import puppeteer from 'puppeteer';

async function verifyToolMessages() {
    console.log('🚀 Launching Tool Message Verification...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Forward console logs
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

        console.log('🔗 Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for game to initialize
        console.log('⏳ Waiting for game initialization...');
        await page.waitForFunction(() => window.__VOXEL_GAME__ && window.__VOXEL_GAME__.agent, { timeout: 10000 });
        console.log('✅ Game initialized.');

        // Test Cases
        const testCases = [
            {
                name: 'view_file',
                args: { AbsolutePath: '/Users/test/projects/game/src/index.js' },
                expected: 'Reading src/index.js'
            },
            {
                name: 'list_dir',
                args: { DirectoryPath: '/Users/test/projects/game' },
                expected: 'Looking in projects/game'
            },
            {
                name: 'run_command',
                args: { CommandLine: 'npm run build --flag --verbose --extra' }, // Long command to trigger truncation
                expected: 'npm run build --f' // Part of the expected truncated string
            },
            {
                name: 'search_web',
                args: { query: 'how to make a cake' },
                expected: 'Searching for "how to make a cake"'
            },
            {
                name: 'spawn_creature',
                args: { creature: 'Pig', count: 5 },
                expected: 'Spawning 5 Pig'
            }
        ];

        console.log('🧪 Running Test Cases...');

        for (const test of testCases) {
            const result = await page.evaluate((t) => {
                const agent = window.__VOXEL_GAME__.agent;
                const ui = window.__VOXEL_GAME__.uiManager;

                // Force new message line for each test to make verification cleaner
                agent.lastToolMsgId = null;

                // Simulate server message
                agent.handleServerMessage({
                    type: 'tool_start',
                    name: t.name,
                    args: t.args
                });

                // Check recent chat messages (last 10) to avoid race conditions with system msgs
                const msgs = Array.from(ui.chatMessages.children);
                const recentMsgs = msgs.slice(-10);

                const found = recentMsgs.find(m => m.innerText.includes(t.expected));

                if (found) {
                    return { passed: true, actual: found.innerText };
                } else {
                    const allTexts = recentMsgs.map(m => m.innerText);
                    return { passed: false, reason: `Expected "${t.expected}" but not found. Recent messages: ${JSON.stringify(allTexts)}` };
                }
            }, test);

            if (result.passed) {
                console.log(`✅ [${test.name}] Passed: ${result.actual}`);
            } else {
                console.error(`❌ [${test.name}] Failed: ${result.reason}`);
                process.exit(1);
            }

            // Small delay between tests
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('🎉 All tool message tests passed!');

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

verifyToolMessages();
