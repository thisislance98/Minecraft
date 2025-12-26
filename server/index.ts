import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import { Encoder } from '@colyseus/schema';
import { GameRoom } from './rooms/GameRoom';
import { stripeRoutes } from './routes/stripe';
import { authRoutes } from './routes/auth';
import './config'; // Initialize config

// Increase buffer size to handle larger states (default is 4KB)
Encoder.BUFFER_SIZE = 256 * 1024; // 256 KB

const port = Number(process.env.PORT || 2567);
const app = express();

// Enable CORS
app.use(cors());
app.use(cors());

// Use raw body for Stripe webhooks, json for everything else
app.use((req, res, next) => {
    if (req.originalUrl === '/api/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

app.use('/api', stripeRoutes);
app.use('/api/auth', authRoutes);

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`);
    next();
});

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

// Expose active rooms for test runner discovery
app.get('/api/rooms', (req, res) => {
    // Access rooms via the driver (cast to any to access internal property)
    const driver = (gameServer as any).driver;
    if (driver && driver.rooms) {
        // driver.rooms is a Map in Colyseus 0.16 - forEach is (value, key)
        const roomsArray: any[] = [];
        driver.rooms.forEach((room: any, roomId: string) => {
            // The room object should have an 'id' or 'roomId' property
            const id = room.roomId || room.id || roomId;
            roomsArray.push({
                roomId: id,
                clients: room.clients?.size || room.clients?.length || 0,
                maxClients: room.maxClients || 10,
                name: room.roomName || 'game'
            });
        });
        console.log('[api/rooms] Found', roomsArray.length, 'rooms:', roomsArray.map(r => r.roomId));
        res.json(roomsArray);
    } else {
        console.log('[api/rooms] No driver.rooms available');
        res.json([]);
    }
});

// Attach Colyseus to the HTTP server (includes matchmaking routes)
gameServer.attach({ server: httpServer });

// Start the server
httpServer.listen(port, () => {
    console.log(`[Colyseus] Server listening on ws://localhost:${port}`);
    console.log(`[Monitor] Available at http://localhost:${port}/colyseus`);
});
