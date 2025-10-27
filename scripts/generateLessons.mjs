#!/usr/bin/env node

/**
 * Generate 100 daily lessons for memorising Asma ul Husna using the ChatGPT API.
 * Each lesson builds on the previous ones and concludes with a remembrance recap.
 *
 * Requirements & usage:
 *   1. Set `OPENAI_API_KEY` in your environment.
 *   2. Optionally set `OPENAI_MODEL` (defaults to gpt-4.1-mini).
 *   3. Run `node scripts/generateLessons.mjs` from the project root.
 *   4. Use `--resume` to continue from an existing output file.
 *
 * The script writes an array of 100 lesson strings to `daily_lessons.json`
 * (override with `LESSONS_OUTPUT`), preserving previously generated lessons.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
const OUTPUT_FILENAME = process.env.LESSONS_OUTPUT ?? 'daily_lessons.json';
const MAX_RETRIES = Number.parseInt(process.env.OPENAI_MAX_RETRIES ?? '3', 10);
const BASE_DELAY_MS = Number.parseInt(process.env.OPENAI_RETRY_DELAY_MS ?? '1000', 10);

if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable.');
  process.exit(1);
}

const divineNames = [
  { index: 1, arabic: 'الرَّحْمَنُ', transliteration: 'AR-RAHMAAN', meaning: 'The Beneficent' },
  { index: 2, arabic: 'الرَّحِيمُ', transliteration: 'AR-RAHEEM', meaning: 'The Merciful' },
  { index: 3, arabic: 'الْمَلِكُ', transliteration: 'AL-MALIK', meaning: 'The Eternal Lord' },
  { index: 4, arabic: 'الْقُدُّوسُ', transliteration: 'AL-QUDDUS', meaning: 'The Most Sacred' },
  { index: 5, arabic: 'السَّلاَمُ', transliteration: 'AS-SALAM', meaning: 'The Embodiment of Peace' },
  { index: 6, arabic: 'الْمُؤْمِنُ', transliteration: "AL-MU'MIN", meaning: 'The Infuser of Faith' },
  { index: 7, arabic: 'الْمُهَيْمِنُ', transliteration: 'AL-MUHAYMIN', meaning: 'The Preserver of Safety' },
  { index: 8, arabic: 'الْعَزِيزُ', transliteration: 'AL-AZIZ', meaning: 'All Mighty' },
  { index: 9, arabic: 'الْجَبَّارُ', transliteration: 'AL-JABBAR', meaning: 'The Compeller, The Restorer' },
  { index: 10, arabic: 'الْمُتَكَبِّرُ', transliteration: 'AL-MUTAKABBIR', meaning: 'The Supreme, The Majestic' },
  { index: 11, arabic: 'الْخَالِقُ', transliteration: 'AL-KHAALIQ', meaning: 'The Creator, The Maker' },
  { index: 12, arabic: 'الْبَارِئُ', transliteration: 'AL-BAARI', meaning: 'The Evolver' },
  { index: 13, arabic: 'الْمُصَوِّرُ', transliteration: 'AL-MUSAWWIR', meaning: 'The Fashioner' },
  { index: 14, arabic: 'الْغَفَّارُ', transliteration: 'AL-GHAFFAR', meaning: 'The Great Forgiver' },
  { index: 15, arabic: 'الْقَهَّارُ', transliteration: 'AL-QAHHAR', meaning: 'The All-Prevailing One' },
  { index: 16, arabic: 'الْوَهَّابُ', transliteration: 'AL-WAHHAAB', meaning: 'The Supreme Bestower' },
  { index: 17, arabic: 'الرَّزَّاقُ', transliteration: 'AR-RAZZAAQ', meaning: 'The Provider' },
  { index: 18, arabic: 'الْفَتَّاحُ', transliteration: 'AL-FATTAAH', meaning: 'The Supreme Solver' },
  { index: 19, arabic: 'الْعَلِيمُ', transliteration: "AL-'ALEEM", meaning: 'The All-Knowing' },
  { index: 20, arabic: 'الْقَابِضُ', transliteration: 'AL-QAABID', meaning: 'The Withholder' },
  { index: 21, arabic: 'الْبَاسِطُ', transliteration: 'AL-BAASIT', meaning: 'The Extender' },
  { index: 22, arabic: 'الْخَافِضُ', transliteration: 'AL-KHAAFIDH', meaning: 'The Reducer' },
  { index: 23, arabic: 'الرَّافِعُ', transliteration: "AR-RAAFI'", meaning: 'The Exalter, The Elevator' },
  { index: 24, arabic: 'الْمُعِزُّ', transliteration: "AL-MU'IZZ", meaning: 'The Honourer, The Bestower' },
  { index: 25, arabic: 'ٱلْمُذِلُّ', transliteration: 'AL-MUZIL', meaning: 'The Dishonourer, The Humiliator' },
  { index: 26, arabic: 'السَّمِيعُ', transliteration: "AS-SAMEE'", meaning: 'The All-Hearing' },
  { index: 27, arabic: 'الْبَصِيرُ', transliteration: 'AL-BASEER', meaning: 'The All-Seeing' },
  { index: 28, arabic: 'الْحَكَمُ', transliteration: 'AL-HAKAM', meaning: 'The Impartial Judge' },
  { index: 29, arabic: 'الْعَدْلُ', transliteration: "AL-'ADL", meaning: 'The Utterly Just' },
  { index: 30, arabic: 'اللَّطِيفُ', transliteration: 'AL-LATEEF', meaning: 'The Subtle One, The Most Gentle' },
  { index: 31, arabic: 'الْخَبِيرُ', transliteration: 'AL-KHABEER', meaning: 'The All-Aware' },
  { index: 32, arabic: 'الْحَلِيمُ', transliteration: 'AL-HALEEM', meaning: 'The Most Forbearing' },
  { index: 33, arabic: 'الْعَظِيمُ', transliteration: "AL-'AZEEM", meaning: 'The Magnificent, The Supreme' },
  { index: 34, arabic: 'الْغَفُورُ', transliteration: 'AL-GHAFOOR', meaning: 'The Great Forgiver' },
  { index: 35, arabic: 'الشَّكُورُ', transliteration: 'ASH-SHAKOOR', meaning: 'The Most Appreciative' },
  { index: 36, arabic: 'الْعَلِيُّ', transliteration: "AL-'ALEE", meaning: 'The Most High, The Exalted' },
  { index: 37, arabic: 'الْكَبِيرُ', transliteration: 'AL-KABEER', meaning: 'The Preserver, The All-Heedful and All-Protecting' },
  { index: 38, arabic: 'الْحَفِيظُ', transliteration: 'AL-HAFEEDH', meaning: 'The Preserver' },
  { index: 39, arabic: 'الْمُقِيتُ', transliteration: 'AL-MUQEET', meaning: 'The Sustainer' },
  { index: 40, arabic: 'الْحَسِيبُ', transliteration: 'AL-HASEEB', meaning: 'The Reckoner' },
  { index: 41, arabic: 'الْجَلِيلُ', transliteration: 'AL-JALEEL', meaning: 'The Majestic' },
  { index: 42, arabic: 'الْكَرِيمُ', transliteration: 'AL-KAREEM', meaning: 'The Most Generous, The Most Esteemed' },
  { index: 43, arabic: 'الرَّقِيبُ', transliteration: 'AR-RAQEEB', meaning: 'The Watchful' },
  { index: 44, arabic: 'ٱلْمُجِيبُ', transliteration: 'AL-MUJEEB', meaning: 'The Responsive One' },
  { index: 45, arabic: 'الْوَاسِعُ', transliteration: 'AL-WAASI', meaning: 'The All-Encompassing, The Boundless' },
  { index: 46, arabic: 'الْحَكِيمُ', transliteration: 'AL-HAKEEM', meaning: 'The All-Wise' },
  { index: 47, arabic: 'الْوَدُودُ', transliteration: 'AL-WADUD', meaning: 'The Most Loving' },
  { index: 48, arabic: 'الْمَجِيدُ', transliteration: 'AL-MAJEED', meaning: 'The Glorious, The Most Honorable' },
  { index: 49, arabic: 'الْبَاعِثُ', transliteration: 'AL-BAAITH', meaning: 'The Infuser of New Life' },
  { index: 50, arabic: 'الشَّهِيدُ', transliteration: 'ASH-SHAHEED', meaning: 'The All Observing Witnessing' },
  { index: 51, arabic: 'الْحَقُّ', transliteration: 'AL-HAQQ', meaning: 'The Absolute Truth' },
  { index: 52, arabic: 'الْوَكِيلُ', transliteration: 'AL-WAKEEL', meaning: 'The Trustee, The Disposer of Affairs' },
  { index: 53, arabic: 'الْقَوِيُّ', transliteration: 'AL-QAWIYY', meaning: 'The All-Strong' },
  { index: 54, arabic: 'الْمَتِينُ', transliteration: 'AL-MATEEN', meaning: 'The Firm, The Steadfast' },
  { index: 55, arabic: 'الْوَلِيُّ', transliteration: 'AL-WALIYY', meaning: 'The Protecting Associate' },
  { index: 56, arabic: 'الْحَمِيدُ', transliteration: 'AL-HAMEED', meaning: 'The Praiseworthy' },
  { index: 57, arabic: 'الْمُحْصِي', transliteration: 'AL-MUHSEE', meaning: 'The All-Enumerating, The Counter' },
  { index: 58, arabic: 'الْمُبْدِئُ', transliteration: 'AL-MUBDI', meaning: 'The Originator, The Initiator' },
  { index: 59, arabic: 'ٱلْمُعِيدُ', transliteration: 'AL-MUEED', meaning: 'The Restorer, The Reinstater' },
  { index: 60, arabic: 'الْمُحْيِي', transliteration: 'AL-MUHYI', meaning: 'The Giver of Life' },
  { index: 61, arabic: 'الْمُمِيتُ', transliteration: 'AL-MUMEET', meaning: 'The Inflicter of Death' },
  { index: 62, arabic: 'الْحَيُّ', transliteration: 'AL-HAYY', meaning: 'The Ever-Living' },
  { index: 63, arabic: 'الْقَيُّومُ', transliteration: 'AL-QAYYOOM', meaning: 'The Sustainer, The Self-Subsisting' },
  { index: 64, arabic: 'الْوَاجِدُ', transliteration: 'AL-WAAJID', meaning: 'The Perceiver' },
  { index: 65, arabic: 'الْمَاجِدُ', transliteration: 'AL-MAAJID', meaning: 'The Illustrious, The Magnificent' },
  { index: 66, arabic: 'الْوَاحِدُ', transliteration: 'AL-WAAHID', meaning: 'The One' },
  { index: 67, arabic: 'الْأَحَدُ', transliteration: 'AL-AHAD', meaning: 'The Unique, The Only One' },
  { index: 68, arabic: 'الصَّمَدُ', transliteration: 'AS-SAMAD', meaning: 'The Eternal, Satisfier of Needs' },
  { index: 69, arabic: 'الْقَادِرُ', transliteration: 'AL-QADEER', meaning: 'The Omnipotent One' },
  { index: 70, arabic: 'الْمُقْتَدِرُ', transliteration: 'AL-MUQTADIR', meaning: 'The Powerful' },
  { index: 71, arabic: 'الْمُقَدِّمُ', transliteration: 'AL-MUQADDIM', meaning: 'The Expediter, The Promoter' },
  { index: 72, arabic: 'الْمُؤَخِّرُ', transliteration: "AL-MU'AKHKHIR", meaning: 'The Delayer' },
  { index: 73, arabic: 'الْأَوَّلُ', transliteration: 'AL-AWWAL', meaning: 'The First' },
  { index: 74, arabic: 'الْآخِرُ', transliteration: 'AL-AAKHIR', meaning: 'The Last' },
  { index: 75, arabic: 'الظَّاهِرُ', transliteration: 'AZ-ZAAHIR', meaning: 'The Manifest' },
  { index: 76, arabic: 'الْبَاطِنُ', transliteration: 'AL-BAATIN', meaning: 'The Hidden One, Knower of the Hidden' },
  { index: 77, arabic: 'الْوَالِي', transliteration: 'AL-WAALI', meaning: 'The Governor, The Patron' },
  { index: 78, arabic: 'الْمُتَعَالِي', transliteration: 'AL-MUTAALI', meaning: 'The Self Exalted' },
  { index: 79, arabic: 'الْبَرُّ', transliteration: 'AL-BARR', meaning: 'The Source of All Goodness' },
  { index: 80, arabic: 'التَّوَّابُ', transliteration: 'AT-TAWWAB', meaning: 'The Ever-Pardoning, The Relenting' },
  { index: 81, arabic: 'الْمُنْتَقِمُ', transliteration: 'AL-MUNTAQIM', meaning: 'The Avenger' },
  { index: 82, arabic: 'الْعَفُوُ', transliteration: "AL-'AFUWW", meaning: 'The Pardoner' },
  { index: 83, arabic: 'الرَّؤُوفُ', transliteration: "AR-RA'OOF", meaning: 'The Most Kind' },
  { index: 84, arabic: 'مَالِكُ الْمُلْكِ', transliteration: 'MAALIK-UL-MULK', meaning: 'Master of the Kingdom, Owner of the Dominion' },
  { index: 85, arabic: 'ذُو الْجَلَالِ وَالْإِكْرَامِ', transliteration: 'DHUL-JALAALI WAL-IKRAAM', meaning: 'Possessor of Glory and Honour, Lord of Majesty and Generosity' },
  { index: 86, arabic: 'الْمُقْسِطُ', transliteration: 'AL-MUQSIT', meaning: 'The Just One' },
  { index: 87, arabic: 'الْجَامِعُ', transliteration: 'AL-JAAMI', meaning: 'The Gatherer, The Uniter' },
  { index: 88, arabic: 'الْغَنِيُّ', transliteration: 'AL-GHANIYY', meaning: 'The Self-Sufficient, The Wealthy' },
  { index: 89, arabic: 'الْمُغْنِيُّ', transliteration: 'AL-MUGHNI', meaning: 'The Enricher' },
  { index: 90, arabic: 'الْمَانِعُ', transliteration: 'AL-MANI', meaning: 'The Withholder' },
  { index: 91, arabic: 'الضَّارُّ', transliteration: 'AD-DHARR', meaning: 'The Distresser' },
  { index: 92, arabic: 'النَّافِعُ', transliteration: "AN-NAFI'", meaning: 'The Propitious, The Benefactor' },
  { index: 93, arabic: 'النُّورُ', transliteration: 'AN-NUR', meaning: 'The Light, The Illuminator' },
  { index: 94, arabic: 'الْهَادِي', transliteration: 'AL-HAADI', meaning: 'The Guide' },
  { index: 95, arabic: 'الْبَدِيعُ', transliteration: 'AL-BADEE', meaning: 'The Incomparable Originator' },
  { index: 96, arabic: 'الْبَاقِي', transliteration: 'AL-BAAQI', meaning: 'The Everlasting' },
  { index: 97, arabic: 'الْوَارِثُ', transliteration: 'AL-WAARITH', meaning: 'The Inheritor, The Heir' },
  { index: 98, arabic: 'الرَّشِيدُ', transliteration: 'AR-RASHEED', meaning: 'The Guide, Infallible Teacher' },
  { index: 99, arabic: 'الصَّبُورُ', transliteration: 'AS-SABOOR', meaning: 'The Forbearing, The Patient' },
];

const outputPath = path.resolve(process.cwd(), OUTPUT_FILENAME);
const resume = process.argv.includes('--resume');

async function persistLessons(lessons) {
  const tmpPath = `${outputPath}.tmp`;
  const payload = JSON.stringify(lessons, null, 2);
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, outputPath);
}

const systemDirective = [
  'You are designing a 100-day memorisation journey for the Asma ul Husna.',
  'Blend spiritual reflection, practical habits, and relatable real-life parallels.',
  'Each lesson must feel connected to the previous ones and highlight a single divine name (Day 1-99) or the full review (Day 100).',
  'Keep the tone warm, encouraging, and rooted in daily life.',
  'Return responses as JSON matching the provided schema, with no extra wrapping or commentary.',
].join(' ');

const responseSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'lesson_response',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['lesson'],
      properties: {
        lesson: {
          type: 'string',
          description:
            'The lesson text for the requested day. Avoid leading/trailing whitespace and do not include the remembrance recap; the script appends that automatically.',
        },
      },
    },
    strict: true,
  },
};

async function readExistingLessons() {
  if (!resume) {
    return [];
  }
  try {
    const content = await fs.readFile(outputPath, 'utf8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error('Existing file is not an array.');
    }
    console.log(`Resuming from ${parsed.length} existing lessons in ${OUTPUT_FILENAME}.`);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.warn(`Could not resume from existing file: ${error.message}`);
    return [];
  }
}

function buildRemembranceLine(dayNumber) {
  const namesToInclude = dayNumber >= divineNames.length + 1
    ? divineNames
    : divineNames.slice(0, Math.min(dayNumber, divineNames.length));
  const roll = namesToInclude.map((entry) => entry.transliteration).join(' • ');
  return `یادآوری اسما الحسنی تا روز ${dayNumber}:\n\n${roll}`;
}

function lessonHeading(dayNumber, nameEntry) {
  if (dayNumber === 100) {
    return 'روز ۱۰۰ – بازبینی کامل: سفر ۱۰۰ روزه اسما الحسنی';
  }
  return `روز ${dayNumber} – ${nameEntry.transliteration}: ${nameEntry.meaning}`;
}

function buildUserPrompt(dayNumber, priorLessons) {
  const previousSection = priorLessons.length
    ? priorLessons.map((lesson, idx) => `Day ${idx + 1}\n${lesson}`).join('\n\n---\n\n')
    : 'None yet.';

  if (dayNumber <= divineNames.length) {
    const nameEntry = divineNames[dayNumber - 1];
    return [
      `We are preparing lesson ${dayNumber} in a 100-day journey.`,
      'Use all previous lessons to maintain continuity and avoid repetitive stories.',
      `Focus name: ${nameEntry.transliteration} (${nameEntry.arabic}) – ${nameEntry.meaning}.`,
      'Design a flowing lesson with:',
      '  • an inviting opening that anchors the day’s intention,',
      '  • a vivid, contemporary example illustrating the divine attribute,',
      '  • a short reflection exercise (questions or journaling prompts),',
      '  • a practical habit or dhikr plan for the next 24 hours,',
      '  • and 1–2 lines that reinforce how today links to prior discoveries.',
      'Do not include the remembrance recap line; it will be appended later.',
      'The lessons language is in Persian.',
      'Prior lessons (for reference):',
      previousSection,
    ].join('\n');
  }

  return [
    'Create the final Day 100 lesson that celebrates the whole journey.',
    'Key elements to include:',
    '  • A heartfelt reflection on the transformation across all 99 names.',
    '  • Guidance for reviewing and weaving the names into daily worship beyond the 100 days.',
    '  • Suggestions for teaching or sharing the Asma ul Husna with family/community.',
    '  • A unifying dua or affirmation that encapsulates the full experience.',
    'Do not include the remembrance recap line; it will be appended later.',
    'The lessons language is in Persian.',
    'Prior lessons (for reference):',
    previousSection,
  ].join('\n');
}

async function callChatGPT(prompt) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemDirective },
      { role: 'user', content: prompt },
    ],
    response_format: responseSchema,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content returned from API.');
      }
      const parsed = JSON.parse(content);
      if (typeof parsed.lesson !== 'string') {
        throw new Error('API response missing lesson string.');
      }
      return parsed.lesson.trim();
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(`Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Failed to call ChatGPT API.');
}

function composeLesson(dayNumber, lessonBody) {
  const nameEntry = divineNames[dayNumber - 1];
  const heading = lessonHeading(dayNumber, nameEntry);
  const segments = [heading, lessonBody.trim(), buildRemembranceLine(dayNumber)];
  return segments.join('\n\n');
}

async function main() {
  const lessons = await readExistingLessons();
  const startDay = lessons.length + 1;

  if (startDay > 100) {
    console.log('All 100 lessons are already present — no work to do.');
    return;
  }

  for (let day = startDay; day <= 100; day += 1) {
    const prompt = buildUserPrompt(day, lessons);
    console.log(`Generating lesson ${day} of 100 using ${MODEL}...`);
    const lessonBody = await callChatGPT(prompt);
    const finalLesson = composeLesson(day, lessonBody);
    lessons.push(finalLesson);
    await persistLessons(lessons);
    console.log(`Lesson ${day} ready.`);
  }

  await persistLessons(lessons);
  console.log(`Wrote ${lessons.length} lessons to ${outputPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
