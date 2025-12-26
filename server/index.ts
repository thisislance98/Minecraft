import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import { Encoder } from '@colyseus/schema';
import { GameRoom } from './rooms/GameRoom';

// Increase buffer size to handle larger states (default is 4KB)
Encoder.BUFFER_SIZE = 128 * 1024; // 128 KB

const port = Number(process.env.PORT || 2567);
const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());

// Create HTTP server
const httpServer = createServer(app);

// Create Colyseus server (without server option - we'll attach later)
const gameServer = new Server();

// Register GameRoom
gameServer.define('game', GameRoom);

// Monitoring endpoint (optional - for debugging)
app.use('/colyseus', monitor());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Attach Colyseus to the HTTP server (includes matchmaking routes)
gameServer.attach({ server: httpServer });

// Start the server
httpServer.listen(port, () => {
    console.log(`[Colyseus] Server listening on ws://localhost:${port}`);
    console.log(`[Monitor] Available at http://localhost:${port}/colyseus`);
});
