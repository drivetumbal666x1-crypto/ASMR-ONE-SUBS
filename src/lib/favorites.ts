"use client";

import { WorkItem } from "./asmr-api";
import { create } from "zustand";

const STORAGE_KEY = "asmr-favorites-v1";

export interface FavoriteWork {
  id: number;
  title: string;
  name: string; // circle
  coverUrl: string;
  has_subtitle: boolean;
  nsfw: boolean;
  duration: number;
  dl_count: number;
  rate_average_2dp: number;
  rate_count: number;
  source_id: string;
  addedAt: number; // timestamp
}

interface FavoritesState {
  favorites: Map<number, FavoriteWork>;
  hydrated: boolean;
  hydrate: () => void;
  toggle: (work: WorkItem) => void;
  isFavorite: (id: number) => boolean;
  remove: (id: number) => void;
  getAll: () => FavoriteWork[];
  count: () => number;
}

function loadFromStorage(): Map<number, FavoriteWork> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr: FavoriteWork[] = JSON.parse(raw);
    return new Map(arr.map((f) => [f.id, f]));
  } catch {
    return new Map();
  }
}

function saveToStorage(favorites: Map<number, FavoriteWork>) {
  try {
    const arr = Array.from(favorites.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // storage full or unavailable
  }
}

function workToFavorite(work: WorkItem): FavoriteWork {
  return {
    id: work.id,
    title: work.title,
    name: work.name,
    coverUrl: work.mainCoverUrl || work.samCoverUrl,
    has_subtitle: work.has_subtitle,
    nsfw: work.nsfw,
    duration: work.duration,
    dl_count: work.dl_count,
    rate_average_2dp: work.rate_average_2dp,
    rate_count: work.rate_count,
    source_id: work.source_id,
    addedAt: Date.now(),
  };
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Map(),
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const loaded = loadFromStorage();
    set({ favorites: loaded, hydrated: true });
  },

  toggle: (work: WorkItem) => {
    const { favorites } = get();
    const next = new Map(favorites);
    if (next.has(work.id)) {
      next.delete(work.id);
    } else {
      next.set(work.id, workToFavorite(work));
    }
    set({ favorites: next });
    saveToStorage(next);
  },

  isFavorite: (id: number) => {
    return get().favorites.has(id);
  },

  remove: (id: number) => {
    const { favorites } = get();
    const next = new Map(favorites);
    next.delete(id);
    set({ favorites: next });
    saveToStorage(next);
  },

  getAll: () => {
    return Array.from(get().favorites.values()).sort(
      (a, b) => b.addedAt - a.addedAt
    );
  },

  count: () => {
    return get().favorites.size;
  },
}));
