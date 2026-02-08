# Test CLI Guide

This guide covers how to use the test CLI to test in-game features including the Merlin AI system and multiplayer functionality.

## Quick Start

```bash
# 1. Start the game server and frontend
./start.sh

# 2. Open browser to http://localhost:3000

# 3. Run test commands from another terminal
node ai-test-cli/bin/cli.js <command>
```

## Installation

The test CLI is located in `ai-test-cli/` directory. You can run it directly:

```bash
node ai-test-cli/bin/cli.js <command>
```

Or install it globally for the `ai-test` shortcut:

```bash
cd ai-test-cli && npm link
```

---

## Testing Merlin AI System

### Quick AI Prompt Test

The simplest way to test Merlin is with the basic test script:

```bash
node scripts/test-ai.js "spawn a wolf"
```

This sends a prompt to the AI system through the Colyseus game server.

### Interactive AI Chat

Start an interactive session with Merlin:

```bash
ai-test interactive
```

Or use the WebSocket-based chat:

```bash
ai-test merlin-chat --provider gemini
```

Supported providers: `gemini`, `openrouter`, `claude`

### Full E2E AI Testing

Run comprehensive tests with browser automation:

```bash
# Full Merlin verification suite
ai-test merlin verify --headless

# Test specific AI functionality
ai-test test "create a glass pyramid" --tool build_structure --headless

# Test creature spawning
ai-test test "spawn an elephant" --creature Elephant --headless
```

### Testing RAG (Knowledge Retrieval)

```bash
# Test what templates are retrieved for a prompt
ai-test rag "how do I make a custom creature"

# Test prompt classification
ai-test rag-classify "spawn a dragon that breathes fire"

# Full knowledge retrieval test
ai-test verify-knowledge "create a red spinning cube" --timeout 60000
```

### Direct Tool Testing

Test specific AI tools directly:

```bash
ai-test tool spawn_creature '{"creature":"Wolf","count":1}'
ai-test tool build_structure '{"type":"pyramid","material":"glass"}'
```

---

## Testing Multiplayer

### Launch Multiple Browser Instances

```bash
# Start 3 browser instances for multiplayer testing
ai-test multi --count 3

# With headless mode (faster, no GUI)
ai-test multi --count 3 --headless
```

### Test Creature Synchronization

Verify that dynamically created creatures appear in all connected clients:

```bash
ai-test test-creature-sync --description "a hopping blue cube" --name HoppingCube
```

### Test Chat Synchronization

Verify chat messages sync across all players:

```bash
ai-test test-chat-sync
```

### Manual Multiplayer Testing

1. Start the server: `./start.sh`
2. Open multiple browser tabs to `localhost:3000`
3. Use the game console to inspect state:

```bash
ai-test console
> players    # See all connected players
> entities   # See all entities in the world
> spawn Wolf # Spawn a creature and verify it appears for all players
```

---

## Game Console

The interactive game console is one of the most powerful debugging tools:

```bash
ai-test console
```

### Console Commands

| Command | Description |
|---------|-------------|
| `state` | Show full game state |
| `pos` | Show player position |
| `inventory` | Show player inventory |
| `entities` | List all entities |
| `players` | List connected players |
| `spawn <type>` | Spawn a creature (e.g., `spawn Wolf`) |
| `give <item> [count]` | Give item to player (e.g., `give diamond_sword 10`) |
| `tp <x> <y> <z>` | Teleport player |
| `prompt "<text>"` | Send AI prompt (e.g., `prompt "build a house"`) |

---

## Drive Command (Execute JavaScript)

Execute JavaScript directly in the game with SDK access:

```bash
# One-liner
ai-test drive "VoxelWorld.spawn('sphere')"

# From file
ai-test drive --file my-script.js

# Interactive mode
ai-test drive --interactive
```

Available globals in drive mode:
- `VoxelWorld` - Main SDK
- `game` - Game instance
- `player` - Local player
- `THREE` - Three.js library
- `detect()` / `detectAround()` - Entity detection helpers

---

## World Management

### Create a World

```bash
ai-test world create --name "Test World" --description "For testing" --seed 12345
```

### List Worlds

```bash
ai-test world list
ai-test world list --mine  # Only your worlds
```

### Load a World

```bash
ai-test world load <worldId>
ai-test world load <worldId> --console  # Load and open console
```

### World Info & Update

```bash
ai-test world info <worldId>
ai-test world update <worldId> --name "New Name"
ai-test world delete <worldId>
```

---

## Performance Testing

### Profile Game Performance

```bash
ai-test profile --duration 30 --samples 120
```

