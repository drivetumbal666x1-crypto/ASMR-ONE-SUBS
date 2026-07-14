"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import WorkGrid from "@/components/WorkGrid";
import FavoritesGrid from "@/components/FavoritesGrid";
import EnglishToggle from "@/components/EnglishToggle";
import { useFavoritesStore } from "@/lib/favorites";
import { Headphones, Loader2, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

function FavoritesCount() {
  const hydrate = useFavoritesStore((s) => s.hydrate);
  const count = useFavoritesStore((s) => s.count());
  const hydrated = useFavoritesStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated || count === 0) return null;
  return (
    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white min-w-[18px] text-center">
      {count}
    </span>
  );
}

export default function HomePage() {
  const [tab, setTab] = useState<"browse" | "favorites">("browse");

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Headphones className="w-6 h-6 text-pink-500" />
            <h1 className="text-lg font-bold text-slate-800">
              ASMR Stream{" "}
              <span className="text-pink-500 font-normal text-sm">via asmr.one</span>
            </h1>
          </Link>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 ml-6 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab("browse")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                tab === "browse"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setTab("favorites")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center ${
                tab === "favorites"
                  ? "bg-white text-red-500 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 mr-1 ${
                  tab === "favorites" ? "fill-red-500" : ""
                }`}
              />
              Favorites
              <FavoritesCount />
            </button>
          </div>

          <div className="ml-auto">
            <EnglishToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {tab === "browse" ? (
          <Suspense
            fallback={
              <div className="flex justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            }
          >
            <WorkGrid />
          </Suspense>
        ) : (
          <FavoritesGrid />
        )}
      </div>
    </main>
  );
}
