# AI Bingo Treasure Hunter 🎯

A mobile-first web application for group treasure hunt games. Teams compete to find real-world objects matching a 3×3 bingo card, photograph them, and let a Vision Language Model (VLM) verify the match through the Hugging Face Inference API.

## Features

- **3×3 Bingo Card** — 9 objects to find in the real world
- **Camera Integration** — Take photos directly from the browser using `getUserMedia`
- **AI Verification** — Vision Language Model validates whether the photo matches the target object
- **Team Progress** — localStorage-based persistence survives refreshes and tab closures
- **Bingo Detection** — Automatic detection of winning lines (rows, columns, diagonals)
- **Celebration Screen** — Confetti and stats when a team achieves bingo
- **Mock Mode** — Development without an API token using `USE_MOCK_VLM=true`
- **File Upload Fallback** — When camera access is denied or unavailable

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Icons | Lucide React |
| Validation | Zod |
| VLM API | Hugging Face Inference API (OpenAI-compatible) |
| Camera | Browser `getUserMedia` API |
| Persistence | localStorage |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Hugging Face account with API token (or use Mock Mode)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd objectdetection

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Edit `.env.local`:

```env
# Required: Your Hugging Face API token
HUGGINGFACE_API_TOKEN=hf_your_token_here

# Required: The VLM model to use
HUGGINGFACE_MODEL_ID=google/gemma-4-31B-it:novita

# Optional: Enable mock mode for development without API
USE_MOCK_VLM=false
```

### Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

## How to Change the VLM Model

Edit the `HUGGINGFACE_MODEL_ID` in `.env.local`. The app uses the [Hugging Face Router](https://huggingface.co/docs/api-inference/en/index) with an OpenAI-compatible API, so any model accessible through the router will work.

**Recommended models:**

| Model | Provider Suffix |
|-------|----------------|
| Google Gemma 4 31B | `google/gemma-4-31B-it:novita` |
| Qwen 2.5 VL 72B | `Qwen/Qwen2.5-VL-72B-Instruct` |
| Meta Llama 4 Scout | `meta-llama/Llama-4-Scout-17B-16E-Instruct` |

The model must support vision (image input) and text output in JSON format.

## How to Customize Bingo Tiles

Edit the file `lib/bingo-data.ts`. The `BINGO_TILES` array contains 9 tile definitions:

```ts
{
  id: "bottle",           // Unique identifier
  label: "Bottle",        // Display name
  description: "Find a drinking bottle.",  // Instructions
  acceptedTerms: [        // Terms the VLM checks against
    "bottle", "water bottle", "drinking bottle"
  ],
  icon: "Wine",           // Lucide icon name
}
```

**Rules:**
- Keep exactly 9 tiles for the 3×3 grid
- Each `id` must be unique
- `icon` must be a valid [Lucide icon name](https://lucide.dev/icons)
- `acceptedTerms` helps the VLM understand what counts as a match

## Project Structure

```
app/
  page.tsx                      → Team login (/)
  game/
    page.tsx                    → Bingo grid (/game)
    tile/[tileId]/page.tsx      → Camera + validation (/game/tile/bottle)
  api/validate-object/route.ts  → VLM proxy API

components/
  team-login-form.tsx           → Login form with validation
  game-header.tsx               → Header with team menu
  progress-summary.tsx          → Progress bar
  bingo-grid.tsx                → 3×3 grid container
  bingo-tile.tsx                → Individual tile
  camera-capture.tsx            → Camera with getUserMedia
  image-preview.tsx             → Photo review before submit
  validation-result.tsx         → Success/failure display
  bingo-celebration.tsx         → Win screen with confetti
  reset-progress-dialog.tsx     → Reset confirmation

lib/
  bingo-data.ts                 → Tile definitions (config)
  bingo-utils.ts                → Win detection logic
  storage.ts                    → localStorage abstraction
  image-utils.ts                → Image compression
  huggingface.ts                → HF API client (server-only)
  validation-schema.ts          → Zod schemas
```

## Mock Mode

Set `USE_MOCK_VLM=true` in `.env.local` to run without a Hugging Face token. In mock mode:

- The API simulates VLM responses with random success/failure
- A ~2-second delay simulates API latency
- No external API calls are made

This is useful for UI development and demonstrations.

## Security

- The Hugging Face token **never** leaves the server — all API calls go through the Next.js server route at `/api/validate-object`
- Images are validated for MIME type (JPEG, PNG, WebP only) and size
- Input is sanitized and validated with Zod
- Basic per-IP rate limiting (15 requests/minute)
- Photos are not stored — they are used for inference only and discarded

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Camera not working | Check browser permissions. Use HTTPS in production. |
| "Model is loading" error | Wait ~30s for cold start, then retry. |
| API timeout | The model may be overloaded. Try again later. |
| Progress lost | Check if localStorage was cleared. Incognito mode does not persist. |
| Tiles not updating after validation | Refresh the page — progress is saved to localStorage. |

## License

MIT
