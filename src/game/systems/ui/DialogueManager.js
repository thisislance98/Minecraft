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

        // Remove all speech bubbles
        for (const b of this.speechBubbles) {
            b.element.remove();
        }
        this.speechBubbles = [];
    }
}
