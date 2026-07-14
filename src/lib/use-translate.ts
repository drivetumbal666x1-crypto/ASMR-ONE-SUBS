"use client";

import { useEffect, useState, useRef } from "react";
import { translateToEnglish, isMostlyEnglish } from "./translate";
import { useAppStore } from "./store";

// Hook that returns a translated version of a single text
export function useTranslatedText(text: string | null | undefined): string {
  const english = useAppStore((s) => s.englishMode);
  const [translated, setTranslated] = useState<string>(text || "");

  useEffect(() => {
    if (!text) {
      setTranslated("");
      return;
    }
    if (!english || isMostlyEnglish(text)) {
      setTranslated(text);
      return;
    }

    let cancelled = false;
    translateToEnglish(text).then((t) => {
      if (!cancelled) setTranslated(t);
    });
    return () => {
      cancelled = true;
    };
  }, [text, english]);

  return translated;
}

// Hook for batch translation of an object
export function useTranslatedFields<T extends Record<string, unknown>>(
  fields: T,
  enabled: boolean
): T {
  const [result, setResult] = useState<T>(fields);
  const lastFieldsRef = useRef<string>("");

  useEffect(() => {
    const fieldsKey = JSON.stringify(fields);
    if (lastFieldsRef.current === fieldsKey) return;
    lastFieldsRef.current = fieldsKey;

    if (!enabled) {
      setResult(fields);
      return;
    }

    let cancelled = false;
    const translateField = async (val: unknown): Promise<unknown> => {
      if (typeof val === "string" && !isMostlyEnglish(val)) {
        return await translateToEnglish(val);
      }
      if (Array.isArray(val)) {
        return await Promise.all(val.map(translateField));
      }
      if (val && typeof val === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val)) {
          out[k] = await translateField(v);
        }
        return out;
      }
      return val;
    };

    (async () => {
      const translated: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        translated[k] = await translateField(v);
      }
      if (!cancelled) setResult(translated as T);
    })();

    return () => {
      cancelled = true;
    };
  }, [fields, enabled]);

  return result;
}
