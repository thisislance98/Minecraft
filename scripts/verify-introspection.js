
import puppeteer from 'puppeteer';

async function verifyAgentIntrospection() {
    console.log('🚀 Launching Agent Introspection Verification...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('antigravity')) console.log(`[CLIENT] ${text}`);
            else if (text.startsWith('VERIFY')) console.log(`[VERIFY] ${text}`);
        });

        console.log('🔗 Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for connection
        await page.waitForFunction(() => window.antigravityClient && window.antigravityClient.ws && window.antigravityClient.ws.readyState === 1, { timeout: 20000 });
        console.log('✅ Agent Connected.');

        // 1. Manually Spawn a Pig (so we have an ID)
        // We can use the game instance directly to spawn one without relying on the agent tool first
        const pigId = await page.evaluate(() => {
            // Find or creat pig
            if (!window.__VOXEL_GAME__) return null;
            if (!window.__VOXEL_GAME__.animals) return null;

            // Just assume one exists or spawn via console? 
            // Let's reuse the one from previous test if persistence is on, or just rely on manual spawn logic
            // Actually, let's just CALL the agent tool "spawn_creature" directly via the shim
            // But we want to test "update_entity" failure.

            // Let's spawn one directly
            const sm = window.__VOXEL_GAME__.spawnManager;
            // Assuming we can access classes.. likely not exposed globally. 
            // We can ask agent to spawn it.
            return null;
        });

        console.log('💬 Asking Agent to spawn a Pig...');
        // We'll use the agent to spawn it, then we'll try to update it manually via tool call to check error
        await page.evaluate(async () => {
            // Send spawn request
            window.antigravityClient.send({
                type: 'input',
                text: "Spawn a Pig" // minimal command
            });
        });

        // Wait for pig
        console.log('⏳ Waiting for Pig...');
        const pigDetails = await page.waitForFunction(() => {
            if (!window.__VOXEL_GAME__) return null;
            const pigs = window.__VOXEL_GAME__.animals.filter(a => a.constructor.name === 'Pig');
            if (pigs.length > 0) return { id: pigs[pigs.length - 1].id };
            return null;
        }, { timeout: 15000 });

        const targetId = await pigDetails.jsonValue();
        console.log(`✅ Found Pig: ${targetId.id}`);

        // 2. TRIGGER THE UPDATE DIRECTLY (Simulating Agent Tool Call)
        // We want to see what the agent returns when it tries to update color
        console.log('⚡ Triggering update_entity via Agent logic check...');

        const result = await page.evaluate(async (id) => {
            // We access the agent instance directly to call the method
            // This mimics what handleToolRequest does
            const agent = window.__VOXEL_GAME__.agent;

            // Directly call the method
            // Note: In real flow, this is called by handleToolRequest
            const result = agent.updateEntity({
                entityId: id,
                updates: { color: 'gold' }
            });

            return result;
        }, targetId.id);

        console.log('🔍 Result from updateEntity:', result);

        if (result.error && result.error.includes("does not implement 'setColor'")) {
            console.log('✅ SUCCESS: Agent correctly reported missing method!');
        } else {
            console.error('❌ FAILURE: Agent did not return expected error.');
            console.error('Received:', result);
            process.exit(1);
        }

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

verifyAgentIntrospection();
