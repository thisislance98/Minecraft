
import { TestRunner } from './ai-test-cli/src/runner.js';
import path from 'path';

async function runCallback() {
    const testFile = process.argv[2];
    if (!testFile) {
        console.error('Usage: node run_manual_test.js <testFile>');
        process.exit(1);
    }

    console.log(`Running manual test: ${testFile}`);
    const runner = new TestRunner(path.resolve(testFile));
    try {
        await runner.run();
        console.log('Test completed successfully');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

runCallback();
