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
  baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL || "http://localhost:3000",
  trustedOrigins: [
    "null",
    "https://ais-dev-fg6nnldzwvuyvu3rsspevg-53963441605.asia-east1.run.app",
    "https://ais-pre-fg6nnldzwvuyvu3rsspevg-53963441605.asia-east1.run.app",
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
  
  account: { accountLinking: { enabled: true, trustedProviders: ['google', 'github'] } },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your password - ZachCourse",
          html: `
            <div style="font-family: sans-serif; background: #0A0A0F; color: #F8FAFC; padding: 40px; border-radius: 12px; max-width: 480px; margin: auto">
              <h1 style="color: #6366F1">🎓 ZachCourse</h1>
              <h2>Reset Your Password</h2>
              <p>Hello ${user.name || "Student"}, click the button below to reset your password:</p>
              <a href="${url}" style="display: inline-block; background: #6366F1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0">Reset Password</a>
              <p style="color: #94A3B8; font-size: 14px">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          `,
        });
        console.log(`Reset password email sent successfully to ${user.email}`);
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
            <h1 style="color:#6366F1">🎓 ZachCourse</h1>
            <h2>Verify your email</h2>
            <p>Click the button below to verify your email and start learning.</p>
            <a href="${url}" style="display:inline-block;background:#6366F1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Verify Email →</a>
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
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Check if email already exists
          const existing = await prisma.user.findUnique({
            where: { email: user.email }
          });
          if (existing) {
            throw new Error("USER_ALREADY_EXISTS: An account with this email already exists.");
          }
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
  },
});
