import React, { useState } from "react";
import { Key, ArrowRight, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { validateUserKey } from "../lib/usage";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ApiKeyOnboardingProps {
  onActivate: () => void;
  onSkip: () => void;
}

export function ApiKeyOnboarding({ onActivate, onSkip }: ApiKeyOnboardingProps) {
  const { t } = useTranslation("auth");
  const [apiKey, setApiKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key || key.length < 20) {
      toast.error(t("toastPasteFullKey", { defaultValue: "Please paste your full API key" }));
      return;
    }
    
    setIsActivating(true);
    // Try the key against the API
    try {
      const result = await validateUserKey(key);
      setIsActivating(false);
      
      if (!result.valid) {
        if (result.error) {
          toast.error(t("toastValidationFailed", { defaultValue: `Key validation failed: ${result.error}`, error: result.error }));
        } else {
          toast.error(t("toastKeyNotWorking", { defaultValue: "That key did not work — double-check you copied it fully" }));
        }
        return;
      }
    } catch (err: any) {
      setIsActivating(false);
      toast.error(t("toastValidationError", { defaultValue: `Validation error: ${err.message || "Unknown error"}`, error: err.message || "Unknown error" }));
      return;
    }
    
    localStorage.setItem("zc_user_key", key);
    window.dispatchEvent(new CustomEvent("zc-key-status-changed"));
    toast.success(t("toastKeyActivated", { defaultValue: "API key activated! Let's go 🚀" }));
    onActivate();
  };

  return (
    <main className="min-h-screen bg-[#0F0D19] flex items-center justify-center p-4 font-sans text-white">
      <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F46E5] via-[#8B5CF6] to-[#EC4899] z-10 rounded-t-3xl"></div>
        
        <div className="p-8 md:p-12 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl select-none">🎓</span>
            <span className="font-bold text-2xl tracking-tight text-[#FAF9FD]">ZachCourse</span>
          </div>

          <h2 className="text-3xl font-black text-[#FAF9FD] tracking-tight mb-3">
            {t("onboardingTitle", { defaultValue: "One last step! 🚀" })}
          </h2>
          <p className="text-sm text-[#8E88AB] leading-relaxed mb-8 max-w-lg">
            {t("onboardingSubtitle", { defaultValue: "ZachCourse is completely free — you just need your own Gemini API key (also free, though some regions may require a billing account or profile to access the free tier). This unlocks unlimited personalized courses, roadmap generation, and mentor chats." })}
          </p>

          <div className="space-y-6 mb-8">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#1A172E] border border-[#2A2443] flex items-center justify-center font-bold text-sm text-[#8E88AB] shrink-0">1</div>
              <div>
                <a 
                  href="https://aistudio.google.com/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#818CF8] hover:text-[#4F46E5] font-semibold text-sm transition"
                >
                  {t("getFreeKey", { defaultValue: "Get Free Key" })} <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <p className="text-xs text-[#8E88AB] mt-1">
                  {t("getFreeKeyDesc", { defaultValue: 'Sign in with Google and click "Create API key". (Note: Depending on your region, Google AI Studio may require linking a billing account to verify your account, but the standard Tier is completely free of charge).' })}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#1A172E] border border-[#2A2443] flex items-center justify-center font-bold text-sm text-[#8E88AB] shrink-0">2</div>
              <div>
                <p className="text-sm font-semibold text-[#FAF9FD]">
                  {t("copyApiKey", { defaultValue: "Copy your API key (usually starts with AIzaSy or AQ.)" })}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#1A172E] border border-[#2A2443] flex items-center justify-center font-bold text-sm text-[#8E88AB] shrink-0">3</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#FAF9FD] mb-3">
                  {t("pasteAndActivate", { defaultValue: "Paste below and hit Activate" })}
                </p>
                <form onSubmit={handleActivate} className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-[#8E88AB]" />
                    </div>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                      }}
                      className="block w-full pl-10 pr-3 py-2.5 bg-[#1A172E] border border-[#2A2443] rounded-xl text-[#FAF9FD] placeholder-[#8E88AB] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition text-sm"
                      placeholder={t("pasteKeyPlaceholder", { defaultValue: "Paste your API key..." })}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isActivating}
                    className="w-full bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] hover:from-[#5054D3] hover:to-[#7C3AED] text-white font-bold py-2.5 px-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("validatingKey", { defaultValue: "Validating Key..." })}
                      </>
                    ) : (
                      <>
                        {t("activateMyKey", { defaultValue: "Activate My Key" })} <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#1E1E2E] pt-6 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-[#8E88AB]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t("keyStoredSecurely", { defaultValue: "Your key stays securely in YOUR browser." })}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
