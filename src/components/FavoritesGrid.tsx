"use client";

import { useEffect, useState } from "react";
import { useFavoritesStore, FavoriteWork } from "@/lib/favorites";
import { Heart, Clock, Download, Star, Subtitles, Trash2 } from "lucide-react";
import Link from "next/link";
import TranslatedText from "./TranslatedText";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function FavoritesGrid() {
  const hydrate = useFavoritesStore((s) => s.hydrate);
  const hydrated = useFavoritesStore((s) => s.hydrated);
  const getAll = useFavoritesStore((s) => s.getAll);
  const remove = useFavoritesStore((s) => s.remove);
  const count = useFavoritesStore((s) => s.count());

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-pulse text-slate-400 text-sm">Loading favorites...</div>
      </div>
    );
  }

  const favorites = getAll();

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Heart className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 text-lg font-medium">No favorites yet</p>
        <p className="text-slate-400 text-sm max-w-md">
          Hover over any work card and click the ❤️ heart icon to add it to your
          favorites. They&apos;re saved in your browser &mdash; no login
          required.
        </p>
        <Link
          href="/"
          className="mt-2 px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-400 transition-colors"
        >
          Browse Works
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        {count} favorite{count !== 1 ? "s" : ""} &middot; Saved in your browser
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {favorites.map((fav) => (
          <FavoriteCard key={fav.id} fav={fav} onRemove={() => remove(fav.id)} />
        ))}
      </div>
    </div>
  );
}

function FavoriteCard({
  fav,
  onRemove,
}: {
  fav: FavoriteWork;
  onRemove: () => void;
}) {
  return (
    <div className="group relative block rounded-xl overflow-hidden bg-white border border-slate-200 hover:border-pink-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <Link href={`/work/${fav.id}`}>
        {/* Cover */}
        <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
          <img
            src={fav.coverUrl}
            alt={fav.title}
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

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
            {fav.nsfw && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500 text-white">
                NSFW
              </span>
            )}
            {fav.has_subtitle && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500 text-white flex items-center gap-0.5">
                <Subtitles className="w-3 h-3" />
                SUB
              </span>
            )}
          </div>

          {/* Duration */}
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(fav.duration)}
          </div>

          {/* Rating */}
          {fav.rate_average_2dp > 0 && (
            <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-yellow-400 flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-yellow-400" />
              {fav.rate_average_2dp.toFixed(1)}
            </div>
          )}

          {/* Favorited heart (always visible) */}
          <div className="absolute top-2 right-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <TranslatedText
              text={fav.name}
              className="font-medium text-pink-600"
            />
            <span>•</span>
            <span>{fav.source_id}</span>
          </p>

          <TranslatedText
            text={fav.title}
            className="text-sm font-medium line-clamp-2 leading-snug text-slate-800 group-hover:text-pink-600 transition-colors block"
            as="h3"
          />

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-0.5">
              <Download className="w-3 h-3" />
              {fav.dl_count.toLocaleString()}
            </span>
          </div>
        </div>
      </Link>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="absolute bottom-2 right-2 p-1.5 rounded-full bg-white/90 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-slate-200"
        title="Remove from favorites"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
