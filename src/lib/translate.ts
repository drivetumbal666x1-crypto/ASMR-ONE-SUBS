// Translation service for Japanese/Chinese content -> English
// Uses Google Translate's free endpoint (no API key required)

const GOOGLE_TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single";

// Cache for translations
const memoryCache = new Map<string, string>();
const STORAGE_KEY = "translation-cache";
const CACHE_VERSION = 1;
const MAX_CACHE_SIZE = 5000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// In-flight requests to prevent duplicate calls
const inflight = new Map<string, Promise<string>>();

interface CacheEntry {
  text: string;
  timestamp: number;
}

function loadCache(): Map<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const data = JSON.parse(raw) as { version: number; entries: Record<string, CacheEntry> };
    if (data.version !== CACHE_VERSION) return new Map();
    const map = new Map<string, CacheEntry>();
    const now = Date.now();
    for (const [k, v] of Object.entries(data.entries)) {
      if (now - v.timestamp < CACHE_TTL_MS) {
        map.set(k, v);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveCache(map: Map<string, CacheEntry>) {
  try {
    if (map.size > MAX_CACHE_SIZE) {
      // Evict oldest entries
      const entries = Array.from(map.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );
      const toKeep = entries.slice(-MAX_CACHE_SIZE);
      map = new Map(toKeep);
    }
    const obj = Object.fromEntries(map);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CACHE_VERSION, entries: obj })
    );
  } catch {
    // Storage full or unavailable; ignore
  }
}

let storageCache: Map<string, CacheEntry> | null = null;
function getStorageCache(): Map<string, CacheEntry> {
  if (!storageCache) storageCache = loadCache();
  return storageCache;
}

// Detect if text is already English (mostly ASCII)
export function isMostlyEnglish(text: string): boolean {
  if (!text) return true;
  // Count non-ASCII characters
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) > 127) nonAscii++;
  }
  return nonAscii / text.length < 0.05;
}

export async function translateToEnglish(
  text: string,
  sourceLang?: "auto" | "ja" | "zh" | "ko"
): Promise<string> {
  if (!text || !text.trim()) return text;
  // Skip if mostly English
  if (isMostlyEnglish(text)) return text;

  const cacheKey = `${sourceLang || "auto"}|${text}`;

  // Check memory cache
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey)!;

  // Check storage cache
  const storage = getStorageCache();
  const cached = storage.get(cacheKey);
  if (cached) {
    memoryCache.set(cacheKey, cached.text);
    return cached.text;
  }

  // Check if request is already in flight
  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey)!;
  }

  // Make the request
  const promise = (async () => {
    try {
      const url = `${GOOGLE_TRANSLATE_URL}?client=gtx&sl=${sourceLang || "auto"}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Translate API ${res.status}`);
      const data = await res.json();
      // data[0] is an array of segments: [[translatedText, sourceText, ...], ...]
      const translated = (data?.[0] || [])
        .map((s: unknown[]) => s?.[0])
        .join("");
      const result = (translated as string) || text;

      // Cache the result
      memoryCache.set(cacheKey, result);
      storage.set(cacheKey, { text: result, timestamp: Date.now() });
      saveCache(storage);

      return result;
    } catch (err) {
      // Return original on error
      console.warn("Translation failed for:", text.slice(0, 50), err);
      return text;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

// Batch translate multiple texts in parallel
export async function translateBatch(
  texts: string[],
  sourceLang?: "auto" | "ja" | "zh" | "ko"
): Promise<string[]> {
  return Promise.all(texts.map((t) => translateToEnglish(t, sourceLang)));
}

// Clear cache (for debugging)
export function clearTranslationCache() {
  memoryCache.clear();
  storageCache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
