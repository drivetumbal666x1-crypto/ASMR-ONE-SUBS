"use client";

import { useAppStore } from "@/lib/store";
import { Languages, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function EnglishToggle() {
  const englishMode = useAppStore((s) => s.englishMode);
  const setEnglishMode = useAppStore((s) => s.setEnglishMode);
  const [hydrated, setHydrated] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("translate-english-enabled");
      if (saved === "1" && !englishMode) {
        setEnglishMode(true);
      }
    } catch {}
    setHydrated(true);
  }, [setEnglishMode, englishMode]);

  // Show brief "translating" indicator after toggling on
  useEffect(() => {
    if (englishMode) {
      setTranslating(true);
      const t = setTimeout(() => setTranslating(false), 1500);
      return () => clearTimeout(t);
    }
  }, [englishMode]);

  if (!hydrated) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200/50 text-slate-500 text-xs font-medium">
        <Languages className="w-3.5 h-3.5" />
        <span>EN</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEnglishMode(!englishMode)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        englishMode
          ? "bg-pink-500 text-white shadow-sm hover:bg-pink-400"
          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
      }`}
      title={englishMode ? "Show original text" : "Translate everything to English"}
    >
      {translating ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : englishMode ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Languages className="w-3.5 h-3.5" />
      )}
      <span>EN</span>
    </button>
  );
}
