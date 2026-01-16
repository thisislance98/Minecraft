
import { getAntigravitySystemPrompt } from './ai/antigravity_prompt';

const prompt = getAntigravitySystemPrompt({});
const lines = prompt.split('\n');

console.log("\n--- SNIPPET: ENTITY LIST INSTRUCTIONS ---");
const entityHeaderIndex = lines.findIndex(l => l.includes("Common Entities (Dynamically Loaded)"));
if (entityHeaderIndex !== -1) {
    // Print header + next 10 lines (should include instructions + first few animals)
    console.log(lines.slice(entityHeaderIndex, entityHeaderIndex + 10).join('\n'));
}

console.log("\n--- SNIPPET: HORSE ENTRY ---");
const horseLine = lines.find(l => l.includes("Horse:"));
console.log(horseLine || "Horse not found");

console.log("\n--- SNIPPET: SLIME ENTRY ---");
const slimeLine = lines.find(l => l.includes("Slime:"));
console.log(slimeLine || "Slime not found");
