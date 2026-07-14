"use client";

import { Heart } from "lucide-react";
import { useFavoritesStore } from "@/lib/favorites";
import { WorkItem } from "@/lib/asmr-api";
import { useEffect } from "react";

interface FavoriteButtonProps {
  work: WorkItem;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function FavoriteButton({
  work,
  size = "md",
  className = "",
}: FavoriteButtonProps) {
  const hydrate = useFavoritesStore((s) => s.hydrate);
  const toggle = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => s.isFavorite(work.id));
  const hydrated = useFavoritesStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const padClasses = {
    sm: "p-1",
    md: "p-1.5",
    lg: "p-2",
  };

  if (!hydrated) {
    return (
      <button className={`${padClasses[size]} ${className}`} disabled>
        <Heart className={`${sizeClasses[size]} text-slate-300`} />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(work);
      }}
      className={`${padClasses[size]} rounded-full transition-all active:scale-90 ${
        isFavorite
          ? "text-red-500 hover:text-red-400"
          : "text-slate-400 hover:text-red-400"
      } ${className}`}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={`${sizeClasses[size]} transition-all ${
          isFavorite ? "fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]" : ""
        }`}
      />
    </button>
  );
}
