import enDictionary from "@/locales/en.json";
import asDictionary from "@/locales/as.json";
import bnDictionary from "@/locales/bn.json";
import brxDictionary from "@/locales/brx.json";
import doiDictionary from "@/locales/doi.json";
import guDictionary from "@/locales/gu.json";
import hiDictionary from "@/locales/hi.json";
import knDictionary from "@/locales/kn.json";
import ksDictionary from "@/locales/ks.json";
import kokDictionary from "@/locales/kok.json";
import maiDictionary from "@/locales/mai.json";
import mlDictionary from "@/locales/ml.json";
import mniDictionary from "@/locales/mni.json";
import mrDictionary from "@/locales/mr.json";
import neDictionary from "@/locales/ne.json";
import orDictionary from "@/locales/or.json";
import paDictionary from "@/locales/pa.json";
import saDictionary from "@/locales/sa.json";
import satDictionary from "@/locales/sat.json";
import sdDictionary from "@/locales/sd.json";
import taDictionary from "@/locales/ta.json";
import teDictionary from "@/locales/te.json";
import urDictionary from "@/locales/ur.json";

import { fallbackLanguage, type SupportedLanguageCode } from "./config";

export type TranslationDictionary = Record<string, unknown>;

const localeDictionaries: Record<SupportedLanguageCode, TranslationDictionary> = {
  en: enDictionary as TranslationDictionary,
  as: asDictionary as TranslationDictionary,
  bn: bnDictionary as TranslationDictionary,
  brx: brxDictionary as TranslationDictionary,
  doi: doiDictionary as TranslationDictionary,
  gu: guDictionary as TranslationDictionary,
  hi: hiDictionary as TranslationDictionary,
  kn: knDictionary as TranslationDictionary,
  ks: ksDictionary as TranslationDictionary,
  kok: kokDictionary as TranslationDictionary,
  mai: maiDictionary as TranslationDictionary,
  ml: mlDictionary as TranslationDictionary,
  mni: mniDictionary as TranslationDictionary,
  mr: mrDictionary as TranslationDictionary,
  ne: neDictionary as TranslationDictionary,
  or: orDictionary as TranslationDictionary,
  pa: paDictionary as TranslationDictionary,
  sa: saDictionary as TranslationDictionary,
  sat: satDictionary as TranslationDictionary,
  sd: sdDictionary as TranslationDictionary,
  ta: taDictionary as TranslationDictionary,
  te: teDictionary as TranslationDictionary,
  ur: urDictionary as TranslationDictionary,
};

const flatEnKeys = flattenDictionary(localeDictionaries.en);

if (process.env.NODE_ENV !== "production") {
  for (const [language, dictionary] of Object.entries(localeDictionaries) as Array<[
    SupportedLanguageCode,
    TranslationDictionary
  ]>) {
    const flatKeys = flattenDictionary(dictionary);
    const missingKeys = Array.from(flatEnKeys).filter((key) => !flatKeys.has(key));

    if (missingKeys.length > 0) {
      console.warn(`[i18n] ${language} missing keys:`, missingKeys.slice(0, 10));
    }
  }
}

export function getDictionary(language: SupportedLanguageCode) {
  return localeDictionaries[language] ?? localeDictionaries[fallbackLanguage];
}

export function getTranslation(language: SupportedLanguageCode, key: string, variables?: Record<string, string | number>) {
  const dictionary = getDictionary(language);
  const englishDictionary = localeDictionaries[fallbackLanguage];
  const resolved = getNestedValue(dictionary, key) ?? getNestedValue(englishDictionary, key) ?? key;
  const text = typeof resolved === "string" ? resolved : String(resolved);

  if (process.env.NODE_ENV !== "production" && !hasNestedKey(dictionary, key)) {
    console.warn(`[i18n] missing translation key in ${language}: ${key}. Falling back to English.`);
  }

  return Object.entries(variables ?? {}).reduce((result, [token, value]) => {
    return result.replaceAll(`{${token}}`, String(value));
  }, text);
}

export function resolveDictionaryValue(dictionary: TranslationDictionary, key: string) {
  return getNestedValue(dictionary, key);
}

function hasNestedKey(dictionary: TranslationDictionary, key: string) {
  return getNestedValue(dictionary, key) !== undefined;
}

function getNestedValue(dictionary: TranslationDictionary, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, dictionary);
}

function flattenDictionary(dictionary: TranslationDictionary, prefix = "") {
  const keys = new Set<string>();

  for (const [entryKey, value] of Object.entries(dictionary)) {
    const nextKey = prefix ? `${prefix}.${entryKey}` : entryKey;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenDictionary(value as TranslationDictionary, nextKey).forEach((nestedKey) => keys.add(nestedKey));
    } else {
      keys.add(nextKey);
    }
  }

  return keys;
}
