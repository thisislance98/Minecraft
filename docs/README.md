# VoxelWorld Documentation

This directory contains architecture documentation and technical references for the VoxelWorld project.

## Architecture Documents

### [Few-Shot AI System](./few-shot-architecture.md)
Complete architecture documentation for the Few-Shot AI system that powers dynamic creature, item, and structure generation.

**Topics Covered:**
- System overview and component architecture
- Request flow and data pipeline
- Example-based learning system
- Code validation and safety mechanisms
- WebSocket communication protocol
- Model support (Claude, GPT, Gemini)
- Error handling and retry logic
- Performance optimization
- Testing and debugging

**Visual Diagrams:**
- [Interactive SVG Diagram](./few-shot-architecture-visual.svg) - High-level system overview
- Sequence diagrams for request flows
- Validation and safety flow charts
- Component interaction diagrams

## Quick Navigation

### For Developers
- **Getting Started:** See main project README
- **Architecture:** [Few-Shot System](./few-shot-architecture.md#system-overview)
- **API Reference:** [Few-Shot API](./few-shot-architecture.md#api-endpoints)
- **Debugging:** [Debug Tips](./few-shot-architecture.md#debug-tips)

### For Contributors
- **Code Structure:** [Key Files](./few-shot-architecture.md#key-files)
- **Adding Examples:** See `server/ai/examples/`
- **Testing:** [Testing Guide](./few-shot-architecture.md#testing)
- **Common Commands:** [Quick Reference](./few-shot-architecture.md#common-commands)

### For Architects
- **Data Flow:** [Complete Request Flow](./few-shot-architecture.md#complete-request-flow)
- **Context Flow:** [Context Gathering](./few-shot-architecture.md#context-flow)
- **Safety:** [Validation & Safety](./few-shot-architecture.md#validation--safety)
- **Performance:** [Optimization Strategies](./few-shot-architecture.md#performance)

## System Components

### Client-Side (`src/game/`)
- **TaskManager** - Request queue and context gathering
- **Agent** - Tool executor (spawn, set_blocks, give_item)
- **VoxelGame** - Core game engine and world state

### Server-Side (`server/`)
- **FewShotAI** - Core AI engine (routing, generation, validation)
- **FewShotSession** - WebSocket handler and message router
- **Example Library** - Pre-built high-quality templates
- **Prompt System** - Category-specific prompt templates

### External Services
- **OpenRouter API** - LLM provider (Claude, GPT, Gemini)
- **WebSocket** - Real-time bidirectional communication

## Architecture Principles

### 1. Example-Based Learning
Instead of training custom models, we provide the LLM with high-quality examples and let it learn patterns on-the-fly. This approach is:
- **Fast** - No training required
- **Flexible** - Easy to add new examples
- **Cost-effective** - Minimal token usage (~2 tokens per request)
- **Reliable** - Examples serve as quality templates

### 2. Specialized Generation
Different types of content (creatures, items, structures) use specialized:
- Prompts with category-specific rules
- Example libraries with relevant templates
- Validation rules matching requirements
- Auto-repair logic for common issues

### 3. Safety First
All generated code goes through:
- **Syntax validation** - Check for JavaScript errors
- **Pattern validation** - Ensure required methods/classes
- **Sandboxed execution** - Limited scope for structure code
- **Auto-repair** - Attempt to fix common issues
- **Error reporting** - Clear feedback to user

### 4. Seamless Integration
The AI system integrates smoothly with the game:
- **Context awareness** - Player position, direction, terrain
- **Task queuing** - Sequential execution with parallel display
- **Retry logic** - Handle race conditions gracefully
- **Streaming responses** - Real-time feedback to user

## Key Features

### 🎯 Smart Routing
Uses LLM tool calling to determine user intent:
- Create new creature/item/structure
- Spawn existing entity
- Give existing item
- General chat/help

### 🎨 Example Matching
Keyword-based scoring system finds the best examples:
- Extract keywords from user request
- Score each example by relevance
- Return top N matches for prompt

### ✅ Robust Validation
Multi-layer validation ensures quality:
1. Syntax checking (Function constructor)
2. Pattern matching (required methods/classes)
3. Auto-repair (add missing implementations)
4. Safe execution (sandboxed code)

### 🚀 High Performance
Optimized for speed and cost:
- Streaming responses (token-by-token)
- Minimal token usage (~2 per request)
- Background connections (no blocking)
- Cached examples (in-memory)

### 🔧 Developer-Friendly
Easy to extend and debug:
- Clear separation of concerns
- HTTP test endpoints
- Detailed logging
- Visual debugging tools

## Common Workflows

### Adding a New Creature Example
```typescript
// server/ai/examples/creatures.ts
export const creatureExamples = [
    {
        name: "MyCreature",
        description: "A cool creature that does X",
        keywords: ["cool", "creature", "feature"],
        code: `class MyCreature extends Animal { ... }`
    }
];
```

### Testing Generation
```bash
# HTTP endpoint
curl -X POST http://localhost:5173/api/ai/fewshot/test \
  -H "Content-Type: application/json" \
  -d '{"prompt": "create a fire dragon"}'

# Find matching examples
curl -X POST http://localhost:5173/api/ai/fewshot/examples \
  -H "Content-Type: application/json" \
  -d '{"prompt": "fire dragon", "category": "creature"}'
```

### Debugging Issues
1. Check console for `[FewShotAI]` logs
2. Verify examples: `GET /api/ai/fewshot/examples`
3. Test generation: `POST /api/ai/fewshot/test`
4. Inspect WebSocket in browser DevTools
5. Check validation errors in response

## Future Enhancements

### Planned Features
- **Context-Aware Examples** - Use biome, time, nearby entities
- **Learning from Feedback** - Track success/failure rates
- **Multi-Step Generation** - Complex behaviors and interactions
- **Visual Feedback** - Preview before spawning
- **Collaborative Creation** - Multi-player co-creation

### Scalability
- Add more examples to library (currently ~15 per category)
- Support custom example injection (user-provided)
- Multi-language model support (local LLMs)
- Fine-tuned models for specific tasks

## Contributing

When contributing to the Few-Shot AI system:

1. **Follow existing patterns** - Study current examples
2. **Add comprehensive examples** - Each should be production-ready
3. **Document new features** - Update this documentation
4. **Test thoroughly** - Use test endpoints before WebSocket
5. **Consider performance** - Token usage matters

## Support

### Questions?
- Check the [Few-Shot Architecture](./few-shot-architecture.md) for detailed info
- Review [Common Commands](./few-shot-architecture.md#common-commands)
- See [Debug Tips](./few-shot-architecture.md#debug-tips)

### Issues?
- Validation failures? Check [Validation Flow](./few-shot-architecture.md#validation-flow-diagram)
- Connection problems? See [Error Handling](./few-shot-architecture.md#error-handling)
- Performance concerns? Review [Optimization](./few-shot-architecture.md#performance)

---

**Documentation Version:** 1.0
**Last Updated:** 2026-02-09
**Maintained by:** VoxelWorld Team
