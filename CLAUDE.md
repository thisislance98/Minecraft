
<!-- CODEUI-RULES -->
## Custom Rules

if it's a new feature, try to use a test cli unless it would be much easier to just have the user do a manual test (this is usually the case for visual features).. if it doesn't have functionality to do the test then add it. you can also use playwright mcp or curl if either of these would be easier. make sure you have enough logging to debug any issues.. if you create any test files, clean them up when you are done. If you need to restart the app use start.sh.. NEVER TOUCH PORT 4001.. if you are having issues with public apis, lookup examples online. for google auth you can use thisislance98@gmail.com and pw: Butch_988
<!-- /CODEUI-RULES -->

## Merlin AI System (Few-Shot)

The Merlin panel is the in-game AI assistant that creates creatures, items, and structures. Before working on any Merlin/few-shot related code, **you MUST read the relevant skill files**:

- **Creatures**: Read `.claude/skills/implementing-creatures.md` before touching creature generation, the Animal base class, DynamicCreatureService, creature examples, or creature prompts.
- **Items**: Read `.claude/skills/implementing-items.md` before touching item generation, the Item/WandItem base classes, DynamicItemService, item examples, or item prompts.
- **Structures**: Read `.claude/skills/implementing-structures.md` before touching structure/building generation, block placement, structure examples, or structure prompts.

These skills document the full architecture, file locations, class patterns, validation rules, and how the few-shot system, server persistence, client registration, and Socket.IO broadcasting all fit together. Following the patterns in the skills ensures new code is consistent with the existing system.
