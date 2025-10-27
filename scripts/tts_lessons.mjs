// tts_lessons.mjs
import { readFile, mkdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";
import wav from "wav";

// ---- Config (override via CLI args) ----
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error("Usage: node tts_lessons.mjs <daily_lesson.json> [--out outdir] [--voice Kore] [--model gemini-2.5-flash-preview-tts] [--overwrite]");
    process.exit(1);
}

const inputPath = resolve(args[0]);
const outDir = getFlag("--out", "audio_out");
const voiceName = getFlag("--voice", "Kore");
// TTS models are currently in preview; this one supports native audio output.
const modelName = getFlag("--model", "gemini-2.5-flash-preview-tts");

const overwriteExisting = hasFlag("--overwrite") || hasFlag("--force");

// WAV/PCM parameters returned by the API (per docs)
const CHANNELS = 1;
const SAMPLE_RATE = 24000; // Hz
const SAMPLE_WIDTH_BYTES = 2; // 16-bit PCM

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// ---- Helpers ----
function getFlag(flag, fallback) {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

function hasFlag(flag) {
    return args.includes(flag);
}

async function ensureDir(p) {
    try {
        const s = await stat(p);
        if (!s.isDirectory()) throw new Error(`${p} exists and is not a directory`);
    } catch {
        await mkdir(p, { recursive: true });
    }
}

function toPadded(n, width = 3) {
    return String(n).padStart(width, "0");
}

function saveWaveFile(filename, pcmBuffer, channels = CHANNELS, rate = SAMPLE_RATE, sampleWidth = SAMPLE_WIDTH_BYTES) {
    return new Promise((resolve, reject) => {
        const writer = new wav.FileWriter(filename, {
            channels,
            sampleRate: rate,
            bitDepth: sampleWidth * 8,
        });
        writer.on("finish", resolve);
        writer.on("error", reject);
        writer.write(pcmBuffer);
        writer.end();
    });
}

// Simple retry wrapper (handles transient 429/5xx)
async function withRetry(fn, { retries = 3, delayMs = 1000 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
            }
        }
    }
    throw lastErr;
}

// ---- Main ----
(async () => {
    await ensureDir(outDir);

    const raw = await readFile(inputPath, "utf-8");
    let lines;
    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || !data.every(s => typeof s === "string")) {
            throw new Error("JSON must be an array of strings.");
        }
        lines = data;
    } catch (e) {
        console.error(`Failed to parse ${basename(inputPath)}: ${e.message}`);
        process.exit(1);
    }

    console.log(`Generating audio with model "${modelName}" and voice "${voiceName}"`);
    let idx = 0;
    for (const text of lines) {
        idx++;
        const fileBase = `lesson_${toPadded(idx)}`;
        const outPath = resolve(outDir, `${fileBase}.wav`);

        if (!text?.trim()) {
            console.warn(`Skipping #${idx}: empty string`);
            continue;
        }

        if (!overwriteExisting) {
            try {
                const existing = await stat(outPath);
                if (existing.isFile()) {
                    console.log(`↷ Skipping #${idx} (${outPath}) – already exists (use --overwrite to regenerate).`);
                    continue;
                }
            } catch {
                // File does not exist; continue generation.
            }
        }

        // Build request to return audio (PCM) and chosen voice
        const genFn = async () => {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName },
                        },
                    },
                },
            });

            // Extract base64 PCM payload
            const b64 = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!b64) throw new Error("No audio data returned from Gemini.");
            return Buffer.from(b64, "base64");
        };

        try {
            const pcmBuffer = await withRetry(genFn);
            await saveWaveFile(outPath, pcmBuffer);
            console.log(`✔ Wrote ${outPath}`);
        } catch (err) {
            console.error(`✖ Failed item #${idx}: ${err.message}`);
        }
    }

    console.log("Done.");
})();