This analyzes:
- FPS (frames per second)
- Draw calls
- Triangle count
- Memory usage

### Material & Entity Audit

Check for missing textures and validate entities:

```bash
ai-test audit
```

---

## Custom Verification

### Verify with Custom Code

```bash
ai-test test "create a bouncing ball" \
  --creature BouncingBall \
  --verify-code "() => {
    const game = window.__VOXEL_GAME__;
    const ball = game.animals.find(a => a.constructor.name === 'BouncingBall');
    return { success: !!ball, message: ball ? 'Found' : 'Not found' };
  }"
```

### Verify from File

```bash
ai-test test "spawn a wolf" --verify-file ./tests/verify-wolf.js
```

---

## Example Workflows

### Testing a New AI Feature

```bash
# 1. Test how the prompt is classified
ai-test rag-classify "make a bouncing ball"

# 2. Run E2E test with verification
ai-test test "create a bouncing ball" --creature BouncingBall --headless

# 3. Verify multiplayer sync
ai-test test-creature-sync --description "a bouncing ball" --name BouncingBall
```

### Debugging AI Issues

```bash
# 1. Launch console
ai-test console

# 2. Check current game state
> state

# 3. Test AI directly
> prompt "spawn a wolf"

# 4. Verify the result
> entities

# 5. Check browser console output (appears in CLI)
```

### CI/CD Testing

```bash
# Run headless tests suitable for CI
ai-test merlin verify --headless
ai-test test "spawn a wolf" --creature Wolf --headless
ai-test test-creature-sync --headless
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MINECRAFT_PORT` | 2567 | Colyseus server port |
| Frontend | 3000 | Vite dev server port |

### Starting the Application

```bash
# Full stack (recommended)
./start.sh

# Frontend only
npm run dev

# Server only
npm run server

# Both with concurrently
npm run dev:all
```

---

## Command Reference

### AI Testing Commands

| Command | Description |
|---------|-------------|
| `ai-test <prompt>` | Send one-off prompt to AI |
| `ai-test interactive` | Interactive AI chat session |
| `ai-test test <prompt>` | Run E2E test with browser automation |
| `ai-test merlin verify` | Full Merlin verification suite |
| `ai-test merlin-chat` | WebSocket-based Merlin chat |
| `ai-test merlin-prompt <prompt>` | Single Merlin prompt |
| `ai-test tool <name> <args>` | Direct tool testing |

### RAG Testing Commands

| Command | Description |
|---------|-------------|
| `ai-test rag <prompt>` | Test RAG template lookup |
| `ai-test rag-classify <prompt>` | Test task classification |
| `ai-test rag-lookup <prompt>` | Full RAG template lookup |
| `ai-test verify-knowledge <prompt>` | End-to-end knowledge test |

### Multiplayer Commands

| Command | Description |
|---------|-------------|
| `ai-test multi` | Launch multiple browsers |
| `ai-test test-creature-sync` | Test creature sync |
| `ai-test test-chat-sync` | Test chat sync |

### Utility Commands

| Command | Description |
|---------|-------------|
| `ai-test console` | Interactive game console |
| `ai-test drive [script]` | Execute JavaScript in game |
| `ai-test game-state` | Quick game state snapshot |
| `ai-test profile` | Performance profiling |
| `ai-test audit` | Material & entity audit |
| `ai-test restart` | Restart server |
| `ai-test cleanup` | Remove test artifacts |

---

## Tips & Best Practices

1. **Always start with `./start.sh`** - Ensures clean process state
2. **Use `--headless` for CI/CD** - Faster execution without GUI
3. **Check logs** - Test logs are saved in `ai-test-cli/test_*.log`
4. **Use console for debugging** - `ai-test console` provides full game access
5. **Verify multiplayer** - Always test creature/item sync across browsers
6. **Profile regularly** - Catch performance regressions early
7. **Use custom verification** - Write JavaScript to verify complex scenarios
8. **Test RAG templates** - Ensure knowledge retrieval works for your prompts

---

## Troubleshooting

### Server Not Responding

```bash
# Kill any hanging processes and restart
ai-test restart
./start.sh
```

### Browser Automation Fails

```bash
# Try without headless to see what's happening
ai-test test "spawn a wolf" --creature Wolf
# (no --headless flag)
```

### AI Not Responding

```bash
# Check AI provider status
ai-test merlin-chat --provider gemini

# Try different provider
ai-test merlin-chat --provider openrouter
```

### Cleanup Test Artifacts

```bash
# Remove test files
ai-test cleanup

# Dry run first
ai-test cleanup --dry-run
```
