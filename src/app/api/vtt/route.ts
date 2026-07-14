import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "URL parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ASMRPlayer/1.0)",
      },
    });

    if (!res.ok) {
      return Response.json(
        { error: `Failed to fetch VTT: ${res.status}` },
        { status: res.status }
      );
    }

    const text = await res.text();
    return new Response(text, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch VTT", detail: String(error) },
      { status: 500 }
    );
  }
}
