"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X, Loader2, ArrowRight } from "lucide-react";
import { parseSearchQuery, getActiveFilterPrefix, FilterKey } from "@/lib/search-parser";
import FilterChips from "./FilterChips";

interface SearchBarProps {
  searchInput: string;
  onSearchSubmit: (value: string) => void;
  placeholder?: string;
}

const FILTER_DESCRIPTIONS: Record<string, string> = {
  tag: "Filter by tags",
  tagw: "Include low-vote tags",
  circle: "Filter by circles",
  va: "Filter by voice actors",
  duration: "Filter by duration > x (seconds)",
  rate: "Filter by rating > x",
  price: "Filter by price > x",
  sell: "Filter by sales > x",
  age: "Filter by age rating",
  lang: "Filter by language",
};

const TYPE_LABELS: Partial<Record<FilterKey, string>> = {
  va: "Voice Actor",
  tag: "Tag",
  circle: "Circle",
  lang: "Language",
};

interface SuggestionItem {
  original: string; // Native text (JP/CN) — inserted into the filter value
  translated: string; // English label shown to the user
}

export default function SearchBar({
  searchInput,
  onSearchSubmit,
  placeholder = "Search ASMR works... (e.g. $tag:ASMR $circle:MyHonyaku)",
}: SearchBarProps) {
  // Use internal state for typing, only sync to parent on submit
  const [localInput, setLocalInput] = useState(searchInput);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sync internal state if URL changes externally (e.g., browser back button)
  useEffect(() => {
    setLocalInput(searchInput);
  }, [searchInput]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSearchSubmit(localInput);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const { filters, rawFilters } = useMemo(
    () => parseSearchQuery(searchInput),
    [searchInput]
  );

  const activeFilter = useMemo(
    () => getActiveFilterPrefix(searchInput),
    [searchInput]
  );

  // Fetch suggestions for filter types that have autocomplete data
  const suggestionTypes: FilterKey[] = ["va", "tag", "circle", "lang"];

  // Determine if this filter type supports suggestions
  const hasSuggestionSupport = !!activeFilter?.key && suggestionTypes.includes(activeFilter.key);

  // Fetch suggestions when active filter changes
  useEffect(() => {
    if (!activeFilter || !hasSuggestionSupport || !showSuggestions) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;

    async function doFetch() {
      if (!activeFilter || !activeFilter.key) return;
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `/api/suggestions?type=${activeFilter.key}&q=${encodeURIComponent(activeFilter.query)}`
        );
        if (!cancelled && res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
        }
      } catch {
        setSuggestions([]);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }

    // Small delay to avoid excessive requests
    const timer = setTimeout(doFetch, 150);

    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [activeFilter?.key, activeFilter?.query, showSuggestions, hasSuggestionSupport]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        formRef.current &&
        !formRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalInput(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  const clearSearch = () => {
    setLocalInput("");
    inputRef.current?.focus();
  };

  const selectSuggestion = useCallback(
    (value: string) => {
      const currentText = localInput;
      const activePrefix = getActiveFilterPrefix(currentText);
      const key = activePrefix ? activePrefix.key : null;

      let newText: string;
      if (key) {
        const regex = new RegExp(`\\$${key}:[^\\s]*$`, "i");
        newText = currentText.replace(regex, `$${key}:${value}`);
      } else {
        newText = currentText.trim() ? `${currentText.trim()} ${value}` : value;
      }

      setLocalInput(newText + " ");
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [localInput]
  );

  return (
    <div className="space-y-3">
      {/* Search input */}
      <form ref={formRef} onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="text"
          value={localInput}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full pl-12 pr-24 py-4 text-base rounded-xl border-2 border-pink-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all shadow-sm"
        />
        {localInput && (
          <button
            type="button"
            onClick={clearSearch}
            onPointerDown={(e) => e.preventDefault()}
            aria-label="Clear search"
            className="absolute right-[3.75rem] sm:right-14 top-1/2 -translate-y-1/2 p-2 sm:p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-90 transition-all z-20 touch-manipulation"
          >
            <X className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        )}
        <button
          type="submit"
          onPointerDown={(e) => e.preventDefault()}
          aria-label="Search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 sm:p-2 rounded-lg bg-pink-500 text-white hover:bg-pink-600 active:scale-90 active:bg-pink-700 shadow-md shadow-pink-500/30 transition-all z-20 touch-manipulation"
          title="Search"
        >
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-[400px] overflow-hidden flex flex-col"
          >
            {/* Autocomplete suggestions for filter types */}
            {activeFilter?.key && hasSuggestionSupport && (
              <div className="flex flex-col">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium capitalize">
                    {TYPE_LABELS[activeFilter.key] || activeFilter.key}
                  </span>
                  <span className="text-pink-500 font-mono text-xs bg-pink-50 px-1.5 py-0.5 rounded">
                    ${activeFilter.key}:
                  </span>
                </div>

                {/* Loading indicator */}
                {loadingSuggestions && (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </div>
                )}

                {/* Suggestions list - English label shown, native text inserted on click */}
                {!loadingSuggestions && (
                  <div className="max-h-[340px] overflow-y-auto p-1">
                    {suggestions.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        No results found
                      </div>
                    ) : (
                      suggestions.map((suggestion, idx) => {
                        const isTranslated = suggestion.translated !== suggestion.original;
                        return (
                          <button
                            key={`${suggestion.original}-${idx}`}
                            onClick={() => selectSuggestion(suggestion.original)}
                            title={suggestion.original}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              idx % 2 === 0
                                ? "bg-white hover:bg-pink-50"
                                : "bg-slate-50/50 hover:bg-pink-50"
                            }`}
                          >
                            <div className="flex items-baseline gap-1">
                              <span className="font-mono text-pink-600 text-xs">$</span>
                              <span className="text-xs text-slate-500">{activeFilter.key}:</span>
                              <span className="font-medium text-slate-800">
                                {suggestion.translated}
                              </span>
                              <span className="font-mono text-pink-400 text-xs">$</span>
                            </div>
                            {isTranslated && (
                              <div className="text-xs text-slate-400 mt-0.5 pl-3 truncate">
                                {suggestion.original}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Numeric filters help */}
            {activeFilter?.key && !hasSuggestionSupport && activeFilter.key !== null && (
              <div className="p-3">
                <p className="text-xs text-slate-500 px-2 py-1 mb-2 font-medium">
                  {FILTER_DESCRIPTIONS[activeFilter.key]}
                </p>
                <div className="flex items-center gap-2 px-2 py-1">
                  <code className="text-pink-600 font-mono text-sm bg-pink-50 px-2 py-1 rounded">
                    ${activeFilter.key}:
                  </code>
                  <span className="text-sm text-slate-700">
                    Type a number...
                  </span>
                </div>
                {activeFilter.key === "duration" && (
                  <p className="text-xs text-slate-400 mt-2 px-2">
                    Examples: $duration:3600 (1h), $duration:7200 (2h), $duration:18000 (5h)
                  </p>
                )}
                {(activeFilter.key === "rate" || activeFilter.key === "price") && (
                  <p className="text-xs text-slate-400 mt-2 px-2">
                    Example: ${activeFilter.key}:4.0 (above 4.0)
                  </p>
                )}
              </div>
            )}

            {/* No active filter - show available filters menu */}
            {!activeFilter?.key && (
              <div className="p-2">
                <p className="text-xs text-slate-500 px-3 py-2 mb-1 font-semibold uppercase tracking-wide">
                  Available Filters
                </p>
                <div className="space-y-0.5">
                  {/* Suggestion types first - these have autocomplete! */}
                  <div className="px-3 py-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 mx-1 rounded mt-1">
                    ✨ Has Suggestions
                  </div>
                  {suggestionTypes.map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        const currentText = localInput.trim();
                        const newText = currentText ? `${currentText} $${key}:` : `$${key}:`;
                        setLocalInput(newText);
                        inputRef.current?.focus();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-pink-50 transition-colors flex items-center gap-2"
                    >
                      <code className="text-pink-600 font-mono text-xs bg-pink-50 px-1.5 py-0.5 rounded flex-shrink-0 min-w-[72px] text-right">
                        ${key}:
                      </code>
                      <span className="text-slate-700">{FILTER_DESCRIPTIONS[key]}</span>
                      <span className="ml-auto text-[10px] text-emerald-500 font-medium">autocomplete</span>
                    </button>
                  ))}

                  {/* Numeric / other filters */}
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 mx-1 rounded mt-2">
                    Numeric / Value
                  </div>
                  {(["duration", "rate", "price", "sell", "age"] as FilterKey[]).map(
                    (key) =>
                      !suggestionTypes.includes(key) && (
                        <button
                          key={key}
                          onClick={() => {
                            const currentText = localInput.trim();
                            const newText = currentText ? `${currentText} $${key}:` : `$${key}:`;
                            setLocalInput(newText);
                            inputRef.current?.focus();
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                          <code className="text-slate-500 font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0 min-w-[80px] text-right">
                            ${key}:
                          </code>
                          <span className="text-slate-600">{FILTER_DESCRIPTIONS[key]}</span>
                        </button>
                      )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Filter chips */}
      {rawFilters.length > 0 && (
        <FilterChips
          filters={rawFilters}
          onRemove={(index: number) => {
            const regex = new RegExp(`\\$${rawFilters[index].key}:[^\\s]*`, "i");
            const newText = localInput.replace(regex, "").replace(/\s+/g, " ").trim();
            setLocalInput(newText);
          }}
        />
      )}
    </div>
  );
}
