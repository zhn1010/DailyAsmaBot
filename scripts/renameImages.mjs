#!/usr/bin/env node

/**
 * Rename image files matching "devine-name-###.ext" by decrementing the number
 * and removing leading zeroes. Processes files in descending order to prevent
 * collisions (002 -> 1 after 003 -> 2, etc.).
 *
 * Usage:
 *   node scripts/renameImages.mjs [directory]
 *
 * Defaults to "./images". Provide an explicit path to target another folder.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const targetDir = path.resolve(process.cwd(), process.argv[2] ?? 'images');
const pattern = /^devine-name-(\d+)\.(jpe?g|png)$/i;

async function loadEntries() {
  try {
    return await fs.readdir(targetDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Directory not found: ${targetDir}`);
      process.exit(1);
    }
    throw error;
  }
}

function parseCandidates(entries) {
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(pattern);
      if (!match) {
        return null;
      }
      const [, numStr, ext] = match;
      const number = Number.parseInt(numStr, 10);
      if (Number.isNaN(number)) {
        return null;
      }
      return {
        originalName: entry.name,
        number,
        ext,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.number - a.number);
}

async function renameCandidate({ originalName, number, ext }) {
  const newNumber = number - 1;
  if (newNumber < 0) {
    console.warn(`Skipping ${originalName}: resulting number would be negative.`);
    return;
  }

  const newName = `devine-name-${newNumber}.${ext}`;
  if (newName === originalName) {
    console.log(`Skipping ${originalName}: already at desired format.`);
    return;
  }

  const currentPath = path.join(targetDir, originalName);
  const nextPath = path.join(targetDir, newName);

  try {
    await fs.access(nextPath);
    console.warn(`Skipping ${originalName}: target file ${newName} already exists.`);
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.rename(currentPath, nextPath);
  console.log(`Renamed ${originalName} -> ${newName}`);
}

async function main() {
  const entries = await loadEntries();
  const candidates = parseCandidates(entries);

  if (!candidates.length) {
    console.log('No matching files found.');
    return;
  }

  for (const candidate of candidates) {
    await renameCandidate(candidate);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

