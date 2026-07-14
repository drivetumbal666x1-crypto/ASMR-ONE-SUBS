import { NextRequest } from "next/server";
import { upstreamFetch } from "@/lib/upstream";

export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Try /api/work/{id} first, fall back to /api/workInfo/{id}
    let data;
    try {
      data = await upstreamFetch(`/api/work/${id}`);
    } catch {
      data = await upstreamFetch(`/api/workInfo/${id}`);
    }

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch work detail", detail: String(error) },
      { status: 502 }
    );
  }
}
