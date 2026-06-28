/// <reference path="../types/next.d.ts" />
import React from "react";
import { Inter } from "next/font/google";
import { AuthProvider } from "../components/AuthProvider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ZachCourse — Your AI Learning Companion",
  description: "Your personalized, AI-powered learning companion that turns any course or topic into a structured, week-by-week roadmap with adaptive quizzes and mentoring.",
  openGraph: {
    title: "ZachCourse — Your AI Learning Companion",
    description: "Your personalized, AI-powered learning companion that turns any course or topic into a structured, week-by-week roadmap.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ZachCourse Learning Companion",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} bg-[#0A0A0F] text-[#F8FAFC] antialiased min-h-screen flex flex-col`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster 
          theme="dark" 
          position="top-right"
          toastOptions={{
            style: {
              background: "#111118",
              border: "1px solid #1E1E2E",
              color: "#F8FAFC",
            },
          }}
        />
      </body>
    </html>
  );
}
