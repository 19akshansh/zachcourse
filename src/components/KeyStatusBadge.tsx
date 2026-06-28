import React, { useState, useEffect, useRef } from "react";
import { getStarBonusRemaining } from "../lib/usage";
import { Key, Star, Sparkles, X } from "lucide-react";

export default function KeyStatusBadge() {
  const [hasKey, setHasKey] = useState(false);
  const [starBonus, setStarBonus] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updateStatus = () => {
    const userKey = typeof window !== "undefined" ? localStorage.getItem("zc_user_key") : null;
    setHasKey(!!userKey);
    setStarBonus(getStarBonusRemaining());
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

  const handleTriggerUnlock = () => {
    window.dispatchEvent(new CustomEvent("zc-quota-exceeded"));
    setIsOpen(false);
  };

  if (!hasKey && starBonus <= 0) {
    return null;
  }

  // Determine which state to show
  let badgeStyle = "text-[#8E88AB] bg-[#1A172E] border-[#2A2443]";
  let icon = <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#8E88AB]" />;
  let label = "✨ 1 free query remaining";
  let shortLabel = "1 free";

  if (hasKey) {
    badgeStyle = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    icon = <Key className="w-3.5 h-3.5 shrink-0" />;
    label = "🔑 Your Key Active";
    shortLabel = "Active";
  } else if (starBonus > 0) {
    badgeStyle = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    icon = <Star className="w-3.5 h-3.5 shrink-0 fill-amber-500/10" />;
    label = `⭐ ${starBonus} queries left`;
    shortLabel = `${starBonus} left`;
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
            <h4 className="text-xs font-bold text-[#FAF9FD] uppercase tracking-wider">Usage & Quotas</h4>
            <button onClick={() => setIsOpen(false)} className="text-[#8E88AB] hover:text-[#FAF9FD]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {hasKey ? (
              <div>
                <p className="text-[#8E88AB] leading-relaxed">
                  You are currently using your **own Gemini API key**. You have unlimited access directly from your browser.
                </p>
                <button
                  onClick={handleRemoveKey}
                  className="mt-3 w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 font-bold py-2 rounded-xl transition cursor-pointer text-center"
                >
                  Remove My Custom Key
                </button>
              </div>
            ) : starBonus > 0 ? (
              <div>
                <p className="text-[#8E88AB] leading-relaxed">
                  Thank you for supporting us on GitHub! You have **{starBonus} premium queries** left on our server.
                </p>
                <button
                  onClick={handleTriggerUnlock}
                  className="mt-3 w-full bg-[#1F1C38] hover:bg-[#2A264D] border border-[#2B2446] text-[#FAF9FD] font-bold py-2 rounded-xl transition cursor-pointer text-center"
                >
                  Manage My Keys / Star
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
