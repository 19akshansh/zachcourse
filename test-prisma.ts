import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  try {
    await prisma.course.delete({
      where: { id: "non-existent", userId: "something" }
    });
  } catch(e) {
    console.log(e);
  }
}
run();
