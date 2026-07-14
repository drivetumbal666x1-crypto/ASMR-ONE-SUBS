"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  WorkDetail,
  WorkItem,
  TrackItem,
  FlatTrack,
  flattenTracks,
  extractImages,
  ImageItem,
} from "@/lib/asmr-api";
import AudioPlayer from "@/components/AudioPlayer";
import TrackList from "@/components/TrackList";
import ImageGallery from "@/components/ImageGallery";
import {
  ArrowLeft,
  Clock,
  Download,
  Star,
  Mic,
  Calendar,
  Tag,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import TranslatedText from "@/components/TranslatedText";
import EnglishToggle from "@/components/EnglishToggle";
import FavoriteButton from "@/components/FavoriteButton";
import { getRecentWork } from "@/lib/recent-works";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getEnglishTag(tag: WorkDetail["tags"][0]): string {
  return tag.i18n?.["en-us"]?.name || tag.i18n?.["ja-jp"]?.name || tag.name;
}

function toWorkDetailFallback(work: WorkItem): WorkDetail {
  return {
    ...work,
    review_text: null,
    progress: null,
    updated_at: null,
    user_name: null,
  };
}

export default function WorkPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleTagSearch = (type: "va" | "tag" | "circle", value: string) => {
    const query = `$${type}:${value}`;
    router.push(`/?q=${encodeURIComponent(query)}`);
  };

  // Player state
  const [currentAudio, setCurrentAudio] = useState<FlatTrack | null>(null);
  const [allAudios, setAllAudios] = useState<FlatTrack[]>([]);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(-1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [workRes, tracksRes] = await Promise.all([
          fetch(`/api/work/${id}`),
          fetch(`/api/tracks/${id}`),
        ]);

        if (!tracksRes.ok) throw new Error(`Tracks error: ${tracksRes.status}`);

        const tracksData = await tracksRes.json();

        let workData: WorkDetail | null = null;
        if (workRes.ok) {
          workData = await workRes.json();
        } else {
          const fallback = getRecentWork(Number(id));
          if (fallback) {
            workData = toWorkDetailFallback(fallback);
          } else {
            throw new Error(`Work not found: ${workRes.status}`);
          }
        }

        setWork(workData);
        setTracks(tracksData);

        // Extract bonus images from tracks for the gallery
        setImages(extractImages(tracksData));

        // Pre-compute flattened audio list
        const { audios } = flattenTracks(tracksData);
        setAllAudios(audios);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const handlePlay = useCallback(
    (audio: FlatTrack, audios: FlatTrack[], index: number) => {
      setCurrentAudio(audio);
      setAllAudios(audios);
      setCurrentAudioIndex(index);
    },
    []
  );

  const handleTrackChange = useCallback(
    (direction: "prev" | "next") => {
      const newIndex =
        direction === "prev" ? currentAudioIndex - 1 : currentAudioIndex + 1;

      if (newIndex >= 0 && newIndex < allAudios.length) {
        const audio = allAudios[newIndex];
        setCurrentAudio(audio);
        setCurrentAudioIndex(newIndex);
      }
    },
    [currentAudioIndex, allAudios]
  );

  const handleClosePlayer = useCallback(() => {
    setCurrentAudio(null);
    setCurrentAudioIndex(-1);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto" />
          <p className="text-slate-500 text-sm">Loading work details...</p>
        </div>
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <p className="text-red-500 text-sm">Error: {error || "Work not found"}</p>
          <Link href="/" className="text-pink-500 hover:text-pink-600 text-sm underline">
            Go back
          </Link>
        </div>
      </div>
    );
  }

  const coverUrl = work.mainCoverUrl || work.samCoverUrl;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <TranslatedText
            text={work.title}
            className="text-sm font-medium text-slate-800 truncate flex-1"
            as="h1"
          />
          <EnglishToggle />
          <a
            href={work.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-pink-500 hover:text-pink-600 flex items-center gap-1 flex-shrink-0"
          >
            DLsite <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Cover + Info */}
          <div className="lg:col-span-1">
            <div className="sticky top-16 space-y-4">
              {/* Image Gallery (Cover + Bonus Images) */}
              <ImageGallery
                images={images}
                coverUrl={coverUrl}
                workTitle={work.title}
              />

              {/* Title + Favorite */}
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex items-start gap-2">
                  <TranslatedText
                    text={work.title}
                    className="text-lg font-semibold leading-snug text-slate-800 block flex-1"
                    as="h1"
                    showBoth
                  />
                  <FavoriteButton
                    work={work as any}
                    size="lg"
                    className="flex-shrink-0 mt-0.5"
                  />
                </div>
              </div>

              {/* Quick info */}
              <div className="bg-white rounded-xl p-4 space-y-3 border border-slate-200">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Circle:</span>
                  <TranslatedText
                    text={work.name}
                    className="font-medium text-pink-600 cursor-pointer hover:underline"
                    onClick={() => handleTagSearch("circle", work.name)}
                  />
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Release:</span>
                  <span>{work.release}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Duration:</span>
                  <span>{formatDuration(work.duration)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Download className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Downloads:</span>
                  <span>{work.dl_count.toLocaleString()}</span>
                </div>

                {work.rate_average_2dp > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-slate-500">Rating:</span>
                    <span className="font-medium">
                      {work.rate_average_2dp.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({work.rate_count} reviews)
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">RJ:</span>
                  <span className="font-mono text-xs">{work.source_id}</span>
                </div>
              </div>

              {/* Voice Actors */}
              {work.vas.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    Voice Actors
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {work.vas.map((va) => (
                      <TranslatedText
                        key={va.id}
                        text={va.name}
                        className="px-2 py-1 text-xs rounded-md bg-pink-50 text-pink-700 font-medium cursor-pointer hover:bg-pink-100 transition-colors"
                        onClick={() => handleTagSearch("va", va.name)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {work.tags.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {work.tags.map((tag) => {
                      const tagName = getEnglishTag(tag);
                      return (
                        <TranslatedText
                          key={tag.id}
                          text={tagName}
                          className="px-2 py-1 text-xs rounded-md bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors"
                          onClick={() => handleTagSearch("tag", tagName)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column: Track list */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">
                  Tracks ({allAudios.length} audio files)
                </h2>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                <TrackList
                  tracks={tracks}
                  onPlay={handlePlay}
                  currentAudioHash={currentAudio?.hash}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Audio Player (fixed bottom) */}
      {currentAudio && work && (
        <AudioPlayer
          audioUrl={currentAudio.mediaStreamUrl}
          audioTitle={currentAudio.title}
          workTitle={work.title}
          coverUrl={coverUrl}
          subtitleUrl={currentAudio.subtitleTrack?.mediaStreamUrl || null}
          images={images}
          onClose={handleClosePlayer}
          onTrackChange={handleTrackChange}
          hasPrev={currentAudioIndex > 0}
          hasNext={currentAudioIndex < allAudios.length - 1}
        />
      )}
    </div>
  );
}
