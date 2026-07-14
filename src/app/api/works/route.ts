import { NextRequest } from "next/server";
import { upstreamFetch } from "@/lib/upstream";
import { db } from "@/db";
import { cachedPages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const revalidate = 60;
export const maxDuration = 30;

type WorksPayload = {
  works?: any[];
  pagination?: {
    currentPage?: number;
    pageSize?: number;
    totalCount?: number;
  };
  [key: string]: unknown;
};

function getTagNames(work: any): string[] {
  return (work.tags || [])
    .flatMap((tag: any) => [
      tag?.name,
      tag?.i18n?.["en-us"]?.name,
      tag?.i18n?.["ja-jp"]?.name,
      tag?.i18n?.["zh-cn"]?.name,
    ])
    .filter(Boolean);
}

function matchesKeyword(work: any, keyword: string): boolean {
  const words = keyword
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  if (words.length === 0) return true;

  const haystack = [
    work.title,
    work.name,
    work.circle?.name,
    work.source_id,
    ...(work.vas || []).map((va: any) => va?.name),
    ...getTagNames(work),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Require every word to match somewhere in title/circle/VA/tag/source id.
  return words.every((word) => haystack.includes(word));
}

async function getHomepageCache(): Promise<WorksPayload | null> {
  try {
    const cached = await db
      .select()
      .from(cachedPages)
      .where(eq(cachedPages.key, "homepage_v1"))
      .limit(1);

    if (cached.length > 0) return cached[0].data as WorksPayload;
  } catch (err) {
    console.warn("DB cache read failed:", err);
  }
  return null;
}

async function saveHomepageCache(data: unknown) {
  try {
    await db
      .insert(cachedPages)
      .values({ key: "homepage_v1", data: data as any })
      .onConflictDoUpdate({
        target: cachedPages.key,
        set: { data: data as any, updatedAt: sql`NOW()` },
      });
  } catch (err) {
    console.warn("DB cache write failed:", err);
  }
}

async function localSearchFallback(args: {
  keyword: string;
  page: number;
  pageSize: number;
  subtitle: boolean;
}): Promise<WorksPayload> {
  const pagesToScan = 6; // 6 * 100 = 600 recent works, fast enough for fallback.
  const paths = Array.from({ length: pagesToScan }, (_, i) => {
    const params = new URLSearchParams();
    params.set("page", String(i + 1));
    params.set("pageSize", "100");
    if (args.subtitle) params.set("subtitle", "1");
    return `/api/works?${params.toString()}`;
  });

  const settled = await Promise.allSettled(
    paths.map((path) => upstreamFetch(path, { timeoutMs: 10000, retries: 0 }))
  );

  const allWorks = settled.flatMap((item) => {
    if (item.status !== "fulfilled") return [];
    const payload = item.value as WorksPayload;
    return payload.works || [];
  });

  const seen = new Set<number>();
  const filtered = allWorks.filter((work) => {
    if (!work || seen.has(work.id)) return false;
    seen.add(work.id);
    if (args.subtitle && !work.has_subtitle) return false;
    return matchesKeyword(work, args.keyword);
  });

  const start = (args.page - 1) * args.pageSize;
  const works = filtered.slice(start, start + args.pageSize);

  return {
    works,
    pagination: {
      currentPage: args.page,
      pageSize: args.pageSize,
      totalCount: filtered.length,
    },
    fallback: true,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Number(searchParams.get("page") || "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") || "15") || 15;
  const keyword = searchParams.get("keyword") || "";
  const subtitle = searchParams.get("subtitle") || "";
  const order = searchParams.get("order") || "";
  const sort = searchParams.get("sort") || "";
  const subtitleOnly = Boolean(subtitle);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (subtitle) params.set("subtitle", subtitle);
  if (order) params.set("order", order);
  if (sort) params.set("sort", sort);

  const path = keyword
    ? `/api/search/${encodeURIComponent(keyword)}?${params.toString()}&includeTranslationWorks=true`
    : `/api/works?${params.toString()}`;

  const isHomepage = !keyword && page === 1 && !subtitle && !order;

  // Homepage should never fail if we have any saved cache. Serve it immediately.
  if (isHomepage) {
    const cached = await getHomepageCache();
    if (cached) {
      // Refresh in the background without blocking the user.
      upstreamFetch(path, { timeoutMs: 20000, retries: 0 })
        .then(saveHomepageCache)
        .catch(() => {});

      return Response.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
      });
    }
  }

  try {
    const data = await upstreamFetch(path, {
      // Keyword searches can be unstable upstream, so fail fast and use fallback.
      timeoutMs: keyword ? 8000 : 22000,
      retries: 0,
    });

    if (isHomepage) void saveHomepageCache(data);

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    // Search fallback: no 502 for users. Use recent data and local matching.
    if (keyword) {
      const fallback = await localSearchFallback({
        keyword,
        page,
        pageSize,
        subtitle: subtitleOnly,
      });
      return Response.json(fallback, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      });
    }

    // Homepage fallback: if upstream failed but cache exists, still serve it.
    if (isHomepage) {
      const cached = await getHomepageCache();
      if (cached) {
        return Response.json(cached, {
          headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
        });
      }
    }

    return Response.json(
      { error: "Failed to fetch works", detail: String(error) },
      { status: 502 }
    );
  }
}
