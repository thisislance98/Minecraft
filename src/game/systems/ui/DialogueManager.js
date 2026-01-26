import * as THREE from 'three';

/**
 * DialogueManager - Handles speech bubbles and dialogue boxes
 */
export class DialogueManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // Dialogue box elements
        this.dialogueBox = null;
        this.dialogueSpeaker = null;
        this.dialogueText = null;

        // Villager chat UI elements
        this.villagerChatBox = null;
        this.villagerChatInput = null;
        this.activeVillager = null;

        // Speech bubbles
        this.speechBubbles = [];
    }

    // --- Dialogue Box System ---

    createDialogueBox() {
        if (this.dialogueBox) return;

        const div = document.createElement('div');
        div.className = 'dialogue-box';
        div.innerHTML = `
            <div class="dialogue-close">✕</div>
            <h3 id="dialogue-speaker">Speaker</h3>
            <p id="dialogue-text">...</p>
        `;
        document.body.appendChild(div);

        div.querySelector('.dialogue-close').addEventListener('click', () => {
            this.hideDialogue();
        });

        this.dialogueBox = div;
        this.dialogueSpeaker = div.querySelector('#dialogue-speaker');
        this.dialogueText = div.querySelector('#dialogue-text');
    }

    showDialogue(speaker, text) {
        if (!this.dialogueBox) this.createDialogueBox();

        this.dialogueSpeaker.textContent = speaker;
        this.dialogueText.textContent = text;
        this.dialogueBox.style.display = 'block';
    }

    hideDialogue() {
        if (this.dialogueBox) {
            this.dialogueBox.style.display = 'none';
        }
    }

    // --- Villager Chat System ---

    /**
     * Create the villager chat UI (speech box + response input)
     */
    createVillagerChatUI() {
        if (this.villagerChatBox) return;

        const container = document.createElement('div');
        container.id = 'villager-chat-container';
        container.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            width: 500px;
            max-width: 90vw;
            z-index: 1000;
            display: none;
            font-family: 'VT323', monospace;
        `;

        container.innerHTML = `
            <div id="villager-chat-box" style="
                background: rgba(0, 0, 0, 0.85);
                border: 3px solid #8B4513;
                border-radius: 10px;
                padding: 15px 20px;
                color: white;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
            ">
                <div id="villager-chat-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                ">
                    <span id="villager-chat-name" style="
                        color: #ffd700;
                        font-size: 24px;
                    ">Villager</span>
                    <button id="villager-chat-close" style="
                        background: none;
                        border: none;
                        color: #888;
                        font-size: 24px;
                        cursor: pointer;
                        padding: 0;
                        line-height: 1;
                    ">&times;</button>
                </div>
                <p id="villager-chat-text" style="
                    margin: 0 0 15px 0;
                    font-size: 20px;
                    line-height: 1.4;
                    min-height: 50px;
                ">...</p>
                <div id="villager-chat-input-container" style="
                    display: flex;
                    gap: 10px;
                ">
                    <input type="text" id="villager-chat-input" placeholder="Type your response..." style="
                        flex: 1;
                        background: rgba(255, 255, 255, 0.1);
                        border: 2px solid #555;
                        border-radius: 5px;
                        padding: 10px;
                        color: white;
                        font-family: 'VT323', monospace;
                        font-size: 18px;
                        outline: none;
                    " />
                    <button id="villager-chat-send" style="
                        background: #8B4513;
                        border: 2px solid #A0522D;
                        border-radius: 5px;
                        padding: 10px 20px;
                        color: white;
                        font-family: 'VT323', monospace;
                        font-size: 18px;
                        cursor: pointer;
                    ">Send</button>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        this.villagerChatBox = container;
        this.villagerChatInput = container.querySelector('#villager-chat-input');

        // Event listeners
        const closeBtn = container.querySelector('#villager-chat-close');
        const sendBtn = container.querySelector('#villager-chat-send');
        const input = this.villagerChatInput;

        closeBtn.addEventListener('click', () => {
            this.hideVillagerSpeech();
            if (this.activeVillager) {
                this.activeVillager.endConversation();
            }
        });

        sendBtn.addEventListener('click', () => {
            this.sendVillagerResponse();
        });

        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Prevent game input
            if (e.key === 'Enter') {
                this.sendVillagerResponse();
            } else if (e.key === 'Escape') {
                this.hideVillagerSpeech();
                if (this.activeVillager) {
                    this.activeVillager.endConversation();
                }
            }
        });

        // Focus styling
        input.addEventListener('focus', () => {
            input.style.borderColor = '#ffd700';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = '#555';
        });
    }

    /**
     * Send the player's response to the villager
     */
    sendVillagerResponse() {
        if (!this.activeVillager || !this.villagerChatInput) return;

        const message = this.villagerChatInput.value.trim();
        if (!message) return;

        console.log(`[DialogueManager] Player says to villager: "${message}"`);

        // Clear input
        this.villagerChatInput.value = '';

        // Show "thinking" state
        const textEl = this.villagerChatBox.querySelector('#villager-chat-text');
        textEl.textContent = '...';

        // Send to villager
        this.activeVillager.handlePlayerResponse(message);
    }

    /**
     * Show villager speech with name and text
     * @param {Object} villager - The villager entity
     * @param {string} text - What the villager says
     */
    showVillagerSpeech(villager, text) {
        if (!this.villagerChatBox) this.createVillagerChatUI();

        this.activeVillager = villager;
        this.uiManager.activeVillagerConversation = villager;

        // Update UI
        const nameEl = this.villagerChatBox.querySelector('#villager-chat-name');
        const textEl = this.villagerChatBox.querySelector('#villager-chat-text');

        const villagerTitle = villager.name ?
            `${villager.name} the ${villager.profession?.name || 'Villager'}` :
            villager.profession?.name || 'Villager';

        nameEl.textContent = villagerTitle;
        textEl.textContent = text;

        // Show the UI
        this.villagerChatBox.style.display = 'block';

        // Unlock pointer for typing
        if (this.game.controls) {
            this.game.controls.unlock();
        }

        // Focus input after a brief delay
        setTimeout(() => {
            if (this.villagerChatInput) {
                this.villagerChatInput.focus();
            }
        }, 100);

        console.log(`[DialogueManager] Showing villager speech: ${villagerTitle} says "${text}"`);
    }

    /**
     * Show the chat input prompt for responding to a villager
     * @param {Object} villager - The villager entity
     */
    showVillagerChatPrompt(villager) {
        if (!this.villagerChatBox) this.createVillagerChatUI();

        this.activeVillager = villager;
        const inputContainer = this.villagerChatBox.querySelector('#villager-chat-input-container');
        if (inputContainer) {
            inputContainer.style.display = 'flex';
        }

        if (this.villagerChatInput) {
            this.villagerChatInput.focus();
        }
    }

    /**
     * Hide the chat input prompt
     */
    hideVillagerChatPrompt() {
        if (!this.villagerChatBox) return;

        const inputContainer = this.villagerChatBox.querySelector('#villager-chat-input-container');
        if (inputContainer) {
            inputContainer.style.display = 'none';
        }
    }

    /**
     * Hide the entire villager speech UI
     */
    hideVillagerSpeech() {
        if (this.villagerChatBox) {
            this.villagerChatBox.style.display = 'none';
        }

        if (this.activeVillager) {
            this.activeVillager = null;
        }

        if (this.uiManager) {
            this.uiManager.activeVillagerConversation = null;
        }

        // Re-lock pointer for game
        if (this.game.controls && !document.pointerLockElement) {
            // Only re-lock if player clicks back into game
        }
    }

    // --- Speech Bubbles ---

    addSpeechBubble(entity, text, duration = 3000) {
        // Remove existing bubble for this entity if any
        this.removeSpeechBubble(entity);

        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble';
        bubble.textContent = text;
        document.body.appendChild(bubble);

        const bubbleData = {
            element: bubble,
            entity: entity,
            timer: duration
        };

        this.speechBubbles.push(bubbleData);
    }

    removeSpeechBubble(entity) {
        const idx = this.speechBubbles.findIndex(b => b.entity === entity);
        if (idx !== -1) {
            const b = this.speechBubbles[idx];
            b.element.remove();
            this.speechBubbles.splice(idx, 1);
        }
    }

    /**
     * Update speech bubble positions - call every frame
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (this.speechBubbles.length === 0) return;

        const camera = this.game.camera;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const widthHalf = width / 2;
        const heightHalf = height / 2;

        for (let i = this.speechBubbles.length - 1; i >= 0; i--) {
            const b = this.speechBubbles[i];
            b.timer -= dt * 1000;

            if (b.timer <= 0) {
                b.element.remove();
                this.speechBubbles.splice(i, 1);
                continue;
            }

            if (!b.entity || b.entity.isDead || !b.entity.mesh?.parent) {
                b.element.remove();
                this.speechBubbles.splice(i, 1);
                continue;
            }

            // Project position
            const pos = new THREE.Vector3().copy(b.entity.position);
            pos.y += b.entity.height + 0.5; // Above head

            pos.project(camera);

            // Check if behind camera
            if (pos.z > 1) {
                b.element.style.display = 'none';
            } else {
                b.element.style.display = 'block';
                const x = (pos.x * widthHalf) + widthHalf;
                const y = -(pos.y * heightHalf) + heightHalf;

                b.element.style.left = `${x}px`;
                b.element.style.top = `${y}px`;
            }
        }
    }

    cleanup() {
        // Remove dialogue box
        if (this.dialogueBox) {
            this.dialogueBox.remove();
            this.dialogueBox = null;
        }

        // Remove villager chat UI
        if (this.villagerChatBox) {
            this.villagerChatBox.remove();
            this.villagerChatBox = null;
            this.villagerChatInput = null;
            this.activeVillager = null;
        }

        // Remove all speech bubbles
        for (const b of this.speechBubbles) {
            b.element.remove();
        }
        this.speechBubbles = [];
    }
}
