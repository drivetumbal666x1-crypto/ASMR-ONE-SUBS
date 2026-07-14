// Server-side fetcher that races multiple ASMR.one API mirrors, so the
// user gets the response from whichever one is fastest / actually online.
// Also does in-memory response caching + in-flight deduplication.

const MIRRORS = [
  "https://api.asmr.one",
  "https://api.asmr-100.com",
  "https://api.asmr-200.com",
  "https://api.asmr-300.com",
];

// Simple in-memory cache. Keyed by relative path (e.g. "/api/works?page=1").
interface CacheEntry {
  data: unknown;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

// Different TTLs for different endpoints
function ttlFor(path: string): number {
  if (path.startsWith("/api/tracks/")) return 30 * 60 * 1000; // 30 min – tracks rarely change
  if (path.startsWith("/api/work/")) return 30 * 60 * 1000;   // 30 min – work metadata stable
  if (path.startsWith("/api/search/")) return 2 * 60 * 1000;  // 2 min – search results
  if (path.startsWith("/api/works")) return 2 * 60 * 1000;    // 2 min – listings
  return 5 * 60 * 1000;
}

// The upstream failure surface we've observed: 522, 5xx, and connection
// timeouts. If ANY mirror returns 200 quickly we take it; otherwise we
// fall back to the slowest 200 or bubble up the last error.
async function fetchFromMirror(path: string, mirror: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${mirror}${path}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ASMRPlayer/1.0)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Race all mirrors in parallel. Resolves with the first 2xx JSON response.
 * If all fail, rejects with the last error.
 */
async function raceMirrors(path: string, timeoutMs = 15000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let remaining = MIRRORS.length;
    let lastError: unknown = new Error("All mirrors failed");

    MIRRORS.forEach((mirror) => {
      fetchFromMirror(path, mirror, timeoutMs)
        .then(async (res) => {
          if (settled) return;
          
          // Verify it's actually JSON before trying to parse
          const contentType = res.headers.get("content-type") || "";
          if (!res.ok || !contentType.includes("application/json")) {
            lastError = new Error(`${mirror} returned ${res.status} (${contentType})`);
            return;
          }

          try {
            const data = await res.json();
            if (!settled) {
              settled = true;
              resolve(data);
            }
          } catch (err) {
            lastError = new Error(`Failed to parse JSON from ${mirror}`);
          }
        })
        .catch((err) => {
          lastError = err;
        })
        .finally(() => {
          remaining--;
          if (remaining === 0 && !settled) {
            settled = true;
            reject(lastError);
          }
        });
    });
  });
}

/**
 * Public fetch: reads from cache when fresh, otherwise races mirrors.
 * Dedupes concurrent identical requests.
 */
export async function upstreamFetch(
  path: string,
  opts?: { forceRefresh?: boolean; retries?: number; timeoutMs?: number }
): Promise<unknown> {
  const key = path;
  const now = Date.now();
  // Increase timeouts to 25s to handle the current slow state of asmr.one
  // but keep the mirror racing so we grab the fastest result.
  const maxRetries = opts?.retries ?? 1;
  const perRequestTimeout = opts?.timeoutMs ?? 25000;

  // Cache hit
  if (!opts?.forceRefresh) {
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < ttlFor(path)) {
      return cached.data;
    }
  }

  // Dedupe concurrent identical calls
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    let lastError: any;

    // Retry loop for transient upstream failures
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await raceMirrors(path, perRequestTimeout);
        cache.set(key, { data, timestamp: Date.now() });
        return data;
      } catch (err) {
        lastError = err;
        // Don't wait on last attempt
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    // If we have a stale cache entry, return it rather than error out
    const stale = cache.get(key);
    if (stale) {
      console.warn(`Upstream failed, serving stale cache for: ${path}`);
      return stale.data;
    }

    throw lastError;
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Trim old cache entries to prevent unbounded growth. Called opportunistically.
 */
function maybePrune() {
  if (cache.size < 500) return;
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
  for (const [k, v] of cache.entries()) {
    if (v.timestamp < cutoff) cache.delete(k);
  }
}

setInterval(maybePrune, 5 * 60 * 1000).unref?.();
