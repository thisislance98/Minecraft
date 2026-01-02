const chokidar = require('chokidar');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.resolve(__dirname, '..');
const LOCK_FILE = path.join(SERVER_DIR, '.ai_lock');
const WATCH_GLOBS = [
    path.join(SERVER_DIR, '**/*.ts'),
    path.join(SERVER_DIR, '**/*.js'),
    path.join(SERVER_DIR, '**/*.json'),
    path.join(SERVER_DIR, '.env')
];

const IGNORED = [
    '**/node_modules/**',
    '**/dist/**',
    '**/scripts/**',
    '**/.ai_lock',
    '**/server.log'
];

let serverProcess = null;
let restartPending = false;
let isRestarting = false;

console.log('[SmartWatch] Starting custom watcher...');
console.log('[SmartWatch] Watching:', SERVER_DIR);

function startServer() {
    if (serverProcess) {
        serverProcess.kill();
    }

    console.log('[SmartWatch] Starting server process...');

    // Using ts-node directly since we handle the watching
    serverProcess = spawn('npx', ['ts-node', '--transpile-only', 'index.ts'], {
        cwd: SERVER_DIR,
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: true }
    });

    serverProcess.on('error', (err) => {
        console.error('[SmartWatch] Server process error:', err);
    });
}

function tryRestart(reason) {
    if (isRestarting) return;

    if (fs.existsSync(LOCK_FILE)) {
        if (!restartPending) {
            console.log(`[SmartWatch] 🔒 Update detected (${reason}), but AI is active. Restart queued.`);
            restartPending = true;
        }
        return;
    }

    console.log(`[SmartWatch] 🔄 Restarting due to: ${reason}`);
    isRestarting = true;
    startServer();
    restartPending = false;

    // Debounce reset
    setTimeout(() => {
        isRestarting = false;
    }, 1000);
}

// Clean up stale lock on start
if (fs.existsSync(LOCK_FILE)) {
    try {
        fs.unlinkSync(LOCK_FILE);
        console.log('[SmartWatch] Removed stale lock file.');
    } catch (e) {
        console.error('[SmartWatch] Failed to remove stale lock file:', e);
    }
}

// Initialize Watcher
const watcher = chokidar.watch(WATCH_GLOBS, {
    ignored: IGNORED,
    ignoreInitial: true,
    persistent: true
});

watcher
    .on('add', path => tryRestart(`File added: ${path}`))
    .on('change', path => {
        // Double check it's not the lock file (though ignored)
        if (path.endsWith('.ai_lock')) return;
        tryRestart(`File changed: ${path}`);
    })
    .on('unlink', path => {
        if (path.endsWith('.ai_lock')) {
            console.log('[SmartWatch] 🔓 Lock released.');
            if (restartPending) {
                console.log('[SmartWatch] Executing queued restart...');
                tryRestart('Lock released');
            }
        } else {
            tryRestart(`File removed: ${path}`);
        }
    });

// Separate watcher just for the lock file itself if chokidar ignores it
// ignoring it in the main watcher prevents infinite loops if we were writing it,
// but we want to know when it is DELETED.
fs.watch(SERVER_DIR, (eventType, filename) => {
    if (filename === '.ai_lock' && eventType === 'rename') {
        if (!fs.existsSync(LOCK_FILE) && restartPending) {
            console.log('[SmartWatch] 🔓 Lock file removed (detected viafs.watch).');
            tryRestart('Lock released');
        }
    }
});

// Initial Start
startServer();
