
import { QuestSystem, Quest, QUEST_TYPES } from '../../src/game/systems/QuestSystem.js';

// Mock Game
const mockGame = {
    uiManager: {
        addChatMessage: (type, msg) => console.log(`[UI] ${type}: ${msg}`)
    },
    inventoryManager: {
        slots: [],
        addItem: (item, count) => console.log(`[Inv] Added ${count} ${item}`),
        getItemCount: (item) => {
            if (item === 'log') return 10;
            return 0;
        },
        removeItem: (index, count) => console.log(`[Inv] Removed ${count} from slot ${index}`)
    }
};

// Populate slots for removal test
mockGame.inventoryManager.slots = new Array(63).fill({});
mockGame.inventoryManager.slots[0] = { item: 'log', count: 10 };


async function runTest() {
    console.log("Starting Quest System Verification...");

    const qs = new QuestSystem(mockGame);

    // 1. Generate Quest
    const questData = {
        title: "Test Quest",
        description: "Test Description",
        type: QUEST_TYPES.GATHER,
        target: "log",
        amount: 5,
        reward: "diamond",
        rewardAmount: 1
    };
    const quest = new Quest(questData);

    // Manual inject to available
    qs.availableQuests.set('villager_1', quest);

    // 2. Accept Quest
    console.log("Accepting quest...");
    const accepted = qs.acceptQuest(quest.id);

    if (!accepted) throw new Error("Failed to accept quest");
    if (!qs.activeQuests.has(quest.id)) throw new Error("Quest not active");
    if (qs.availableQuests.has('villager_1')) throw new Error("Quest still available");

    console.log("Quest accepted successfully.");

    // 3. Check Progress
    qs.checkQuestProgress();
    if (quest.currentAmount !== 10) throw new Error(`Progress mismatch: ${quest.currentAmount}`);

    // 4. Complete Quest
    if (!qs.canCompleteQuest(quest.id)) throw new Error("Should be able to complete quest");

    console.log("Completing quest...");
    const completed = qs.completeQuest(quest.id);

    if (!completed) throw new Error("Failed to complete quest");
    if (qs.activeQuests.has(quest.id)) throw new Error("Quest still active after completion");
    if (!qs.completedQuests.has(quest.id)) throw new Error("Quest not marked completed");

    console.log("Quest completed successfully.");
    console.log("Verification Passed!");
}

runTest().catch(e => {
    console.error("Verification Failed:", e);
    process.exit(1);
});
