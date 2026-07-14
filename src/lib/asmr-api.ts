// Types for the ASMR.one API responses

export interface WorkItem {
  id: number;
  title: string;
  circle_id: number;
  name: string;
  nsfw: boolean;
  release: string;
  dl_count: number;
  price: number;
  review_count: number;
  rate_count: number;
  rate_average_2dp: number;
  rate_count_detail: {
    review_point: number;
    count: number;
    ratio: number;
  }[];
  rank: {
    term: string;
    category: string;
    rank: number;
    rank_date: string;
  }[] | null;
  has_subtitle: boolean;
  create_date: string;
  vas: { id: string; name: string }[];
  tags: {
    id: number;
    name: string;
    i18n: {
      "en-us"?: { name: string };
      "ja-jp"?: { name: string };
      "zh-cn"?: { name: string };
    };
  }[];
  language_editions: {
    lang: string;
    label: string;
    workno: string;
    edition_id: number;
    edition_type: string;
    display_order: number;
  }[];
  original_workno: string | null;
  other_language_editions_in_db: {
    id: number;
    lang: string;
    title: string;
    source_id: string;
    is_original: boolean;
    source_type: string;
  }[];
  translation_info: Record<string, unknown>;
  work_attributes: string;
  age_category_string: string;
  duration: number;
  source_type: string;
  source_id: string;
  source_url: string;
  userRating: number | null;
  circle: {
    id: number;
    name: string;
    source_id: string;
    source_type: string;
  };
  samCoverUrl: string;
  thumbnailCoverUrl: string;
  mainCoverUrl: string;
}

export interface WorksResponse {
  works: WorkItem[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
}

export interface TrackItem {
  type: "folder" | "audio" | "text" | "image";
  title: string;
  hash?: string;
  work?: { id: number; source_id: string; source_type: string };
  workTitle?: string;
  mediaStreamUrl?: string;
  mediaDownloadUrl?: string;
  streamLowQualityUrl?: string;
  duration?: number;
  size?: number;
  children?: TrackItem[];
}

export interface WorkDetail extends WorkItem {
  review_text: string | null;
  progress: string | null;
  updated_at: string | null;
  user_name: string | null;
}

const API_BASE = process.env.ASMR_API_BASE || "https://api.asmr.one";

// Timeout wrapper for fetch
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchWorks(
  page: number = 1,
  options?: {
    sort?: string;
    order?: string;
    keyword?: string;
    subtitle?: boolean;
  }
): Promise<WorksResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (options?.sort) params.set("sort", options.sort);
  if (options?.order) params.set("order", options.order);
  if (options?.keyword) params.set("keyword", options.keyword);

  const url = `${API_BASE}/api/works?${params.toString()}`;

  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ASMRPlayer/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`ASMR API error: ${res.status}`);
  }

  const data = await res.json();
  return data as WorksResponse;
}

export async function fetchWorkDetail(workId: number): Promise<WorkDetail> {
  const res = await fetchWithTimeout(`${API_BASE}/api/work/${workId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ASMRPlayer/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`ASMR API error: ${res.status}`);
  }

  return res.json();
}

export async function fetchTracks(workId: number): Promise<TrackItem[]> {
  const res = await fetchWithTimeout(`${API_BASE}/api/tracks/${workId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ASMRPlayer/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`ASMR API error: ${res.status}`);
  }

  return res.json();
}

