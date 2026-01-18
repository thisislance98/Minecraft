import { MultiBrowserRunner } from '../src/multi-browser.js';
import chalk from 'chalk';

async function runVoiceChatTest() {
    console.log(chalk.blue('Starting Voice Chat Verification...'));

    const runner = new MultiBrowserRunner({
        browserCount: 2,
        headless: false
    });

    try {
        await runner.launchAll();

        // Wait for world to load
        await new Promise(r => setTimeout(r, 3000));

        // Enable voice chat on Browser 1
        console.log(chalk.yellow('Browser 1: Enabling voice chat...'));
        const browser1Result = await runner.browsers[0].evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.socketManager) {
                return { error: 'Game or SocketManager not ready' };
            }

            // Enable voice chat
            localStorage.setItem('settings_voice', 'true');
            game.socketManager.voiceEnabled = true;

            // For testing, we don't actually initialize PeerJS (would require mic permissions)
            // Instead, we verify the state machine is correct
            return {
                voiceEnabled: game.socketManager.voiceEnabled,
                socketId: game.socketManager.socketId,
                roomId: game.socketManager.roomId,
                playerMeshesSize: game.socketManager.playerMeshes?.size ?? 0,
                pendingPeerIdsSize: game.socketManager.pendingPeerIds?.size ?? 0
            };
        });
        console.log('Browser 1 state:', browser1Result);

        // Enable voice chat on Browser 2
        console.log(chalk.yellow('Browser 2: Enabling voice chat...'));
        const browser2Result = await runner.browsers[1].evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.socketManager) {
                return { error: 'Game or SocketManager not ready' };
            }

            // Enable voice chat
            localStorage.setItem('settings_voice', 'true');
            game.socketManager.voiceEnabled = true;

            return {
                voiceEnabled: game.socketManager.voiceEnabled,
                socketId: game.socketManager.socketId,
                roomId: game.socketManager.roomId,
                playerMeshesSize: game.socketManager.playerMeshes?.size ?? 0,
                pendingPeerIdsSize: game.socketManager.pendingPeerIds?.size ?? 0
            };
        });
        console.log('Browser 2 state:', browser2Result);

        // Verify both browsers are in the same room
        if (browser1Result.roomId && browser2Result.roomId) {
            if (browser1Result.roomId === browser2Result.roomId) {
                console.log(chalk.green('✓ Both browsers are in the same room:', browser1Result.roomId));
            } else {
                console.log(chalk.red('✗ Browsers are in different rooms!'));
                console.log('  Browser 1:', browser1Result.roomId);
                console.log('  Browser 2:', browser2Result.roomId);
            }
        }

        // Verify each browser can see the other player
        if (browser1Result.playerMeshesSize >= 1) {
            console.log(chalk.green('✓ Browser 1 can see other player(s):', browser1Result.playerMeshesSize));
        } else {
            console.log(chalk.red('✗ Browser 1 cannot see other players'));
        }

        if (browser2Result.playerMeshesSize >= 1) {
            console.log(chalk.green('✓ Browser 2 can see other player(s):', browser2Result.playerMeshesSize));
        } else {
            console.log(chalk.red('✗ Browser 2 cannot see other players'));
        }

        // Test /voicedebug command on Browser 1
        console.log(chalk.yellow('\nTesting /voicedebug command on Browser 1...'));
        const debugResult = await runner.browsers[0].evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.uiManager) {
                return { error: 'UIManager not ready' };
            }

            // Open chat and send the debug command
            game.uiManager.toggleChatPanel(true);
            game.uiManager.setChatMode('ai');

            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.value = '/voicedebug';
                game.uiManager.handleSendMessage();
                return { success: true, message: 'Debug command sent' };
            }
            return { error: 'Chat input not found' };
        });
        console.log('Debug command result:', debugResult);

        // Wait a moment and check console logs
        await new Promise(r => setTimeout(r, 1000));

        // Get the voice debug output from chat
        const chatMessages = await runner.browsers[0].evaluate(() => {
            const chatContainer = document.getElementById('chat-messages-ai');
            if (chatContainer) {
                const messages = chatContainer.querySelectorAll('.message');
                return Array.from(messages).slice(-3).map(m => m.textContent);
            }
            return [];
        });
        console.log('Recent chat messages:', chatMessages);

        console.log(chalk.green('\n✓ Voice chat test completed'));
        console.log(chalk.blue('\nNote: Full voice chat testing requires microphone permissions'));
        console.log(chalk.blue('which cannot be automated. Please test manually:'));
        console.log(chalk.blue('1. Open two browser windows to the game'));
        console.log(chalk.blue('2. Enable voice chat in settings on both'));
        console.log(chalk.blue('3. Hold V to talk and verify audio is transmitted'));

    } catch (error) {
        console.error(chalk.red('Test failed:'), error);
    } finally {
        await runner.closeAll();
    }
}

runVoiceChatTest();
