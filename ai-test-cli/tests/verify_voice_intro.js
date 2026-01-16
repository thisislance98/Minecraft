
import { GameBrowser } from '../src/browser.js';
import chalk from 'chalk';

async function verifyVoiceIntro() {
    const browser = new GameBrowser({ headless: false, quiet: true });

    try {
        console.log(chalk.blue('Starting Merlin Voice Intro Verification (Interactive)...'));
        await browser.launch();

        console.log(chalk.cyan('Clearing localStorage...'));
        await browser.evaluate(() => {
            localStorage.removeItem('merlin_voice_intro_seen');
        });

        // Listen for console logs
        let logs = [];
        browser.page.on('console', msg => {
            logs.push(msg.text());
        });

        console.log(chalk.cyan('Reloading page...'));
        await browser.page.reload();
        await browser.waitForGameLoad();

        console.log(chalk.cyan('Waiting 4s for initial attempt...'));
        await new Promise(r => setTimeout(r, 4000));

        // Check logs for initial attempt
        const attempt1 = logs.some(l => l.includes('Attempting to play voice introduction'));
        const success1 = logs.some(l => l.includes('Audio playback started'));
        const failed1 = logs.some(l => l.includes('Audio play failed') || l.includes('Voice intro failed'));

        if (success1) {
            console.log(chalk.green('✅ Initial attempt success! (Autoplay allowed)'));
        } else if (failed1) {
            console.log(chalk.yellow('⚠️ Initial attempt failed (Autoplay blocked), simulating click...'));

            // Simulate user interaction
            await browser.page.mouse.click(640, 360); // Click center screen (approx)
            await new Promise(r => setTimeout(r, 2000));

            const success2 = logs.some(l => l.includes('Audio playback started'));
            if (success2) {
                console.log(chalk.green('✅ Retry on click success!'));
            } else {
                console.error(chalk.red('❌ Retry on click failed.'));
                console.log('Logs:', logs.filter(l => l.includes('Merlin')));
                process.exit(1);
            }
        } else {
            console.log(chalk.yellow('❓ No attempt seen? Waiting longer...'));
            // Maybe timer hasn't fired?
            await new Promise(r => setTimeout(r, 2000));
            if (logs.some(l => l.includes('Audio playback started'))) {
                console.log(chalk.green('✅ Success after wait.'));
            } else {
                console.error(chalk.red('❌ No attempt seen even after wait.'));
                process.exit(1);
            }
        }

    } catch (error) {
        console.error(chalk.red('Test Error:'), error);
        process.exit(1);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

verifyVoiceIntro();