export async function fetchVttContent(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ASMRPlayer/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch VTT: ${res.status}`);
  }

  return res.text();
}

// Flatten tracks to get audio files with their paired subtitle/VTT files
export interface FlatTrack {
  type: "audio" | "text";
  title: string;
  hash: string;
  mediaStreamUrl: string;
  duration: number;
  size: number;
  subtitleTrack?: FlatTrack;
}

export function flattenTracks(tracks: TrackItem[]): { audios: FlatTrack[]; subtitles: FlatTrack[] } {
  const audios: FlatTrack[] = [];
  const subtitles: FlatTrack[] = [];

  function walk(items: TrackItem[]) {
    for (const item of items) {
      if (item.type === "folder" && item.children) {
        walk(item.children);
      } else if (item.type === "audio") {
        audios.push({
          type: "audio",
          title: item.title,
          hash: item.hash || "",
          mediaStreamUrl: item.mediaStreamUrl || "",
          duration: item.duration || 0,
          size: item.size || 0,
        });
      } else if (item.type === "text") {
        subtitles.push({
          type: "text",
          title: item.title,
          hash: item.hash || "",
          mediaStreamUrl: item.mediaStreamUrl || "",
          duration: item.duration || 0,
          size: item.size || 0,
        });
      }
    }
  }

  walk(tracks);

  // Pair audio with subtitle by matching titles (subtitle has .vtt suffix)
  for (const audio of audios) {
    const matchingSub = subtitles.find(
      (s) =>
        s.title === audio.title + ".vtt" ||
        s.title === audio.title.replace(/\.\w+$/, "") + ".vtt" ||
        s.title.startsWith(audio.title.replace(/\.\w+$/, ""))
    );
    if (matchingSub) {
      audio.subtitleTrack = matchingSub;
    }
  }

  return { audios, subtitles };
}

// Extract image files from tracks for gallery/slideshow
export interface ImageItem {
  title: string;
  url: string;
  hash: string;
}

export function extractImages(tracks: TrackItem[]): ImageItem[] {
  const images: ImageItem[] = [];

  function walk(items: TrackItem[]) {
    for (const item of items) {
      if (item.type === "folder" && item.children) {
        walk(item.children);
      } else if (item.type === "image") {
        images.push({
          title: item.title,
          url: item.mediaStreamUrl || item.mediaDownloadUrl || "",
          hash: item.hash || "",
        });
      } else if (
        item.type !== "audio" &&
        item.type !== "text" &&
        item.type !== "folder" &&
        item.mediaStreamUrl
      ) {
        // Fallback: any non-audio/text/folder with an image-like extension
        const lower = item.title.toLowerCase();
        if (
          lower.endsWith(".jpg") ||
          lower.endsWith(".jpeg") ||
          lower.endsWith(".png") ||
          lower.endsWith(".gif") ||
          lower.endsWith(".webp") ||
          lower.endsWith(".bmp")
        ) {
          images.push({
            title: item.title,
            url: item.mediaStreamUrl || item.mediaDownloadUrl || "",
            hash: item.hash || "",
          });
        }
      }
    }
  }

  walk(tracks);
  return images;
}

// Parse VTT content into subtitle cues
export interface VttCue {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  translatedText?: string;
}

export function parseVtt(vttContent: string): VttCue[] {
  const cues: VttCue[] = [];
  const lines = vttContent.split("\n");
  let currentCue: Partial<VttCue> = {};
  let textLines: string[] = [];

  // Skip WEBVTT header
  let i = 0;
  if (lines[0]?.trim().startsWith("WEBVTT")) {
    i = 1;
  }

  for (; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "") {
      if (currentCue.id && currentCue.startTime !== undefined) {
        currentCue.text = textLines.join("\n").trim();
        cues.push(currentCue as VttCue);
        currentCue = {};
        textLines = [];
      }
      continue;
    }

    // Check for timestamp line: 00:00:05.849 --> 00:00:07.097
    const timestampMatch = line.match(
      /^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
    );

    if (timestampMatch) {
      currentCue.startTime = parseTimestamp(timestampMatch[1]);
      currentCue.endTime = parseTimestamp(timestampMatch[2]);
      continue;
    }

    // If we haven't set an id yet and no timestamp, this is the cue id
    if (!currentCue.id && !timestampMatch && /^\d+$/.test(line)) {
      currentCue.id = line;
      continue;
    }

    // Accumulate text lines
    if (currentCue.startTime !== undefined) {
      textLines.push(line);
    }
  }

  // Don't miss the last cue
  if (currentCue.id && currentCue.startTime !== undefined && textLines.length > 0) {
    currentCue.text = textLines.join("\n").trim();
    cues.push(currentCue as VttCue);
  }

  return cues;
}

function parseTimestamp(ts: string): number {
  const [h, m, s] = ts.split(":");
  const [sec, ms] = s.split(".");
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms) / 1000;
}
