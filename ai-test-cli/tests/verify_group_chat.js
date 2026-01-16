import { MultiBrowserRunner } from '../src/multi-browser.js';
import chalk from 'chalk';

async function runGroupChatTest() {
    console.log(chalk.blue('Starting Group Chat Verification...'));
    // Using 2 browsers, headed mode implicitly (default in MultiBrowserRunner is headless:false unless specified)
    // MultiBrowserRunner default options: browserCount=2, headless=false
    const runner = new MultiBrowserRunner({
        browserCount: 2,
        headless: false // User requested headed mode in global rules ("ALWAYS run the cli in headed mode")
    });

    try {
        await runner.launchAll();

        // Wait a bit for initial sync and world load
        await new Promise(r => setTimeout(r, 2000));

        // Browser 1 sends message
        const browser1 = runner.browsers[0];
        const message1 = "Hello from Browser 1 " + Date.now();

        console.log('Browser 1: Switching to Group Chat and sending message: ' + message1);
        await browser1.evaluate((msg) => {
            const game = window.__VOXEL_GAME__;
            if (game && game.uiManager) {
                game.uiManager.toggleChatPanel(true);
                game.uiManager.setChatMode('group');

                // Force input update
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value = msg;
                    // Trigger input event if needed, but handleSendMessage reads value directly
                    game.uiManager.handleSendMessage();
                } else {
                    throw new Error('Chat input not found');
                }
            } else {
                throw new Error('Game or UIManager not ready');
            }
        }, message1);

        // Browser 2 verification
        const browser2 = runner.browsers[1];
        console.log('Browser 2: verifying message reception...');

        // Polling for message reception
        let received = false;
        let attempts = 0;
        while (!received && attempts < 10) {
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s
            received = await browser2.evaluate((expectedMsg) => {
                const game = window.__VOXEL_GAME__;
                // Ensure we are looking at group chat messages, though they are appended to DOM even if hidden
                const groupParams = document.getElementById('chat-messages-group');
                if (!groupParams) return false;

                // Also check if we should switch to group tab to see it visible? 
                // The verification just checks if it's in the DOM.
                return groupParams.innerText.includes(expectedMsg);
            }, message1);
            attempts++;
            if (!received) console.log(`  Waiting for message... (${attempts}/10)`);
        }

        if (received) {
            console.log(chalk.green('✓ Browser 2 received message from Browser 1'));
        } else {
            console.log(chalk.red('✗ Browser 2 did NOT receive message in time'));

            // Debug info
            const debugInfo = await browser2.evaluate(() => {
                const el = document.getElementById('chat-messages-group');
                return {
                    exists: !!el,
                    content: el ? el.innerText : null,
                    socketConnected: window.__VOXEL_GAME__?.socketManager?.socket?.connected
                };
            });
            console.log('Debug Info Browser 2:', debugInfo);

            throw new Error('Chat sync failed');
        }

        // Browser 2 replies
        const message2 = "Reply from Browser 2 " + Date.now();
        console.log('Browser 2: Sending reply: ' + message2);

        await browser2.evaluate((msg) => {
            const game = window.__VOXEL_GAME__;
            // Ensure chat panel is open and in group mode
            game.uiManager.toggleChatPanel(true);
            game.uiManager.setChatMode('group');

            const chatInput = document.getElementById('chat-input');
            chatInput.value = msg;
            game.uiManager.handleSendMessage();
        }, message2);

        // Browser 1 verification
        console.log('Browser 1: verifying reply reception...');
        let receivedReply = false;
        attempts = 0;

        while (!receivedReply && attempts < 10) {
            await new Promise(r => setTimeout(r, 1000));
            receivedReply = await browser1.evaluate((expectedMsg) => {
                const groupParams = document.getElementById('chat-messages-group');
                return groupParams && groupParams.innerText.includes(expectedMsg);
            }, message2);
            attempts++;
        }

        if (receivedReply) {
            console.log(chalk.green('✓ Browser 1 received reply from Browser 2'));
        } else {
            console.log(chalk.red('✗ Browser 1 did NOT receive reply'));
            throw new Error('Chat sync failed (reply)');
        }

        console.log(chalk.green('\n✅ GROUP CHAT VERIFICATION PASSED!'));

    } catch (e) {
        console.error(chalk.red('Test Failed:'), e);
        throw e;
    } finally {
        // Wait a bit to see the result visually if needed
        await new Promise(r => setTimeout(r, 2000));
        await runner.closeAll();
    }
}

runGroupChatTest();
