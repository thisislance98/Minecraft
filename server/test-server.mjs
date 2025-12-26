#!/usr/bin/env node
/**
 * Minimal Colyseus Test Server
 * 
 * A standalone, simple Colyseus server for testing client-server connectivity.
 * Run from server/ directory: node test-server.mjs
 */

import { Server, Room } from "colyseus";
import { createServer } from "http";
import express from "express";

const PORT = 2568; // Different port from main server

// Simple test room (no schema, just basic room functionality)
class TestRoom extends Room {
    onCreate(options) {
        // Simple state object (not using @colyseus/schema for simplicity)
        this.state = { counter: 0, players: {} };
        console.log(`[TestRoom] Created with options:`, options);

        // Echo any message back
        this.onMessage("ping", (client, data) => {
            console.log(`[TestRoom] Ping from ${client.sessionId}:`, data);
            client.send("pong", { ...data, serverTime: Date.now() });
        });

        // Broadcast message
        this.onMessage("broadcast", (client, data) => {
            console.log(`[TestRoom] Broadcast from ${client.sessionId}:`, data);
            this.broadcast("broadcast", { from: client.sessionId, ...data });
        });

        // Increment counter
        this.onMessage("increment", (client) => {
            this.state.counter++;
            console.log(`[TestRoom] Counter: ${this.state.counter}`);
            this.broadcast("counter", { value: this.state.counter });
        });
    }

    onJoin(client, options) {
        console.log(`[TestRoom] ${client.sessionId} joined`);
        this.state.players[client.sessionId] = options.name || "Anonymous";
        client.send("welcome", { sessionId: client.sessionId, counter: this.state.counter });
    }

    onLeave(client) {
        console.log(`[TestRoom] ${client.sessionId} left`);
        delete this.state.players[client.sessionId];
    }

    onDispose() {
        console.log(`[TestRoom] Disposed`);
    }
}

// Create server
const app = express();
app.get("/health", (req, res) => res.json({ status: "ok" }));

const httpServer = createServer(app);
const gameServer = new Server();

gameServer.define("test", TestRoom);
gameServer.attach({ server: httpServer });

httpServer.listen(PORT, () => {
    console.log(`\n🧪 Test Colyseus Server running on ws://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
});
