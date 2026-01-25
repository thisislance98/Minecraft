/**
 * UI Module Exports
 *
 * These managers are extracted from the monolithic UIManager.js for better organization.
 * Each manager handles a specific concern:
 *
 * - NotificationManager: Toast notifications and refresh prompts
 * - HUDManager: FPS counter, position display, block count
 * - DialogueManager: Speech bubbles and dialogue boxes
 * - MobileControlsManager: Touch joysticks and mobile buttons
 */

export { NotificationManager } from './NotificationManager.js';
export { HUDManager } from './HUDManager.js';
export { DialogueManager } from './DialogueManager.js';
export { MobileControlsManager } from './MobileControlsManager.js';
