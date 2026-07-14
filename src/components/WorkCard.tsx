"use client";

import { WorkItem } from "@/lib/asmr-api";
import { saveRecentWork } from "@/lib/recent-works";
import { useFavoritesStore } from "@/lib/favorites";
import { Clock, Download, Star, Subtitles, Mic, Heart } from "lucide-react";
import Link from "next/link";
import TranslatedText from "./TranslatedText";
import FavoriteButton from "./FavoriteButton";
import { useEffect } from "react";

function FavoriteButtonOverlay({ work }: { work: WorkItem }) {
  const hydrate = useFavoritesStore((s) => s.hydrate);
  const isFav = useFavoritesStore((s) => s.isFavorite(work.id));

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div
      className={`absolute top-1.5 right-1.5 z-10 transition-opacity ${
        isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}
    >
      <FavoriteButton
        work={work}
        size="sm"
        className="bg-black/40 backdrop-blur-sm hover:bg-black/60"
      />
    </div>
  );
}

interface WorkCardProps {
  work: WorkItem;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getEnglishTag(tag: WorkItem["tags"][0]): string {
  return tag.i18n?.["en-us"]?.name || tag.i18n?.["ja-jp"]?.name || tag.name;
}

export default function WorkCard({ work }: WorkCardProps) {
  const coverUrl = work.mainCoverUrl || work.samCoverUrl;

  const prefetchWorkData = () => {
    // Warm the API caches so the detail page loads instantly on click
    fetch(`/api/tracks/${work.id}`).catch(() => {});
    fetch(`/api/work/${work.id}`).catch(() => {});
  };

  return (
    <Link
      href={`/work/${work.id}`}
      onClick={() => saveRecentWork(work)}
      onMouseEnter={prefetchWorkData}
      onFocus={prefetchWorkData}
      className="group block rounded-xl overflow-hidden bg-white border border-slate-200 hover:border-pink-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      {/* Cover */}
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        <img
          src={coverUrl}
          alt={work.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "data:image/svg+xml," +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" fill="%23f1f5f9"><rect width="300" height="400"/><text x="150" y="200" text-anchor="middle" fill="%2394a3b8" font-size="14">No Cover</text></svg>`
              );
          }}
        />

        {/* Favorite button */}
        <FavoriteButtonOverlay work={work} />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          {work.nsfw && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500 text-white">
              NSFW
            </span>
          )}
          {work.has_subtitle && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500 text-white flex items-center gap-0.5">
              <Subtitles className="w-3 h-3" />
              SUB
            </span>
          )}
        </div>

        {/* Duration */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDuration(work.duration)}
        </div>

        {/* Rating */}
        {work.rate_average_2dp > 0 && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-yellow-400 flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-yellow-400" />
            {work.rate_average_2dp.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <TranslatedText
            text={work.name}
            className="font-medium text-pink-600"
          />
          <span>•</span>
          <span>{work.source_id}</span>
        </p>

        <TranslatedText
          text={work.title}
          className="text-sm font-medium line-clamp-2 leading-snug text-slate-800 group-hover:text-pink-600 transition-colors block"
          as="h3"
        />

        <div className="flex items-center gap-2 text-xs text-slate-400">
          {work.vas && work.vas.length > 0 && (
            <span className="flex items-center gap-0.5 truncate">
              <Mic className="w-3 h-3 flex-shrink-0" />
              <TranslatedText
                text={work.vas.slice(0, 2).map((va) => va.name).join(", ") +
                  (work.vas.length > 2 ? ` +${work.vas.length - 2}` : "")}
              />
            </span>
          )}
          <span className="flex items-center gap-0.5 flex-shrink-0">
            <Download className="w-3 h-3" />
            {work.dl_count.toLocaleString()}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {work.tags.slice(0, 3).map((tag) => {
            const tagText = getEnglishTag(tag);
            return (
              <TranslatedText
                key={tag.id}
                text={tagText}
                className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault(); // Stop navigation to work page
                  e.stopPropagation();
                  window.location.href = `/?q=${encodeURIComponent(`$tag:${tagText}`)}`;
                }}
              />
            );
          })}
          {work.tags.length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded text-slate-400">
              +{work.tags.length - 3}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
