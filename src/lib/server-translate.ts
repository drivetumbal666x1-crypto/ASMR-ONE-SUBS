// Server-side translation helper (for use inside API routes / route handlers).
// Uses Google Translate's free endpoint (no API key required).
// Caches results in a module-level Map that persists for the lifetime of the
// warm serverless/container instance, so repeated lookups are free.

const GOOGLE_TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

// Detect if text is already English/Latin (mostly ASCII) — skip translation.
export function isMostlyEnglish(text: string): boolean {
  if (!text) return true;
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) > 127) nonAscii++;
  }
  return nonAscii / text.length < 0.05;
}

export async function translateServer(text: string): Promise<string> {
  if (!text || !text.trim()) return text;
  if (isMostlyEnglish(text)) return text;

  const cached = cache.get(text);
  if (cached) return cached;

  const inFlightPromise = inflight.get(text);
  if (inFlightPromise) return inFlightPromise;

  const promise = (async () => {
    try {
      const url = `${GOOGLE_TRANSLATE_URL}?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ASMRPlayer/1.0)" },
      });
      if (!res.ok) throw new Error(`Translate API ${res.status}`);
      const data = await res.json();
      const translated = (data?.[0] || []).map((s: unknown[]) => s?.[0]).join("");
      const result = (translated as string) || text;
      cache.set(text, result);
      return result;
    } catch {
      // Fall back to original text on any failure (rate limit, network, etc.)
      return text;
    } finally {
      inflight.delete(text);
    }
  })();

  inflight.set(text, promise);
  return promise;
}

// Translate a batch of strings with a concurrency limit to avoid hammering
// the translation endpoint (and getting rate-limited) all at once.
export async function translateAllServer(
  texts: string[],
  concurrency = 6
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = Array.from(new Set(texts));

  let index = 0;
  async function worker() {
    while (index < unique.length) {
      const i = index++;
      const text = unique[i];
      const translated = await translateServer(text);
      result.set(text, translated);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
  await Promise.all(workers);

  return result;
}
