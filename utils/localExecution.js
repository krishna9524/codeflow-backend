const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Directories
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const JAVA_LIB_PATH = 'C:/libs/json-20240303.jar'; // exact .jar path

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const safeUnlink = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete temp file: ${filePath}`, err);
        });
    }
};

// --- FIX: Function to get memory usage of a process by PID ---
const getMemoryUsage = (pid, callback) => {
    const isWin = process.platform === 'win32';
    const command = isWin 
        ? `tasklist /fi "PID eq ${pid}" /fo csv /nh` 
        : `ps -p ${pid} -o rss=`;

    exec(command, (err, stdout, stderr) => {
        if (err || stderr) {
            return callback(0); // Return 0 if we can't get memory
        }
        if (isWin) {
            const parts = stdout.trim().split(',');
            const mem = parts[parts.length - 1].replace(/"/g, '').replace(' K', '').trim();
            callback(parseInt(mem, 10));
        } else {
            callback(Math.ceil(parseInt(stdout.trim(), 10))); // ps returns KB
        }
    });
};

const executeLocally = (fullCode, language, input) => {
    return new Promise((resolve, reject) => {
        const uniqueId = uuidv4();
        let sourcePath, execPath;

        const run = (command, args = [], options = {}) => {
            const startTime = process.hrtime.bigint();
            const child = spawn(command, args, {
                cwd: TEMP_DIR,
                shell: process.platform === 'win32',
                ...options,
            });

            let output = '', error = '';
            let peakMemoryInKb = 0;
            let memoryPoll;

            // --- FIX: Start polling for memory usage ---
            if (child.pid) {
                memoryPoll = setInterval(() => {
                    getMemoryUsage(child.pid, (memKb) => {
                        if (memKb > peakMemoryInKb) {
                            peakMemoryInKb = memKb;
                        }
                    });
                }, 150); // Poll every 150ms
            }

            const timeout = setTimeout(() => {
                clearInterval(memoryPoll); // Stop polling
                if (!child.killed) {
                    process.platform === 'win32'
                        ? spawn('taskkill', ['/pid', child.pid, '/f', '/t'])
                        : process.kill(-child.pid, 'SIGKILL');
                    reject({
                        status: 'Time Limit Exceeded',
                        output: 'Execution took too long (10 seconds).',
                        runtime: 10000,
                        memory: peakMemoryInKb,
                    });
                }
            }, 10000);

            if (input) {
                child.stdin.write(input);
                child.stdin.end();
            }

            child.stdout.on('data', (data) => output += data.toString());
            child.stderr.on('data', (data) => error += data.toString());

            child.on('close', (code) => {
                clearTimeout(timeout);
                clearInterval(memoryPoll); // Stop polling
                const endTime = process.hrtime.bigint();
                const timeInMs = Number((endTime - startTime) / 1000000n);

                safeUnlink(sourcePath);
                if (execPath) safeUnlink(execPath);

                if (code === 0 && !error.trim()) {
                    resolve({ status: 'Accepted', output, runtime: timeInMs, memory: peakMemoryInKb });
                } else {
                    reject({ status: 'Runtime Error', output: error || output, runtime: timeInMs, memory: peakMemoryInKb });
                }
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                clearInterval(memoryPoll); // Stop polling
                safeUnlink(sourcePath);
                if (execPath) safeUnlink(execPath);
                reject({ status: 'Execution Error', output: err.message, runtime: 0, memory: 0 });
            });
        };

        if (language === 'cpp') {
            sourcePath = path.join(TEMP_DIR, `${uniqueId}.cpp`);
            execPath = path.join(TEMP_DIR, process.platform === 'win32' ? `${uniqueId}.exe` : uniqueId);
            fs.writeFileSync(sourcePath, fullCode);
            const compileArgs = ['-std=c++17', sourcePath, '-o', execPath];
            const compile = spawn('g++', compileArgs, { shell: true });
            let compileError = '';
            compile.stderr.on('data', (data) => compileError += data.toString());
            compile.on('close', (code) => {
                if (code !== 0) {
                    safeUnlink(sourcePath);
                    reject({ status: 'Compilation Error', output: compileError });
                } else {
                    run(execPath);
                }
            });
        } else if (language === 'java') {
            const classNameMatch = fullCode.match(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);
            const className = classNameMatch ? classNameMatch[1] : 'Main';
            sourcePath = path.join(TEMP_DIR, `${className}.java`);
            fs.writeFileSync(sourcePath, fullCode);
            const compile = spawn('javac', ['-cp', JAVA_LIB_PATH, sourcePath], { shell: true });
            let compileError = '';
            compile.stderr.on('data', (data) => compileError += data.toString());
            compile.on('close', (code) => {
                if (code !== 0) {
                    safeUnlink(sourcePath);
                    reject({ status: 'Compilation Error', output: compileError });
                } else {
                    execPath = path.join(TEMP_DIR, `${className}.class`);
                    run('java', ['-cp', `.;${JAVA_LIB_PATH}`, className]);
                }
            });
        } else if (language === 'python') {
            sourcePath = path.join(TEMP_DIR, `${uniqueId}.py`);
            fs.writeFileSync(sourcePath, fullCode);
            run('python', ['-u', sourcePath]);
        } else {
            reject({ status: 'Error', output: `Language '${language}' not supported.` });
        }
    });
};

module.exports = { executeLocally };