const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

// --- Configuration ---
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const JAVA_LIB_PATH = process.env.JAVA_LIB_PATH || 'C:/libs/json-20250517.jar';
const MSYS_PATH = process.env.MSYS_PATH || 'C:/msys64/mingw64';

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// --- Helper Functions ---

const normalizeLanguage = (lang) => {
    const aliases = {
        python: 'python', python3: 'python', py: 'python',
        java: 'java',
        c: 'cpp', 'c++': 'cpp', cpp: 'cpp',
    };
    return aliases[lang.toLowerCase().trim()] || lang.toLowerCase().trim();
};

const combineCode = (driverCode, userCode) => {
    const placeholderRegex = /^(\s*([#\/]{2,})\s*USER_CODE_HERE\s*)/m;
    const safeUserCode = userCode || '';
    if (placeholderRegex.test(driverCode)) {
        return driverCode.replace(placeholderRegex, safeUserCode + '\n');
    }
    return safeUserCode + '\n\n' + driverCode;
};

const compareOutputs = (userOutput, expectedOutput) => {
    const trimmedUserOutput = userOutput.trim();
    const expectedOutputString = JSON.stringify(expectedOutput);

    try {
        const parsedUserOutput = JSON.parse(trimmedUserOutput);
        const canonicalUserOutputString = JSON.stringify(parsedUserOutput);
        return canonicalUserOutputString === expectedOutputString;
    } catch (e) {
        return trimmedUserOutput === expectedOutputString.replace(/"/g, '');
    }
};

const cleanupDirectory = (dirPath) => {
    if (dirPath && fs.existsSync(dirPath)) {
        fs.rm(dirPath, { recursive: true, force: true }, (err) => {
            if (err) console.error(`Failed to cleanup temp directory: ${dirPath}`, err);
        });
    }
};

// --- FIX #1: Re-introduce the memory measurement function ---
const getMemoryUsage = (pid, callback) => {
    const isWin = process.platform === 'win32';

    // On Windows, use the more reliable 'wmic' command.
    // On Linux/macOS, 'ps' is standard and works perfectly.
    const command = isWin
        ? `wmic process where processid=${pid} get WorkingSetSize /value`
        : `ps -p ${pid} -o rss=`;

    exec(command, (err, stdout, stderr) => {
        // --- Improved error logging to help debug in the future ---
        if (err || stderr || !stdout) {
            if (err && err.message.includes('No Instance(s) Available')) {
                // This is expected if the process is too fast, so don't log it as an error.
            } else if (err || stderr) {
                console.error(`[MemoryUsage] Error polling PID ${pid}:`, err || stderr);
            }
            return callback(0);
        }
        
        let mem = 0;
        try {
            if (isWin) {
                // WMIC output is like "WorkingSetSize=123456". It's in BYTES.
                const match = stdout.trim().split('=');
                if (match.length === 2) {
                    const memInBytes = parseInt(match[1], 10);
                    mem = Math.ceil(memInBytes / 1024); // Convert bytes to KB
                }
            } else {
                // ps output is already in KB.
                mem = Math.ceil(parseInt(stdout.trim(), 10));
            }
        } catch {
            mem = 0; // Default to 0 if parsing fails
        }

        callback(isNaN(mem) ? 0 : mem);
    });
};

// --- Core Execution Logic ---

const compileCode = (fullCode, language) => {
    return new Promise((resolve) => {
        const uniqueId = uuidv4();
        const tempDir = path.join(TEMP_DIR, uniqueId);
        fs.mkdirSync(tempDir, { recursive: true });
        
        if (language === 'cpp') {
            const sourcePath = path.join(tempDir, `main.cpp`);
            const exePath = path.join(tempDir, 'main.exe');
            fs.writeFileSync(sourcePath, fullCode, 'utf8');

            const compileArgs = [ sourcePath, '-o', exePath, '-std=c++17', `-I${path.join(MSYS_PATH, 'include')}`, `-L${path.join(MSYS_PATH, 'lib')}`, '-ljsoncpp' ];
            const compile = spawn('g++', compileArgs);
            
            let compileError = '';
            compile.stderr.on('data', data => compileError += data.toString());
            
            compile.on('close', code => {
                if (code !== 0) {
                    cleanupDirectory(tempDir);
                    resolve({ status: 'Compilation Error', error: compileError });
                } else {
                    resolve({ status: 'Compiled', tempDir, executablePath: exePath, language });
                }
            });
            compile.on('error', err => {
                cleanupDirectory(tempDir);
                resolve({ status: 'Compilation Error', error: err.message });
            });
        } else if (language === 'java') {
            const classNameMatch = fullCode.match(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);
            const className = classNameMatch ? classNameMatch[1] : 'Main';
            const sourcePath = path.join(tempDir, `${className}.java`);
            fs.writeFileSync(sourcePath, fullCode);

            const compile = spawn('javac', ['-cp', JAVA_LIB_PATH, sourcePath]);
            let compileError = '';
            compile.stderr.on('data', data => compileError += data.toString());

            compile.on('close', (code) => {
                if (code !== 0) {
                    cleanupDirectory(tempDir);
                    resolve({ status: 'Compilation Error', error: compileError });
                } else {
                    resolve({ status: 'Compiled', tempDir, executablePath: null, language, className });
                }
            });
            compile.on('error', err => {
                cleanupDirectory(tempDir);
                resolve({ status: 'Compilation Error', error: err.message });
            });
        } else if (language === 'python') {
            const sourcePath = path.join(tempDir, `main.py`);
            fs.writeFileSync(sourcePath, fullCode, 'utf8');
            resolve({ status: 'Compiled', tempDir, executablePath: sourcePath, language });
        } else {
            cleanupDirectory(tempDir);
            resolve({ status: 'Error', error: 'Language not supported.' });
        }
    });
};

const runExecutable = ({ tempDir, executablePath, language, className }, input) => {
    return new Promise((resolve) => {
        const inputString = typeof input === 'string' ? input : JSON.stringify(input);
        let command, args = [];

        if (language === 'cpp') {
            command = executablePath;
        } else if (language === 'java') {
            command = 'java';
            const separator = process.platform === 'win32' ? ';' : ':';
            args = ['-cp', `${tempDir}${separator}${JAVA_LIB_PATH}`, className];
        } else if (language === 'python') {
            command = 'python';
            args = ['-u', executablePath];
        } else {
            resolve({ status: 'Error', output: '', error: 'Language not supported.', runtime: 0, memory: 0 });
            return;
        }

        const startTime = process.hrtime.bigint();
        const child = spawn(command, args, { cwd: tempDir, detached: process.platform !== 'win32' });
        
        let output = '', error = '';
        // --- FIX #2: Re-integrate memory polling logic ---
        let peakMemoryInKb = 0;
        let memoryPoll;

        if (child.pid) {
            memoryPoll = setInterval(() => {
                getMemoryUsage(child.pid, (memKb) => {
                    if (memKb > peakMemoryInKb) {
                        peakMemoryInKb = memKb;
                    }
                });
            }, 150); // Poll every 150ms for peak memory
        }

        const timeout = setTimeout(() => {
            if (memoryPoll) clearInterval(memoryPoll); // Stop polling on timeout
            if (!child.killed) {
                process.platform === 'win32' ? spawn('taskkill', ['/pid', child.pid, '/f', '/t']) : process.kill(-child.pid, 'SIGKILL');
            }
        }, 10000); 

        child.stdin.write(inputString);
        child.stdin.end();

        child.stdout.on('data', data => output += data.toString());
        child.stderr.on('data', data => error += data.toString());

        child.on('close', code => {
            clearTimeout(timeout);
            if (memoryPoll) clearInterval(memoryPoll); // Stop polling when process closes
            const endTime = process.hrtime.bigint();
            const timeInMs = Number((endTime - startTime) / 1000000n);
            
            // --- FIX #3: Pass the measured memory in every result object ---
            if (child.signalCode === 'SIGKILL') {
                resolve({ status: 'Time Limit Exceeded', output, error: 'Process timed out after 10 seconds.', runtime: 10000, memory: peakMemoryInKb });
            } else if (code === 0) {
                resolve({ status: 'Accepted', output, error, runtime: timeInMs, memory: peakMemoryInKb });
            } else {
                resolve({ status: 'Runtime Error', output, error: error || output, runtime: timeInMs, memory: peakMemoryInKb });
            }
        });

        child.on('error', err => {
            clearTimeout(timeout);
            if (memoryPoll) clearInterval(memoryPoll);
            resolve({ status: 'Runtime Error', output: '', error: err.message, runtime: 0, memory: 0 });
        });
    });
};

// --- Helper for "Run Code" button ---
const executeCodeOnce = async (fullCode, language, input) => {
    const normalizedLang = normalizeLanguage(language);
    const compileResult = await compileCode(fullCode, normalizedLang);

    if (compileResult.status !== 'Compiled') {
        return { 
            status: compileResult.status, 
            output: '', 
            error: compileResult.error,
            runtime: 0,
            memory: 0
        };
    }
    const runResult = await runExecutable(compileResult, input);
    cleanupDirectory(compileResult.tempDir);
    return runResult;
};

// --- Submission Processing ---
// (No changes needed here, as it correctly uses the 'memory' field from runExecutable)
const processSubmission = async (submission, question, userCode, language) => {
    const BATCH_SIZE = 4;
    const normalizedLang = normalizeLanguage(language);
    const driverCode = question[`driver_${normalizedLang}`];
    const fullCode = combineCode(driverCode, userCode);
    
    const compileResult = await compileCode(fullCode, normalizedLang);

    if (compileResult.status !== 'Compiled') {
        submission.status = compileResult.status;
        submission.output = compileResult.error;
        await submission.save();
        return; 
    }

    const { tempDir } = compileResult;
    let passedCount = 0;
    let maxRuntime = 0;
    let maxMemory = 0;

    try {
        for (let i = 0; i < question.hiddenTestCases.length; i += BATCH_SIZE) {
            const batch = question.hiddenTestCases.slice(i, i + BATCH_SIZE);
            const promises = batch.map(testCase => 
                runExecutable(compileResult, testCase.input)
                    .then(result => ({ ...result, testCase }))
            );
            const batchResults = await Promise.all(promises);

            for (const result of batchResults) {
                if (result.runtime > maxRuntime) maxRuntime = result.runtime;
                if (result.memory > maxMemory) maxMemory = result.memory;

                const isCorrect = compareOutputs(result.output, result.testCase.output);

                if (result.status === 'Accepted' && isCorrect) {
                    passedCount++;
                } else {
                    let failureStatus = 'Wrong Answer';
                    if (result.status !== 'Accepted') failureStatus = result.status;
                    
                    submission.status = failureStatus;
                    submission.output = result.error || result.output;
                    submission.failedCase = {
                        input: result.testCase.input,
                        expected: result.testCase.output,
                        output: result.output.trim(),
                    };
                    submission.passedCases = passedCount;
                    submission.runtimeInMs = maxRuntime;
                    submission.memoryInKb = maxMemory;
                    await submission.save();
                    return;
                }
            }
        }

        submission.status = 'Accepted';
        submission.passedCases = passedCount;
        submission.runtimeInMs = maxRuntime;
        submission.memoryInKb = maxMemory;
        await submission.save();
        
        await User.findByIdAndUpdate(submission.userId, {
            $addToSet: { solvedProblems: submission.questionId },
        });

    } catch (error) {
        console.error("Error during submission processing:", error);
        submission.status = 'System Error';
        submission.output = `An unexpected error occurred: ${error.message}`;
        await submission.save();
    } finally {
        cleanupDirectory(tempDir);
    }
};

module.exports = {
    normalizeLanguage,
    combineCode,
    compareOutputs,
    compileCode,
    runExecutable,
    executeCodeOnce,
    processSubmission
};