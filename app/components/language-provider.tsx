"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type LanguageCode = "en" | "hi" | "pa";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey) => string;
};

type TranslationDictionary = Record<TranslationKey, string>;

type TranslationKey =
  | "analysis"
  | "backToReport"
  | "caseAssistant"
  | "createCase"
  | "dashboard"
  | "demoBanner"
  | "emptyState"
  | "loading"
  | "myCases"
  | "newChat"
  | "openCase"
  | "oversight"
  | "search"
  | "settings"
  | "signOut";

const languageStorageKey = "caseflow:language";

const dictionaries: Record<LanguageCode, TranslationDictionary> = {
  en: {
    analysis: "Analysis",
    backToReport: "Back to report",
    caseAssistant: "Case Assistant",
    createCase: "Create Case",
    dashboard: "Dashboard",
    demoBanner: "Demonstration environment - fictional case data only",
    emptyState: "No data available.",
    loading: "Loading...",
    myCases: "My Cases",
    newChat: "New chat",
    openCase: "Open Case",
    oversight: "Oversight",
    search: "Search",
    settings: "Settings",
    signOut: "Sign out",
  },
  hi: {
    analysis: "विश्लेषण",
    backToReport: "रिपोर्ट पर वापस जाएं",
    caseAssistant: "केस सहायक",
    createCase: "केस बनाएं",
    dashboard: "डैशबोर्ड",
    demoBanner: "डेमोंस्ट्रेशन परिवेश - केवल काल्पनिक केस डेटा",
    emptyState: "कोई डेटा उपलब्ध नहीं है।",
    loading: "लोड हो रहा है...",
    myCases: "मेरे केस",
    newChat: "नई चैट",
    openCase: "केस खोलें",
    oversight: "निगरानी",
    search: "खोजें",
    settings: "सेटिंग्स",
    signOut: "साइन आउट",
  },
  pa: {
    analysis: "Analysis",
    backToReport: "Back to report",
    caseAssistant: "Case Assistant",
    createCase: "Create Case",
    dashboard: "Dashboard",
    demoBanner: "Demonstration environment - fictional case data only",
    emptyState: "No data available.",
    loading: "Loading...",
    myCases: "My Cases",
    newChat: "New chat",
    openCase: "Open Case",
    oversight: "Oversight",
    search: "Search",
    settings: "Settings",
    signOut: "Sign out",
  },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => readStoredLanguage());

  const setLanguage = (nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);

    try {
      window.localStorage.setItem(languageStorageKey, nextLanguage);
    } catch {
      // Ignore local storage write failures.
    }
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key) => dictionaries[language][key] || dictionaries.en[key],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}

export function languageName(language: LanguageCode) {
  if (language === "hi") return "Hindi";
  if (language === "pa") return "Punjabi";
  return "English";
}

export function readStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";

  try {
    const storedLanguage = window.localStorage.getItem(languageStorageKey);
    if (storedLanguage === "en" || storedLanguage === "hi" || storedLanguage === "pa") {
      return storedLanguage;
    }
  } catch {
    // Ignore local storage read failures.
  }

  return "en";
}
