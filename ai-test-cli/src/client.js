import WebSocket from 'ws';
import EventEmitter from 'events';

export class AntigravityClient extends EventEmitter {
    constructor(url = 'ws://localhost:2567/api/antigravity') {
        super();
        this.url = url;
        this.ws = null;
        this.isConnected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url, {
                headers: {
                    'x-antigravity-client': 'cli',
                    'x-antigravity-secret': 'asdf123'
                }
            });

            this.ws.on('open', () => {
                this.isConnected = true;
                this.emit('connected');
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.emit('message', message);

                    // Emit specific events based on message type
                    if (message.type) {
                        this.emit(message.type, message);
                    }
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            });

            this.ws.on('error', (error) => {
                this.emit('error', error);
                if (!this.isConnected) reject(error);
            });

            this.ws.on('close', () => {
                this.isConnected = false;
                this.emit('disconnected');
            });
        });
    }

    sendPrompt(text, context = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected');
        }

        const payload = {
            type: 'input',
            text,
            context: {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                biome: 'Plains',
                ...context
            }
        };

        this.ws.send(JSON.stringify(payload));
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
