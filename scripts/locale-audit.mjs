import fs from "node:fs";
import path from "node:path";

const localesDir = path.resolve(process.cwd(), "locales");
const englishFile = path.join(localesDir, "en.json");
const localeFiles = fs
  .readdirSync(localesDir)
  .filter((file) => file.endsWith(".json") && file !== "en.json")
  .sort();

const englishDictionary = JSON.parse(fs.readFileSync(englishFile, "utf8"));

function flattenDictionary(dictionary, prefix = "") {
  const keys = [];

  for (const [key, value] of Object.entries(dictionary)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenDictionary(value, nextKey));
    } else {
      keys.push(nextKey);
    }
  }

  return keys;
}

function getDictionaryValue(dictionary, key) {
  return key.split(".").reduce((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return current[segment];
    }

    return undefined;
  }, dictionary);
}

function getMalformedKeys(dictionary, prefix = "") {
  const malformed = [];

  for (const [key, value] of Object.entries(dictionary)) {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) {
      malformed.push(prefix ? `${prefix}.${key}` : key);
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      malformed.push(...getMalformedKeys(value, prefix ? `${prefix}.${key}` : key));
    }
  }

  return malformed;
}

function collectEnglishPlaceholders(dictionary, englishDictionary, prefix = "") {
  const matches = [];

  for (const [key, value] of Object.entries(dictionary)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      matches.push(...collectEnglishPlaceholders(value, englishDictionary, nextKey));
      continue;
    }

    const englishValue = getDictionaryValue(englishDictionary, nextKey);
    if (typeof value === "string" && typeof englishValue === "string" && value === englishValue) {
      matches.push(nextKey);
    }
  }

  return matches;
}

const englishKeys = flattenDictionary(englishDictionary);
const englishKeySet = new Set(englishKeys);

const report = {
  generatedAt: new Date().toISOString(),
  sourceSchema: "locales/en.json",
  locales: [],
};

for (const localeFile of localeFiles) {
  const localeCode = localeFile.replace(/\.json$/, "");
  const localeDictionary = JSON.parse(fs.readFileSync(path.join(localesDir, localeFile), "utf8"));
  const localeKeys = flattenDictionary(localeDictionary);
  const localeKeySet = new Set(localeKeys);

  const missingKeys = englishKeys.filter((key) => !localeKeySet.has(key));
  const extraKeys = localeKeys.filter((key) => !englishKeySet.has(key));
  const malformedKeys = getMalformedKeys(localeDictionary);
  const englishPlaceholders = collectEnglishPlaceholders(localeDictionary, englishDictionary);

  report.locales.push({
    localeCode,
    file: localeFile,
    status:
      missingKeys.length === 0 && extraKeys.length === 0 && englishPlaceholders.length === 0 && malformedKeys.length === 0
        ? "ok"
        : "warn",
    missingKeysCount: missingKeys.length,
    extraKeysCount: extraKeys.length,
    englishPlaceholdersCount: englishPlaceholders.length,
    malformedKeysCount: malformedKeys.length,
    missingKeys: missingKeys.slice(0, 20),
    extraKeys: extraKeys.slice(0, 20),
    englishPlaceholders: englishPlaceholders.slice(0, 20),
    malformedKeys: malformedKeys.slice(0, 20),
  });
}

console.log(JSON.stringify(report, null, 2));
