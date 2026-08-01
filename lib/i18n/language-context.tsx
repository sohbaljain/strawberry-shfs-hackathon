"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  fallbackLanguage,
  getLanguageDirection,
  getLanguageLabel,
  isSupportedLanguageCode,
  LANGUAGE_STORAGE_KEY,
  type SupportedLanguageCode,
} from "./config";
import { getTranslation } from "./dictionaries";

export type LanguageContextValue = {
  language: SupportedLanguageCode;
  setLanguage: (language: SupportedLanguageCode) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: SupportedLanguageCode;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<SupportedLanguageCode>(() => readStoredLanguage(initialLanguage));
  const didMountRef = useRef(false);

  useEffect(() => {
    writeLanguageToDocument(language);
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    router.refresh();
  }, [language, router]);

  const setLanguage = (nextLanguage: SupportedLanguageCode) => {
    setLanguageState(nextLanguage);

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      window.document.cookie = `${LANGUAGE_STORAGE_KEY}=${nextLanguage}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Ignore local storage write failures.
    }
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, variables) => getTranslation(language, key, variables),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within the active LanguageProvider.");
  }

  return context;
}

export function readStoredLanguage(preferredLanguage?: SupportedLanguageCode): SupportedLanguageCode {
  if (typeof window === "undefined") {
    return preferredLanguage ?? fallbackLanguage;
  }

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguageCode(storedLanguage)) return storedLanguage;
    return preferredLanguage ?? fallbackLanguage;
  } catch {
    return preferredLanguage ?? fallbackLanguage;
  }
}

export function languageName(language: SupportedLanguageCode) {
  return getLanguageLabel(language);
}

export function languageDirection(language: SupportedLanguageCode) {
  return getLanguageDirection(language);
}

export function writeLanguageToDocument(language: SupportedLanguageCode) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = language;
  document.documentElement.dir = getLanguageDirection(language);
}
