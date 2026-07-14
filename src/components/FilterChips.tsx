"use client";

import { X } from "lucide-react";
import { FilterKey } from "@/lib/search-parser";

interface FilterChipsProps {
  filters: { key: FilterKey; value: string }[];
  onRemove: (index: number) => void;
}

export default function FilterChips({ filters, onRemove }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter, index) => (
        <div
          key={`${filter.key}-${filter.value}-${index}`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 text-pink-700 rounded-full text-xs font-medium border border-pink-200"
        >
          <span className="text-pink-500 font-mono">$</span>
          <span>{filter.key}:</span>
          <span className="font-semibold">{filter.value}</span>
          <button
            onClick={() => onRemove(index)}
            className="ml-1 p-0.5 rounded-full hover:bg-pink-200 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
