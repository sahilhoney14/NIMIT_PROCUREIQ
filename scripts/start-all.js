/**
 * ProcureIQ Unified Server Runner
 * Starts the ProcureIQ Enterprise Backend Server on Port 3000
 */

const { spawn } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '../backend');

console.log('\x1b[1m\x1b[34m=======================================================');
console.log('       Starting ProcureIQ Enterprise Unified Server');
console.log('=======================================================\x1b[0m\n');

const proc = spawn('node', ['server.js'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: true
});

proc.on('close', code => {
    console.log(`Server process exited with code ${code}`);
});

function shutdown() {
    console.log('\nGracefully shutting down ProcureIQ server...');
    proc.kill();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
