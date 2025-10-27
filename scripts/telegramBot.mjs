#!/usr/bin/env node

import 'dotenv/config';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import cron from 'node-cron';
import TelegramBot from 'node-telegram-bot-api';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable.');
  process.exit(1);
}

const resolveFromRoot = (relativePath) => path.resolve(process.cwd(), relativePath);

const LESSONS_PATH = resolveFromRoot(process.env.LESSONS_PATH ?? 'daily_lessons.json');
const IMAGES_DIR = resolveFromRoot(process.env.LESSON_IMAGES_DIR ?? 'images');
const AUDIO_DIR = resolveFromRoot(process.env.LESSON_AUDIO_DIR ?? 'tts_audio');
const VIDEOS_PATH = resolveFromRoot(process.env.LESSON_VIDEOS_PATH ?? 'asma_ul_husna_videos.json');
const PROGRESS_PATH = resolveFromRoot(
  process.env.USER_PROGRESS_PATH ?? path.join('data', 'user_progress.json'),
);

const TIMEZONE = process.env.BOT_TIMEZONE ?? 'Asia/Tehran';
const LOCALE = process.env.BOT_LOCALE ?? 'fa-IR';
const DAILY_CRON = process.env.BOT_CRON_EXPRESSION ?? '0 6 * * *';
const MAX_MESSAGE_LENGTH = 4096;
const TOTAL_AUDIO_FILES = 100;
const TOTAL_IMAGE_FILES = 99;

const HELP_TEXT = [
  'دستورات در دسترس:',
  '• /start — آغاز یا ادامه سفر و دریافت درس اول',
  '• /progress — مشاهده پیشرفت و زمان درس بعدی',
  '• /lesson <شماره> — دریافت دستی یک درس مشخص (مثال: /lesson 5)',
  '• /help — نمایش دوباره‌ی این راهنما',
].join('\n');

const normalizeChatId = (value) => {
  const text = String(value);
  return /^-?\d+$/.test(text) ? Number.parseInt(text, 10) : value;
};

const readJsonFile = async (filePath, fallback) => {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }

    throw error;
  }
};

const ensureDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const loadLessons = async () => {
  const data = await readJsonFile(LESSONS_PATH, []);

  if (!Array.isArray(data)) {
    throw new Error(`Expected an array in ${LESSONS_PATH}, received ${typeof data}`);
  }

  const limited = data.slice(0, Math.min(TOTAL_IMAGE_FILES, TOTAL_AUDIO_FILES, data.length));

  if (limited.length === 0) {
    throw new Error(`No lessons found in ${LESSONS_PATH}`);
  }

  return limited;
};

const loadVideos = async (lessonCount) => {
  const data = await readJsonFile(VIDEOS_PATH, []);

  if (!Array.isArray(data)) {
    console.warn(`Ignoring videos: expected an array in ${VIDEOS_PATH}, received ${typeof data}`);
    return [];
  }

  return data.slice(0, lessonCount);
};

const formatChunks = (text) => {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const remaining = text.length - start;

    if (remaining <= MAX_MESSAGE_LENGTH) {
      chunks.push(text.slice(start).trim());
      break;
    }

    const tentativeEnd = start + MAX_MESSAGE_LENGTH;
    let splitIndex = text.lastIndexOf('\n', tentativeEnd);

    if (splitIndex <= start) {
      splitIndex = text.lastIndexOf(' ', tentativeEnd);
    }

    if (splitIndex <= start) {
      splitIndex = tentativeEnd;
    }

    const segment = text.slice(start, splitIndex).trim();

    if (segment) {
      chunks.push(segment);
    }

    start = splitIndex;
  }

  return chunks.filter(Boolean);
};

const lessons = await loadLessons();
const videos = await loadVideos(lessons.length);

const progress = await readJsonFile(PROGRESS_PATH, { users: {} });

if (typeof progress !== 'object' || progress === null || Array.isArray(progress)) {
  throw new Error(`Corrupted progress file at ${PROGRESS_PATH}`);
}

if (!progress.users || typeof progress.users !== 'object') {
  progress.users = {};
}

await ensureDirectory(path.dirname(PROGRESS_PATH));

