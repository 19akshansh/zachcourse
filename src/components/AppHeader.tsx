import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, LogOut, LogIn, HelpCircle, GraduationCap, Loader2, User, ShieldCheck, Github, Save, Trash2 } from "lucide-react";
import { DiscordIcon } from "./DiscordIcon";
import KeyStatusBadge from "./KeyStatusBadge";
import { trpc } from "../lib/trpc-client";
import { toast } from "sonner";
import { authClient } from "../lib/auth-client";
import { TourLauncher } from "./tour/TourLauncher";
import { tourEventEmitter } from "./tour/TourController";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslation } from "react-i18next";

interface AppHeaderProps {
  onMenuClick: () => void;
  isCollapsed: boolean;
  isOpen: boolean;
  session: any;
  onSignOut: () => void;
  mode?: "trial";
  onUpgradeClick?: () => void;
}

export default function AppHeader({ onMenuClick, isCollapsed, isOpen, session, onSignOut, mode, onUpgradeClick }: AppHeaderProps) {
  const { t } = useTranslation(["header", "common"]);
  const isTrialMode = mode === "trial";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleTourStep = (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: string }>;
      const stepId = customEvent.detail?.stepId;
      if (stepId === "header-profile-item" || stepId === "header-avatar-menu") {
        setDropdownOpen(true);
      } else if (stepId) {
        setDropdownOpen(false);
      }
    };

    tourEventEmitter.addEventListener("tour-step", handleTourStep);
    return () => {
      tourEventEmitter.removeEventListener("tour-step", handleTourStep);
    };
  }, []);

  const fetchMyProfile = async () => {
    if (isTrialMode) return;
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
    if (profileOpen && !isTrialMode) {
      fetchMyProfile();
    }
  }, [profileOpen, isTrialMode]);

  const handleSaveBio = async () => {
    if (isTrialMode) return;
    setIsSavingBio(true);
    try {
      await trpc.updateMyBio.mutate({ bio });
      toast.success(t("bioUpdatedSuccess", { defaultValue: "Bio updated successfully! ✓" }));
    } catch (err: any) {
      toast.error(err.message || t("bioUpdateFailed", { defaultValue: "Failed to update bio" }));
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleDisconnect = async (provider: "github" | "discord") => {
    if (isTrialMode) return;
    const providerName = provider === "github" ? "GitHub" : "Discord";
    if (!confirm(t("disconnectConfirm", { defaultValue: `Are you sure you want to disconnect your ${providerName} account?`, provider: providerName }))) {
      return;
    }
    setIsUnlinking(prev => ({ ...prev, [provider]: true }));
    try {
      await trpc.unlinkSocialProvider.mutate({ provider });
      toast.success(t("disconnectSuccess", { defaultValue: `Successfully disconnected your ${providerName} account.`, provider: providerName }));
      const data = await trpc.getMySocialLinks.query();
      setBio(data.bio || "");
      setSocialLinks(data.socialLinks || []);
    } catch (err: any) {
      toast.error(err.message || t("disconnectFailed", { defaultValue: `Failed to disconnect ${providerName}`, provider: providerName }));
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

  const user = isTrialMode ? { name: "Trial Account", email: "Temporary Trial" } : session?.user;
  const [isUpdating, setIsUpdating] = useState(false);
  const currentRole = (user as any)?.role || "student";

  const handleToggleRole = async () => {
    if (isTrialMode) {
      if (onUpgradeClick) {
        onUpgradeClick();
      } else {
        toast.error(t("signUpSaveProgress", { defaultValue: "Create a free account to switch roles and access the teacher dashboard!" }));
      }
      return;
    }
    const nextRole = currentRole === "teacher" ? "student" : "teacher";
    setIsUpdating(true);
    try {
      await trpc.setUserRole.mutate({ role: nextRole });
      toast.success(t("roleSwitched", { defaultValue: `Role switched to ${nextRole}! Refreshing...`, role: nextRole }));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || t("roleUpdateFailed", { defaultValue: "Failed to update role" }));
    } finally {
      setIsUpdating(false);
    }
  };

  const displayName = isTrialMode ? "Trial Account" : (user?.name || "Guest Account");
  const displayEmail = isTrialMode ? "Temporary Trial" : (user?.email || "Temporary Trial");
  const initials = isTrialMode ? "TA" : (user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "G");

  return (
    <>
      <header className="h-14 sticky top-0 z-30 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-[#1E1E2E] flex items-center justify-between px-4">
      {/* LEFT SIDE */}
      <div className="flex items-center gap-2">
        <button
          data-tour="sidebar-collapse"
          onClick={onMenuClick}
          className="p-1.5 rounded-lg hover:bg-white/5 border border-[#1E1E2E] text-[#8E88AB] hover:text-[#FAF9FD] transition cursor-pointer"
          aria-label={t("toggleMenu", { defaultValue: "Toggle Navigation Menu" })}
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
        {isTrialMode && (
          <button
            onClick={onUpgradeClick}
            className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] font-bold text-indigo-200 bg-indigo-950/40 border border-indigo-500/30 rounded-full hover:bg-indigo-900/40 hover:text-indigo-100 transition animate-pulse cursor-pointer shrink-0"
          >
            <span>Trial Mode</span>
            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 py-0.1 rounded-full uppercase tracking-wider hidden sm:inline">Upgrade</span>
          </button>
        )}
        <LanguageSwitcher />
        <TourLauncher />
        <div data-tour="header-key-badge">
          <KeyStatusBadge />
        </div>

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            data-tour="header-avatar-menu"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition cursor-pointer"
            aria-label={t("userMenu", { defaultValue: "User Account Menu" })}
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
                data-tour="header-profile-item"
                onClick={() => {
                  setDropdownOpen(false);
                  if (isTrialMode) {
                    if (onUpgradeClick) onUpgradeClick();
                  } else {
                    setProfileOpen(true);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#8E88AB] hover:text-[#FAF9FD] hover:bg-[#1E1E2E]/50 rounded-lg transition cursor-pointer text-left mb-1.5"
              >
                <User className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="flex items-center gap-1.5 justify-between w-full">
                  <span>{t("myProfile")}</span>
                  {isTrialMode && <span className="text-[10px] text-slate-400">🔒</span>}
                </span>
              </button>

              <button
                onClick={handleToggleRole}
                disabled={isUpdating}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#8E88AB] hover:text-[#FAF9FD] hover:bg-[#1E1E2E]/50 rounded-lg transition cursor-pointer text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{t("switchRole", { role: t(`common:${currentRole}`, { defaultValue: currentRole }) })}</span>
                </div>
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8E88AB] shrink-0" />
                ) : (
                  <span className="text-[10px] text-amber-500/80 underline font-normal hover:text-amber-400">{t("switch")}</span>
                )}
              </button>

              <div className="h-px bg-[#1E1E2E] my-1.5" />

              {mode === "trial" ? (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    window.location.href = "/sign-up?from=trial";
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#8E88AB] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer text-left"
                >
                  <LogIn className="w-4 h-4 text-indigo-400" />
                  <span>{t("common:login", { defaultValue: "Login" })}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    localStorage.removeItem("session_token");
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#8E88AB] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t("signOut")}</span>
                </button>
              )}
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
              aria-label={t("closeProfileModal", { defaultValue: "Close Profile Modal" })}
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-[#2A2443] pb-4">
              <div className="w-10 h-10 rounded-xl bg-[#4F46E5]/10 flex items-center justify-center text-indigo-400">
                <User className="w-5.5 h-5.5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">{t("myProfile")}</h3>
                <p className="text-xs text-[#8E88AB] mt-0.5 font-medium">{t("profileSubtitle", { defaultValue: "Verify your developer presence and customize your learning identity." })}</p>
              </div>
            </div>

            {isProfileLoading ? (
              <div className="py-12 flex flex-col justify-center items-center gap-2 text-sm text-[#8E88AB]">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span>{t("loadingSettings", { defaultValue: "Loading settings..." })}</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Bio section */}
                {isTrialMode ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#CECADF]">
                      {t("bioLabel", { defaultValue: "My Bio (Optional)" })}
                    </label>
                    <div className="w-full bg-[#1A172E]/60 border border-[#2A2443] rounded-2xl p-4 text-sm text-[#8E88AB] italic">
                      {t("bioLockedTrial", { defaultValue: "Create a free account to add and save a personal bio." })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="modal-bio" className="block text-sm font-bold text-[#CECADF]">
                      {t("bioLabel", { defaultValue: "My Bio (Optional)" })}
                    </label>
                    <textarea
                      id="modal-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, 160))}
                      placeholder={t("bioPlaceholder", { defaultValue: "Share a bit about your engineering interests, goals, or coding experience..." })}
                      className="w-full bg-[#1A172E] border border-[#2A2443] hover:border-[#4F46E5]/50 focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] rounded-2xl p-4 text-sm text-[#FAF9FD] placeholder-[#5C5578] outline-none min-h-[100px] resize-none transition"
                    />
                    <div className="flex justify-between items-center text-xs">
                      <span className={bio.length >= 160 ? "text-amber-500 font-bold" : "text-[#8E88AB] font-medium"}>
                        {t("bioCount", { defaultValue: "{{length}}/160 characters", length: bio.length })}
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
                            {t("saving", { defaultValue: "Saving..." })}
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            {t("saveBio", { defaultValue: "Save Bio" })}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Socials connections */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-[#CECADF]">{t("verifiedBadges", { defaultValue: "Verified Social Badges" })}</h4>
                    <p className="text-[11px] text-[#8E88AB] leading-relaxed mt-0.5">
                      {t("badgesNote", { defaultValue: "Authentication is completed securely via official providers. No manual URL input is supported." })}
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
                                <span className="text-[10px] font-semibold text-[#8E88AB] block uppercase tracking-wider">{t("githubBadge", { defaultValue: "GITHUB" })}</span>
                                <span className="text-sm font-bold text-[#FAF9FD]">
                                  {t("connectedAs", { defaultValue: "Connected as {{username}}", username: link.externalUsername ? `@${link.externalUsername}` : "Verified User" })}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDisconnect("github")}
                              disabled={unlinking || isTrialMode}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition cursor-pointer border border-rose-500/20 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                              title={t("disconnectGitHub", { defaultValue: "Disconnect GitHub" })}
                            >
                              {unlinking ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  {t("disconnecting", { defaultValue: "Disconnecting..." })}
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {t("disconnect", { defaultValue: "Disconnect" })}
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
                            <span className="text-sm font-medium text-[#8E88AB]">{t("githubAccount", { defaultValue: "GitHub Account" })}</span>
                          </div>
                          <button
                            type="button"
                            disabled={isTrialMode}
                            onClick={async () => {
                              try {
                                toast.info(t("redirectingGithub", { defaultValue: "Redirecting to GitHub auth..." }));
                                const { error } = await authClient.linkSocial({
                                  provider: "github",
                                  callbackURL: window.location.href,
                                });
                                if (error) {
                                  toast.error(error.message || t("linkGithubFailed", { defaultValue: "Failed to link GitHub — check provider configuration" }));
                                  return;
                                }
                              } catch (err: any) {
                                toast.error(err.message || t("linkGithubError", { defaultValue: "Failed to link GitHub" }));
                              }
                            }}
                            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 border border-neutral-700 text-neutral-100 text-xs font-bold transition rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t("connect", { defaultValue: "Connect" })}
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
                                <span className="text-[10px] font-semibold text-[#8E88AB] block uppercase tracking-wider">{t("discordBadge", { defaultValue: "DISCORD" })}</span>
                                <span className="text-sm font-bold text-[#FAF9FD]">
                                  {t("connectedAs", { defaultValue: "Connected as {{username}}", username: link.externalUsername ? `@${link.externalUsername}` : "Verified User" })}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDisconnect("discord")}
                              disabled={unlinking || isTrialMode}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition cursor-pointer border border-rose-500/20 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                              title={t("disconnectDiscord", { defaultValue: "Disconnect Discord" })}
                            >
                              {unlinking ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  {t("disconnecting", { defaultValue: "Disconnecting..." })}
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {t("disconnect", { defaultValue: "Disconnect" })}
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
                            <span className="text-sm font-medium text-[#8E88AB]">{t("discordAccount", { defaultValue: "Discord Account" })}</span>
                          </div>
                          <button
                            type="button"
                            disabled={isTrialMode}
                            onClick={async () => {
                              try {
                                toast.info(t("redirectingDiscord", { defaultValue: "Redirecting to Discord auth..." }));
                                const { error } = await authClient.linkSocial({
                                  provider: "discord",
                                  callbackURL: window.location.href,
                                });
                                if (error) {
                                  toast.error(error.message || t("linkDiscordFailed", { defaultValue: "Failed to link Discord — check provider configuration" }));
                                  return;
                                }
                              } catch (err: any) {
                                toast.error(err.message || t("linkDiscordError", { defaultValue: "Failed to link Discord" }));
                              }
                            }}
                            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 border border-neutral-700 text-neutral-100 text-xs font-bold transition rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t("connect", { defaultValue: "Connect" })}
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
                    {t("common:close", { defaultValue: "Close" })}
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
