
import { Config } from '../core/Config.js';

export const QUEST_TYPES = {
    GATHER: 'gather', // Gather items
    KILL: 'kill',     // Kill mobs (not implemented yet fully for tracking)
};

export class Quest {
    constructor(data) {
        this.id = data.id || Math.random().toString(36).substr(2, 9);
        this.title = data.title;
        this.description = data.description;
        this.type = data.type;
        this.target = data.target; // Item ID or Entity Type
        this.targetName = data.targetName || data.target;
        this.requiredAmount = data.amount || 1;
        this.currentAmount = 0;
        this.reward = data.reward; // Item ID
        this.rewardAmount = data.rewardAmount || 1;
        this.isCompleted = false;
        this.isAccepted = false;

        // For dialogue generation
        this.dialogueIntro = data.dialogueIntro || `I need some help with ${this.title}.`;
        this.dialogueCompletion = data.dialogueCompletion || "Thank you so much!";
    }
}

export class QuestSystem {
    constructor(game) {
        this.game = game;
        this.activeQuests = new Map(); // id -> Quest
        this.completedQuests = new Set(); // ids
        this.availableQuests = new Map(); // villagerId -> Quest
    }

    /**
     * Generate a random quest suitable for a villager profession
     */
    generateQuestForVillager(villager) {
        const profession = villager.professionKey;

        // Simple templates based on profession
        let templates = [];

        const commonTemplates = [
            {
                title: "Wood Gathering",
                description: "I need wood to fix my fence.",
                type: QUEST_TYPES.GATHER,
                target: "log",
                targetName: "Oak Logs",
                amount: 5,
                reward: "diamond",
                rewardAmount: 1,
                dialogueIntro: "The storm last night damaged my fences. Could you bring me some wood logs?"
            },
            {
                title: "Flower Power",
                description: "I want to decorate the village square.",
                type: QUEST_TYPES.GATHER,
                target: "flower_red",
                targetName: "Red Flowers",
                amount: 3,
                reward: "emerald",
                rewardAmount: 2,
                dialogueIntro: "The village looks so drab. Some red flowers would really brighten it up!"
            }
        ];

        if (profession === 'FARMER') {
            templates.push({
                title: "Seed Supply",
                description: "I'm running low on seeds.",
                type: QUEST_TYPES.GATHER,
                target: "wheat_seeds", // Assuming this exists or similar
                targetName: "Seeds",
                amount: 10,
                reward: "bread",
                rewardAmount: 5,
                dialogueIntro: "It's planting season and I'm short on seeds. Can you help?"
            });
            templates.push({
                title: "Harvest Time",
                description: "I need wheat for bread.",
                type: QUEST_TYPES.GATHER,
                target: "wheat",
                targetName: "Wheat",
                amount: 10,
                reward: "emerald",
                rewardAmount: 3,
                dialogueIntro: "The harvest is bountiful but I can't do it alone. Bringing me some wheat would help."
            });
        } else if (profession === 'BLACKSMITH') {
            templates.push({
                title: "Coal for the Forge",
                description: "The fires are dying low.",
                type: QUEST_TYPES.GATHER,
                target: "coal",
                targetName: "Coal",
                amount: 5,
                reward: "iron_ingot",
                rewardAmount: 2,
                dialogueIntro: "My forge is getting cold. I need coal to keep working."
            });
            templates.push({
                title: "Iron Supplies",
                description: "I need iron ore to smelt.",
                type: QUEST_TYPES.GATHER,
                target: "iron_ore",
                targetName: "Iron Ore",
                amount: 5,
                reward: "sword",
                rewardAmount: 1,
                dialogueIntro: "I'm planning to forge a masterpiece, but I need raw iron ore."
            });
        }

        // Fallback
        if (templates.length === 0) templates = commonTemplates;
        else templates = templates.concat(commonTemplates);

        const template = templates[Math.floor(Math.random() * templates.length)];
        const quest = new Quest(template);

        // Store association
        this.availableQuests.set(villager.id, quest);

        return quest;
    }

    hasQuestRequest(villagerId) {
        return this.availableQuests.has(villagerId);
    }

    getQuestFromVillager(villagerId) {
        return this.availableQuests.get(villagerId);
    }

    acceptQuest(questId) {
        // Find quest in available quests (values) if direct lookup not possible, or pass object
        // Assuming we pass quest object or look it up.
        // Let's look up in available to move to active.
        let foundQuest = null;
        let foundVillagerId = null;

        for (const [vId, q] of this.availableQuests.entries()) {
            if (q.id === questId) {
                foundQuest = q;
                foundVillagerId = vId;
                break;
            }
        }

        if (!foundQuest) return false;

        foundQuest.isAccepted = true;
        this.activeQuests.set(foundQuest.id, foundQuest);
        this.availableQuests.delete(foundVillagerId); // Remove from available

        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', `Quest Accepted: ${foundQuest.title}`);
        }

        this.checkQuestProgress(); // Check if already satisfied
        return true;
    }

    completeQuest(questId) {
        const quest = this.activeQuests.get(questId);
        if (!quest || quest.isCompleted) return false;

        // Verify requirements again just in case
        if (quest.type === QUEST_TYPES.GATHER) {
            const count = this.game.inventoryManager.getItemCount(quest.target);
            if (count < quest.requiredAmount) return false;

            // Consume items
            // Simple removal loop
            let remaining = quest.requiredAmount;
            // We need a removeItems helper in InventoryManager generally, but we can just use loop
            // Actually InventoryManager doesn't have a clean "remove X items" that scans slots easily...
            // Wait, `removeItem(index, count)` exists, but we need to find them.

            // We'll iterate slots to remove
            for (let i = 0; i < this.game.inventoryManager.slots.length; i++) {
                const slot = this.game.inventoryManager.slots[i];
                if (slot.item === quest.target) {
                    const take = Math.min(slot.count, remaining);
                    this.game.inventoryManager.removeItem(i, take);
                    remaining -= take;
                    if (remaining <= 0) break;
                }
            }
        }

        // Give reward
        if (this.game.inventoryManager) {
            this.game.inventoryManager.addItem(quest.reward, quest.rewardAmount);
        }

        quest.isCompleted = true;
        this.activeQuests.delete(questId);
        this.completedQuests.add(questId);

        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', `Quest Completed: ${quest.title}`);
            this.game.uiManager.addChatMessage('system', `Reward: ${quest.rewardAmount}x ${quest.reward}`);
        }
        return true;
    }

    // Call this whenever inventory changes or relevant events happen
    checkQuestProgress() {
        if (!this.game.inventoryManager) return;

        for (const quest of this.activeQuests.values()) {
            if (quest.type === QUEST_TYPES.GATHER) {
                const count = this.game.inventoryManager.getItemCount(quest.target);
                quest.currentAmount = count;

                // Notify if ready?
                if (quest.currentAmount >= quest.requiredAmount) {
                    // Could notify user "Quest Ready to Turn In"
                }
            }
        }
    }

    // Helper to check if a specific quest is ready to complete
    canCompleteQuest(questId) {
        const quest = this.activeQuests.get(questId);
        if (!quest) return false;

        if (quest.type === QUEST_TYPES.GATHER) {
            const count = this.game.inventoryManager.getItemCount(quest.target);
            return count >= quest.requiredAmount;
        }
        return false;
    }
}
