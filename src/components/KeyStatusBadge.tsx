import React, { useState, useEffect, useRef } from "react";
import { Key, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function KeyStatusBadge() {
  const { t } = useTranslation("common");
  const [hasKey, setHasKey] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updateStatus = () => {
    if (typeof window === "undefined") return;
    const userKey = localStorage.getItem("zc_user_key");
    setHasKey(!!userKey && userKey !== "null" && userKey !== "undefined" && userKey.trim() !== "");
  };

  useEffect(() => {
    updateStatus();
    
    // Listen to key status change events
    window.addEventListener("zc-key-status-changed", updateStatus);
    
    // Handle click outside to close popover
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("zc-key-status-changed", updateStatus);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleRemoveKey = () => {
    localStorage.removeItem("zc_user_key");
    updateStatus();
    window.dispatchEvent(new CustomEvent("zc-key-status-changed"));
    setIsOpen(false);
  };

  if (!hasKey) {
    return null;
  }

  // Determine which state to show
  let badgeStyle = "text-[#8E88AB] bg-[#1A172E] border-[#2A2443]";
  let icon = <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#8E88AB]" />;
  let label = t("freeQueryRemaining", { defaultValue: "✨ 1 free query remaining" });
  let shortLabel = t("freeQueryRemainingShort", { defaultValue: "1 free" });

  if (hasKey) {
    badgeStyle = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    icon = <Key className="w-3.5 h-3.5 shrink-0" />;
    label = t("yourKeyActive", { defaultValue: "🔑 Your Key Active" });
    shortLabel = t("keyActiveShort", { defaultValue: "Active" });
  }

  return (
    <div className="relative font-sans shrink-0" ref={popoverRef}>
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-semibold cursor-pointer transition hover:brightness-110 active:scale-95 whitespace-nowrap ${badgeStyle}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <span className="inline sm:hidden">{shortLabel}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#111118] border border-[#2B2446]/60 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-[#2B2446]/60 pb-2.5 mb-2.5">
            <h4 className="text-xs font-bold text-[#FAF9FD] uppercase tracking-wider">
              {t("usageAndQuotas", { defaultValue: "Usage & Quotas" })}
            </h4>
            <button onClick={() => setIsOpen(false)} className="text-[#8E88AB] hover:text-[#FAF9FD]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3 text-xs">
            {hasKey && (
              <div>
                <p className="text-[#8E88AB] leading-relaxed">
                  {t("keyExplanation", { defaultValue: "You are currently using your own Gemini API key. You have unlimited access directly from your browser." })}
                </p>
                <button
                  onClick={handleRemoveKey}
                  className="mt-3 w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 font-bold py-2 rounded-xl transition cursor-pointer text-center"
                >
                  {t("removeCustomKey", { defaultValue: "Remove My Custom Key" })}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
