import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, LogOut, HelpCircle, GraduationCap, Loader2, User, ShieldCheck, Github, Save, Trash2 } from "lucide-react";
import { DiscordIcon } from "./DiscordIcon";
import KeyStatusBadge from "./KeyStatusBadge";
import { trpc } from "../lib/trpc-client";
import { toast } from "sonner";
import { authClient } from "../lib/auth-client";

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

  const [profileOpen, setProfileOpen] = useState(false);
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<Record<string, boolean>>({});

  const fetchMyProfile = async () => {
    setIsProfileLoading(true);
    try {
      const data = await trpc.getMySocialLinks.query();
      setBio(data.bio || "");
      setSocialLinks(data.socialLinks || []);
    } catch (err) {
      console.error("Failed to fetch profile info:", err);
    } finally {
      setIsProfileLoading(false);
    }
  };

  useEffect(() => {
    if (profileOpen) {
      fetchMyProfile();
    }
  }, [profileOpen]);

  const handleSaveBio = async () => {
    setIsSavingBio(true);
    try {
      await trpc.updateMyBio.mutate({ bio });
      toast.success("Bio updated successfully! ✓");
    } catch (err: any) {
      toast.error(err.message || "Failed to update bio");
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleDisconnect = async (provider: "github" | "discord") => {
    if (!confirm(`Are you sure you want to disconnect your ${provider === "github" ? "GitHub" : "Discord"} account?`)) {
      return;
    }
    setIsUnlinking(prev => ({ ...prev, [provider]: true }));
    try {
      await trpc.unlinkSocialProvider.mutate({ provider });
      toast.success(`Successfully disconnected your ${provider === "github" ? "GitHub" : "Discord"} account.`);
      const data = await trpc.getMySocialLinks.query();
      setBio(data.bio || "");
      setSocialLinks(data.socialLinks || []);
    } catch (err: any) {
      toast.error(err.message || `Failed to disconnect ${provider}`);
    } finally {
      setIsUnlinking(prev => ({ ...prev, [provider]: false }));
    }
  };

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
    <>
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
              <div className="w-full h-full bg-gradient-to-br from-[#4F46E5] to-[#8B5CF6] flex items-center justify-center text-xs text-white font-extrabold shadow-md">
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
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  setProfileOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#8E88AB] hover:text-[#FAF9FD] hover:bg-[#1E1E2E]/50 rounded-lg transition cursor-pointer text-left mb-1.5"
              >
                <User className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>My Profile</span>
              </button>

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

    {/* MY PROFILE MODAL */}
      {profileOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121021] border border-[#2A2443] rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 text-left">
            <button
              onClick={() => setProfileOpen(false)}
              className="absolute top-4 right-4 text-[#8E88AB] hover:text-white transition cursor-pointer text-sm font-bold"
              aria-label="Close Profile Modal"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-[#2A2443] pb-4">
              <div className="w-10 h-10 rounded-xl bg-[#4F46E5]/10 flex items-center justify-center text-indigo-400">
                <User className="w-5.5 h-5.5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">My Profile</h3>
                <p className="text-xs text-[#8E88AB] mt-0.5 font-medium">Verify your developer presence and customize your learning identity.</p>
              </div>
            </div>

            {isProfileLoading ? (
              <div className="py-12 flex flex-col justify-center items-center gap-2 text-sm text-[#8E88AB]">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span>Loading settings...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Bio section */}
                <div className="space-y-2">
                  <label htmlFor="modal-bio" className="block text-sm font-bold text-[#CECADF]">
                    My Bio (Optional)
                  </label>
                  <textarea
                    id="modal-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 160))}
                    placeholder="Share a bit about your engineering interests, goals, or coding experience..."
                    className="w-full bg-[#1A172E] border border-[#2A2443] hover:border-[#4F46E5]/50 focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] rounded-2xl p-4 text-sm text-[#FAF9FD] placeholder-[#5C5578] outline-none min-h-[100px] resize-none transition"
                  />
                  <div className="flex justify-between items-center text-xs">
                    <span className={bio.length >= 160 ? "text-amber-500 font-bold" : "text-[#8E88AB] font-medium"}>
                      {bio.length}/160 characters
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveBio}
                      disabled={isSavingBio}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-[#4F46E5] hover:to-[#7C3AED] text-white rounded-xl transition font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingBio ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Save Bio
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Socials connections */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-[#CECADF]">Verified Social Badges</h4>
                    <p className="text-[11px] text-[#8E88AB] leading-relaxed mt-0.5">
                      Authentication is completed securely via official providers. No manual URL input is supported.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* GitHub connection */}
                    {(() => {
                      const link = socialLinks.find(l => l.provider === "github");
                      const unlinking = isUnlinking["github"] || false;
                      if (link) {
                        return (
                          <div className="flex items-center justify-between p-3 bg-[#1A172E] border border-[#2A2443] rounded-2xl">
                            <div className="flex items-center gap-3">
                              <Github className="w-5 h-5 text-neutral-100" />
                              <div className="text-left">
                                <span className="text-[10px] font-semibold text-[#8E88AB] block uppercase tracking-wider">GitHub</span>
                                <span className="text-sm font-bold text-[#FAF9FD]">
                                  Connected as {link.externalUsername ? `@${link.externalUsername}` : "Verified User"}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDisconnect("github")}
                              disabled={unlinking}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition cursor-pointer border border-rose-500/20 text-xs font-bold"
                              title="Disconnect GitHub"
                            >
                              {unlinking ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Disconnecting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Disconnect
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center justify-between p-3 bg-[#1A172E] border border-[#2A2443]/60 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <Github className="w-5 h-5 text-[#8E88AB]" />
                            <span className="text-sm font-medium text-[#8E88AB]">GitHub Account</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                toast.info("Redirecting to GitHub auth...");
                                const { error } = await authClient.linkSocial({
                                  provider: "github",
                                  callbackURL: window.location.href,
                                });
                                if (error) {
                                  toast.error(error.message || "Failed to link GitHub — check provider configuration");
                                  return;
                                }
                              } catch (err: any) {
                                toast.error(err.message || "Failed to link GitHub");
                              }
                            }}
                            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 border border-neutral-700 text-neutral-100 text-xs font-bold transition rounded-xl cursor-pointer"
                          >
                            Connect
                          </button>
                        </div>
                      );
                    })()}

                    {/* Discord connection */}
                    {(() => {
                      const link = socialLinks.find(l => l.provider === "discord");
                      const unlinking = isUnlinking["discord"] || false;
                      if (link) {
                        return (
                          <div className="flex items-center justify-between p-3 bg-[#1A172E] border border-[#2A2443] rounded-2xl">
                            <div className="flex items-center gap-3">
                              <DiscordIcon className="w-5 h-5 text-[#5865F2]" />
                              <div className="text-left">
                                <span className="text-[10px] font-semibold text-[#8E88AB] block uppercase tracking-wider">Discord</span>
                                <span className="text-sm font-bold text-[#FAF9FD]">
                                  Connected as {link.externalUsername ? `@${link.externalUsername}` : "Verified User"}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDisconnect("discord")}
                              disabled={unlinking}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition cursor-pointer border border-rose-500/20 text-xs font-bold"
                              title="Disconnect Discord"
                            >
                              {unlinking ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Disconnecting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Disconnect
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center justify-between p-3 bg-[#1A172E] border border-[#2A2443]/60 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <DiscordIcon className="w-5 h-5 text-[#8E88AB]" />
                            <span className="text-sm font-medium text-[#8E88AB]">Discord Account</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                toast.info("Redirecting to Discord auth...");
                                const { error } = await authClient.linkSocial({
                                  provider: "discord",
                                  callbackURL: window.location.href,
                                });
                                if (error) {
                                  toast.error(error.message || "Failed to link Discord — check provider configuration");
                                  return;
                                }
                              } catch (err: any) {
                                toast.error(err.message || "Failed to link Discord");
                              }
                            }}
                            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 border border-neutral-700 text-neutral-100 text-xs font-bold transition rounded-xl cursor-pointer"
                          >
                            Connect
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-[#2A2443]">
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="px-5 py-2.5 bg-[#1A172E] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs cursor-pointer w-full text-center"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
