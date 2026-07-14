import { NextRequest } from "next/server";
import { upstreamFetch } from "@/lib/upstream";

export const revalidate = 1800;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await upstreamFetch(`/api/tracks/${id}?v=2`);
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch tracks", detail: String(error) },
      { status: 502 }
    );
  }
}
