"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguageCode>(() => readStoredLanguage());

  useEffect(() => {
    writeLanguageToDocument(language);
  }, [language]);

  const setLanguage = (nextLanguage: SupportedLanguageCode) => {
    setLanguageState(nextLanguage);

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
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

export function readStoredLanguage(): SupportedLanguageCode {
  if (typeof window === "undefined") {
    return fallbackLanguage;
  }

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguageCode(storedLanguage) ? storedLanguage : fallbackLanguage;
  } catch {
    return fallbackLanguage;
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
