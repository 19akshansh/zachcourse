import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";
import { sendEmail } from "./mail";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET || "default-secret-development-key-123",
  baseURL: (() => {
    if (process.env.BETTER_AUTH_URL) {
      return process.env.BETTER_AUTH_URL;
    }
    const appUrl = process.env.APP_URL;
    if (appUrl && (appUrl.includes("ais-dev") || appUrl.includes("ais-pre") || appUrl.includes("asia-east1.run.app") || appUrl.includes("asia-southeast1.run.app") || appUrl.includes("run.app"))) {
      return appUrl;
    }
    return appUrl || "http://localhost:3000";
  })(),
  trustedOrigins: [
    "null",
    "https://*.run.app",
    "https://*.asia-east1.run.app",
    "https://*.asia-east2.run.app",
    "https://*.asia-northeast1.run.app",
    "https://*.asia-northeast2.run.app",
    "https://*.asia-northeast3.run.app",
    "https://*.asia-south1.run.app",
    "https://*.asia-south2.run.app",
    "https://*.asia-southeast1.run.app",
    "https://*.asia-southeast2.run.app",
    "https://*.australia-southeast1.run.app",
    "https://*.australia-southeast2.run.app",
    "https://*.europe-central2.run.app",
    "https://*.europe-north1.run.app",
    "https://*.europe-southwest1.run.app",
    "https://*.europe-west1.run.app",
    "https://*.europe-west2.run.app",
    "https://*.europe-west3.run.app",
    "https://*.europe-west4.run.app",
    "https://*.europe-west6.run.app",
    "https://*.europe-west8.run.app",
    "https://*.europe-west9.run.app",
    "https://*.me-central1.run.app",
    "https://*.me-central2.run.app",
    "https://*.me-west1.run.app",
    "https://*.northamerica-northeast1.run.app",
    "https://*.northamerica-northeast2.run.app",
    "https://*.southamerica-east1.run.app",
    "https://*.southamerica-west1.run.app",
    "https://*.us-central1.run.app",
    "https://*.us-east1.run.app",
    "https://*.us-east4.run.app",
    "https://*.us-east5.run.app",
    "https://*.us-south1.run.app",
    "https://*.us-west1.run.app",
    "https://*.us-west2.run.app",
    "https://*.us-west3.run.app",
    "https://*.us-west4.run.app",
    "https://*.usercontent.goog",
    "https://zachcourse-955328668699.asia-southeast1.run.app",
    "https://zachcourse.com",
    "http://localhost:3000",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.APP_URL ? [process.env.APP_URL] : []),
  ],
  advanced: {
    useSecureCookies: true,
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    }
  },
  
  account: { accountLinking: { enabled: true, trustedProviders: ['google', 'github', 'discord'], allowDifferentEmails: true } },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "student",
      }
    }
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    sendResetPassword: async ({ user, url, token }: any) => {
      try {
        const appUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
        const resetLink = `${appUrl}/reset-password/${token}`;

        await sendEmail({
          to: user.email,
          subject: "Reset your password - ZachCourse",
          html: `
            <div style="font-family: sans-serif; background: #0A0A0F; color: #F8FAFC; padding: 40px; border-radius: 12px; max-width: 480px; margin: auto">
              <h1 style="color: #4F46E5">🎓 ZachCourse</h1>
              <h2>Reset Your Password</h2>
              <p>Hello ${user.name || "Student"}, click the button below to reset your password:</p>
              <a href="${resetLink}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0">Reset Password</a>
              <p style="color: #94A3B8; font-size: 14px">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          `,
        });
        console.log(`Reset password email sent successfully to ${user.email} with link: ${resetLink}`);
      } catch (err) {
        console.error("Failed to send reset password email:", err);
      }
    }
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your ZachCourse email",
        html: `
          <div style="font-family:Inter,sans-serif;background:#0A0A0F;color:#F8FAFC;padding:40px;border-radius:12px;max-width:480px;margin:auto">
            <h1 style="color:#4F46E5">🎓 ZachCourse</h1>
            <h2>Verify your email</h2>
            <p>Click the button below to verify your email and start learning.</p>
            <a href="${url}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Verify Email →</a>
            <p style="color:#94A3B8;font-size:14px">If you didn't create a ZachCourse account, ignore this email.</p>
          </div>
        `
      })
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      scope: ["read:user", "user:email"],
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      scope: ["identify", "email"],
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.email) {
            return { data: user };
          }
          const normalizedEmail = user.email.toLowerCase().trim();
          
          // Only perform duplicate check if emailVerified is false (credentials signup)
          if (user.emailVerified === false) {
            const existing = await prisma.user.findUnique({
              where: { email: normalizedEmail }
            });
            if (existing) {
              throw new Error("USER_ALREADY_EXISTS: An account with this email already exists.");
            }
          }
          
          user.email = normalizedEmail;
          return { data: user };
        },
        after: async (user) => {
          try {
            await prisma.userProgress.create({
              data: {
                userId: user.id,
                currentCourse: "Mastering Python & Smart Software Creation",
                currentWeek: 1,
                streakDays: 1,
                totalHoursLogged: 0.1,
                quizScores: {},
              },
            });
            console.log(`Created default user progress for user ${user.id}`);
          } catch (err) {
            console.error("Error creating UserProgress in signup hook:", err);
          }
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          try {
            const provider = account.providerId; // 'github' or 'discord'
            if (provider !== 'github' && provider !== 'discord') {
              return;
            }

            let externalUsername: string | null = null;
            let profileUrl: string | null = null;

            if (provider === 'github' && account.accessToken) {
              const res = await fetch("https://api.github.com/user", {
                headers: {
                  Authorization: `Bearer ${account.accessToken}`,
                  "User-Agent": "ZachCourse-Auth",
                },
              });
              if (res.ok) {
                const data = await res.json() as any;
                externalUsername = data.login || null;
                profileUrl = data.html_url || null;
              } else {
                console.error("Failed to fetch GitHub profile in auth hook:", await res.text());
              }
            } else if (provider === 'discord' && account.accessToken) {
              const res = await fetch("https://discord.com/api/users/@me", {
                headers: {
                  Authorization: `Bearer ${account.accessToken}`,
                },
              });
              if (res.ok) {
                const data = await res.json() as any;
                externalUsername = data.username || null;
                profileUrl = data.id ? `https://discord.com/users/${data.id}` : null;
              } else {
                console.error("Failed to fetch Discord profile in auth hook:", await res.text());
              }
            }

            if (externalUsername || profileUrl) {
              await prisma.socialLink.upsert({
                where: {
                  userId_provider: {
                    userId: account.userId,
                    provider,
                  },
                },
                update: {
                  externalUsername,
                  profileUrl,
                  linkedAt: new Date(),
                },
                create: {
                  userId: account.userId,
                  provider,
                  externalUsername,
                  profileUrl,
                },
              });
              console.log(`Upserted SocialLink for user ${account.userId}, provider ${provider}`);
            }
          } catch (err) {
            console.error("Error in account.create.after hook:", err);
          }
        }
      }
    }
  },
});
