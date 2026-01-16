
const { runTest } = require('./ai-test-runner'); // Assuming this helper exists from previous context

// If not, I'll write a standalone puppeteer script. 
// Given the "ai-test-cli" usually wraps this, I will write a script compatible with the project's test runner if I knew the format.
// Looking at history, `tests/toggle_creatures_test.js` existed.
// Let's assume standard Puppeteer syntax if checking browser.

module.exports = async (page) => {
    console.log('Verifying Texture Atlas...');

    // Wait for game to load
    await page.waitForFunction(() => window.game && window.game.isLoaded, { timeout: 10000 });

    // Check Logs
    const logs = await page.evaluate(() => {
        // This requires capturing logs, which might be done by the runner.
        // Or we check Game state directly.
        return window.testLogs || [];
    });

    // Check AssetManager
    const atlasInfo = await page.evaluate(() => {
        const am = window.game.assetManager;
        return {
            hasAtlas: !!am.atlas,
            atlasSize: am.atlas ? am.atlas.size : 0,
            materialCount: am.materialArray.length, // Should be low (or unused)
            opaqueMat: !!am.opaqueMaterial,
            translucentMat: !!am.transparentMaterial
        };
    });

    console.log('Atlas Info:', atlasInfo);

    if (!atlasInfo.hasAtlas) throw new Error('Atlas not initialized');
    if (atlasInfo.atlasSize < 1024) throw new Error('Atlas too small');
    if (!atlasInfo.opaqueMat || !atlasInfo.translucentMat) throw new Error('Atlas materials missing');

    // Check Chunks
    const chunkInfo = await page.evaluate(() => {
        const chunk = window.game.chunks.values().next().value;
        if (!chunk) return null;
        if (!chunk.mesh) return { hasMesh: false };
        return {
            hasMesh: true,
            isGroup: chunk.mesh.type === 'Group',
            childrenCount: chunk.mesh.children.length
        };
    });

    console.log('Chunk Info:', chunkInfo);

    if (!chunkInfo) console.log('No chunks loaded yet.');
    else {
        if (!chunkInfo.isGroup) throw new Error('Chunk mesh is not a Group');
        if (chunkInfo.childrenCount === 0) console.warn('Chunk mesh has no children (empty chunk?)');
        else console.log('Texture Atlas Chunk verified with children!');
    }
};
