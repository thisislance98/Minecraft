# ElevenLabs CLI

A command-line tool for generating text-to-speech, sound effects, and music using the ElevenLabs API.

## Installation

```bash
cd elevenlabs-cli
npm install
npm link  # Makes 'elevenlabs' command available globally
```

## Setup

1. Get your API key from [elevenlabs.io](https://elevenlabs.io)
2. Create a `.env` file:
   ```
   ELEVENLABS_API_KEY=your_api_key_here
   ```

## Commands

### List Voices
```bash
elevenlabs voices
elevenlabs voices --json  # Output as JSON
```

### Text-to-Speech
```bash
elevenlabs voice "Hello, world!" -o hello.mp3
elevenlabs voice "Welcome to my game" -v EXAVITQu4vr4xnSDxMaL -o welcome.mp3
```

Options:
- `-o, --output <file>` - Output file (default: voice_output.mp3)
- `-v, --voice <id>` - Voice ID
- `-m, --model <id>` - Model ID (default: eleven_multilingual_v2)
- `--stability <value>` - Voice stability 0-1
- `--similarity <value>` - Similarity boost 0-1

### Sound Effects
```bash
elevenlabs sound "explosion in a cave" -o explosion.mp3
elevenlabs sound "footsteps on gravel" -d 5 -o footsteps.mp3
elevenlabs sound "ambient forest sounds" --loop -o forest.mp3
```

Options:
- `-o, --output <file>` - Output file (default: sound_output.mp3)
- `-d, --duration <seconds>` - Duration in seconds
- `-l, --loop` - Create seamlessly looping sound
- `-i, --influence <value>` - Prompt influence 0-1

### Music
```bash
elevenlabs music "upbeat electronic dance music" -o edm.mp3
elevenlabs music "calm piano background" -d 60 -o piano.mp3
elevenlabs music "epic orchestral battle theme" --loop -o battle.mp3
```

Options:
- `-o, --output <file>` - Output file (default: music_output.mp3)
- `-d, --duration <seconds>` - Duration (default: 30)
- `-l, --loop` - Create seamlessly looping music
- `-i, --influence <value>` - Prompt influence 0-1
