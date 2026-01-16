
import fs from 'fs';
try {
    const { GameBrowser } = await import('../ai-test-cli/src/browser.js');
    console.log("GameBrowser imported successfully");
    fs.writeFileSync('import_test.txt', 'GameBrowser imported successfully');
} catch (e) {
    console.error("Import failed:", e);
    fs.writeFileSync('import_test.txt', `Import failed: ${e.message}`);
}
