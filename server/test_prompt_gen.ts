
import { getAntigravitySystemPrompt } from './ai/antigravity_prompt';

console.log("Generating prompt...");
const prompt = getAntigravitySystemPrompt({});

console.log("Checking for 'Horse'...");
if (prompt.includes("Horse: '../src/game/entities/animals/Horse.js'")) {
    console.log("✅ Horse found in prompt.");
} else {
    console.error("❌ Horse NOT found in prompt.");
}

console.log("Checking for 'Slime'...");
if (prompt.includes("Slime: '../src/game/entities/monsters/Slime.js'")) {
    console.log("✅ Slime found in prompt.");
} else {
    console.error("❌ Slime NOT found in prompt.");
}

console.log("Checking for 'Registry' instruction...");
if (prompt.includes("You do NOT need to check AnimalRegistry.js")) {
    console.log("✅ Registry bypass instruction found.");
} else {
    console.error("❌ Registry bypass instruction NOT found.");
}
