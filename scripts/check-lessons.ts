import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking lesson contents in DB...");
  const lessons = await prisma.lessonContent.findMany({
    where: {
      language: { not: "en" }
    }
  });
  console.log(`Found ${lessons.length} non-English lesson contents in DB:`);
  for (const l of lessons) {
    console.log(`- Course ID: ${l.courseId}, Lesson ID: ${l.lessonId}, Lang: ${l.language}`);
    console.log(`  Content snippet: "${l.content.slice(0, 100)}..."`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
