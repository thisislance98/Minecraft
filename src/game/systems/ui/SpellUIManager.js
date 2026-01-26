/**
 * SpellUIManager - Handles spell selector and spell creator UI
 */
export class SpellUIManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        this.spellSelector = null;
        this.spellCreatorDiv = null;
        this.spellInput = null;
        this.currentWandItem = null;
    }

    initialize() {
        // Spell UI is created on demand
    }

    // --- Spell Selector ---

    createSpellSelector() {
        if (this.spellSelector) return;

        const div = document.createElement('div');
        div.id = 'spell-selector';
        div.style.cssText = `
            position: fixed; right: 20px; top: 50%; transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #a0522d;
            border-radius: 8px;
            padding: 10px;
            color: white;
            font-family: monospace;
            display: none;
            flex-direction: column;
            gap: 5px;
            min-width: 150px;
            z-index: 1000;
        `;
        document.body.appendChild(div);
        this.spellSelector = div;
    }

    updateSpellSelector(spells, currentIndex) {
        if (!this.spellSelector) this.createSpellSelector();
        this.spellSelector.innerHTML = '';

        // Header
        const title = document.createElement('div');
        title.textContent = 'Spells (Press R)';
        title.style.cssText = 'text-align: center; border-bottom: 1px solid #777; margin-bottom: 5px; padding-bottom: 5px; color: #ffd700; font-weight: bold;';
        this.spellSelector.appendChild(title);

        if (!spells || spells.length === 0) {
            const el = document.createElement('div');
            el.textContent = "No spells";
            el.style.color = "#aaa";
            this.spellSelector.appendChild(el);
            return;
        }

        spells.forEach((spell, index) => {
            const el = document.createElement('div');
            el.textContent = spell.name;
            el.style.cssText = `
                padding: 5px;
                background: ${index === currentIndex ? 'rgba(255, 215, 0, 0.3)' : 'transparent'};
                border: 1px solid ${index === currentIndex ? '#ffd700' : 'transparent'};
                border-radius: 4px;
            `;
            if (index === currentIndex) {
                el.textContent = '> ' + spell.name;
            }
            this.spellSelector.appendChild(el);
        });
    }

    toggleSpellSelector(show) {
        if (!this.spellSelector && show) this.createSpellSelector();
        if (this.spellSelector) {
            this.spellSelector.style.display = show ? 'flex' : 'none';
        }
    }

    // --- Spell Creator ---

    createSpellCreator() {
        if (this.spellCreatorDiv) return;

        const div = document.createElement('div');
        div.id = 'spell-creator';
        div.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9); padding: 20px; border-radius: 8px;
            border: 2px solid #a020f0; color: #fff; font-family: 'VT323', monospace;
            text-align: center; z-index: 2500; display: none; min-width: 300px;
        `;

        div.innerHTML = `
            <h2 style="color: #d050ff; margin-top: 0;">Spell Creator</h2>
            <div style="margin-bottom: 15px; text-align: left; font-size: 14px; color: #aaa;">
                Keywords: levitate, damage, fire, push, self, ray
            </div>
            <input type="text" id="spell-input" placeholder="e.g. 'fireball damage'"
                style="width: 100%; padding: 8px; font-family: inherit; font-size: 16px; margin-bottom: 15px; background: #222; color: #fff; border: 1px solid #555;">
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="spell-create-btn" style="padding: 8px 16px; background: #a020f0; color: white; border: none; cursor: pointer;">Craft Spell</button>
                <button id="spell-cancel-btn" style="padding: 8px 16px; background: #555; color: white; border: none; cursor: pointer;">Cancel</button>
            </div>
        `;

        document.body.appendChild(div);

        this.spellCreatorDiv = div;
        this.spellInput = div.querySelector('#spell-input');

        // Handlers
        div.querySelector('#spell-create-btn').onclick = () => this.handleCreateSpell();
        div.querySelector('#spell-cancel-btn').onclick = () => this.closeSpellCreator();

        this.spellInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleCreateSpell();
            if (e.key === 'Escape') this.closeSpellCreator();
        });
    }

    openSpellCreator(wandItem) {
        if (!this.spellCreatorDiv) this.createSpellCreator();

        this.currentWandItem = wandItem;
        this.spellCreatorDiv.style.display = 'block';
        this.spellInput.value = '';
        this.spellInput.focus();

        this.game.inputManager.unlock();
        this.game.gameState.flags.inventoryOpen = true;
    }

    closeSpellCreator() {
        if (this.spellCreatorDiv) {
            this.spellCreatorDiv.style.display = 'none';
        }
        this.currentWandItem = null;
        this.game.gameState.flags.inventoryOpen = false;
    }

    handleCreateSpell() {
        if (!this.currentWandItem) return;

        const text = this.spellInput.value.trim();
        if (!text) return;

        // Use AI to create the spell
        if (this.game.agent) {
            const prompt = `Create a new spell for the OmniWandItem.js based on this description: "${text}". Add it to the default spells list in the constructor.`;
            this.game.agent.sendTextMessage(prompt);
            this.closeSpellCreator();
            this.uiManager.chatManager?.addChatMessage('system', 'Request sent to AI Agent...');
        } else {
            console.error("No agent found");
            this.uiManager.chatManager?.addChatMessage('system', "Error: AI Agent not found.");
        }
    }

    cleanup() {
        if (this.spellSelector) {
            this.spellSelector.remove();
        }
        if (this.spellCreatorDiv) {
            this.spellCreatorDiv.remove();
        }
    }
}
