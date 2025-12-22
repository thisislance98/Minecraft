import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tasks = new Map();

export default function GodModePlugin() {
    return {
        name: 'god-mode',
        configureServer(server) {
            // Configuration Endpoint
            server.middlewares.use('/api/god-mode/config', (req, res, next) => {
                res.end(JSON.stringify({
                    apiKey: process.env.GEMINI_API_KEY
                }));
            });

            // Task Status Endpoint
            server.middlewares.use('/api/god-mode/task', (req, res, next) => {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const taskId = url.pathname.split('/').pop();

                if (req.method !== 'GET' || !taskId) return next();

                const task = tasks.get(taskId);
                if (!task) {
                    // Return 200 to avoid browser console 404 errors during polling
                    res.statusCode = 200;
                    return res.end(JSON.stringify({ status: 'not_found', error: 'Task not found' }));
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(task));
            });

            server.middlewares.use('/api/god-mode/chat', async (req, res, next) => {
                if (req.method !== 'POST') return next();

                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { message } = JSON.parse(body);
                        console.log('[GodMode] Received request:', message);

                        const taskId = Date.now().toString();
                        tasks.set(taskId, { status: 'pending', taskId, logs: '', startTime: Date.now() });

                        // Context Gathering
                        const contextFiles = [
                            'src/game/Player.js',
                            'src/game/VoxelGame.jsx',
                            'src/controls/Controls.js',
                            'src/game/animals/Turtle.js',
                            'src/game/Studio.js'
                        ];

                        const contextArgs = contextFiles.map(f => `@${f}`).join(' ');
                        const fullPrompt = `USER REQUEST: ${message}\n\nINSTRUCTIONS:\n1. Analyze the request and the provided files: ${contextArgs}\n2. YOU MUST APPLY THE CHANGES NOW using the @file edit syntax.\n3. DO NOT JUST TALK. PERFORM THE EDIT ON THE FILES.\n4. Return a VERY brief summary of what you actually changed.`;

                        // Start CLI in background
                        console.log(`[GodMode] Starting Task ${taskId}: ${message}`);

                        // Use --prompt flag to pass prompt directly (ensures non-interactive mode)
                        const promptFilePath = path.join(process.cwd(), `.temp_prompt_${taskId}.txt`);
                        await fs.writeFile(promptFilePath, fullPrompt);

                        const { spawn } = await import('child_process');
                        // Use -y (yolo mode) and -p (prompt) flags for non-interactive execution
                        const child = spawn('gemini', ['-y', '-p', fullPrompt], {
                            stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin to ensure CLI knows it's non-interactive
                            cwd: process.cwd()
                        });

                        // Set a timeout to mark task as failed if it exceeds 5 minutes
                        const taskTimeout = setTimeout(() => {
                            const task = tasks.get(taskId);
                            if (task && task.status === 'pending') {
                                console.error(`[GodMode] Task ${taskId} Timed out after 5 minutes`);
                                tasks.set(taskId, { ...task, status: 'failed', error: 'Task timed out after 5 minutes' });
                                child.kill(); // Kill the process
                            }
                        }, 5 * 60 * 1000);

                        child.stdout.on('data', (data) => {
                            const output = data.toString();
                            const task = tasks.get(taskId);
                            if (task) {
                                const newLogs = (task.logs || '') + output;
                                tasks.set(taskId, { ...task, logs: newLogs });
                            }
                        });

                        child.stderr.on('data', (data) => {
                            const output = data.toString();
                            // console.error(`[GodMode] Task ${taskId} Stderr:`, output); // Optional: log to server console
                            const task = tasks.get(taskId);
                            if (task) {
                                const newLogs = (task.logs || '') + output;
                                tasks.set(taskId, { ...task, logs: newLogs });
                            }
                        });

                        child.on('close', async (code) => {
                            clearTimeout(taskTimeout);
                            try { await fs.unlink(promptFilePath); } catch (e) { }

                            const task = tasks.get(taskId);
                            if (!task) return;

                            if (code === 0) {
                                console.log(`[GodMode] Task ${taskId} Completed`);
                                tasks.set(taskId, { ...task, status: 'completed', message: 'Task finished successfully.' });
                            } else {
                                console.error(`[GodMode] Task ${taskId} Exited with code ${code}`);
                                tasks.set(taskId, { ...task, status: 'failed', error: `Process exited with code ${code}` });
                            }
                        });

                        child.on('error', async (err) => {
                            clearTimeout(taskTimeout);
                            try { await fs.unlink(promptFilePath); } catch (e) { }
                            console.error(`[GodMode] Task ${taskId} Exception:`, err);
                            const task = tasks.get(taskId);
                            if (task) {
                                const logs = (task.logs || '') + `\n--- EXCEPTION ---\n${err.message}`;
                                tasks.set(taskId, { ...task, status: 'failed', error: err.message, logs });
                            }
                        });

                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, taskId }));

                    } catch (error) {
                        console.error('[GodMode] Error:', error);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: false, error: error.message }));
                    }
                });
            });
        }
    };
}
