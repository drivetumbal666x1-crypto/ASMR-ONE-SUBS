import { NextRequest } from "next/server";
import { upstreamFetch } from "@/lib/upstream";

export const revalidate = 3600; // 1 hour
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    // The popular endpoint requires a POST request
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    
    // We'll hit the mirror directly for the POST request since upstreamFetch is GET-only.
    // We can just use the main mirror.
    const res = await fetch("https://api.asmr.one/api/recommender/popular", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ASMRPlayer/1.0)",
        Accept: "application/json",
      },
      body: JSON.stringify({ page: 1, pageSize: 12 }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}`);
    }

    const data = await res.json();
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch popular works", detail: String(error) },
      { status: 502 }
    );
  }
}
