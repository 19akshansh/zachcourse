import React from "react";
import { TooltipRenderProps } from "react-joyride";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function TourTooltip(props: TooltipRenderProps) {
  const { t } = useTranslation(["tour"]);
  const {
    backProps,
    primaryProps,
    skipProps,
    closeProps,
    index,
    step,
    continuous,
    tooltipProps,
    size
  } = props;

  const isCentered = step.placement === "center";

  return (
    <>
      {isCentered && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[-1] pointer-events-auto" />
      )}
      <div
        {...tooltipProps}
        role="dialog"
        aria-modal="true"
        className="bg-[#1A172E] border border-[#2A2443] rounded-2xl shadow-2xl w-[calc(100vw-32px)] max-w-[360px] flex flex-col overflow-hidden"
      >
      <div className="flex justify-between items-start p-3.5 pb-1.5 sm:p-4 sm:pb-2">
        <h3 className="font-display text-[#FAF9FD] font-bold text-base sm:text-lg leading-tight">
          {step.title}
        </h3>
        <button
          {...closeProps}
          className="p-1 text-[#8E88AB] hover:text-[#FAF9FD] transition-colors rounded-lg hover:bg-[#2A2443]"
          aria-label={t("common:close", { defaultValue: "Close" })}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-[#CECADF] text-xs sm:text-sm font-sans leading-relaxed">
        {step.content}
      </div>
      <div className="flex items-center justify-between p-3.5 pt-3.5 border-t border-[#2A2443] mt-1 sm:mt-2 gap-2 flex-wrap sm:flex-nowrap">
        <div className="text-[10px] text-[#8E88AB] uppercase tracking-wider font-bold shrink-0">
          {t("stepIndicator", { current: index + 1, total: size, defaultValue: "Step {{current}} of {{total}}" })}
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-1.5 sm:mt-0">
          {index > 0 && (
            <button
              {...backProps}
              className="px-2.5 py-1.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] rounded-xl text-xs sm:text-sm font-bold transition-colors w-full sm:w-auto text-center"
            >
              {t("back", { defaultValue: "Back" })}
            </button>
          )}
          {!continuous ? (
            <button
              {...closeProps}
              className="px-2.5 py-1.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] rounded-xl text-xs sm:text-sm font-bold transition-colors w-full sm:w-auto text-center"
            >
              {t("common:close", { defaultValue: "Close" })}
            </button>
          ) : (
            <button
              {...primaryProps}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] text-white rounded-xl text-xs sm:text-sm font-bold transition-colors w-full sm:w-auto text-center"
            >
              {index === size - 1 ? t("done", { defaultValue: "Done" }) : t("next", { defaultValue: "Next" })}
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
