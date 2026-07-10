import fs from "fs";
import path from "path";
import translate from "@iamtraction/google-translate";
import { translate as bingTranslate } from "bing-translate-api";

// Pure Node.js recursive directory walking
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
        results.push(filePath);
      }
    }
  });
  return results;
}

// Convert nested JSON into flat key-value pairs (using dots)
function flattenObject(obj, prefix = "") {
  let result = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(result, flattenObject(val, fullKey));
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

// Convert flat key-value pairs (using dots) into nested JSON
function unflattenObject(flat) {
  let result = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split(".");
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== "object" || Array.isArray(current[part])) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = val;
  }
  return result;
}

// Extract namespace from useTranslation hook in file
function getNamespaces(code, file) {
  if (file && file.endsWith("tour-content.ts")) {
    return ["tour"];
  }
  const namespaces = new Set();
  
  // Pattern 1: useTranslation("ns") or useTranslation('ns')
  const singleNsRegex = /useTranslation\s*\(\s*(['"`])(.*?)\1\s*\)/g;
  let match;
  while ((match = singleNsRegex.exec(code)) !== null) {
    namespaces.add(match[2]);
  }
  
  // Pattern 2: useTranslation(["ns1", "ns2"])
  const arrayNsRegex = /useTranslation\s*\(\s*\[\s*(.*?)\s*\]\s*\)/g;
  while ((match = arrayNsRegex.exec(code)) !== null) {
    const arrContent = match[1];
    const items = arrContent.split(",").map(s => s.trim().replace(/['"`]/g, ""));
    items.forEach(it => {
      if (it) namespaces.add(it);
    });
  }
  
  // Pattern 3: useTranslation() with no args -> defaults to common
  const noArgsRegex = /useTranslation\s*\(\s*\)/g;
  if (noArgsRegex.test(code)) {
    namespaces.add("common");
  }
  
  return namespaces.size > 0 ? Array.from(namespaces) : ["common"];
}

// Extract keys and defaultValues from code using a character-by-character scanner
function extractKeysAndDefaults(code, defaultNs) {
  const results = [];
  const regex = /\bt\s*\(\s*(['"`])(.*?)\1/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const fullKey = match[2];
    const startIdx = match.index;
    
    // Scan for balanced parentheses and quotes to grab arguments
    let openParentheses = 1;
    let endIdx = startIdx + match[0].length;
    let inString = false;
    let stringChar = null;
    let argsString = "";
    
    while (endIdx < code.length) {
      const char = code[endIdx];
      if (inString) {
        if (char === stringChar && code[endIdx - 1] !== "\\") {
          inString = false;
        }
      } else {
        if (char === "'" || char === '"' || char === "`") {
          inString = true;
          stringChar = char;
        } else if (char === "(") {
          openParentheses++;
        } else if (char === ")") {
          openParentheses--;
          if (openParentheses === 0) {
            break;
          }
        }
      }
      argsString += char;
      endIdx++;
    }
    
    // Parse defaultValue from argsString
    let defaultValue = "";
    const defaultValObjRegex = /defaultValue\s*:\s*(['"`])((?:[^\\]|\\.)*?)\1/s;
    const defaultValueObjMatch = argsString.match(defaultValObjRegex);
    if (defaultValueObjMatch) {
      defaultValue = defaultValueObjMatch[2].replace(/\\/g, "");
    } else {
      const firstCommaIdx = argsString.indexOf(",");
      if (firstCommaIdx !== -1) {
        const afterComma = argsString.substring(firstCommaIdx + 1).trim();
        if (afterComma.startsWith("'") || afterComma.startsWith('"') || afterComma.startsWith("`")) {
          const quoteChar = afterComma[0];
          const nextQuoteIdx = afterComma.indexOf(quoteChar, 1);
          if (nextQuoteIdx !== -1) {
            defaultValue = afterComma.substring(1, nextQuoteIdx).replace(/\\/g, "");
          }
        }
      }
    }
    
    // Resolve namespace and key
    let ns = defaultNs;
    let finalKey = fullKey;
    if (fullKey.includes(":")) {
      const parts = fullKey.split(":");
      ns = parts[0];
      finalKey = parts.slice(1).join(":");
    }
    
    results.push({ ns, key: finalKey, defaultValue: defaultValue || finalKey });
  }
  
  return results;
}

// Automated text translator with concurrency handling and variables protection
async function translateText(text, targetLang) {
  if (!text) return "";
  if (targetLang === "en") return text;
  
  const langMap = {
    zh: "zh-CN",
    en: "en",
    ar: "ar",
    de: "de",
    es: "es",
    fr: "fr",
    hi: "hi"
  };
  const target = langMap[targetLang] || targetLang;
  
  // Protect i18next variables (e.g. {{variable}})
  const vars = [];
  const processedText = text.replace(/\{\{([^}]+)\}\}/g, (match) => {
    vars.push(match);
    return `__VAR_${vars.length - 1}__`;
  });

  let translated = "";
  try {
    const res = await translate(processedText, { to: target });
    translated = res.text;
  } catch (err) {
    try {
      const res = await bingTranslate(processedText, null, target);
      translated = res.translation;
    } catch (e) {
      console.warn(`Translation failed for: "${text}" to ${targetLang}. Falling back to English.`);
      translated = processedText;
    }
  }

  // Restore variables
  vars.forEach((v, idx) => {
    translated = translated.replace(new RegExp(`__VAR_${idx}__`, "gi"), v);
  });

  return translated;
}

// Concurrency-limited promise queue
async function runWithConcurrencyLimit(tasks, limit = 5) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

async function main() {
  const languages = ["en", "ar", "de", "es", "fr", "hi", "zh"];
  const namespaces = [
    "analytics", "auth", "certificate", "cohorts", "common", 
    "documentUpload", "header", "landing", "mentorChat", 
    "personalization", "progressDashboard", "quizRunner", 
    "roadmap", "teacherDashboard", "tour"
  ];

  console.log("Initializing locale directories and files...");
  languages.forEach(lang => {
    const dir = path.join("src", "locales", lang);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    namespaces.forEach(ns => {
      const filePath = path.join(dir, `${ns}.json`);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
      }
    });
  });

  console.log("Scanning source files...");
  const files = walk("src");
  console.log(`Found ${files.length} source files.`);

  // Collect all keys and defaultValues from source code
  const codeKeysByNamespace = {};
  namespaces.forEach(ns => {
    codeKeysByNamespace[ns] = {};
  });

  files.forEach(file => {
    const code = fs.readFileSync(file, "utf8");
    const fileNamespaces = getNamespaces(code, file);
    const defaultNs = fileNamespaces[0] || "common";
    const findings = extractKeysAndDefaults(code, defaultNs);
    
    findings.forEach(({ ns, key, defaultValue }) => {
      if (namespaces.includes(ns)) {
        // If it doesn't exist yet, or the new one has a non-empty defaultValue
        if (!codeKeysByNamespace[ns][key] || (defaultValue && defaultValue !== key)) {
          codeKeysByNamespace[ns][key] = defaultValue;
        }
      }
    });
  });

  console.log("Analyzing missing and orphaned keys...");
  const summary = {};
  namespaces.forEach(ns => {
    summary[ns] = {
      totalKeys: 0,
      addedKeys: 0,
      orphanedKeys: 0,
    };
  });

  // Step 1: Update English keys (and identify orphaned ones)
  namespaces.forEach(ns => {
    const enPath = path.join("src", "locales", "en", `${ns}.json`);
    const existing = JSON.parse(fs.readFileSync(enPath, "utf8"));
    const flatExisting = flattenObject(existing);
    const codeKeys = codeKeysByNamespace[ns];

    let updated = false;
    let addedCount = 0;
    let orphanedCount = 0;

    // Identify missing keys in English and add them
    for (const [key, defaultValue] of Object.entries(codeKeys)) {
      if (!(key in flatExisting)) {
        flatExisting[key] = defaultValue;
        addedCount++;
        updated = true;
      }
    }

    // Apply strict standardized overrides requested by user
    if (ns === "common") {
      flatExisting["syllabusLinkPlaceholder"] = "https://your-syllabus-link.com";
      flatExisting["emailPlaceholder"] = "you@example.com";
      updated = true;
    }

    // Identify possibly orphaned keys in English JSON
    for (const key of Object.keys(flatExisting)) {
      if (!(key in codeKeys)) {
        orphanedCount++;
      }
    }

    if (updated) {
      const nested = unflattenObject(flatExisting);
      fs.writeFileSync(enPath, JSON.stringify(nested, null, 2), "utf8");
    }

    summary[ns].totalKeys = Object.keys(flatExisting).length;
    summary[ns].addedKeys = addedCount;
    summary[ns].orphanedKeys = orphanedCount;
  });

  // Step 2: Propagate and translate missing keys to other languages
  console.log("Propagating and translating missing keys to other languages...");
  const fileTasks = [];

  for (const ns of namespaces) {
    const enPath = path.join("src", "locales", "en", `${ns}.json`);
    const enFlat = flattenObject(JSON.parse(fs.readFileSync(enPath, "utf8")));

    for (const lang of languages) {
      if (lang === "en") continue;

      const langPath = path.join("src", "locales", lang, `${ns}.json`);
      const langFlat = flattenObject(JSON.parse(fs.readFileSync(langPath, "utf8")));

      const missingKeys = [];
      for (const [key, enValue] of Object.entries(enFlat)) {
        if (!(key in langFlat)) {
          missingKeys.push({ key, enValue });
        }
      }

      // If there are missing keys or it is common namespace, queue a single atomic file translation/save task
      if (missingKeys.length > 0 || ns === "common") {
        fileTasks.push(async () => {
          let updated = false;

          if (missingKeys.length > 0) {
            console.log(`Processing ${missingKeys.length} missing keys for [${lang}] [${ns}]...`);
            // Translate all missing keys for this file in parallel
            await Promise.all(missingKeys.map(async ({ key, enValue }) => {
              console.log(`Translating [${ns}] "${key}" to [${lang}]...`);
              const trans = await translateText(enValue, lang);
              langFlat[key] = trans;
            }));
            updated = true;
          }

          if (ns === "common") {
            langFlat["syllabusLinkPlaceholder"] = "https://your-syllabus-link.com";
            langFlat["emailPlaceholder"] = "you@example.com";
            updated = true;
          }

          if (updated) {
            const nested = unflattenObject(langFlat);
            fs.writeFileSync(langPath, JSON.stringify(nested, null, 2), "utf8");
            console.log(`Saved updated atomic file: ${langPath}`);
          }
        });
      }
    }
  }

  console.log(`Executing ${fileTasks.length} language file synchronization tasks...`);
  await runWithConcurrencyLimit(fileTasks, 3); // 3 files in parallel to prevent rate limiting while running efficiently

  console.log("\n=================== i18n Synchronization Summary ===================");
  console.log("| Namespace           | Total Keys | Added (New) | Orphaned (Possible) |");
  console.log("|---------------------|------------|-------------|---------------------|");
  Object.entries(summary).forEach(([ns, data]) => {
    const nsCol = ns.padEnd(19);
    const totalCol = String(data.totalKeys).padEnd(10);
    const addedCol = String(data.addedKeys).padEnd(11);
    const orphanedCol = String(data.orphanedKeys).padEnd(19);
    console.log(`| ${nsCol} | ${totalCol} | ${addedCol} | ${orphanedCol} |`);
  });
  console.log("====================================================================");
  console.log("Synchronization complete! 0 missing keys across all 15 namespaces x 7 languages ✅");
}

main().catch(console.error);
