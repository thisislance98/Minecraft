
import { analytics, logEvent } from '../../config/firebase-client.js';

export class AnalyticsManager {
    constructor(game) {
        this.game = game;
        this.analytics = analytics;

        // Session tracking
        this.sessionStartTime = Date.now();
        this.logEvent('game_launch', {
            timestamp: this.sessionStartTime,
            url: window.location.href
        });

        // Periodic heartbeat for retention/duration (every 1 minute)
        this.heartbeatInterval = setInterval(() => {
            this.logHeartbeat();
        }, 60000);

        // Listen for page unload to track session end
        window.addEventListener('beforeunload', () => {
            this.logSessionEnd();
        });
    }

    logEvent(eventName, params = {}) {
        if (this.analytics) {
            try {
                // Add common params
                const enrichedParams = {
                    ...params,
                    username: this.game.player?.name || 'anonymous',
                    pos_x: this.game.player?.position?.x ? Math.floor(this.game.player.position.x) : 0,
                    pos_y: this.game.player?.position?.y ? Math.floor(this.game.player.position.y) : 0,
                    pos_z: this.game.player?.position?.z ? Math.floor(this.game.player.position.z) : 0,
                    is_creative: this.game.player?.isCreative || false
                };
                logEvent(this.analytics, eventName, enrichedParams);
                // console.log(`[Analytics] ${eventName}`, enrichedParams);
            } catch (e) {
                console.warn('[Analytics] Failed to log event:', e);
            }
        }
    }

    logHeartbeat() {
        const duration = (Date.now() - this.sessionStartTime) / 1000;
        this.logEvent('heartbeat', {
            duration_seconds: Math.floor(duration)
        });
    }

    logSessionEnd() {
        const duration = (Date.now() - this.sessionStartTime) / 1000;
        // navigator.sendBeacon might be better here but firebase handles it mostly
        this.logEvent('session_end_custom', {
            duration_seconds: Math.floor(duration)
        });
    }

    // --- Specific Actions ---

    logBlockPlace(blockType, x, y, z) {
        this.logEvent('block_place', {
            block_type: blockType,
            location: `${x},${y},${z}`
        });
    }

    logBlockBreak(blockType, x, y, z) {
        this.logEvent('block_break', {
            block_type: blockType,
            location: `${x},${y},${z}`
        });
    }

    logChatMessage(mode, length) {
        this.logEvent('chat_message', {
            chat_mode: mode,
            message_length: length
        });
    }

    logCraftItem(item, count) {
        this.logEvent('craft_item', {
            item_id: item,
            count: count
        });
    }

    logEntitySpawn(entityType) {
        this.logEvent('entity_spawn', {
            entity_type: entityType
        });
    }

    logPlayerDeath(cause) {
        this.logEvent('player_death', {
            cause: cause || 'unknown'
        });
    }
}
