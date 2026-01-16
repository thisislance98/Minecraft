#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_KEY = process.env.VITE_ELEVENLABS_API_KEY;
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'sounds');

async function generate() {
    console.log('🔊 Retrying "jump" sound...');
    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': API_KEY
        },
        body: JSON.stringify({
            text: 'Quick whoosh jump sound, arcade platformer style, short and snappy',
            duration_seconds: 0.5,
            prompt_influence: 0.5
        })
    });

    if (!response.ok) {
        console.error('Failed:', await response.text());
        return;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'jump.mp3'), Buffer.from(buffer));
    console.log('✅ Saved jump.mp3');
}

generate().catch(console.error);
