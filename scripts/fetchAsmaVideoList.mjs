import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error('Missing YOUTUBE_API_KEY environment variable.');
  console.error('Create a YouTube Data API v3 key and export it before running this script.');
  process.exit(1);
}

const SEARCH_KEYWORDS = ['asmaul husna', 'asmaul husna for kids', 'أسماء الله الحسنى', '99 Names of Allah', '99 Beautiful Names', 'Asma Allah Alhusna'];
const MAX_RESULTS_PER_QUERY = Number.parseInt(process.env.MAX_RESULTS ?? '99', 10);
const OUTPUT_PATH = path.resolve(process.cwd(), process.argv[2] ?? 'asma_ul_husna_videos.json');

const containsNinetyNine = (title = '') => /(^|\D)99(\D|$)/.test(title);

const chunk = (items, size) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const youtubeFetch = async (endpoint, params) => {
  const url = new URL(`${API_BASE}/${endpoint}`);
  params.set('key', API_KEY);
  url.search = params.toString();

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YouTube API request failed (${response.status} ${response.statusText}): ${body}`);
  }

  return response.json();
};

const fetchSearchResults = async (query, limit) => {
  const matches = [];
  let pageToken;

  while (matches.length < limit) {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: '50',
      order: 'relevance',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const data = await youtubeFetch('search', params);
    const items = data.items ?? [];

    for (const item of items) {
      const title = item.snippet?.title ?? '';
      const videoId = item.id?.videoId;

      if (!videoId || !containsNinetyNine(title)) {
        continue;
      }

      matches.push(videoId);

      if (matches.length >= limit) {
        break;
      }
    }

    if (!data.nextPageToken) {
      break;
    }

    pageToken = data.nextPageToken;
  }

  return matches;
};

const fetchVideoDetails = async (videoIds) => {
  const details = new Map();

  for (const group of chunk(videoIds, 50)) {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: group.join(','),
      maxResults: '50',
    });

    const data = await youtubeFetch('videos', params);

    for (const item of data.items ?? []) {
      details.set(item.id, item);
    }
  }

  return details;
};

const main = async () => {
  const allVideos = [];

  for (const keyword of SEARCH_KEYWORDS) {
    console.log(`Fetching videos for "${keyword}"...`);
    const videoIds = await fetchSearchResults(keyword, MAX_RESULTS_PER_QUERY);
    const videoDetails = await fetchVideoDetails(videoIds);

    if (videoIds.length === 0) {
      console.warn(`No matching videos found for "${keyword}".`);
      continue;
    }

    videoIds.forEach((videoId, index) => {
      const detail = videoDetails.get(videoId);
      const snippet = detail?.snippet ?? {};
      const statistics = detail?.statistics ?? {};

      allVideos.push({
        query: keyword,
        rank: index + 1,
        videoId,
        title: snippet.title ?? '',
        channelTitle: snippet.channelTitle ?? '',
        publishedAt: snippet.publishedAt ?? null,
        description: snippet.description ?? '',
        viewCount: statistics.viewCount ? Number(statistics.viewCount) : null,
        likeCount: statistics.likeCount ? Number(statistics.likeCount) : null,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    });

    if (videoIds.length < MAX_RESULTS_PER_QUERY) {
      console.warn(
        `Only found ${videoIds.length} videos containing "99" in the title for "${keyword}".`,
      );
    }
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(allVideos, null, 2), 'utf-8');
  console.log(`Saved ${allVideos.length} ranked videos to ${OUTPUT_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
