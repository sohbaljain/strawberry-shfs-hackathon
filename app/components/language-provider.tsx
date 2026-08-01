"use client";

import type { ReactNode } from "react";
import {
  LanguageProvider as TranslationLanguageProvider,
  languageDirection,
  languageName,
  readStoredLanguage,
  useLanguage,
  writeLanguageToDocument,
} from "@/lib/i18n/language-context";
import { getTranslation } from "@/lib/i18n/dictionaries";
import type { SupportedLanguageCode } from "@/lib/i18n/config";

export type LanguageCode = SupportedLanguageCode;

export type TranslationKey = string;

export function LanguageProvider({ children }: { children: ReactNode }) {
  return <TranslationLanguageProvider>{children}</TranslationLanguageProvider>;
}

export function useCaseFlowLanguage() {
  return useLanguage();
}

export function translate(key: string, variables?: Record<string, string | number>) {
  return getTranslation(readStoredLanguage(), key, variables);
}

export { useLanguage, languageDirection, languageName, readStoredLanguage, writeLanguageToDocument };

