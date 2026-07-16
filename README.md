#   

This version uses a Hugging Face vision-language model through the
OpenAI-compatible Router API (`router.huggingface.co/v1`). The model
runs remotely, not on the user's device.

## Setup

```bash
npm install
cp .env.example .env
```

Add your Hugging Face token:

```env
HF_TOKEN=hf_your_token_here
HF_MODEL=google/gemma-4-31B-it:novita
PORT=3000
```

Run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Clue storage

All game clues and judging examples are stored in:

```text
data/clues.json
```

The browser receives only:

- clue ID
- visible clue
- difficulty

Accepted and rejected examples stay on the server. When checking a photo, the
browser submits only the clue ID. The server loads the authoritative clue from
JSON, so changing browser HTML does not change the judging prompt.

## VLM result

The VLM is instructed to return:

```json
{
  "match": true,
  "confidence": 0.91,
  "object": "water bottle",
  "reason": "A bottle is commonly used for drinking."
}
```

The app passes when `match` is true and confidence is at least `0.65`.

## Notes

Inference Provider availability can change. The default model is one of the
models recommended in Hugging Face's image-text-to-text documentation. If that
model is unavailable for your account/provider, replace `HF_MODEL` with another
vision-language model that shows an available Inference Provider on its Hugging
Face model page.
