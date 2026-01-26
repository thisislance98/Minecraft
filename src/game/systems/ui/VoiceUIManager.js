/**
 * VoiceUIManager - Handles voice chat button, Merlin voice button, and voice indicators
 */
export class VoiceUIManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        this.voiceBtn = document.getElementById('voice-btn');
        this.muteBtn = null;
    }

    initialize() {
        this.setupVoiceButton();
        this.setupMerlinVoiceButton();
        this.createMuteButton();
    }

    setupVoiceButton() {
        if (!this.voiceBtn) return;

        // Get saved state
        const savedVoice = localStorage.getItem('settings_voice') === 'true';
        this.updateVoiceButtonState(savedVoice);

        this.voiceBtn.addEventListener('click', () => {
            const currentState = localStorage.getItem('settings_voice') === 'true';
            const newState = !currentState;

            // Update storage and state
            localStorage.setItem('settings_voice', newState);
            this.updateVoiceButtonState(newState);

            // Sync with voice toggle in settings if it exists
            const voiceToggle = document.getElementById('settings-voice-toggle');
            if (voiceToggle) {
                voiceToggle.checked = newState;
            }

            // Enable/disable voice chat
            if (this.game.socketManager) {
                this.game.socketManager.voiceChatManager.setVoiceChatEnabled(newState);
            }

            // Show feedback message
            this.uiManager.chatManager?.addChatMessage('system',
                newState ? '🎤 Voice chat enabled. Hold V to talk.' : '🎤 Voice chat disabled.');
        });
    }

    updateVoiceButtonState(enabled) {
        if (!this.voiceBtn) return;
        if (enabled) {
            this.voiceBtn.style.background = 'rgba(0, 200, 100, 0.5)';
            this.voiceBtn.style.color = '#fff';
            this.voiceBtn.title = 'Voice Chat: ON (Hold V to talk)';
        } else {
            this.voiceBtn.style.background = '';
            this.voiceBtn.style.color = '';
            this.voiceBtn.title = 'Toggle Voice Chat';
        }
    }

    setupMerlinVoiceButton() {
        // Create Mic Button in Chat Input Area
        const chatInputContainer = document.querySelector('#chat-panel .chat-input-container');
        if (!chatInputContainer) return;

        // Check if already exists
        if (document.getElementById('voice-mic-btn')) return;

        const micBtn = document.createElement('button');
        micBtn.id = 'voice-mic-btn';
        micBtn.innerHTML = '🎤';
        micBtn.title = 'Speak to Merlin';
        micBtn.style.cssText = `
            background: #444; border: 1px solid #666; color: white;
            width: 40px; height: 40px; border-radius: 4px;
            font-size: 20px; cursor: pointer; margin-left: 5px;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
        `;

        // Insert before Send button
        const sendBtn = document.getElementById('send-chat');
        if (sendBtn) {
            chatInputContainer.insertBefore(micBtn, sendBtn);
        } else {
            chatInputContainer.appendChild(micBtn);
        }

        micBtn.onclick = () => {
            if (this.game.merlinClient) {
                this.game.merlinClient.toggleVoice();
            }
        };

        // Listen for status updates
        if (this.game.merlinClient) {
            this.game.merlinClient.addListener((msg) => {
                if (msg.type === 'voice_status') {
                    if (msg.status === 'listening') {
                        micBtn.style.background = '#ff4444';
                        micBtn.innerHTML = '🛑';
                        micBtn.classList.add('pulse');
                    } else {
                        micBtn.style.background = '#444';
                        micBtn.innerHTML = '🎤';
                        micBtn.classList.remove('pulse');
                    }
                }
            });
        }

        // Add pulse animation style
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
            }
            .pulse {
                animation: pulse 1.5s infinite;
            }
        `;
        document.head.appendChild(style);
    }

    createMuteButton() {
        const container = document.getElementById('top-right-controls');
        if (!container || document.getElementById('mute-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'mute-btn';
        btn.className = 'ui-btn';
        btn.title = 'Toggle Sound';

        // Get initial state from sound manager or localStorage
        const isMuted = localStorage.getItem('settings_audio') === 'false';
        btn.textContent = isMuted ? '🔇' : '🔊';

        btn.addEventListener('click', () => {
            if (this.game.soundManager) {
                const newMuted = !this.game.soundManager.isMuted;
                this.game.soundManager.setMuted(newMuted);
                btn.textContent = newMuted ? '🔇' : '🔊';
                localStorage.setItem('settings_audio', !newMuted);

                // Sync with settings toggle
                const audioToggle = document.getElementById('settings-audio-toggle');
                if (audioToggle) {
                    audioToggle.checked = !newMuted;
                }
            }
        });

        container.appendChild(btn);
        this.muteBtn = btn;
    }

    toggleVoiceTransmitIndicator(active) {
        // Show/hide voice transmit indicator when user is speaking
        let indicator = document.getElementById('voice-transmit-indicator');

        if (active) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'voice-transmit-indicator';
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 100px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(255, 50, 50, 0.9);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 20px;
                    font-family: 'VT323', monospace;
                    font-size: 18px;
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: pulse 1s infinite;
                `;
                indicator.innerHTML = `
                    <span style="font-size: 24px;">🎤</span>
                    <span>Transmitting...</span>
                `;
                document.body.appendChild(indicator);
            }
        } else {
            if (indicator) {
                indicator.remove();
            }
        }
    }

    cleanup() {
        const micBtn = document.getElementById('voice-mic-btn');
        if (micBtn) micBtn.remove();

        const indicator = document.getElementById('voice-transmit-indicator');
        if (indicator) indicator.remove();
    }
}
