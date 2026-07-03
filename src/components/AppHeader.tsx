import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, LogOut, HelpCircle, GraduationCap, Loader2 } from "lucide-react";
import KeyStatusBadge from "./KeyStatusBadge";
import { trpc } from "../lib/trpc-client";
import { toast } from "sonner";

interface AppHeaderProps {
  onMenuClick: () => void;
  isCollapsed: boolean;
  isOpen: boolean;
  session: any;
  onSignOut: () => void;
}

export default function AppHeader({ onMenuClick, isCollapsed, isOpen, session, onSignOut }: AppHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const user = session?.user;
  const [isUpdating, setIsUpdating] = useState(false);
  const currentRole = (user as any)?.role || "student";

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

  const displayName = user?.name || "Guest Account";
  const displayEmail = user?.email || "Temporary Trial";
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "G";

  return (
    <header className="h-14 sticky top-0 z-30 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-[#1E1E2E] flex items-center justify-between px-4">
      {/* LEFT SIDE */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg hover:bg-white/5 border border-[#1E1E2E] text-[#8E88AB] hover:text-[#FAF9FD] transition cursor-pointer"
          aria-label="Toggle Navigation Menu"
        >
          {/* Mobile Icon */}
          <span className="md:hidden">
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </span>
          {/* Desktop Icon */}
          <span className="hidden md:inline">
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </span>
        </button>

        {/* Logo centered on mobile / only visible on mobile screen sizes */}
        <div className="md:hidden flex items-center gap-1.5 ml-1 select-none">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-white text-base hidden sm:inline">ZachCourse</span>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <KeyStatusBadge />

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition cursor-pointer"
            aria-label="User Account Menu"
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-xs text-white font-extrabold shadow-md">
                {initials}
              </div>
            )}
          </button>

          {/* DROPDOWN MENU */}
          {dropdownOpen && (
            <div className="absolute right-0 top-11 bg-[#111118] border border-[#1E1E2E] rounded-xl p-2 shadow-2xl min-w-[220px] z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 border-b border-[#1E1E2E] mb-1.5">
                <p className="text-xs font-bold text-[#FAF9FD] truncate leading-tight">{displayName}</p>
                <p className="text-[10px] text-[#8E88AB] truncate leading-none mt-1">{displayEmail}</p>
              </div>

              <button
                onClick={handleToggleRole}
                disabled={isUpdating}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#8E88AB] hover:text-[#FAF9FD] hover:bg-[#1E1E2E]/50 rounded-lg transition cursor-pointer text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Role: <span className="capitalize text-amber-400 font-bold">{currentRole}</span></span>
                </div>
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8E88AB] shrink-0" />
                ) : (
                  <span className="text-[10px] text-amber-500/80 underline font-normal hover:text-amber-400">Switch</span>
                )}
              </button>

              <div className="h-px bg-[#1E1E2E] my-1.5" />

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  localStorage.removeItem("session_token");
                  onSignOut();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#8E88AB] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
