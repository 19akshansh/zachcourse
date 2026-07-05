const fs = require('fs');
let code = fs.readFileSync('src/server/trpc.ts', 'utf8');

const oldReturn = `      return {
        name: targetUser.name,
        bio: targetUser.bio || "",
        socialLinks: targetUser.socialLinks
      };`;
const newReturn = `      const cohort = await ctx.prisma.cohort.findUnique({
        where: { id: input.cohortId }
      });
      let role = "Member";
      if (cohort) {
        if (cohort.ownerId === input.userId) {
          role = cohort.isClassroom ? "Teacher" : "Owner";
        } else {
          role = cohort.isClassroom ? "Student" : "Member";
        }
      }

      return {
        name: targetUser.name,
        bio: targetUser.bio || "",
        socialLinks: targetUser.socialLinks,
        role: role
      };`;

code = code.replace(oldReturn, newReturn);
fs.writeFileSync('src/server/trpc.ts', code);
