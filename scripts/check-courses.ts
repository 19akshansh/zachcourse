import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking courses in DB...");
  const courses = await prisma.course.findMany({
    include: {
      courseTranslations: true
    }
  });
  console.log(`Found ${courses.length} courses:`);
  for (const c of courses) {
    console.log(`- Course: "${c.title}" (ID: ${c.id})`);
    console.log(`  Translations (${c.courseTranslations.length}):`);
    for (const t of c.courseTranslations) {
      console.log(`    * Lang: ${t.language}, Title: "${t.title}"`);
      console.log(`      Modules: ${JSON.stringify(t.modules, null, 2)}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
