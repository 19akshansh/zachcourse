import React, { useState, useRef, useEffect } from "react";
import { signOut, useSession } from "../lib/auth-client";
import { navigate } from "../lib/router";
import { LogOut, User, Settings, ChevronDown, GraduationCap, Loader2 } from "lucide-react";
import { trpc } from "../lib/trpc-client";
import { toast } from "sonner";

export default function UserMenu() {
  const { data: sessionData } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!sessionData?.user) return null;

  const { user } = sessionData;
  const currentRole = (user as any).role || "student";

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    navigate("/");
  };

  const handleToggleRole = async () => {
    const nextRole = currentRole === "teacher" ? "student" : "teacher";
    setIsUpdating(true);
    try {
      await trpc.setUserRole.mutate({ role: nextRole });
      toast.success(`Role switched to ${nextRole}! Refreshing...`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative font-sans" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#1E1E2E]/60 transition cursor-pointer border border-transparent hover:border-[#1E1E2E]"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || "User Avatar"}
            className="w-8 h-8 rounded-full object-cover border border-[#4F46E5]/30"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#8B5CF6] flex items-center justify-center text-xs text-white font-extrabold shadow-md">
            {initials}
          </div>
        )}
        <div className="hidden sm:block text-left max-w-[120px]">
          <p className="text-xs font-bold text-[#F8FAFC] truncate">{user.name}</p>
          <p className="text-[10px] text-[#94A3B8] truncate">{user.email}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-[#111118] border border-[#1E1E2E] rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2.5 border-b border-[#1E1E2E] mb-1.5">
            <p className="text-xs font-bold text-[#F8FAFC] truncate">{user.name}</p>
            <p className="text-[10px] text-[#94A3B8] truncate">{user.email}</p>
          </div>

          <button
            onClick={() => { setIsOpen(false); navigate("/dashboard?tab=progress"); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E1E2E]/50 rounded-xl transition cursor-pointer text-left"
          >
            <User className="w-4 h-4 text-[#4F46E5]" />
            <span>My Profile</span>
          </button>

          <button
            onClick={() => { setIsOpen(false); navigate("/dashboard?tab=progress"); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E1E2E]/50 rounded-xl transition cursor-pointer text-left"
          >
            <Settings className="w-4 h-4 text-[#8B5CF6]" />
            <span>Settings</span>
          </button>

          <button
            onClick={handleToggleRole}
            disabled={isUpdating}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E1E2E]/50 rounded-xl transition cursor-pointer text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-4 h-4 text-amber-500" />
              <span>Role: <span className="capitalize text-amber-400 font-bold">{currentRole}</span></span>
            </div>
            {isUpdating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#94A3B8]" />
            ) : (
              <span className="text-[10px] text-amber-500/80 underline font-normal hover:text-amber-400">Switch</span>
            )}
          </button>

          <div className="h-px bg-[#1E1E2E] my-1.5" />

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition cursor-pointer text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
