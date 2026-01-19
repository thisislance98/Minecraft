/**
 * Socket Handlers - Module exports
 *
 * Extracted socket event handlers for cleaner server organization.
 */

// Admin handlers
export { registerAdminHandlers } from './adminHandlers';

// Minigame handlers
export {
    registerMinigameHandlers,
    getMinigameSessionId,
    findPlayerMinigameSession
} from './minigameHandlers';
