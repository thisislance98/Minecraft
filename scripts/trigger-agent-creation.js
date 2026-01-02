
import puppeteer from 'puppeteer';

async function triggerAgentCreation() {
    console.log('🚀 Launching Agent Creation Trigger (Debug Mode)...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[AntigravityClient]')) {
                console.log(`[CLIENT-LOG] ${text}`);
            } else if (text.includes('Error')) {
                console.log(`[BROWSER-ERR] ${text}`);
            }
        });

        console.log('🔗 Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('⏳ Waiting for AntigravityClient...');

        // Poll for client status
        try {
            await page.waitForFunction(() => {
                const client = window.antigravityClient;
                if (!client) return false;
                if (!client.ws) return false;
                return client.ws.readyState === 1; // OPEN
            }, { timeout: 15000, polling: 500 });
            console.log('✅ Agent Connected!');
        } catch (e) {
            console.error('❌ Timeout waiting for agent connection.');
            // Debug state
            const state = await page.evaluate(() => {
                const c = window.antigravityClient;
                return {
                    exists: !!c,
                    wsExists: !!c?.ws,
                    readyState: c?.ws?.readyState,
                    url: c?.ws?.url
                };
            });
            console.log('DEBUG STATE:', state);
        }

        // Even if timeout, try to send message if client exists (might be glitch in readyState check)
        console.log('💬 Attempting to send prompt...');
        await page.evaluate(() => {
            if (window.antigravityClient && window.antigravityClient.ws && window.antigravityClient.ws.readyState === 1) {
                // We use send() directly or via game.agent if available.
                // Looking at AntigravityClient.js, it has handleInput method? No, only send().
                // The Session on server handles input.
                // We need to send { type: 'input', text: ... }

                window.antigravityClient.send({
                    type: 'input',
                    text: "Spawn a Pig and update its color to gold."
                });
                console.log("Message sent via antigravityClient.send()");
            } else {
                console.error("Client not ready, cannot send.");
            }
        });

        // Wait for response log
        console.log('⏳ Monitor logs for 15s...');
        await new Promise(r => setTimeout(r, 15000));

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    } finally {
        await browser.close();
    }
}

triggerAgentCreation();
