"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { WorkItem } from "@/lib/asmr-api";
import WorkCard from "./WorkCard";
import { useAppStore } from "@/lib/store";
import { Loader2, SlidersHorizontal } from "lucide-react";
import SearchBar from "./SearchBar";
import { parseSearchQuery, hasFilters, SearchFilters } from "@/lib/search-parser";
import { fetchWorksPage, prefetchWorksPage, PAGE_SIZE } from "@/lib/works-pagination";
import Pagination from "./Pagination";
import Highlights from "./Highlights";

export default function WorkGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [works, setWorks] = useState<WorkItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gridTopRef = useRef<HTMLDivElement>(null);

  const mode = useAppStore((s) => s.mode);
  const showNsfw = useAppStore((s) => s.showNsfw);
  const setMode = useAppStore((s) => s.setMode);
  const setShowNsfw = useAppStore((s) => s.setShowNsfw);

  // URL is the source of truth for page + search query so browser
  // back/forward navigation restores exactly where the user was.
  const urlPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const urlQuery = searchParams.get("q") || "";
  const urlMode = searchParams.get("mode") === "subtitles" ? "subtitles" : "all";

  const [searchInput, setSearchInput] = useState(urlQuery);

  // Keep the mode toggle in sync with the URL (covers back/forward navigation)
  useEffect(() => {
    if (urlMode !== mode) setMode(urlMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMode]);

  // If the URL's search query changes from something other than our own
  // push (i.e. the user pressed back/forward), sync the input box to match.
  useEffect(() => {
    if (urlQuery !== searchInput) {
      setSearchInput(urlQuery);
    }
  }, [urlQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse the search input for advanced filters
  const { text: searchText, filters: searchFilters } = useMemo(
    () => parseSearchQuery(searchInput),
    [searchInput]
  );

  const updateUrl = useCallback(
    (params: { page?: number; q?: string; mode?: "all" | "subtitles" }) => {
      const next = new URLSearchParams(searchParams.toString());

      const nextPage = params.page ?? urlPage;
      const nextQ = params.q ?? urlQuery;
      const nextMode = params.mode ?? urlMode;

      if (nextPage > 1) next.set("page", String(nextPage));
      else next.delete("page");

      if (nextQ) next.set("q", nextQ);
      else next.delete("q");

      if (nextMode === "subtitles") next.set("mode", "subtitles");
      else next.delete("mode");

      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, urlPage, urlQuery, urlMode]
  );

  const handleSearchSubmit = useCallback((newQuery: string) => {
    if (newQuery !== urlQuery) {
      updateUrl({ q: newQuery, page: 1 });
    }
  }, [urlQuery, updateUrl]);

  // Fetch the current page whenever URL page/query/mode changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { text, filters } = parseSearchQuery(urlQuery);

        // If the user only used advanced filters (e.g., "$tag:ASMR") without plain text,
        // pass the filter values to the server as keywords to get relevant results.
        let serverKeyword = text;
        if (!serverKeyword && hasFilters(filters)) {
          const filterValues = [
            ...filters.tag,
            ...filters.tagw,
            ...filters.circle,
            ...filters.va,
          ]
            .filter((v) => v.length > 0)
            .join(" ");
          if (filterValues) {
            serverKeyword = filterValues;
          }
        }

        const result = await fetchWorksPage(
          urlPage,
          serverKeyword,
          urlMode === "subtitles",
          {
            onStale: (fresh) => {
              if (!cancelled) {
                setWorks(fresh.works);
                setTotalPages(fresh.totalPages);
                setTotalCount(fresh.totalCount);
              }
            },
          }
        );
        if (!cancelled) {
          setWorks(result.works);
          setTotalPages(result.totalPages);
          setTotalCount(result.totalCount);
        }

        // Prefetch next + previous pages so pagination clicks are instant
        const subtitleOnly = urlMode === "subtitles";
        if (urlPage + 1 <= result.totalPages) {
          prefetchWorksPage(urlPage + 1, serverKeyword, subtitleOnly);
        }
        if (urlPage - 1 >= 1) {
          prefetchWorksPage(urlPage - 1, serverKeyword, subtitleOnly);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [urlPage, urlQuery, urlMode]);

  const handleModeChange = useCallback(
    (newMode: "all" | "subtitles") => {
      setMode(newMode);
      updateUrl({ mode: newMode, page: 1 });
    },
    [setMode, updateUrl]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateUrl({ page: newPage });
      gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [updateUrl]
  );

  // Apply advanced (client-side only) filters + NSFW filter on top of the current page
  const filteredWorks = works.filter((work) => {
    if (!showNsfw && work.nsfw) return false;
    if (hasFilters(searchFilters)) {
      return applyFilters(work, searchFilters);
    }
    return true;
  });

  const isClientFiltered = !showNsfw || hasFilters(searchFilters);

  // If we are currently loading and have no data, don't show "No works found" yet
  const showNoResults = !loading && !error && filteredWorks.length === 0;

  const showHighlights = urlPage === 1 && !urlQuery && mode === "all" && showNsfw;

  return (
    <div className="space-y-6">
      {showHighlights && <Highlights />}

      {/* Search & Controls */}
      <div ref={gridTopRef} className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm pb-4 pt-2 space-y-3">
        <SearchBar searchInput={searchInput} onSearchSubmit={handleSearchSubmit} />

        {/* Mode toggle and NSFW toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg bg-slate-200 p-0.5">
            <button
              onClick={() => handleModeChange("all")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleModeChange("subtitles")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                mode === "subtitles"
                  ? "bg-white text-pink-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              Subtitles Only
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showNsfw}
              onChange={(e) => setShowNsfw(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-pink-500 focus:ring-pink-300"
            />
            Show NSFW
          </label>

          <span className="text-xs text-slate-400 ml-auto">
            {totalCount > 0 && (
              <>
                Page {urlPage} of {totalPages} &middot; {totalCount.toLocaleString()} works
                {isClientFiltered && " (filtered)"}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-center py-8">
          <p className="text-red-500 text-sm">Error: {error}</p>
          <button
            onClick={() => updateUrl({})}
            className="mt-2 text-sm text-pink-500 hover:text-pink-600 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading overlay for grid */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredWorks.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </div>

          {showNoResults && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400">
                No works found{isClientFiltered ? " matching your filters on this page" : ""}
              </p>
              {isClientFiltered && (
                <p className="text-xs text-slate-400 mt-1">
                  Try a different page &mdash; client-side filters only apply within the current {PAGE_SIZE}-item page
                </p>
              )}
            </div>
          )}

          {/* Pagination controls */}
          <Pagination page={urlPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}

// Apply advanced filters to a work
function applyFilters(work: WorkItem, filters: SearchFilters): boolean {
  if (filters.tag.length > 0) {
    const hasAllTags = filters.tag.every((tagFilter) =>
      work.tags.some(
        (t) =>
          t.name.toLowerCase().includes(tagFilter.toLowerCase()) ||
          t.i18n?.["en-us"]?.name?.toLowerCase().includes(tagFilter.toLowerCase()) ||
          t.i18n?.["ja-jp"]?.name?.toLowerCase().includes(tagFilter.toLowerCase()) ||
          t.i18n?.["zh-cn"]?.name?.toLowerCase().includes(tagFilter.toLowerCase())
      )
    );
    if (!hasAllTags) return false;
  }

  if (filters.tagw.length > 0) {
    const hasAllTags = filters.tagw.every((tagFilter) =>
      work.tags.some(
        (t) =>
          t.name.toLowerCase().includes(tagFilter.toLowerCase()) ||
          t.i18n?.["en-us"]?.name?.toLowerCase().includes(tagFilter.toLowerCase())
      )
    );
    if (!hasAllTags) return false;
  }

  if (filters.circle.length > 0) {
    const matchesCircle = filters.circle.some(
      (circleFilter) =>
        work.name.toLowerCase().includes(circleFilter.toLowerCase()) ||
        work.circle.name.toLowerCase().includes(circleFilter.toLowerCase())
    );
    if (!matchesCircle) return false;
  }

  if (filters.va.length > 0) {
    const hasAllVas = filters.va.every((vaFilter) =>
      work.vas.some((va) => va.name.toLowerCase().includes(vaFilter.toLowerCase()))
    );
    if (!hasAllVas) return false;
  }

  if (filters.duration !== null) {
    if (work.duration <= filters.duration) return false;
  }

  if (filters.rate !== null) {
    if (work.rate_average_2dp <= filters.rate) return false;
  }

  if (filters.price !== null) {
    if (work.price <= filters.price) return false;
  }

  if (filters.sell !== null) {
    if (work.dl_count <= filters.sell) return false;
  }

  if (filters.age !== null) {
    if (work.age_category_string.toLowerCase() !== filters.age.toLowerCase()) {
      return false;
    }
  }

  if (filters.lang !== null) {
    const hasLang = work.language_editions.some(
      (le) => le.lang.toLowerCase() === filters.lang!.toLowerCase()
    );
    if (!hasLang) return false;
  }

  return true;
}
