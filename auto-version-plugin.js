import fs from 'fs';
import path from 'path';

/**
 * Vite plugin to auto-increment version number on file changes
 */
export default function AutoVersionBumpPlugin() {
    let lastBumpTime = 0;
    const DEBOUNCE_MS = 2000; // Debounce to avoid multiple bumps in quick succession

    const bumpVersion = () => {
        const now = Date.now();
        if (now - lastBumpTime < DEBOUNCE_MS) {
            return; // Skip if we just bumped
        }
        lastBumpTime = now;

        const files = ['minecraft-clone.html', 'index.html'];

        for (const fileName of files) {
            const filePath = path.resolve(process.cwd(), fileName);

            if (!fs.existsSync(filePath)) {
                continue;
            }

            let content = fs.readFileSync(filePath, 'utf-8');
            const versionMatch = content.match(/v(\d+)\.(\d+)\.(\d+)/);

            if (versionMatch) {
                const major = versionMatch[1];
                const minor = versionMatch[2];
                const build = parseInt(versionMatch[3], 10);
                const oldVersion = versionMatch[0];
                const newVersion = `v${major}.${minor}.${build + 1}`;

                content = content.replace(new RegExp(oldVersion, 'g'), newVersion);
                fs.writeFileSync(filePath, content);

                console.log(`\x1b[35m[auto-version]\x1b[0m ${fileName}: ${oldVersion} → ${newVersion}`);
            }
        }
    };

    return {
        name: 'auto-version-bump',

        // Only bump version on server start, not during HMR
        // The handleHotUpdate hook was causing full page reloads because
        // it modified index.html on every file change
        buildStart() {
            bumpVersion();
        }
    };
}