const saveProgress = async () => {
  const tmpPath = `${PROGRESS_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(progress, null, 2), 'utf8');
  await fs.rename(tmpPath, PROGRESS_PATH);
};

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const ensureUserState = (chatId) => {
  const key = String(chatId);

  if (!progress.users[key]) {
    progress.users[key] = {
      currentLesson: 0,
      lastSentAt: null,
      joinedAt: new Date().toISOString(),
    };
  }

  return progress.users[key];
};

const sendLessonAssets = async (chatId, lessonIndex) => {
  const chatRef = normalizeChatId(chatId);
  const lessonNumber = lessonIndex + 1;
  const lessonText = lessons[lessonIndex];

  if (!lessonText) {
    await bot.sendMessage(
      chatRef,
      `درس شماره ${lessonNumber} در دسترس نیست. لطفاً با مسئول سامانه تماس بگیر.`,
    );
    return;
  }

  const imagePath = path.join(IMAGES_DIR, `devine-name-${lessonNumber}.jpg`);

  try {
    await fs.access(imagePath);
    await bot.sendPhoto(
      chatRef,
      createReadStream(imagePath),
      { caption: `نام الهی شماره ${lessonNumber}` },
      { filename: path.basename(imagePath), contentType: 'image/jpeg' },
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to send image for lesson ${lessonNumber}:`, error);
    }
  }

  const messageChunks = formatChunks(lessonText);

  for (const chunk of messageChunks) {
    await bot.sendMessage(chatRef, chunk);
  }

  const audioFilename = `lesson_${String(lessonNumber).padStart(3, '0')}.wav`;
  const audioPath = path.join(AUDIO_DIR, audioFilename);

  try {
    await fs.access(audioPath);
    await bot.sendAudio(
      chatRef,
      createReadStream(audioPath),
      {},
      { filename: audioFilename, contentType: 'audio/wav' },
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to send audio for lesson ${lessonNumber}:`, error);
    }
  }

  const videoMeta = videos[lessonIndex];

  if (videoMeta) {
    const videoCaptionLines = [
      videoMeta.title ? `• عنوان: ${videoMeta.title}` : null,
      videoMeta.url,
    ].filter(Boolean);

    await bot.sendMessage(chatRef, videoCaptionLines.join('\n'));
  }
};

const sendLessonToUser = async (chatId, lessonIndex) => {
  const chatRef = normalizeChatId(chatId);
  const userState = ensureUserState(chatId);

  if (lessonIndex >= lessons.length) {
    await bot.sendMessage(
      chatRef,
      '🎉 همه‌ی درس‌ها را گذرانده‌ای. امیدواریم این نام‌های نورانی همراهت بمانند.',
    );
    userState.currentLesson = lessons.length;
    await saveProgress();
    return;
  }

  try {
    await sendLessonAssets(chatId, lessonIndex);
    userState.currentLesson = Math.min(lessonIndex + 1, lessons.length);
    userState.lastSentAt = new Date().toISOString();
    await saveProgress();
  } catch (error) {
    console.error(`Failed to deliver lesson ${lessonIndex + 1} to ${chatId}:`, error);
  }
};

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  const chatKey = String(chatId);
  const existingState = progress.users[chatKey];

  if (!existingState) {
    ensureUserState(chatId);
    await saveProgress();
    await bot.sendMessage(
      chatId,
      'سلام! به سفر «اسماءالحسنی» خوش آمدی. درس اول همین حالا برایت ارسال می‌شود.',
    );
    await sendLessonToUser(chatId, 0);
    await bot.sendMessage(chatId, HELP_TEXT);
    return;
  }

  await bot.sendMessage(
    chatId,
    `خوش برگشتی! تا این لحظه ${Math.min(
      existingState.currentLesson,
      lessons.length,
    )} درس از مجموع ${lessons.length} درس را دریافت کرده‌ای. درس بعدی ساعت ۶:۰۰ ${TIMEZONE} برایت ارسال می‌شود.`,
  );
  await bot.sendMessage(chatId, HELP_TEXT);
});

bot.onText(/^\/progress$/, async (msg) => {
  const chatId = msg.chat.id;
  const chatKey = String(chatId);
  const existingState = progress.users[chatKey];

  if (!existingState) {
    await bot.sendMessage(
      chatId,
      'هیچ پیشرفتی برایت پیدا نکردم. ابتدا دستور /start را بفرست تا ثبت نامت کامل شود.',
    );
    return;
  }

  const { currentLesson, lastSentAt } = existingState;
  const nextLessonNumber = Math.min(currentLesson + 1, lessons.length);

  const progressLines = [
    `تا این لحظه ${currentLesson} درس از مجموع ${lessons.length} درس را دریافت کرده‌ای.`,
    currentLesson >= lessons.length
      ? '🎉 دوره را کامل کرده‌ای. آفرین!'
      : `درس بعدی: شماره ${nextLessonNumber} (برنامه‌ریزی شده برای ساعت ۶:۰۰ ${TIMEZONE}).`,
    lastSentAt
      ? `آخرین ارسال: ${new Date(lastSentAt).toLocaleString(LOCALE, { timeZone: TIMEZONE })}`
      : null,
  ].filter(Boolean);

  await bot.sendMessage(chatId, progressLines.join('\n'));
});

bot.onText(/^\/lesson\s+(\d{1,3})$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const lessonRequested = Number.parseInt(match[1], 10);

  if (!Number.isFinite(lessonRequested) || lessonRequested < 1 || lessonRequested > lessons.length) {
    await bot.sendMessage(
      chatId,
      `لطفاً شماره درسی بین ۱ و ${lessons.length} وارد کن؛ مثال: /lesson 5`,
    );
    return;
  }

  await bot.sendMessage(chatId, `درس ${lessonRequested} به درخواستت ارسال می‌شود.`);
  await sendLessonAssets(chatId, lessonRequested - 1);
});

bot.onText(/^\/help$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, HELP_TEXT);
});

const deliverDailyLessons = async () => {
  const userEntries = Object.entries(progress.users);

  if (userEntries.length === 0) {
    return;
  }

  console.log(
    `[${new Date().toISOString()}] Delivering daily lessons to ${userEntries.length} subscribers.`,
  );

  for (const [chatId, state] of userEntries) {
    if (!state || typeof state.currentLesson !== 'number') {
      continue;
    }

    if (state.currentLesson >= lessons.length) {
      continue;
    }

    await sendLessonToUser(chatId, state.currentLesson);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

cron.schedule(
  DAILY_CRON,
  () => {
    deliverDailyLessons().catch((error) => {
      console.error('Daily lesson delivery failed:', error);
    });
  },
  { timezone: TIMEZONE },
);

console.log(
  `Telegram bot started. Managing ${Object.keys(progress.users).length} subscribers across ${lessons.length
  } lessons.`,
);
