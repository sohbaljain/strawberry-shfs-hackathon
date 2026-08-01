import { useMemo } from "react";
import { getTranslation } from "./dictionaries";
import { useLanguage } from "./language-context";

export function useTranslation() {
  const { language } = useLanguage();

  return useMemo(
    () => ({
      t: (key: string, variables?: Record<string, string | number>) =>
        getTranslation(language, key, variables),
    }),
    [language],
  );
}
