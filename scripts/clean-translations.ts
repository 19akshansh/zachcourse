import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NON_LATIN_LANGUAGES = [
  "hi", "ar", "zh", "ja", "ko", "ru", "he", "el", "th", "fa", 
  "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or", "as"
];

function isBadLatinTranslation(text: string, lang: string): boolean {
  if (!text) return false;
  if (!NON_LATIN_LANGUAGES.includes(lang)) return false;

  // Count Latin/English alphabetic characters
  const latinMatch = text.match(/[a-zA-Z]/g);
  const latinCount = latinMatch ? latinMatch.length : 0;

  // Keep only alphabetic characters from Latin and main non-Latin scripts
  // \u0900-\u097F is Devanagari (Hindi)
  // \u0600-\u06FF is Arabic
  // \u4e00-\u9fff is Chinese
  // \u3040-\u30ff is Japanese Hiragana/Katakana
  // \u3130-\u318f is Korean Hangul
  // \u0400-\u04FF is Cyrillic (Russian)
  const alphabeticOnly = text.replace(/[^a-zA-Z\u0900-\u097F\u0600-\u06FF\u4e00-\u9fff\u3040-\u30ff\u3130-\u318f\u0400-\u04FF]/g, "");

  if (alphabeticOnly.length > 5) {
    const latinPct = (latinCount / alphabeticOnly.length) * 100;
    // If over 70% of the alphabetic text is English/Latin script but we expect a non-Latin script,
    // it's highly likely that the model failed to translate and left it in English.
    if (latinPct > 70) {
      return true;
    }
  }
  return false;
}

async function main() {
  console.log("=== SCANNING COURSE TRANSLATIONS FOR INCOMPLETENESS AND CORRUPTION ===");
  const translations = await prisma.courseTranslation.findMany({
    include: {
      course: true,
    }
  });

  console.log(`Found ${translations.length} translations to check.`);

  let purgedCount = 0;

  for (const trans of translations) {
    let shouldPurge = false;
    let reason = "";

    const courseRoadmap = trans.course.roadmapData as any;
    const transModules = trans.modules as any;

    if (!courseRoadmap || !courseRoadmap.modules) {
      shouldPurge = true;
      reason = "Original course roadmap is missing or invalid";
    } else if (!transModules || !Array.isArray(transModules)) {
      shouldPurge = true;
      reason = "Translated modules data is missing or not an array";
    } else {
      const origModules = courseRoadmap.modules;
      
      // 1. Module count check
      if (origModules.length !== transModules.length) {
        shouldPurge = true;
        reason = `Module count mismatch. Original: ${origModules.length}, Translated: ${transModules.length}`;
      } else {
        // 2. Lesson count & ID sequence check
        const originalLessonIds: string[] = [];
        const transLessonIds: string[] = [];

        origModules.forEach((m: any) => {
          if (m.lessons) {
            m.lessons.forEach((l: any) => originalLessonIds.push(l.id));
          }
        });

        transModules.forEach((m: any) => {
          if (m.lessons) {
            m.lessons.forEach((l: any) => transLessonIds.push(l.id));
          }
        });

        if (originalLessonIds.length !== transLessonIds.length) {
          shouldPurge = true;
          reason = `Lesson count mismatch. Original: ${originalLessonIds.length}, Translated: ${transLessonIds.length}`;
        } else {
          for (let i = 0; i < originalLessonIds.length; i++) {
            if (originalLessonIds[i] !== transLessonIds[i]) {
              shouldPurge = true;
              reason = `Lesson ID mismatch at index ${i}. Original: "${originalLessonIds[i]}", Translated: "${transLessonIds[i]}"`;
              break;
            }
          }
        }
      }
    }

    // 3. Script validation (detection of English/Latin slop in non-Latin translations)
    if (!shouldPurge) {
      // Check course translation title & description
      if (isBadLatinTranslation(trans.title, trans.language)) {
        shouldPurge = true;
        reason = `Course title "${trans.title}" failed Latin script check for target language "${trans.language}"`;
      } else if (isBadLatinTranslation(trans.description, trans.language)) {
        shouldPurge = true;
        reason = `Course description "${trans.description}" failed Latin script check for target language "${trans.language}"`;
      } else {
        // Check modules and lessons
        for (const m of transModules) {
          if (isBadLatinTranslation(m.title, trans.language) || isBadLatinTranslation(m.description, trans.language)) {
            shouldPurge = true;
            reason = `Module "${m.title}" failed Latin script check for target language "${trans.language}"`;
            break;
          }
          if (m.lessons) {
            for (const l of m.lessons) {
              if (isBadLatinTranslation(l.title, trans.language) || isBadLatinTranslation(l.description, trans.language)) {
                shouldPurge = true;
                reason = `Lesson "${l.title}" failed Latin script check for target language "${trans.language}"`;
                break;
              }
            }
          }
          if (shouldPurge) break;
        }
      }
    }

    if (shouldPurge) {
      console.log(`[PURGING] Course "${trans.course.title}" (${trans.language}): ${reason}`);
      await prisma.courseTranslation.delete({
        where: { id: trans.id }
      });
      purgedCount++;
    } else {
      console.log(`[OK] Course "${trans.course.title}" (${trans.language}) passed all verification checks.`);
    }
  }

  console.log(`\n=== SCAN COMPLETED. Purged ${purgedCount} invalid/incomplete translations. ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
