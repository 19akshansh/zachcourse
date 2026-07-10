import React, { useState, useEffect } from "react";
import { Languages, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const languagesList = [
  { code: "en", nativeName: "English" },
  { code: "ar", nativeName: "العربية" },
  { code: "es", nativeName: "Español" },
  { code: "fr", nativeName: "Français" },
  { code: "de", nativeName: "Deutsch" },
  { code: "hi", nativeName: "हिन्दी" },
  { code: "zh", nativeName: "中文" }
];

export function LanguageSwitcher({ buttonClassName }: { buttonClassName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { i18n, t } = useTranslation(["header", "common"]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("zc_language", code);
    setIsOpen(false);
  };

  const activeLang = i18n.language || "en";

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={buttonClassName || "p-2 text-[#CECADF] hover:text-[#FAF9FD] hover:bg-[#2A2443] rounded-xl transition-colors flex items-center justify-center relative"}
        aria-label={t("changeLanguage", { defaultValue: "Change Language" })}
      >
        <Languages className="w-5 h-5" />
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Centered Modal Container */}
          <div className="relative w-full max-w-md bg-[#121021] border border-[#2A2443] rounded-2xl shadow-2xl z-10 p-6 space-y-6 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-[#4F46E5]/10 text-[#8B5CF6] rounded-full flex items-center justify-center">
                <Languages className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">{t("changeLanguage")}</h3>
                <p className="text-sm text-[#CECADF] mt-2 leading-relaxed">
                  {t("common:changeLanguageDesc", { defaultValue: "Select your preferred language. Language changes will apply to the entire platform." })}
                </p>
              </div>
            </div>
            
            <div className="overflow-y-auto pr-1 space-y-2 max-h-[300px] custom-scrollbar">
              {languagesList.map((lang) => {
                const isSelected = activeLang.startsWith(lang.code);
                return (
                  <button
                    key={lang.code}
                    onClick={() => selectLanguage(lang.code)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center justify-between group border ${
                      isSelected
                        ? "bg-[#4F46E5]/15 border-[#4F46E5]/40 text-white font-semibold"
                        : "border-transparent text-[#CECADF] hover:bg-[#2A2443] hover:text-white"
                    }`}
                  >
                    <span className="text-sm">{lang.nativeName}</span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#4F46E5]/25 border border-[#4F46E5]/50 flex items-center justify-center text-white">
                        <Check className="w-3 h-3 text-[#8B5CF6]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs cursor-pointer w-full sm:w-auto text-center"
              >
                {t("common:close", { defaultValue: "Close" })}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
