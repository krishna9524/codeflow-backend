const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

const safeUnlink = (filePath, retries = 5, delay = 100) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return;
    }
    fs.unlink(filePath, (err) => {
        if (err && err.code === 'EPERM' && retries > 0) {
            console.warn(`EPERM error deleting ${path.basename(filePath)}. Retrying...`);
            setTimeout(() => safeUnlink(filePath, retries - 1, delay), delay);
        } else if (err) {
            console.error(`Failed to delete file ${path.basename(filePath)}:`, err);
        }
    });
};

function handlePlaygroundConnection(ws) {
    let childProcess = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'run') {
                if (childProcess) childProcess.kill();
                runCode(data.code, data.language, ws);
            } else if (data.type === 'stdin') {
                if (childProcess && !childProcess.killed) {
                    childProcess.stdin.write(data.data);
                }
            }
        } catch (e) {
            console.error("Failed to process WebSocket message:", e);
        }
    });

    ws.on('close', () => {
        if (childProcess) {
            // Use the same robust kill logic on disconnect
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', childProcess.pid, '/f', '/t']);
            } else {
                process.kill(-childProcess.pid, 'SIGKILL');
            }
        }
        console.log('Client disconnected from playground');
    });

    function runCode(code, language, ws) {
        const uniqueId = uuidv4();
        let sourcePath, execPath;
        const send = (type, data) => {
            try {
                ws.send(JSON.stringify({ type, data }));
            } catch (e) {
                console.error("Failed to send WebSocket message:", e);
            }
        };

        const cleanup = () => {
            safeUnlink(sourcePath);
            safeUnlink(execPath);
        };

        const execute = (command, args = []) => {
            try {
                // UPDATED: Spawn the process in its own group to kill the entire tree
                const spawnOptions = { 
                    cwd: TEMP_DIR,
                    // On non-Windows, create a detached process group
                    detached: process.platform !== 'win32' 
                };
                childProcess = spawn(command, args, spawnOptions);
            } catch(e) {
                send('stderr', `Failed to execute command: ${command}. Is it installed?\nError: ${e.message}`);
                send('exit', `\n[CodeFlow] Process failed to start.\n`);
                cleanup();
                return;
            }
            
            childProcess.stdout.setEncoding('utf8');
            childProcess.stderr.setEncoding('utf8');

            // UPDATED: Timeout increased to 60 seconds
            const timeout = setTimeout(() => {
                if (childProcess && !childProcess.killed) {
                    send('stderr', '\n\n[CodeFlow] Error: Time Limit Exceeded (60 seconds)\n');
                    
                    // UPDATED: Use a more robust, cross-platform kill command
                    if (process.platform === 'win32') {
                        // On Windows, use taskkill to terminate the process tree
                        spawn('taskkill', ['/pid', childProcess.pid, '/f', '/t']);
                    } else {
                        // On Linux/macOS, kill the entire process group by negating the PID
                        process.kill(-childProcess.pid, 'SIGKILL');
                    }
                }
            }, 60000); // 60 seconds

            childProcess.stdout.on('data', (data) => send('stdout', data));
            childProcess.stderr.on('data', (data) => send('stderr', data));
            childProcess.on('close', (code) => {
                clearTimeout(timeout);
                send('exit', `\n[CodeFlow] Process exited with code ${code}\n`);
                cleanup();
                childProcess = null;
            });
            childProcess.on('error', (err) => {
                clearTimeout(timeout);
                send('stderr', `\n[CodeFlow] Process error: ${err.message}\n`);
                cleanup();
                childProcess = null;
            });
        };

        // ... (The 'try/switch' block for languages remains unchanged)
        try {
            switch (language) {
                case 'python':
                    sourcePath = path.join(TEMP_DIR, `${uniqueId}.py`);
                    fs.writeFileSync(sourcePath, code);
                    execute('python3', ['-u', sourcePath]);
                    break;
                
                case 'cpp':
                    sourcePath = path.join(TEMP_DIR, `${uniqueId}.cpp`);
                    execPath = path.join(TEMP_DIR, process.platform === 'win32' ? `${uniqueId}.exe` : uniqueId);
                    fs.writeFileSync(sourcePath, code);
                    const compileCpp = spawn('g++', [sourcePath, '-o', execPath]);
                    compileCpp.stderr.on('data', (data) => send('stderr', data.toString()));
                    compileCpp.on('close', (code) => {
                        if (code !== 0) {
                            send('exit', '\n[CodeFlow] Compilation failed.\n');
                            cleanup();
                        } else {
                            execute(execPath);
                        }
                    });
                    break;

                case 'java':
                    const classNameMatch = code.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);
                    if (!classNameMatch) {
                        send('stderr', '[CodeFlow] Error: Could not find a class definition.\n');
                        send('exit', '');
                        return;
                    }
                    const className = classNameMatch[1];
                    sourcePath = path.join(TEMP_DIR, `${className}.java`);
                    fs.writeFileSync(sourcePath, code);
                    
                    const compileJava = spawn('javac', [sourcePath], { cwd: TEMP_DIR });
                    compileJava.stderr.on('data', (data) => send('stderr', data.toString()));
                    compileJava.on('close', (code) => {
                        if (code !== 0) {
                            send('exit', '\n[CodeFlow] Compilation failed.\n');
                            cleanup();
                        } else {
                            execPath = path.join(TEMP_DIR, `${className}.class`);
                            execute('java', [className]);
                        }
                    });
                    break;

                default:
                    send('stderr', `Unsupported language: ${language}`);
                    send('exit', '');
            }
        } catch (error) {
            send('stderr', `An internal server error occurred: ${error.message}`);
            send('exit', '');
            cleanup();
        }
    }
}

module.exports = { handlePlaygroundConnection };