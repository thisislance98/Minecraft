import { GameBrowser } from './browser.js';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

/**
 * Manages multiple GameBrowser sessions for the Driver
 */
export class SessionManager {
    constructor() {
        this.sessions = new Map(); // id -> { browser: GameBrowser, config: options }
    }

    /**
     * Start a new browser session
     */
    async startSession(options = {}) {
        const id = options.id || `session_${uuidv4().substring(0, 8)}`;
        console.log(chalk.blue(`[SessionManager] Starting session: ${id}`));

        if (this.sessions.has(id)) {
            throw new Error(`Session ${id} already exists`);
        }

        const browser = new GameBrowser({
            headless: options.headless ?? true,
            gameUrl: options.gameUrl || 'http://localhost:3000',
            quiet: options.quiet ?? false
        });

        await browser.launch();
        await browser.waitForGameLoad();

        this.sessions.set(id, { browser, config: options });
        console.log(chalk.green(`  ✓ Session ${id} ready`));

        return id;
    }

    /**
     * Get a session by ID
     */
    getSession(id) {
        const session = this.sessions.get(id);
        if (!session) {
            throw new Error(`Session ${id} not found`);
        }
        return session.browser;
    }

    /**
     * Stop a specific session
     */
    async stopSession(id) {
        const session = this.sessions.get(id);
        if (session) {
            console.log(chalk.dim(`[SessionManager] Stopping session: ${id}`));
            await session.browser.close();
            this.sessions.delete(id);
            return true;
        }
        return false;
    }

    /**
     * Stop all sessions
     */
    async stopAll() {
        console.log(chalk.dim('[SessionManager] Stopping all sessions...'));
        for (const [id, session] of this.sessions) {
            await session.browser.close();
        }
        this.sessions.clear();
    }

    /**
     * Get active session IDs
     */
    getActiveSessions() {
        return Array.from(this.sessions.keys());
    }
}
