import { spawn, execSync } from 'child_process';
import chalk from 'chalk';

const SERVER_URL = 'http://localhost:3000';
const PROJECT_ROOT = '/Users/I850333/projects/experiments/Minecraft';

/**
 * Check if server is running by attempting to connect
 */
export async function isServerRunning() {
    try {
        const response = await fetch(SERVER_URL, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        return response.ok || response.status < 500;
    } catch {
        return false;
    }
}

/**
 * Start the server if not already running
 * @returns {Promise<boolean>} true if server is now running
 */
export async function ensureServerRunning() {
    if (await isServerRunning()) {
        console.log(chalk.green('✓ Server already running'));
        return true;
    }

    console.log(chalk.yellow('⚠ Server not running. Starting...'));

    // Start the server in background
    const serverProcess = spawn('bash', ['./start.sh'], {
        cwd: PROJECT_ROOT,
        detached: true,
        stdio: 'ignore'
    });
    serverProcess.unref();

    // Wait for server to become available
    const maxWait = 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
        await new Promise(r => setTimeout(r, 1000));
        if (await isServerRunning()) {
            console.log(chalk.green('✓ Server started successfully'));
            return true;
        }
        process.stdout.write('.');
    }

    console.log(chalk.red('\n✗ Server failed to start within timeout'));
    return false;
}
