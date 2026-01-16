#!/usr/bin/env node
/**
 * Sound Effects Generator using ElevenLabs API
 * Generates 11 game sound effects and saves them to public/sounds/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_KEY = process.env.VITE_ELEVENLABS_API_KEY;
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'sounds');

if (!API_KEY) {
    console.error('❌ VITE_ELEVENLABS_API_KEY not found in .env file');
    process.exit(1);
}

// Sound effect definitions
const SOUND_EFFECTS = [
    {
        name: 'footstep_grass',
        prompt: 'Soft footstep on grass and dirt, single step, Minecraft-style walking sound',
        duration: 0.5
    },
    {
        name: 'footstep_stone',
        prompt: 'Hard footstep on stone cobblestone, single step, slight echo',
        duration: 0.5
    },
    {
        name: 'block_break',
        prompt: 'Crunchy block breaking sound, stone crumbling, voxel game style destruction',
        duration: 1.0
    },
    {
        name: 'block_place',
        prompt: 'Solid block placement thud, satisfying Minecraft-style block drop sound',
        duration: 0.5
    },
    {
        name: 'item_pickup',
        prompt: 'Magical sparkle pop sound, item collection chime, bright and satisfying',
        duration: 0.5
    },
    {
        name: 'jump',
        prompt: 'Quick whoosh jump sound, arcade platformer style, short and snappy',
        duration: 0.5
    },
    {
        name: 'damage',
        prompt: 'Low thud impact sound, player takes damage, oof sound effect',
        duration: 0.5
    },
    {
        name: 'levelup',
        prompt: 'Triumphant fanfare ding, achievement unlocked sound, magical ascending chime with sparkles',
        duration: 1.5
    },
    {
        name: 'teleport',
        prompt: 'Ethereal whooshing portal sound, magical teleportation, mystical warping effect',
        duration: 1.0
    },
    {
        name: 'rumble',
        prompt: 'Deep rumbling earthquake sound, ground shaking, distant thunder and vibration',
        duration: 2.0
    },
    {
        name: 'splash',
        prompt: 'Water splash sound, player diving into water, bubbly impact',
        duration: 1.0
    }
];

async function generateSoundEffect(sound) {
    console.log(`🔊 Generating "${sound.name}"...`);

    try {
        const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': API_KEY
            },
            body: JSON.stringify({
                text: sound.prompt,
                duration_seconds: sound.duration,
                prompt_influence: 0.5
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const buffer = await response.arrayBuffer();
        const outputPath = path.join(OUTPUT_DIR, `${sound.name}.mp3`);

        fs.writeFileSync(outputPath, Buffer.from(buffer));
        console.log(`   ✅ Saved: ${outputPath}`);

        return true;
    } catch (error) {
        console.error(`   ❌ Failed to generate "${sound.name}": ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎮 ElevenLabs Sound Effects Generator');
    console.log('=====================================\n');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Created output directory: ${OUTPUT_DIR}\n`);
    }

    let successCount = 0;
    let failCount = 0;

    for (const sound of SOUND_EFFECTS) {
        const success = await generateSoundEffect(sound);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=====================================');
    console.log(`✅ Generated: ${successCount}/${SOUND_EFFECTS.length} sounds`);
    if (failCount > 0) {
        console.log(`❌ Failed: ${failCount} sounds`);
    }
    console.log('=====================================');
}

main().catch(console.error);
