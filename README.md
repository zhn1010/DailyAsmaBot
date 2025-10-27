# Asma ul Husna Lesson Generator

This project contains a Node.js script that uses the ChatGPT API to generate 100 daily lessons for memorising the 99 Names of Allah (Asma ul Husna). Each lesson builds on prior days, provides a relatable reflection, and ends with a remembrance recap of the names learned so far.

## Prerequisites

- Node.js 18 or newer (for built-in `fetch`).
- An OpenAI API key with access to a ChatGPT-capable model.

## Usage

1. Install dependencies (none required beyond Node.js).
2. Export your API key:
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```
3. (Optional) Pick a model by setting `OPENAI_MODEL` (defaults to `gpt-4.1-mini`).
4. Generate or resume the curriculum:
   ```bash
   # fresh run
   pnpm generate:lessons

   # resume from an existing output file
   pnpm generate:lessons -- --resume
   ```

The script writes `daily_lessons.json`, containing an array of 100 lesson strings (Day 1–100). Use `LESSONS_OUTPUT` to override the filename.

### Post-processing

- Convert remembrance rolls to Arabic script (in-place):
  ```bash
  pnpm lessons:arabic-roll
  ```
  Provide input/output paths to write to a different file:
  ```bash
  node scripts/convertRemembranceToArabic.mjs path/to/source.json path/to/output.json
  ```

- Decrement image sequence numbers in `images/`:
  ```bash
  pnpm images:reindex
  ```
  Supply a custom directory if needed:
  ```bash
  node scripts/renameImages.mjs path/to/images
  ```

- Render TTS audio for the lessons (skips files that already exist so you can resume safely; add `--overwrite` to regenerate):
  ```bash
  pnpm lessons:tts
  ```
  Customise the output directory, voice, or model:
  ```bash
  pnpm lessons:tts -- ./daily_lessons.json --out ./tts_audio --voice Kore --model gemini-2.5-flash-preview-tts --overwrite
  ```

- Fetch ranked Asma ul Husna videos (requires a YouTube Data API v3 key):
  ```bash
  export YOUTUBE_API_KEY="..."
  pnpm videos:asma
  ```
  The script requests up to 99 matches for each of the phrases `asmaul husna` and `asmaul husna for kids`, keeps only titles containing the number `99`, and preserves YouTube’s relevance ordering.  
  Optional tweaks:
  - Pass a custom output path: `pnpm videos:asma -- ./path/to/file.json`
  - Change the per-keyword cap by setting `MAX_RESULTS` (defaults to `99`)

- Resort an existing `asma_ul_husna_videos.json`, dedupe by URL, and refresh ranks using view/like counts (view count first, like count as tie-breaker):
  ```bash
  pnpm videos:sort            # overwrites asma_ul_husna_videos.json
  pnpm videos:sort -- ./input.json ./output.json  # explicit paths
  ```
- Re-rank the current JSON after deleting/reordering entries so `rank` matches the array position:
  ```bash
  pnpm videos:rerank                 # rewrites asma_ul_husna_videos.json in place
  pnpm videos:rerank -- input.json   # rewrites another file in place
  pnpm videos:rerank -- input.json output.json
  ```

## Telegram Bot

Send each day’s lesson (text, image, audio, and a recommended video link) to subscribers via Telegram.

1. Install dependencies and set up your bot token:
   ```bash
   pnpm install
   echo "TELEGRAM_BOT_TOKEN=123456789:ABCDE..." > .env
   ```
2. Start the bot in polling mode:
   ```bash
   pnpm bot:start
   ```
3. Key behaviours:
   - `/start` registers the chat and immediately delivers Lesson 1 (or resumes from the stored index).
   - Lessons 2–99 are delivered daily at **6:00 a.m. Asia/Tehran** using `node-cron`.
   - `/progress` reports how many lessons you have received and when the next drop arrives.
   - `/lesson <n>` resends a specific lesson on demand without changing the daily schedule.
   - `/help` lists the available commands inside the bot.
   - User progress lives in `data/user_progress.json`; delete or edit it to reset a subscriber.
   - Environment variables are loaded via `.env` (handled by `dotenv`); exporting them manually still works if you prefer.

### Bot configuration

Fine-tune paths or timing with environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `LESSONS_PATH` | `daily_lessons.json` | JSON array of lesson strings (only the first 99 entries are used). |
| `LESSON_IMAGES_DIR` | `images` | Directory containing lesson artwork (`devine-name-<n>.jpg`). |
| `LESSON_AUDIO_DIR` | `tts_audio` | Directory containing lesson audio (`lesson_<nnn>.wav`). |
| `LESSON_VIDEOS_PATH` | `asma_ul_husna_videos.json` | Optional YouTube metadata list; the first 99 entries are linked. |
| `USER_PROGRESS_PATH` | `data/user_progress.json` | Storage location for chat progress. |
| `BOT_TIMEZONE` | `Asia/Tehran` | Timezone passed to the cron scheduler. |
| `BOT_CRON_EXPRESSION` | `0 6 * * *` | Cron expression for daily deliveries. |

> The bot uses long polling by default. Switch `node-telegram-bot-api` to webhook mode if you deploy on a platform that prefers webhooks.

## Configuration Options

- `OPENAI_API_KEY`: authentication (required).
- `OPENAI_API_URL`: override the API endpoint (optional).
- `OPENAI_MODEL`: specify a different ChatGPT model.
- `LESSONS_OUTPUT`: change the output filename.
- `OPENAI_MAX_RETRIES`: retry count for API calls (default 3).
- `OPENAI_RETRY_DELAY_MS`: initial retry delay in milliseconds.

## Output Format

Each array element is a complete lesson string that includes:
- a heading with the day and focus name,
- a reflective narrative with practice prompts,
- a concluding “Remembrance Roll” that lists the names memorised up to that day.

Day 100 provides a review and celebration of all 99 names while reinforcing the complete remembrance roll.
