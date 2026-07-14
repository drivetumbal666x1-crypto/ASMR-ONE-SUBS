"use client";

import { useState, useEffect } from "react";
import { WorkItem } from "@/lib/asmr-api";
import Link from "next/link";
import { saveRecentWork } from "@/lib/recent-works";
import TranslatedText from "./TranslatedText";
import FavoriteButton from "./FavoriteButton";
import { Clock, Download, Star, Subtitles, TrendingUp, Trophy, Calendar, Sparkles } from "lucide-react";

type HighlightCategory = "trending" | "topRated" | "mostDownloaded" | "newest";

export default function Highlights() {
  const [category, setCategory] = useState<HighlightCategory>("trending");
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        let url = "";
        if (category === "trending") {
          url = "/api/popular";
        } else if (category === "topRated") {
          url = "/api/works?page=1&pageSize=12&order=rate_average_2dp&sort=desc";
        } else if (category === "mostDownloaded") {
          url = "/api/works?page=1&pageSize=12&order=dl_count&sort=desc";
        } else if (category === "newest") {
          url = "/api/works?page=1&pageSize=12&order=release&sort=desc";
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch highlights");
        const data = await res.json();
        
        if (!cancelled) {
          setWorks((data.works || []).slice(0, 12)); // Only show top 12
        }
      } catch (err) {
        console.error("Highlights error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [category]);

  const tabs = [
    { id: "trending", label: "Trending", icon: TrendingUp },
    { id: "topRated", label: "Top Rated", icon: Star },
    { id: "mostDownloaded", label: "All-Time Best", icon: Trophy },
    { id: "newest", label: "Latest Additions", icon: Sparkles },
  ] as const;

  return (
    <div className="mb-10 space-y-4">
      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = category === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-pink-500 text-white shadow-md shadow-pink-500/20"
                  : "bg-white text-slate-600 hover:bg-pink-50 border border-slate-200"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-pink-500"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Horizontal Scrollable Row */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-pink-200 scrollbar-track-transparent">
          {loading ? (
            // Skeletons
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-w-[240px] w-[240px] sm:min-w-[280px] sm:w-[280px] flex-shrink-0 animate-pulse bg-white rounded-2xl border border-slate-200 aspect-[3/4] snap-start" />
            ))
          ) : (
            works.map((work, idx) => (
              <HighlightCard key={work.id} work={work} rank={idx + 1} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightCard({ work, rank }: { work: WorkItem; rank: number }) {
  const coverUrl = work.mainCoverUrl || work.samCoverUrl;

  return (
    <Link
      href={`/work/${work.id}`}
      onClick={() => saveRecentWork(work)}
      className="group relative min-w-[240px] w-[240px] sm:min-w-[280px] sm:w-[280px] flex-shrink-0 block rounded-2xl overflow-hidden bg-white border border-slate-200 hover:border-pink-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 snap-start"
    >
      {/* Cover Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 border-b border-slate-100">
        <img
          src={coverUrl}
          alt={work.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "data:image/svg+xml," +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23f1f5f9"><rect width="300" height="200"/><text x="150" y="100" text-anchor="middle" fill="%2394a3b8" font-size="14">No Cover</text></svg>`
              );
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Rank Badge */}
        <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold shadow-lg">
          #{rank}
        </div>

        {/* Favorite */}
        <div className="absolute top-2 right-2 z-10 transition-opacity opacity-0 group-hover:opacity-100 [&:has(.fill-red-500)]:opacity-100">
          <FavoriteButton work={work} size="sm" className="bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white" />
        </div>

        {/* Subtitle Badge */}
        {work.has_subtitle && (
          <div className="absolute bottom-2 left-2 px-2 py-1 text-xs font-bold rounded-md bg-emerald-500 text-white flex items-center gap-1 shadow-md">
            <Subtitles className="w-3.5 h-3.5" />
            SUB
          </div>
        )}
      </div>

      {/* Info Content */}
      <div className="p-4 space-y-2.5">
        <TranslatedText
          text={work.title}
          className="text-sm font-semibold line-clamp-2 leading-snug text-slate-800 group-hover:text-pink-600 transition-colors block h-[40px]"
          as="h3"
        />

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="font-medium text-slate-700">{work.rate_average_2dp.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>{work.dl_count.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{work.release.split("-")[0]}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
