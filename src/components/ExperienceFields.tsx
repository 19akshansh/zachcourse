import React from "react";
import { useTranslation } from "react-i18next";

interface ExperienceFieldsProps {
  experienceLevel: string;
  setExperienceLevel: (val: string) => void;
  backgroundContext: string;
  setBackgroundContext: (val: string) => void;
}

export function ExperienceFields({
  experienceLevel,
  setExperienceLevel,
  backgroundContext,
  setBackgroundContext,
}: ExperienceFieldsProps) {
  const { t } = useTranslation("personalization");

  return (
    <div className="space-y-6 font-sans">
      <div>
        <label className="block text-sm font-bold text-[#8E88AB] uppercase tracking-wider mb-3">
          {t("expLevel", { defaultValue: "Experience Level" })}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "beginner", icon: "🌱", label: t("beginner", { defaultValue: "Beginner" }) },
            { id: "intermediate", icon: "🔥", label: t("intermediate", { defaultValue: "Intermediate" }) },
            { id: "advanced", icon: "🚀", label: t("advanced", { defaultValue: "Advanced" }) }
          ].map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => setExperienceLevel(lvl.id)}
              className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                experienceLevel === lvl.id 
                  ? "border-[#4F46E5] bg-[#4F46E5]/10 text-white" 
                  : "border-[#2A2443] bg-[#0F0D19] text-[#8E88AB] hover:border-[#3F395B]"
              }`}
            >
              <span className="text-2xl mb-2">{lvl.icon}</span>
              <span className="font-semibold text-sm">{lvl.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-[#8E88AB] uppercase tracking-wider mb-3">
          {t("yourBackground", { defaultValue: "Your Background" })}{" "}
          <span className="text-[#3F395B] normal-case font-normal">
            {t("optionalNote", { defaultValue: "(optional, but helps a lot)" })}
          </span>
        </label>
        <textarea
          value={backgroundContext}
          onChange={(e) => setBackgroundContext(e.target.value)}
          placeholder={t("bgPlaceholder", { defaultValue: "e.g. I know basic HTML/CSS but no JavaScript. I learn best by building small projects rather than reading theory." })}
          rows={3}
          maxLength={500}
          className="w-full bg-[#0F0D19] border-2 border-[#2A2443] focus:border-[#4F46E5] rounded-xl px-5 py-4 text-white text-sm transition-colors placeholder:text-[#3F395B] outline-none resize-none"
        />
      </div>
    </div>
  );
}
