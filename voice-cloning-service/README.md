# Voice Cloning Service

This Python service handles celebrity voice cloning using PyTorch and torchaudio.

## Installation

1. Install Python 3.8 or higher
2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Service

```bash
python app.py
```

The service will run on http://localhost:5001

## Available Celebrity Voices

- Donald Trump
- Barack Obama
- Morgan Freeman
- David Attenborough
- Ariana Grande
- Elon Musk

## API Endpoints

### POST /clone
Clone a voice to a celebrity voice

**Request:**
- `audio`: Audio file (WAV format recommended)
- `target_voice`: Celebrity voice ID (trump, obama, morgan-freeman, etc.)

**Response:**
- Returns MP3 file with cloned voice

### GET /health
Check service status

## Notes

This implementation uses pitch shifting and audio effects for voice transformation. For production-quality voice cloning, you would need:
- Pre-trained RVC (Retrieval-based Voice Conversion) models
- Voice model files for each celebrity
- More sophisticated neural network processing
