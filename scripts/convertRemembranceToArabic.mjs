#!/usr/bin/env node

/**
 * Convert the transliterated remembrance rolls in `daily_lessons.json`
 * to their Arabic counterparts while preserving lesson structure.
 *
 * Usage:
 *   node scripts/convertRemembranceToArabic.mjs [inputFile] [outputFile]
 *
 * Defaults:
 *   inputFile  = ./daily_lessons.json
 *   outputFile = same as input (in-place update)
 *
 * To write to a different file, provide both arguments.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const divineNames = [
  { transliteration: 'AR-RAHMAAN', arabic: 'الرَّحْمَنُ' },
  { transliteration: 'AR-RAHEEM', arabic: 'الرَّحِيمُ' },
  { transliteration: 'AL-MALIK', arabic: 'الْمَلِكُ' },
  { transliteration: 'AL-QUDDUS', arabic: 'الْقُدُّوسُ' },
  { transliteration: 'AS-SALAM', arabic: 'السَّلاَمُ' },
  { transliteration: "AL-MU'MIN", arabic: 'الْمُؤْمِنُ' },
  { transliteration: 'AL-MUHAYMIN', arabic: 'الْمُهَيْمِنُ' },
  { transliteration: 'AL-AZIZ', arabic: 'الْعَزِيزُ' },
  { transliteration: 'AL-JABBAR', arabic: 'الْجَبَّارُ' },
  { transliteration: 'AL-MUTAKABBIR', arabic: 'الْمُتَكَبِّرُ' },
  { transliteration: 'AL-KHAALIQ', arabic: 'الْخَالِقُ' },
  { transliteration: 'AL-BAARI', arabic: 'الْبَارِئُ' },
  { transliteration: 'AL-MUSAWWIR', arabic: 'الْمُصَوِّرُ' },
  { transliteration: 'AL-GHAFFAR', arabic: 'الْغَفَّارُ' },
  { transliteration: 'AL-QAHHAR', arabic: 'الْقَهَّارُ' },
  { transliteration: 'AL-WAHHAAB', arabic: 'الْوَهَّابُ' },
  { transliteration: 'AR-RAZZAAQ', arabic: 'الرَّزَّاقُ' },
  { transliteration: 'AL-FATTAAH', arabic: 'الْفَتَّاحُ' },
  { transliteration: "AL-'ALEEM", arabic: 'اَلْعَلِيْمُ' },
  { transliteration: 'AL-QAABID', arabic: 'الْقَابِضُ' },
  { transliteration: 'AL-BAASIT', arabic: 'الْبَاسِطُ' },
  { transliteration: 'AL-KHAAFIDH', arabic: 'الْخَافِضُ' },
  { transliteration: "AR-RAAFI'", arabic: 'الرَّافِعُ' },
  { transliteration: "AL-MU'IZZ", arabic: 'الْمُعِزُّ' },
  { transliteration: 'AL-MUZIL', arabic: 'ٱلْمُذِلُّ' },
  { transliteration: "AS-SAMEE'", arabic: 'السَّمِيعُ' },
  { transliteration: 'AL-BASEER', arabic: 'الْبَصِيرُ' },
  { transliteration: 'AL-HAKAM', arabic: 'الْحَكَمُ' },
  { transliteration: "AL-'ADL", arabic: 'الْعَدْلُ' },
  { transliteration: 'AL-LATEEF', arabic: 'اللَّطِيفُ' },
  { transliteration: 'AL-KHABEER', arabic: 'الْخَبِيرُ' },
  { transliteration: 'AL-HALEEM', arabic: 'الْحَلِيمُ' },
  { transliteration: "AL-'AZEEM", arabic: 'الْعَظِيمُ' },
  { transliteration: 'AL-GHAFOOR', arabic: 'الْغَفُورُ' },
  { transliteration: 'ASH-SHAKOOR', arabic: 'الشَّكُورُ' },
  { transliteration: "AL-'ALEE", arabic: 'الْعَلِيُّ' },
  { transliteration: 'AL-KABEER', arabic: 'الْكَبِيرُ' },
  { transliteration: 'AL-HAFEEDH', arabic: 'الْحَفِيظُ' },
  { transliteration: 'AL-MUQEET', arabic: 'المُقيِت' },
  { transliteration: 'AL-HASEEB', arabic: 'الْحسِيبُ' },
  { transliteration: 'AL-JALEEL', arabic: 'الْجَلِيلُ' },
  { transliteration: 'AL-KAREEM', arabic: 'الْكَرِيمُ' },
  { transliteration: 'AR-RAQEEB', arabic: 'الرَّقِيبُ' },
  { transliteration: 'AL-MUJEEB', arabic: 'ٱلْمُجِيبُ' },
  { transliteration: 'AL-WAASI', arabic: 'الْوَاسِعُ' },
  { transliteration: 'AL-HAKEEM', arabic: 'الْحَكِيمُ' },
  { transliteration: 'AL-WADUD', arabic: 'الْوَدُودُ' },
  { transliteration: 'AL-MAJEED', arabic: 'الْمَجِيدُ' },
  { transliteration: 'AL-BAAITH', arabic: 'الْبَاعِثُ' },
  { transliteration: 'ASH-SHAHEED', arabic: 'الشَّهِيدُ' },
  { transliteration: 'AL-HAQQ', arabic: 'الْحَقُ' },
  { transliteration: 'AL-WAKEEL', arabic: 'الْوَكِيلُ' },
  { transliteration: 'AL-QAWIYY', arabic: 'الْقَوِيُ' },
  { transliteration: 'AL-MATEEN', arabic: 'الْمَتِينُ' },
  { transliteration: 'AL-WALIYY', arabic: 'الْوَلِيُّ' },
  { transliteration: 'AL-HAMEED', arabic: 'الْحَمِيدُ' },
  { transliteration: 'AL-MUHSEE', arabic: 'الْمُحْصِي' },
  { transliteration: 'AL-MUBDI', arabic: 'الْمُبْدِئُ' },
  { transliteration: 'AL-MUEED', arabic: 'ٱلْمُعِيدُ' },
  { transliteration: 'AL-MUHYI', arabic: 'الْمُحْيِي' },
  { transliteration: 'AL-MUMEET', arabic: 'اَلْمُمِيتُ' },
  { transliteration: 'AL-HAYY', arabic: 'الْحَيُّ' },
  { transliteration: 'AL-QAYYOOM', arabic: 'الْقَيُّومُ' },
  { transliteration: 'AL-WAAJID', arabic: 'الْوَاجِدُ' },
  { transliteration: 'AL-MAAJID', arabic: 'الْمَاجِدُ' },
  { transliteration: 'AL-WAAHID', arabic: 'الْواحِدُ' },
  { transliteration: 'AL-AHAD', arabic: 'اَلاَحَدُ' },
  { transliteration: 'AS-SAMAD', arabic: 'الصَّمَدُ' },
  { transliteration: 'AL-QADEER', arabic: 'الْقَادِرُ' },
  { transliteration: 'AL-MUQTADIR', arabic: 'الْمُقْتَدِرُ' },
  { transliteration: 'AL-MUQADDIM', arabic: 'الْمُقَدِّمُ' },
  { transliteration: "AL-MU'AKHKHIR", arabic: 'الْمُؤَخِّرُ' },
  { transliteration: 'AL-AWWAL', arabic: 'الأوَّلُ' },
  { transliteration: 'AL-AAKHIR', arabic: 'الآخِرُ' },
  { transliteration: 'AZ-ZAAHIR', arabic: 'الظَّاهِرُ' },
  { transliteration: 'AL-BAATIN', arabic: 'الْبَاطِنُ' },
  { transliteration: 'AL-WAALI', arabic: 'الْوَالِي' },
  { transliteration: 'AL-MUTAALI', arabic: 'الْمُتَعَالِي' },
  { transliteration: 'AL-BARR', arabic: 'الْبَرُّ' },
  { transliteration: 'AT-TAWWAB', arabic: 'التَّوَابُ' },
  { transliteration: 'AL-MUNTAQIM', arabic: 'الْمُنْتَقِمُ' },
  { transliteration: "AL-'AFUWW", arabic: 'العَفُوُ' },
  { transliteration: "AR-RA'OOF", arabic: 'الرَّؤُوفُ' },
  { transliteration: 'MAALIK-UL-MULK', arabic: 'َمَالِكُ ٱلْمُلْكُ' },
  { transliteration: 'DHUL-JALAALI WAL-IKRAAM', arabic: 'ذُوالْجَلاَلِ وَالإكْرَامِ' },
  { transliteration: 'AL-MUQSIT', arabic: 'الْمُقْسِطُ' },
  { transliteration: 'AL-JAAMI', arabic: 'الْجَامِعُ' },
  { transliteration: 'AL-GHANIYY', arabic: 'ٱلْغَنيُّ' },
  { transliteration: 'AL-MUGHNI', arabic: 'ٱلْمُغْنِيُّ' },
  { transliteration: 'AL-MANI', arabic: 'اَلْمَانِعُ' },
  { transliteration: 'AD-DHARR', arabic: 'الضَّارَ' },
  { transliteration: "AN-NAFI'", arabic: 'النَّافِعُ' },
  { transliteration: 'AN-NUR', arabic: 'النُّورُ' },
  { transliteration: 'AL-HAADI', arabic: 'الْهَادِي' },
  { transliteration: 'AL-BADEE', arabic: 'الْبَدِيعُ' },
  { transliteration: 'AL-BAAQI', arabic: 'اَلْبَاقِي' },
  { transliteration: 'AL-WAARITH', arabic: 'الْوَارِثُ' },
  { transliteration: 'AR-RASHEED', arabic: 'الرَّشِيدُ' },
  { transliteration: 'AS-SABOOR', arabic: 'الصَّبُورُ' },
];

const transliterationToArabic = new Map(
  divineNames.map(({ transliteration, arabic }) => [transliteration, arabic]),
);

const inputPath = path.resolve(process.cwd(), process.argv[2] ?? 'daily_lessons.json');
const outputPath = path.resolve(process.cwd(), process.argv[3] ?? process.argv[2] ?? 'daily_lessons.json');

function replaceRemembranceLine(lesson) {
  const lines = lesson.split('\n');
  let lastIndex = lines.length - 1;

  while (lastIndex >= 0 && lines[lastIndex].trim() === '') {
    lastIndex -= 1;
  }

  if (lastIndex < 0) {
    return lesson;
  }

  const originalLine = lines[lastIndex];
  const tokens = originalLine.split('•').map((token) => token.trim()).filter(Boolean);

  if (!tokens.length) {
    return lesson;
  }

  const converted = tokens.map((token) => {
    const mapped = transliterationToArabic.get(token);
    if (!mapped) {
      console.warn(`Warning: could not map "${token}" to Arabic; leaving unchanged.`);
      return token;
    }
    return mapped;
  });

  lines[lastIndex] = converted.join(' • ');
  return lines.join('\n');
}

async function main() {
  const raw = await fs.readFile(inputPath, 'utf8');
  const lessons = JSON.parse(raw);

  if (!Array.isArray(lessons)) {
    throw new Error('Input file must contain a JSON array of lessons.');
  }

  const updated = lessons.map((lesson) => {
    if (typeof lesson !== 'string') {
      console.warn('Skipping non-string lesson entry.');
      return lesson;
    }
    return replaceRemembranceLine(lesson);
  });

  const tmpPath = `${outputPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf8');
  await fs.rename(tmpPath, outputPath);
  console.log(`Updated remembrance lines written to ${outputPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

