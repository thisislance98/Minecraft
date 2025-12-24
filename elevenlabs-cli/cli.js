#!/usr/bin/env node

/**
 * ElevenLabs CLI
 * Generate text-to-speech, sound effects, and music from the command line
 */

import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import { config } from 'dotenv';
import { listVoices, textToSpeech, generateSoundEffect, generateMusic } from './api.js';

// Load environment variables
config();

const program = new Command();

program
    .name('elevenlabs')
    .description('CLI tool for ElevenLabs text-to-speech, sound effects, and music generation')
    .version('1.0.0');

// ===== VOICES COMMAND =====
program
    .command('voices')
    .description('List all available voices')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
        try {
            console.log('🎤 Fetching available voices...\n');
            const voices = await listVoices();

            if (options.json) {
                console.log(JSON.stringify(voices, null, 2));
            } else {
                console.log('Available Voices:');
                console.log('─'.repeat(60));
                voices.forEach((voice) => {
                    const labels = voice.labels ? Object.values(voice.labels).join(', ') : '';
                    console.log(`  ${voice.name.padEnd(20)} ${voice.voice_id}`);
                    if (labels) {
                        console.log(`    └─ ${labels}`);
                    }
                });
                console.log(`\n✅ Found ${voices.length} voices`);
            }
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            process.exit(1);
        }
    });

// ===== VOICE (TTS) COMMAND =====
program
    .command('voice')
    .description('Generate speech from text')
    .argument('<text>', 'Text to convert to speech')
    .option('-o, --output <file>', 'Output file path', 'voice_output.mp3')
    .option('-v, --voice <id>', 'Voice ID (use "voices" command to list)', 'EXAVITQu4vr4xnSDxMaL')
    .option('-m, --model <id>', 'Model ID', 'eleven_multilingual_v2')
    .option('--stability <value>', 'Voice stability (0-1)', '0.5')
    .option('--similarity <value>', 'Similarity boost (0-1)', '0.75')
    .action(async (text, options) => {
        try {
            console.log(`🎙️  Generating speech...`);
            console.log(`   Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            console.log(`   Voice: ${options.voice}`);

            const audioBuffer = await textToSpeech(text, options.voice, {
                modelId: options.model,
                stability: parseFloat(options.stability),
                similarityBoost: parseFloat(options.similarity),
            });

            await writeFile(options.output, Buffer.from(audioBuffer));
            console.log(`\n✅ Saved to: ${options.output}`);
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            process.exit(1);
        }
    });

// ===== SOUND COMMAND =====
program
    .command('sound')
    .description('Generate sound effect from text description')
    .argument('<prompt>', 'Description of the sound effect')
    .option('-o, --output <file>', 'Output file path', 'sound_output.mp3')
    .option('-d, --duration <seconds>', 'Duration in seconds')
    .option('-l, --loop', 'Create a seamlessly looping sound')
    .option('-i, --influence <value>', 'Prompt influence (0-1)', '0.3')
    .action(async (prompt, options) => {
        try {
            console.log(`🔊 Generating sound effect...`);
            console.log(`   Prompt: "${prompt}"`);
            if (options.duration) console.log(`   Duration: ${options.duration}s`);
            if (options.loop) console.log(`   Looping: enabled`);

            const audioBuffer = await generateSoundEffect(prompt, {
                durationSeconds: options.duration ? parseFloat(options.duration) : null,
                promptInfluence: parseFloat(options.influence),
                loop: options.loop,
            });

            await writeFile(options.output, Buffer.from(audioBuffer));
            console.log(`\n✅ Saved to: ${options.output}`);
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            process.exit(1);
        }
    });

// ===== MUSIC COMMAND =====
program
    .command('music')
    .description('Generate music from text description')
    .argument('<prompt>', 'Description of the music')
    .option('-o, --output <file>', 'Output file path', 'music_output.mp3')
    .option('-d, --duration <seconds>', 'Duration in seconds', '30')
    .option('-l, --loop', 'Create seamlessly looping music')
    .option('-i, --influence <value>', 'Prompt influence (0-1)', '0.3')
    .action(async (prompt, options) => {
        try {
            console.log(`🎵 Generating music...`);
            console.log(`   Prompt: "${prompt}"`);
            console.log(`   Duration: ${options.duration}s`);
            if (options.loop) console.log(`   Looping: enabled`);

            const audioBuffer = await generateMusic(prompt, {
                durationSeconds: parseFloat(options.duration),
                promptInfluence: parseFloat(options.influence),
                loop: options.loop,
            });

            await writeFile(options.output, Buffer.from(audioBuffer));
            console.log(`\n✅ Saved to: ${options.output}`);
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            process.exit(1);
        }
    });

program.parse();
