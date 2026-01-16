
const GameTest = require('../src/GameTest');
const assert = require('assert');

class VerifyMerlinVoiceUI extends GameTest {
    async run() {
        // Wait for game to load
        await this.page.waitForSelector('#chat-panel', { timeout: 30000 });

        console.log('Checking for Merlin Voice Button...');

        // Check if chat panel exists
        const chatPanel = await this.page.$('#chat-panel');
        assert(chatPanel, 'Chat Panel should exist');

        // Check for the voice button inside the chat input container
        // We need to wait a bit because UIManager might initialize async or after some frame
        await this.page.waitForTimeout(1000);

        const micBtnSelector = '#voice-mic-btn';
        const micBtn = await this.page.$(micBtnSelector);

        if (micBtn) {
            console.log('✅ Merlin Voice Button found!');

            // Check if it is inside the correct container
            const containerSelector = '#chat-panel .chat-input-container';
            const containerCallback = await this.page.evaluate((sel, btnSel) => {
                const container = document.querySelector(sel);
                const btn = document.querySelector(btnSel);
                return container && container.contains(btn);
            }, containerSelector, micBtnSelector);

            assert(containerCallback, 'Merlin Voice Button should be inside .chat-input-container');
            console.log('✅ Button is correctly positioned in the container.');

        } else {
            console.error('❌ Merlin Voice Button NOT found!');
            // Log the HTML of the container to debug
            const containerHtml = await this.page.evaluate(() => {
                const c = document.querySelector('#chat-panel .chat-input-container');
                return c ? c.innerHTML : 'Container not found';
            });
            console.log('Container HTML:', containerHtml);
            throw new Error('Merlin Voice Button not found in DOM');
        }
    }
}

module.exports = VerifyMerlinVoiceUI;
