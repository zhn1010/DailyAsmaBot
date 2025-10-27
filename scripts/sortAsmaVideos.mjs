import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const resolvePath = (value) => path.resolve(process.cwd(), value);

const [inputArg, outputArg] = process.argv.slice(2);
const inputPath = resolvePath(inputArg ?? 'asma_ul_husna_videos.json');
const outputPath = resolvePath(outputArg ?? inputArg ?? 'asma_ul_husna_videos.json');

const toNumber = (value) => {
  const norm = Number(value);
  return Number.isFinite(norm) ? norm : -1;
};

const compareByPopularity = (a, b) => {
  const viewDiff = toNumber(b?.viewCount) - toNumber(a?.viewCount);

  if (viewDiff !== 0) {
    return viewDiff;
  }

  const likeDiff = toNumber(b?.likeCount) - toNumber(a?.likeCount);

  if (likeDiff !== 0) {
    return likeDiff;
  }

  return 0;
};

const main = async () => {
  const fileContents = await readFile(inputPath, 'utf-8');
  const data = JSON.parse(fileContents);

  if (!Array.isArray(data)) {
    throw new Error(`Expected an array in ${inputPath}, received ${typeof data}`);
  }

  const dedupedData = [];
  const seenByUrl = new Map();

  const dedupeKey = (item) => item?.url ?? item?.videoId ?? null;

  for (const item of data) {
    const key = dedupeKey(item);

    if (!key) {
      dedupedData.push(item);
      continue;
    }

    if (!seenByUrl.has(key)) {
      seenByUrl.set(key, dedupedData.length);
      dedupedData.push(item);
      continue;
    }

    const existingIndex = seenByUrl.get(key);
    const existingItem = dedupedData[existingIndex];

    if (compareByPopularity(item, existingItem) < 0) {
      dedupedData[existingIndex] = item;
    }
  }

  const sortedData = dedupedData.sort(compareByPopularity);

  sortedData.forEach((item, index) => {
    item.rank = index + 1;
  });

  await writeFile(outputPath, JSON.stringify(sortedData, null, 2), 'utf-8');
  console.log(
    `Sorted ${sortedData.length} unique entries by viewCount and likeCount, and wrote to ${outputPath}`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
