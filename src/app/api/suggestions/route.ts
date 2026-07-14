import { NextRequest } from "next/server";
import { translateAllServer } from "@/lib/server-translate";
import { upstreamFetch } from "@/lib/upstream";

export interface SuggestionItem {
  original: string; // Native text (JP/CN) — inserted into the search filter value
  translated: string; // English label shown to the user, also searchable
}

interface SuggestionCache {
  vas: Map<string, number>; // native name -> count
  tags: Map<string, number>; // english (or native fallback) name -> count
  circles: Map<string, number>; // native name -> count
  langs: Set<string>;
  vaTranslations: Map<string, string>; // native -> English
  circleTranslations: Map<string, string>; // native -> English
  updatedAt: number;
}

let cache: SuggestionCache | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type"); // "va", "tag", "circle", "lang"
  const query = searchParams.get("q") || "";

  if (!type || !["va", "tag", "circle", "lang"].includes(type)) {
    return Response.json({ error: "Invalid type" }, { status: 400 });
  }

  await ensureCache();

  let results: SuggestionItem[] = [];

  switch (type) {
    case "va": {
      const names = filterSuggestions(cache!.vas, cache!.vaTranslations, query, 50);
      results = names.map((name) => ({
        original: name,
        translated: cache!.vaTranslations.get(name) || name,
      }));
      break;
    }
    case "tag": {
      // Tag names are already English (or fall back to native) when the cache
      // was built, so original === translated here.
      const names = filterSuggestions(cache!.tags, null, query, 100);
      results = names.map((name) => ({ original: name, translated: name }));
      break;
    }
    case "circle": {
      const names = filterSuggestions(cache!.circles, cache!.circleTranslations, query, 50);
      results = names.map((name) => ({
        original: name,
        translated: cache!.circleTranslations.get(name) || name,
      }));
      break;
    }
    case "lang": {
      const names = Array.from(cache!.langs)
        .filter((l) => !query || l.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 20);
      results = names.map((name) => ({ original: name, translated: name }));
      break;
    }
  }

  return Response.json({ results });
}

// Matches the query against the native name AND (if provided) its English
// translation, so users can search using English words even when the native
// name is in Japanese/Chinese and can't be typed on their keyboard.
function filterSuggestions(
  map: Map<string, number>,
  translations: Map<string, string> | null,
  query: string,
  limit: number
): string[] {
  const q = query.toLowerCase();
  const entries = Array.from(map.entries());

  entries.sort((a, b) => b[1] - a[1]); // sort by frequency

  if (!q) {
    return entries.slice(0, limit).map(([name]) => name);
  }

  const prefixMatches: [string, number][] = [];
  const containMatches: [string, number][] = [];

  for (const [name, count] of entries) {
    const lowerName = name.toLowerCase();
    const lowerTranslated = translations?.get(name)?.toLowerCase() || "";

    const matchesPrefix = lowerName.startsWith(q) || lowerTranslated.startsWith(q);
    const matchesContain = lowerName.includes(q) || lowerTranslated.includes(q);

    if (matchesPrefix) {
      prefixMatches.push([name, count]);
    } else if (matchesContain) {
      containMatches.push([name, count]);
    }
  }

  return [...prefixMatches, ...containMatches].slice(0, limit).map(([name]) => name);
}

async function ensureCache(): Promise<SuggestionCache> {
  if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
    return cache;
  }

  const vas = new Map<string, number>();
  const tags = new Map<string, number>();
  const circles = new Map<string, number>();
  const langs = new Set<string>();

  try {
    // Fetch first 5 pages to build a good index (~100 works)
    const pages = await Promise.all([
      fetchPage(1),
      fetchPage(2),
      fetchPage(3),
      fetchPage(4),
      fetchPage(5),
    ]);

    for (const works of pages) {
      for (const work of works) {
        for (const va of work.vas || []) {
          if (va.name) {
            vas.set(va.name, (vas.get(va.name) || 0) + 1);
          }
        }

        for (const tag of work.tags || []) {
          const enName =
            tag.i18n?.["en-us"]?.name ||
            tag.i18n?.["ja-jp"]?.name ||
            tag.i18n?.["zh-cn"]?.name ||
            tag.name;
          if (enName) {
            tags.set(enName, (tags.get(enName) || 0) + 1);
          }
        }

        if (work.circle?.name) {
          circles.set(work.circle.name, (circles.get(work.circle.name) || 0) + 1);
        }

        for (const le of work.language_editions || []) {
          if (le.lang) langs.add(le.lang);
        }
      }
    }

    // Translate ALL unique VA and circle names once per cache refresh, so
    // that subsequent per-keystroke filtering can match against English
    // translations without additional API calls.
    const [vaTranslations, circleTranslations] = await Promise.all([
      translateAllServer(Array.from(vas.keys())),
      translateAllServer(Array.from(circles.keys())),
    ]);

    cache = {
      vas,
      tags,
      circles,
      langs,
      vaTranslations,
      circleTranslations,
      updatedAt: Date.now(),
    };
  } catch (err) {
    console.error("Failed to build suggestion cache:", err);
    if (!cache) {
      cache = {
        vas,
        tags,
        circles,
        langs,
        vaTranslations: new Map(),
        circleTranslations: new Map(),
        updatedAt: Date.now(),
      };
    }
  }

  return cache;
}

async function fetchPage(page: number): Promise<any[]> {
  try {
    const data = (await upstreamFetch(`/api/works?page=${page}&pageSize=20`)) as {
      works?: any[];
    };
    return data.works || [];
  } catch {
    return [];
  }
}
