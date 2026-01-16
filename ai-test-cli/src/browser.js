import puppeteer from 'puppeteer';
import { ensureServerRunning } from './server-check.js';

/**
 * Browser automation for running game client during CLI tests
 */
export class GameBrowser {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        // Append ?cli=true to bypass authentication on server
        const baseUrl = options.gameUrl || 'http://localhost:3000';
        this.gameUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'cli=true&secret=asdf123';
        this.headless = options.headless ?? false; // Always headed for visual debugging
        this.quiet = options.quiet ?? false; // Suppress browser logs when true
    }

    /**
     * Launch browser and navigate to game
     */
    async launch() {
        // Ensure server is running before launching browser
        const serverReady = await ensureServerRunning();
        if (!serverReady) {
            throw new Error('Server not available. Please start the server manually.');
        }

        console.log(`🌐 Launching browser (headless: ${this.headless})...`);

        this.browser = await puppeteer.launch({
            headless: this.headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--enable-webgl',
                '--enable-gpu',
                '--ignore-gpu-blocklist',
                '--use-gl=angle',
                '--use-angle=gl'
            ]
        });

        this.page = await this.browser.newPage();

        // Set viewport for consistent rendering
        await this.page.setViewport({ width: 1280, height: 720 });

        // Log console messages from the game
        this.page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();

            // Skip noisy messages
            if (text.includes('THREE.WebGLRenderer')) return;

            // Skip all non-essential logs in quiet mode
            if (this.quiet && type !== 'error') return;

            // Highlight AI-related messages
            const isAIMessage = text.includes('[Agent]') || text.includes('[AI]') ||
                text.includes('Tool:') || text.includes('Thought:') ||
                text.includes('Executing Client Tool');

            if (type === 'error') {
                console.log(`  [Browser Error] ${text}`);
            } else if (type === 'warn') {
                console.log(`  [Browser Warn] ${text}`);
            } else if (isAIMessage) {
                console.log(`  🤖 ${text}`);
            } else if (type === 'log' || type === 'info') {
                console.log(`  [Browser] ${text}`);
            }
        });

        console.log(`  Navigating to ${this.gameUrl}...`);
        await this.page.goto(this.gameUrl, { waitUntil: 'domcontentloaded' });

        return this;
    }

    /**
     * Wait for game to fully load (checks for presence of game canvas or specific element)
     */
    async waitForGameLoad(timeout = 30000) {
        console.log('  Waiting for game to load...');

        try {
            // Wait for the game canvas to appear
            await this.page.waitForSelector('canvas', { timeout });

            // Give Three.js a moment to initialize
            await this.page.waitForFunction(() => {
                // Check if game object exists on window (common pattern)
                return window.game !== undefined || document.querySelector('canvas');
            }, { timeout: 10000 });

            // Small additional delay for WebGL context setup
            await new Promise(r => setTimeout(r, 2000));

            console.log('  ✓ Game loaded');
            return true;
        } catch (e) {
            console.log('  ⚠️ Game load timeout (continuing anyway)');
            return false;
        }
    }

    /**
     * Send a chat prompt to Merlin
     */
    async sendPrompt(prompt) {
        console.log(`  💬 Sending prompt: "${prompt}"`);
        await this.page.evaluate((text) => {
            const game = window.__VOXEL_GAME__;
            const merlinClient = game?.uiManager?.merlinClient || window.merlinClient;

            if (merlinClient && merlinClient.send) {
                // Build context from game state
                const context = {
                    position: game?.player?.position ? {
                        x: game.player.position.x,
                        y: game.player.position.y,
                        z: game.player.position.z
                    } : { x: 0, y: 50, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    biome: 'Plains'
                };

                merlinClient.send({
                    type: 'input',
                    text: text,
                    context: context
                });
                console.log('[Browser] Prompt sent to Merlin');
            } else {
                console.error('[Browser] No Merlin client found or send() not available');
            }
        }, prompt);
    }

    /**
     * Execute JavaScript in the browser context
     */
    async evaluate(fn, ...args) {
        return this.page.evaluate(fn, ...args);
    }

    /**
     * Wait for a function to return true in browser context
     */
    async waitForFunction(fn, options = {}, ...args) {
        return this.page.waitForFunction(fn, options, ...args);
    }

    /**
     * Take a screenshot for debugging
     */
    async screenshot(path = 'screenshot.png') {
        await this.page.screenshot({ path });
        console.log(`  📸 Screenshot saved: ${path}`);
    }

    /**
     * Close the browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('  ✓ Browser closed');
        }
    }
}
