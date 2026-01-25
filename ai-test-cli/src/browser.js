import puppeteer from 'puppeteer';
import { ensureServerRunning } from './server-check.js';

/**
 * Browser automation for running game client during CLI tests
 */
export class GameBrowser {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        // Support custom URL (e.g., with world parameter) or default
        // Append ?cli=true to bypass authentication on server
        const baseUrl = options.url || options.gameUrl || 'http://localhost:3000';
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
     * Start screen recording using CDP
     * @param {string} path - Path to save the recording
     */
    async startRecording(path = 'recording.webm') {
        if (this.recordingPath) {
            console.log('  ⚠️ Recording already in progress');
            return;
        }

        this.recordingPath = path;
        this.recordingFrames = [];

        // Use CDP to enable screencast
        const client = await this.page.target().createCDPSession();
        this.cdpClient = client;

        await client.send('Page.startScreencast', {
            format: 'png',
            quality: 80,
            maxWidth: 1280,
            maxHeight: 720,
            everyNthFrame: 2 // Every 2nd frame for ~30fps
        });

        client.on('Page.screencastFrame', async (frame) => {
            this.recordingFrames.push(frame.data);
            await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
        });

        console.log(`  🎬 Recording started: ${path}`);
    }

    /**
     * Stop recording and save to file
     * Note: This saves individual PNG frames. For a proper video,
     * you'd need to use ffmpeg to combine them.
     */
    async stopRecording() {
        if (!this.cdpClient) {
            console.log('  ⚠️ No recording in progress');
            return null;
        }

        await this.cdpClient.send('Page.stopScreencast');

        const frameCount = this.recordingFrames.length;
        console.log(`  🎬 Recording stopped: ${frameCount} frames captured`);

        // Save frames as individual PNGs in a folder
        const fs = await import('fs');
        const path = await import('path');

        const basePath = this.recordingPath.replace(/\.\w+$/, '');
        const framesDir = `${basePath}_frames`;

        // Create frames directory
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }

        // Save each frame
        for (let i = 0; i < this.recordingFrames.length; i++) {
            const framePath = path.join(framesDir, `frame_${i.toString().padStart(5, '0')}.png`);
            fs.writeFileSync(framePath, Buffer.from(this.recordingFrames[i], 'base64'));
        }

        console.log(`  📁 Frames saved to: ${framesDir}/`);
        console.log(`  💡 To create video: ffmpeg -framerate 15 -i ${framesDir}/frame_%05d.png -c:v libx264 -pix_fmt yuv420p ${basePath}.mp4`);

        // Cleanup
        this.recordingPath = null;
        this.recordingFrames = [];
        this.cdpClient = null;

        return framesDir;
    }

    /**
     * Close the browser
     */
    async close() {
        if (this.cdpClient) {
            try {
                await this.cdpClient.send('Page.stopScreencast');
            } catch (e) {
                // Ignore
            }
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('  ✓ Browser closed');
        }
    }
}
