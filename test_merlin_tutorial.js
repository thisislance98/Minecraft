import { chromium } from 'playwright';

(async () => {
    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Clear local storage logic simulates a "New User"
    await page.addInitScript(() => {
        localStorage.clear();
        console.log('Local Storage cleared for test.');
    });

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));


    console.log('Navigating to game...');
    // Assuming server is running at localhost:3000 (Vite default)
    // Adjust port if necessary.
    await page.goto('http://localhost:3000/?cli=true');

    console.log('Waiting for game load...');
    await page.waitForTimeout(5000); // Wait for connection

    // Check Chat for Introduction
    // We can't see "hidden" messages, but we can see the RESULTING AI chat message.
    // The AI takes time to generate, so we wait.
    console.log('Waiting for Merlin introduction...');

    // Select the chat container - adjusting selector based on index.html
    // id="chat-messages-ai"
    try {
        await page.waitForSelector('#chat-messages-ai .message.ai', { timeout: 30000 });
        const introText = await page.innerText('#chat-messages-ai .message.ai');
        console.log('Introduction received:', introText);

        if (introText.includes('Merlin') && introText.toLowerCase().includes('wolf')) {
            console.log('SUCCESS: Merlin introduced himself and asked for a wolf.');
        } else {
            console.log('WARNING: Introduction text did not match expected pattern.');
        }

    } catch (e) {
        console.error('FAILED: No introduction message received within timeout.', e);
    }

    // Now simulate spawning a wolf
    console.log('Simulating player input: "spawn a wolf"...');
    await page.fill('#chat-input', 'spawn a wolf');
    await page.click('#send-chat');

    // Wait for response (Praise)
    console.log('Waiting for Merlin praise...');
    await page.waitForTimeout(10000); // Give time for tool execution and response

    const messages = await page.$$eval('#chat-messages-ai .message.ai', els => els.map(e => e.innerText));
    const lastMessage = messages[messages.length - 1];

    console.log('Last message:', lastMessage);

    if (messages.length > 1) {
        console.log('SUCCESS: Merlin responded after action.');
    } else {
        console.log('WARNING: No second response received.');
    }

    await browser.close();
})();
