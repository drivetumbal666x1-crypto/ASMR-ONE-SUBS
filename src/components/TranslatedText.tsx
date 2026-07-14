"use client";

import { useTranslatedText } from "@/lib/use-translate";
import { ReactNode } from "react";

interface TranslatedTextProps {
  text: string;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "div";
  showBoth?: boolean; // Show original + English stacked
}

/**
 * Renders text that auto-translates to English when English mode is on.
 * - If English mode is OFF: shows the original text
 * - If English mode is ON and text is already English: shows original
 * - If English mode is ON and text is Japanese/Chinese: shows English translation
 *
 * With showBoth=true, displays both: original (smaller) + English (main)
 */
export default function TranslatedText({
  text,
  className = "",
  as: Tag = "span",
  showBoth = false,
  onClick,
}: TranslatedTextProps & { onClick?: (e: React.MouseEvent) => void }) {
  const translated = useTranslatedText(text);

  const content = (
    <>
      {showBoth && translated !== text ? (
        <>
          <span className="block text-sm">{translated}</span>
          <span className="block text-xs text-slate-400 mt-0.5">{text}</span>
        </>
      ) : (
        translated
      )}
    </>
  );

  return (
    <Tag className={className} onClick={onClick}>
      {content}
    </Tag>
  );
}
