import React, { createContext, useContext, useEffect } from "react";
import { useSession } from "../lib/auth-client";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  session: any;
  isPending: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: sessionData, isPending, refetch } = useSession();

  useEffect(() => {
    // Dynamic tracking of dark theme body style inside Vite client
    if (typeof document !== "undefined") {
      document.body.style.backgroundColor = "#0A0A0F";
      document.body.classList.add("dark");
    }
  }, []);

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center text-[#F8FAFC] p-6 text-center select-none relative overflow-hidden font-sans">
        {/* Subtle blur background effects */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-gradient-to-tr from-[#6366F1]/10 to-[#8B5CF6]/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-gradient-to-bl from-[#8B5CF6]/10 to-[#6366F1]/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

        <div className="flex flex-col items-center gap-4 relative z-10">
          <span className="text-5xl animate-bounce mb-2 select-none">✨📚</span>
          <h1 className="text-3xl font-black text-[#F8FAFC] tracking-tight bg-gradient-to-r from-white to-[#CECADF] bg-clip-text text-transparent">
            ZachCourse
          </h1>
          <div className="flex items-center gap-2 mt-4 text-sm font-bold text-[#6366F1] bg-[#6366F1]/10 border border-[#6366F1]/20 px-4 py-2 rounded-2xl">
            <Loader2 className="w-4 h-4 animate-spin text-[#6366F1]" />
            <span>Syncing with companion core...</span>
          </div>
          <p className="text-xs text-[#94A3B8] font-semibold mt-2 max-w-xs leading-relaxed">
            Please wait while we establish your secure study connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session: sessionData, isPending, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
