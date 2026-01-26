/**
 * NetworkMessageSender - Handles all outgoing socket.io messages
 */
export class NetworkMessageSender {
    constructor(game, socketManager) {
        this.game = game;
        this.socketManager = socketManager;
    }

    get socket() {
        return this.socketManager.socket;
    }

    get isConnected() {
        return this.socketManager.isConnected();
    }

    sendPosition(pos, rotY, isCrouching = false, isFlying = false) {
        if (!this.isConnected) return;

        const shirtColor = this.game.player?.shirtColor || null;

        this.socket.emit('player:move', {
            pos: { x: pos.x, y: pos.y, z: pos.z },
            rotY: rotY,
            name: this.game.playerName || 'Player',
            isCrouching: isCrouching,
            health: this.game.player?.health,
            maxHealth: this.game.player?.maxHealth,
            shirtColor: shirtColor,
            isFlying: isFlying
        });
    }

    sendPlayerState() {
        if (!this.isConnected || !this.game.player) return;

        this.socket.emit('player:move', {
            pos: {
                x: this.game.player.position.x,
                y: this.game.player.position.y,
                z: this.game.player.position.z
            },
            rotY: this.game.player.rotation.y,
            name: this.game.playerName || 'Player',
            isCrouching: this.game.player.isCrouching,
            health: this.game.player.health,
            maxHealth: this.game.player.maxHealth,
            shirtColor: this.game.player.shirtColor
        });
    }

    sendBlockChange(x, y, z, type) {
        if (!this.isConnected) return;

        this.socket.emit('block:change', {
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z),
            type: type // 0 for air (destruction), other numbers for block type
        });

        console.log(`[NetworkMessageSender] Block change sent: ${x},${y},${z} -> ${type}`);
    }

    sendSetTime(time) {
        if (!this.isConnected) return;
        this.socket.emit('world:setTime', { time });
    }

    sendEntityUpdate(data) {
        if (!this.isConnected) return;
        this.socket.emit('entity:update', data);
    }

    sendSignUpdate(x, y, z, text) {
        if (!this.isConnected) return;
        this.socket.emit('sign:update', { x, y, z, text });
    }

    sendEntitySpawn(data) {
        if (!this.isConnected) return;
        this.socket.emit('entity:spawn', data);
    }

    sendEntityRemove(id) {
        if (!this.isConnected) return;
        this.socket.emit('entity:remove', { id });
    }

    /**
     * Send held item change to all players
     */
    sendHeldItem(itemType) {
        if (!this.isConnected) return;
        this.socket.emit('player:held_item', { itemType });
    }

    sendDeath() {
        if (!this.isConnected) return;

        console.log('[NetworkMessageSender] Sending player death event');
        this.socket.emit('player:death', {});

        // Notify UI
        if (this.game.uiManager) {
            this.game.uiManager.showDeathScreen();
        }
    }

    sendDamage(targetId, amount) {
        if (!this.isConnected) return;

        console.log(`[NetworkMessageSender] Sending damage to ${targetId}: ${amount}`);
        this.socket.emit('player:damage', {
            targetId: targetId,
            amount: amount
        });
    }

    sendPlayerAction(action) {
        if (!this.isConnected) return;

        this.socket.emit('player:action', { action });

        if (action === 'death') {
            if (this.game.uiManager) {
                this.game.uiManager.showDeathScreen();
            }
        }
    }

    sendProjectileSpawn(type, pos, vel) {
        if (!this.isConnected) return;

        this.socket.emit('projectile:spawn', {
            type,
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: vel.x, y: vel.y, z: vel.z }
        });
    }

    /**
     * Send shirt color update to server and sync with other players
     */
    sendShirtColor(shirtColor) {
        if (!this.isConnected) return;

        console.log(`[NetworkMessageSender] Sending shirt color: ${shirtColor}`);
        this.socket.emit('player:color', { shirtColor });
    }

    // === Soccer Ball Methods ===

    sendSoccerBallState(ball) {
        if (!this.isConnected) return;

        this.socket.emit('soccer:ball_state', {
            pos: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
            vel: { x: ball.velocity.x, y: ball.velocity.y, z: ball.velocity.z }
        });
    }

    sendSoccerBallKick() {
        if (!this.isConnected) return;

        this.socket.emit('soccer:ball_kick', {
            playerId: this.socketManager.socketId
        });
    }

    sendSoccerGoal(scoringSide, scores) {
        if (!this.isConnected) return;

        this.socket.emit('soccer:goal', { scoringSide, scores });
    }

    sendSoccerGameOver(winner, scores) {
        if (!this.isConnected) return;
        this.socket.emit('soccer:game_over', { winner, scores });
    }

    sendSoccerGameReset() {
        if (!this.isConnected) return;

        console.log('[NetworkMessageSender] Broadcasting soccer game reset');
        this.socket.emit('soccer:game_reset', {});
    }

    sendSoccerBallReset(pos) {
        if (!this.isConnected) return;

        console.log('[NetworkMessageSender] Broadcasting soccer ball reset to:', pos);
        this.socket.emit('soccer:ball_reset', { pos });
    }

    sendWorldReset() {
        if (!this.isConnected) {
            console.warn('[NetworkMessageSender] Cannot reset world: Not connected');
            return;
        }
        console.log('[NetworkMessageSender] Sending world reset request...');
        this.socket.emit('world:reset');
    }

    sendChatMessage(message) {
        if (!this.isConnected) return;

        this.socket.emit('chat:message', {
            name: this.game.playerName || 'Player',
            message: message
        });

        // Also display locally
        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('player', message, {
                playerName: this.game.playerName || 'You'
            });
        }

        // Show speech bubble above local player
        this.game.player?.showSpeechBubble(message);
    }

    sendGroupChatMessage(message) {
        // Same as sendChatMessage for now
        this.sendChatMessage(message);
    }

    sendPlayerSpeech(message) {
        if (!this.isConnected) return;

        this.socket.emit('player:speech', {
            message: message
        });

        // Show locally
        this.game.player?.showSpeechBubble(message);
    }

    requestSoccerHost() {
        if (!this.isConnected) return;
        this.socket.emit('soccer:request_host');
    }
}
