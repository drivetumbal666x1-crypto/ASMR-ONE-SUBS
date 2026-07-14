"use client";

import { WorkItem } from "./asmr-api";

export const PAGE_SIZE = 15;
const SESSION_CACHE_KEY = "asmr-works-cache-v2";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_MAX_MS = 60 * 60 * 1000; // 1 hour - can still show stale while re-fetching

interface CachedPage {
  works: WorkItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  timestamp: number;
}

interface CacheStore {
  [key: string]: CachedPage;
}

function loadCacheStore(): CacheStore {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheStore;
  } catch {
    return {};
  }
}

function saveCacheStore(store: CacheStore) {
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(store));
  } catch {
    // sessionStorage unavailable/full
  }
}

function cacheKey(page: number, keyword: string, subtitleOnly: boolean): string {
  return `${page}|${keyword || ""}|${subtitleOnly ? "1" : "0"}`;
}

export interface PagedWorksResult {
  works: WorkItem[];
  totalCount: number;
  totalPages: number;
  page: number;
}

async function fetchAndCache(
  page: number,
  keyword: string,
  subtitleOnly: boolean
): Promise<PagedWorksResult> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  if (keyword) params.set("keyword", keyword);
  if (subtitleOnly) params.set("subtitle", "1");

  const res = await fetch(`/api/works?${params.toString()}`);

  // Always parse as text first, then verify it's valid JSON before parsing.
  // This protects against rare proxy/server issues that return an HTML
  // error page (e.g. Next.js dev overlay) when the real route errors.
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  if (text.trimStart().startsWith("<")) {
    throw new Error("Upstream returned HTML instead of JSON");
  }

  let data: { works?: WorkItem[]; pagination?: { totalCount?: number } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Failed to parse JSON response");
  }

  const works: WorkItem[] = data.works || [];
  const totalCount = data.pagination?.totalCount ?? works.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const store = loadCacheStore();
  const key = cacheKey(page, keyword, subtitleOnly);
  store[key] = {
    works,
    totalCount,
    totalPages,
    page,
    timestamp: Date.now(),
  };
  saveCacheStore(store);

  return { works, totalCount, totalPages, page };
}

export async function fetchWorksPage(
  page: number,
  keyword: string,
  subtitleOnly: boolean,
  opts?: { onStale?: (stale: PagedWorksResult) => void }
): Promise<PagedWorksResult> {
  const store = loadCacheStore();
  const key = cacheKey(page, keyword, subtitleOnly);
  const cached = store[key];
  const now = Date.now();

  // Fresh cache: return immediately
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      works: cached.works,
      totalCount: cached.totalCount,
      totalPages: cached.totalPages,
      page: cached.page,
    };
  }

  // Stale-while-revalidate: return old data, refresh in background
  if (cached && now - cached.timestamp < STALE_MAX_MS) {
    fetchAndCache(page, keyword, subtitleOnly)
      .then((fresh) => opts?.onStale?.(fresh))
      .catch(() => {});
    return {
      works: cached.works,
      totalCount: cached.totalCount,
      totalPages: cached.totalPages,
      page: cached.page,
    };
  }

  // No cache: fetch fresh
  return await fetchAndCache(page, keyword, subtitleOnly);
}

// Prefetch adjacent pages in the background for instant navigation
export function prefetchWorksPage(
  page: number,
  keyword: string,
  subtitleOnly: boolean
): void {
  const store = loadCacheStore();
  const key = cacheKey(page, keyword, subtitleOnly);
  const cached = store[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return;
  fetchAndCache(page, keyword, subtitleOnly).catch(() => {});
}

export function clearWorksCache() {
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // ignore
  }
}
