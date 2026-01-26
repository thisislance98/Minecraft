/**
 * Socket Module Exports
 *
 * These managers are extracted from the monolithic SocketManager.js for better organization.
 *
 * - VoiceChatManager: PeerJS voice chat with spatial audio
 * - NetworkMessageSender: All outgoing socket.io messages
 * - PlayerModelFactory: 3D character model creation
 * - PlayerSyncManager: Remote player mesh management and interpolation
 */

export { VoiceChatManager } from './VoiceChatManager.js';
export { NetworkMessageSender } from './NetworkMessageSender.js';
export { PlayerModelFactory } from './PlayerModelFactory.js';
export { PlayerSyncManager } from './PlayerSyncManager.js';
