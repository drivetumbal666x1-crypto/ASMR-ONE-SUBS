"use client";

import { WorkItem } from "@/lib/asmr-api";

const STORAGE_KEY = "asmr-recent-works-v1";
const MAX_ITEMS = 200;

type WorkMap = Record<string, WorkItem>;

export function saveRecentWork(work: WorkItem) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const map: WorkMap = raw ? JSON.parse(raw) : {};
    map[String(work.id)] = work;

    // basic cap by pruning oldest insertion order approximation
    const entries = Object.entries(map);
    if (entries.length > MAX_ITEMS) {
      const trimmed = Object.fromEntries(entries.slice(entries.length - MAX_ITEMS));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage failures
  }
}

export function getRecentWork(id: number): WorkItem | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map: WorkMap = JSON.parse(raw);
    return map[String(id)] || null;
  } catch {
    return null;
  }
}
