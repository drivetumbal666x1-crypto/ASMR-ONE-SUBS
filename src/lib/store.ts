// Zustand store for app state management
import { create } from "zustand";

export interface NowPlaying {
  workId: number;
  workTitle: string;
  audioTitle: string;
  audioUrl: string;
  coverUrl: string;
  subtitleUrl: string | null;
  vas: { id: string; name: string }[];
  tags: { id: number; name: string }[];
  circleName: string;
}

interface AppState {
  // Mode filter
  mode: "all" | "subtitles";
  setMode: (mode: "all" | "subtitles") => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Now playing
  nowPlaying: NowPlaying | null;
  setNowPlaying: (np: NowPlaying | null) => void;

  // NSFW filter
  showNsfw: boolean;
  setShowNsfw: (show: boolean) => void;

  // English translation mode
  englishMode: boolean;
  setEnglishMode: (enabled: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: "all",
  setMode: (mode) => set({ mode }),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  nowPlaying: null,
  setNowPlaying: (nowPlaying) => set({ nowPlaying }),

  showNsfw: true,
  setShowNsfw: (showNsfw) => set({ showNsfw }),

  englishMode: false,
  setEnglishMode: (englishMode) => set({ englishMode }),
}));
