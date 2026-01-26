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
 * - ChatManager: Chat panel, messages, modes (AI, Group, Player)
 * - SettingsManager: Settings modal and preferences
 * - GraphicsSettingsManager: Graphics quality presets and toggles
 * - ModalManager: Tutorial, help, death screen modals
 * - VoiceUIManager: Voice chat buttons and indicators
 * - SpellUIManager: Spell selector and spell creator
 * - MinigameUIManager: Survival mode, soccer scoreboard UIs
 * - SignEditorManager: Sign text input modal
 * - SpaceshipUIManager: Spaceship control deck UI
 */

export { NotificationManager } from './NotificationManager.js';
export { HUDManager } from './HUDManager.js';
export { DialogueManager } from './DialogueManager.js';
export { MobileControlsManager } from './MobileControlsManager.js';
export { ChatManager } from './ChatManager.js';
export { SettingsManager } from './SettingsManager.js';
export { GraphicsSettingsManager } from './GraphicsSettingsManager.js';
export { ModalManager } from './ModalManager.js';
export { VoiceUIManager } from './VoiceUIManager.js';
export { SpellUIManager } from './SpellUIManager.js';
export { MinigameUIManager } from './MinigameUIManager.js';
export { SignEditorManager } from './SignEditorManager.js';
export { SpaceshipUIManager } from './SpaceshipUIManager.js';
