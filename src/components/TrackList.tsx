"use client";

import { TrackItem, FlatTrack, flattenTracks } from "@/lib/asmr-api";
import { useMemo } from "react";
import {
  Play,
  FileAudio,
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useTranslatedText } from "@/lib/use-translate";

interface TrackListProps {
  tracks: TrackItem[];
  onPlay: (audio: FlatTrack, allAudios: FlatTrack[], index: number) => void;
  currentAudioHash?: string;
}

function TrackTreeItem({
  item,
  depth,
  onPlay,
  currentAudioHash,
  allAudios,
}: {
  item: TrackItem;
  depth: number;
  onPlay: (audio: FlatTrack, allAudios: FlatTrack[], index: number) => void;
  currentAudioHash?: string;
  allAudios: FlatTrack[];
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const translatedTitle = useTranslatedText(item.title);

  if (item.type === "folder") {
    const isExpanded = expanded;
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 rounded-md transition-colors"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
          )}
          <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="truncate" title={item.title}>
            {translatedTitle}
          </span>
        </button>
        {isExpanded && item.children && (
          <div>
            {item.children.map((child, idx) => {
              // For audio items at child level, find them in allAudios
              if (child.type === "audio") {
                const flatAudio = allAudios.find(
                  (a) => a.hash === child.hash
                );
                if (flatAudio) {
                  const audioIndex = allAudios.indexOf(flatAudio);
                  return (
                    <TrackTreeItem
                      key={child.hash || idx}
                      item={child}
                      depth={depth + 1}
                      onPlay={onPlay}
                      currentAudioHash={currentAudioHash}
                      allAudios={allAudios}
                    />
                  );
                }
              }
              return (
                <TrackTreeItem
                  key={child.hash || idx}
                  item={child}
                  depth={depth + 1}
                  onPlay={onPlay}
                  currentAudioHash={currentAudioHash}
                  allAudios={allAudios}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (item.type === "audio") {
    const flatAudio = allAudios.find((a) => a.hash === item.hash);
    const audioIndex = flatAudio ? allAudios.indexOf(flatAudio) : -1;
    const isPlaying = currentAudioHash === item.hash;

    return (
      <button
        onClick={() => {
          if (flatAudio && audioIndex >= 0) {
            onPlay(flatAudio, allAudios, audioIndex);
          }
        }}
        className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors ${
          isPlaying
            ? "bg-pink-500/20 text-pink-300"
            : "text-slate-300 hover:bg-slate-700/50"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <Play
          className={`w-4 h-4 flex-shrink-0 ${
            isPlaying ? "text-pink-400 fill-pink-400" : "text-slate-500"
          }`}
        />
        <FileAudio className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="truncate" title={item.title}>
          {translatedTitle}
        </span>
        {flatAudio?.duration ? (
          <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
            {Math.floor(flatAudio.duration / 60)}:
            {Math.floor(flatAudio.duration % 60)
              .toString()
              .padStart(2, "0")}
          </span>
        ) : null}
      </button>
    );
  }

  if (item.type === "text") {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span className="truncate" title={item.title}>
          {translatedTitle}
        </span>
      </div>
    );
  }

  return null;
}

export default function TrackList({
  tracks,
  onPlay,
  currentAudioHash,
}: TrackListProps) {
  const { audios } = useMemo(() => flattenTracks(tracks), [tracks]);

  return (
    <div className="space-y-0.5">
      {tracks.map((item, idx) => (
        <TrackTreeItem
          key={item.hash || idx}
          item={item}
          depth={0}
          onPlay={onPlay}
          currentAudioHash={currentAudioHash}
          allAudios={audios}
        />
      ))}
    </div>
  );
}

export { flattenTracks };
export type { FlatTrack };
