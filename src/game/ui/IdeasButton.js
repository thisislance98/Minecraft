import { ideaList } from '../data/ideasData.js';

export class IdeasButton {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.modal = null;
        this.currentIdeaIndex = 0;
        this.shuffledIdeas = [];

        this.setupUI();
        this.shuffleIdeas();
    }

    shuffleIdeas() {
        this.shuffledIdeas = [...ideaList];
        // Fisher-Yates shuffle
        for (let i = this.shuffledIdeas.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledIdeas[i], this.shuffledIdeas[j]] = [this.shuffledIdeas[j], this.shuffledIdeas[i]];
        }
    }

    setupUI() {
        // Create the main button
        this.createButton();

        // Create the modal (hidden by default)
        this.createModal();
    }

    createButton() {
        const btn = document.createElement('button');
        btn.id = 'ideas-btn';
        btn.innerHTML = '💡 Ideas';
        btn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.6);
            color: #ffd700;
            border: 2px solid #ffd700;
            border-radius: 20px;
            padding: 8px 16px;
            font-family: 'VT323', monospace;
            font-size: 18px;
            cursor: pointer;
            z-index: 1000;
            transition: all 0.2s;
            box-shadow: 0 0 10px rgba(255, 215, 0, 0.2);
        `;

        btn.onmouseover = () => {
            btn.style.background = 'rgba(0, 0, 0, 0.8)';
            btn.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.4)';
            btn.style.transform = 'scale(1.05)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'rgba(0, 0, 0, 0.6)';
            btn.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.2)';
            btn.style.transform = 'scale(1)';
        };

        btn.onclick = () => {
            this.showNextIdea();
            btn.blur(); // Remove focus so it doesn't capture keyboard input
        };

        document.body.appendChild(btn);
        this.btn = btn;
    }

    createModal() {
        // Modal Container
        this.modal = document.createElement('div');
        this.modal.id = 'idea-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 80px;
            left: 20px;
            width: 300px;
            background: rgba(20, 20, 30, 0.95);
            border: 2px solid #ffd700;
            border-radius: 12px;
            padding: 15px;
            font-family: 'VT323', monospace;
            color: white;
            z-index: 1000;
            display: none;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
            animation: slide-in 0.3s ease-out;
        `;

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slide-in {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);

        // Content
        this.modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #ffd700; font-size: 20px;">💡 Try This!</h3>
                <button id="close-idea" style="background:none; border:none; color:#666; cursor:pointer; font-size: 20px;">×</button>
            </div>
            <div id="idea-text" style="font-size: 16px; line-height: 1.4; margin-bottom: 15px; min-height: 40px;">
                ...
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="next-idea" style="
                    flex: 1;
                    background: #ffd700;
                    color: #000;
                    border: none;
                    border-radius: 4px;
                    padding: 8px;
                    cursor: pointer;
                    font-family: inherit;
                    font-weight: bold;
                    font-size: 16px;
                ">Next Idea 🎲</button>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Bind events
        this.modal.querySelector('#close-idea').onclick = () => this.hide();
        this.modal.querySelector('#next-idea').onclick = () => this.showNextIdea();
    }

    showNextIdea() {
        if (!this.modal) return;

        // Show modal if hidden
        this.modal.style.display = 'block';

        // Get next idea
        const idea = this.shuffledIdeas[this.currentIdeaIndex];

        // Update text
        const textEl = this.modal.querySelector('#idea-text');
        textEl.textContent = idea;

        // Increment index loop
        this.currentIdeaIndex = (this.currentIdeaIndex + 1) % this.shuffledIdeas.length;

        // Visual feedback
        const btn = this.modal.querySelector('#next-idea');
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = 'scale(1)', 100);
    }

    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }
}
