export const LANGUAGE_STORAGE_KEY = "caseflow:language";

export const supportedLanguageCodes = [
  "en",
  "as",
  "bn",
  "brx",
  "doi",
  "gu",
  "hi",
  "kn",
  "ks",
  "kok",
  "mai",
  "ml",
  "mni",
  "mr",
  "ne",
  "or",
  "pa",
  "sa",
  "sat",
  "sd",
  "ta",
  "te",
  "ur",
] as const;

export type SupportedLanguageCode = (typeof supportedLanguageCodes)[number];

export const languageDisplayNames: Record<SupportedLanguageCode, string> = {
  en: "English",
  as: "অসমীয়া",
  bn: "বাংলা",
  brx: "बोड़ो",
  doi: "डोगरी",
  gu: "ગુજરાતી",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
  ks: "کٲشُر",
  kok: "कोंकणी",
  mai: "मैथिली",
  ml: "മലയാളം",
  mni: "ꯃꯩꯇꯩ",
  mr: "मराठी",
  ne: "नेपाली",
  or: "ଓଡ଼ିଆ",
  pa: "ਪੰਜਾਬੀ",
  sa: "संस्कृत",
  sat: "ᱥᱟᱱᱛᱟᱞᱤ",
  sd: "سنڌي",
  ta: "தமிழ்",
  te: "తెలుగు",
  ur: "اردو",
};

export const rtlLanguageCodes = new Set<SupportedLanguageCode>(["ur", "sd", "ks"]);

export const fallbackLanguage: SupportedLanguageCode = "en";

export function isSupportedLanguageCode(value: unknown): value is SupportedLanguageCode {
  return typeof value === "string" && supportedLanguageCodes.includes(value as SupportedLanguageCode);
}

export function getLanguageDirection(language: SupportedLanguageCode) {
  return rtlLanguageCodes.has(language) ? "rtl" : "ltr";
}

export function getLanguageDisplayName(language: SupportedLanguageCode) {
  return languageDisplayNames[language] ?? languageDisplayNames.en;
}

export function getLanguageLabel(language: SupportedLanguageCode) {
  return getLanguageDisplayName(language);
}
