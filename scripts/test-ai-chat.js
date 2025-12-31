
import puppeteer from 'puppeteer';

async function testAiChat() {
    console.log('🚀 Launching AI Chat Test...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Forward console logs
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.message}`));

        console.log('🔗 Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for game to initialize
        console.log('⏳ Waiting for game initialization...');
        await page.waitForFunction(() => window.__VOXEL_GAME__ && window.__VOXEL_GAME__.agent && window.__VOXEL_GAME__.agent.ws.readyState === 1, { timeout: 10000 });
        console.log('✅ Game and Agent connected.');

        // Hook into UIManager to capture chat
        await page.evaluate(() => {
            const originalAdd = window.__VOXEL_GAME__.uiManager.addChatMessage.bind(window.__VOXEL_GAME__.uiManager);
            window.__VOXEL_GAME__.uiManager.addChatMessage = (type, text) => {
                console.log(`[CHAT LOG] [${type}] ${text}`);
                return originalAdd(type, text);
            };

            // Remove updateChatMessageContent hook to avoid interference, or just log
            const originalUpdate = window.__VOXEL_GAME__.uiManager.updateChatMessageContent.bind(window.__VOXEL_GAME__.uiManager);
            window.__VOXEL_GAME__.uiManager.updateChatMessageContent = (id, text) => {
                console.log(`[CHAT STREAM] (${id}) ${text}`);
                return originalUpdate(id, text);
            };
        });

        // Send multi-tool prompt covering ALL tools: write, list, replace, spawn, get_scene, teleport
        console.log('💬 Sending comprehensive multi-tool prompt to AI...');
        await page.evaluate(() => {
            window.__VOXEL_GAME__.agent.sendTextMessage("Create 'full_test.txt' with 'Step 1', then list_dir to confirm, then replace 'Step 1' with 'Step 2' in that file, then spawn a Pig at 10,60,10, and finally teleport me to 10,65,10 to see it.");
        });

        // Wait for response
        console.log('⏳ Waiting for AI response...');

        // Evaluate until we see an AI message
        const responseFound = await page.waitForFunction(() => {
            const chatContainer = window.__VOXEL_GAME__.uiManager.chatMessages;
            if (!chatContainer) return false;

            const msgs = Array.from(chatContainer.children);
            const last = msgs[msgs.length - 1];
            // Format check: "Sender: Message"
            return last && last.textContent.includes('ai:') && last.textContent.split('ai:')[1].trim().length > 0;
        }, { timeout: 10000 }).catch(() => false);

        if (responseFound) {
            const lastMsgText = await page.evaluate(() => {
                const chatContainer = window.__VOXEL_GAME__.uiManager.chatMessages;
                return chatContainer.lastElementChild.textContent;
            });
            console.log('✅ AI Responded:', lastMsgText);
            console.log('✅ TEST PASSED');
        } else {
            console.error('❌ AI did not respond or response was empty.');

            // Debug: Print all messages
            const allMsgs = await page.evaluate(() => {
                const chatContainer = window.__VOXEL_GAME__.uiManager.chatMessages;
                if (!chatContainer) return 'No Chat Container';
                return Array.from(chatContainer.children).map(c => c.textContent);
            });
            console.log('Chat History:', allMsgs);
            console.log('❌ TEST FAILED');
        }

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    } finally {
        await browser.close();
    }
}

testAiChat();
