import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import { GameRoom } from './rooms/GameRoom';

const port = Number(process.env.PORT || 2567);
const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());

const gameServer = new Server({
    server: createServer(app)
});

// Register GameRoom
gameServer.define('game', GameRoom);

// Monitoring endpoint (optional - for debugging)
app.use('/colyseus', monitor());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rooms: gameServer.rooms.size,
        timestamp: new Date().toISOString()
    });
});

gameServer.listen(port);

console.log(`[Colyseus] Server listening on ws://localhost:${port}`);
console.log(`[Monitor] Available at http://localhost:${port}/colyseus`);
