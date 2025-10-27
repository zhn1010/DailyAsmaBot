#!/usr/bin/env node

/**
 * Re-rank the entries inside asma_ul_husna_videos.json after manual edits.
 *
 * Usage:
 *   node scripts/rerankAsmaVideos.mjs                  # rewrites the default file in place
 *   node scripts/rerankAsmaVideos.mjs input.json       # rewrites a custom file in place
 *   node scripts/rerankAsmaVideos.mjs input.json output.json
 *
 * The script preserves all fields and only refreshes the `rank` property so it
 * matches the (1-based) position of each item in the file.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const resolvePath = (value) => path.resolve(process.cwd(), value);

const [inputArg, outputArg] = process.argv.slice(2);
const inputPath = resolvePath(inputArg ?? 'asma_ul_husna_videos.json');
const outputPath = resolvePath(outputArg ?? inputArg ?? 'asma_ul_husna_videos.json');

const assertArray = (data) => {
  if (!Array.isArray(data)) {
    throw new Error(`Expected an array of videos, received ${typeof data}`);
  }
};

const rerankVideos = (videos) =>
  videos.map((item, index) => {
    if (item && typeof item === 'object') {
      return { ...item, rank: index + 1 };
    }

    return { rank: index + 1 };
  });

const main = async () => {
  const fileContents = await readFile(inputPath, 'utf8');
  const parsed = JSON.parse(fileContents);

  assertArray(parsed);

  const updated = rerankVideos(parsed);
  const payload = JSON.stringify(updated, null, 2);

  await writeFile(outputPath, payload, 'utf8');
  console.log(
    `Re-ranked ${updated.length} videos (1-based) from ${inputPath} and wrote the result to ${outputPath}`,
  );
};

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
