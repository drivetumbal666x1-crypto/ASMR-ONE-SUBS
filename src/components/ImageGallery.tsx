"use client";

import { useState, useCallback, useEffect } from "react";
import { ImageItem } from "@/lib/asmr-api";
import { ChevronLeft, ChevronRight, X, ZoomIn, ImageIcon } from "lucide-react";

interface ImageGalleryProps {
  images: ImageItem[];
  coverUrl?: string;
  workTitle?: string;
}

export default function ImageGallery({ images, coverUrl, workTitle }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Combine cover + bonus images
  const allImages: ImageItem[] = [
    ...(coverUrl
      ? [{ title: "Cover", url: coverUrl, hash: "cover" }]
      : []),
    ...images,
  ];

  if (allImages.length === 0) return null;

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % allImages.length);
  }, [allImages.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + allImages.length) % allImages.length);
  }, [allImages.length]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i + 1) % allImages.length);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i - 1 + allImages.length) % allImages.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, allImages.length]);

  const currentImage = allImages[currentIndex];

  return (
    <>
      {/* Main slideshow */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="relative aspect-[16/10] bg-slate-100 group">
          <img
            src={currentImage.url}
            alt={currentImage.title}
            className="w-full h-full object-contain cursor-zoom-in"
            onClick={() => openLightbox(currentIndex)}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />

          {/* Overlay controls */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Image counter */}
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white font-mono">
            {currentIndex + 1} / {allImages.length}
          </div>

          {/* Zoom hint */}
          <div className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-4 h-4" />
          </div>
        </div>

        {/* Thumbnails */}
        {allImages.length > 1 && (
          <div className="flex gap-1.5 p-2 overflow-x-auto bg-slate-50">
            {allImages.map((img, idx) => (
              <button
                key={img.hash}
                onClick={() => setCurrentIndex(idx)}
                className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all ${
                  idx === currentIndex
                    ? "border-pink-500 ring-1 ring-pink-300"
                    : "border-transparent hover:border-slate-300"
                }`}
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Image title */}
        <div className="px-3 py-2 text-xs text-slate-500 text-center border-t border-slate-100">
          <ImageIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          {currentImage.title}
          {workTitle && allImages.length > 1 && (
            <span className="text-slate-300 mx-1">&middot;</span>
          )}
          {workTitle && allImages.length > 1 && (
            <span className="text-slate-400">{allImages.length} images</span>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i - 1 + allImages.length) % allImages.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i + 1) % allImages.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <img
            src={allImages[lightboxIndex].url}
            alt={allImages[lightboxIndex].title}
            className="max-w-[90vw] max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 rounded-full text-sm text-white">
            {lightboxIndex + 1} / {allImages.length} &middot; {allImages[lightboxIndex].title}
          </div>
        </div>
      )}
    </>
  );
}
