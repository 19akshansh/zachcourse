import React, { useState, useEffect } from "react";
import { HelpCircle, Play, Check } from "lucide-react";
import { tourEventEmitter } from "./TourController";
import { TourChapterId, getTourChapters } from "../../lib/tour-content";
import { useSession } from "../../lib/auth-client";
import { trpc } from "../../lib/trpc-client";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export function TourLauncher() {
  const { t } = useTranslation(["tour"]);
  const [isOpen, setIsOpen] = useState(false);
  const { data: sessionData } = useSession();
  const userRole = (sessionData?.user as any)?.role || "student";
  
  const [tourProgress, setTourProgress] = useState<{ chaptersSeen: string[]; completedAt: string | Date | null; contentVersion: number } | null>(null);

  useEffect(() => {
    if (sessionData?.user) {
      trpc.getTourProgress.query()
        .then(data => {
          setTourProgress({
            chaptersSeen: data.chaptersSeen || [],
            completedAt: data.completedAt,
            contentVersion: data.contentVersion || 0
          });
        })
        .catch(console.error);
    }
  }, [sessionData?.user]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const launchChapter = (chapter: TourChapterId | "full") => {
    setIsOpen(false);
    tourEventEmitter.dispatchEvent(new CustomEvent("startTour", { detail: { chapter } }));
  };

  const isSeen = (chapter: TourChapterId | "full") => {
    if (!tourProgress) return false;
    if (chapter === "full") return tourProgress.completedAt !== null;
    return tourProgress.chaptersSeen.includes(chapter) || tourProgress.completedAt !== null;
  };

  const visibleChapters = [
    { id: "welcome", title: t("welcome", { defaultValue: "Welcome" }), desc: t("welcome_desc", { defaultValue: "A quick intro to the platform." }) },
    { id: "sidebar-and-account", title: t("sidebar-and-account", { defaultValue: "Navigation & Account" }), desc: t("sidebar-and-account_desc", { defaultValue: "Find your way around." }) },
    { id: "building-a-course", title: t("building-a-course", { defaultValue: "Building a Course" }), desc: t("building-a-course_desc", { defaultValue: "Create a personalized curriculum." }) },
    { id: "course-views", title: t("course-views", { defaultValue: "Course Navigation" }), desc: t("course-views_desc", { defaultValue: "How to use a generated course." }) },
    { id: "visual-roadmaps", title: t("visual-roadmaps", { defaultValue: "Visual Roadmaps" }), desc: t("visual-roadmaps_desc", { defaultValue: "Node-based learning graphs." }) },
    { id: "cohorts", title: t("cohorts", { defaultValue: "Cohorts" }), desc: t("cohorts_desc", { defaultValue: "Learn with your peers." }) },
    { id: "teacher-tools", title: t("teacher-tools", { defaultValue: "Teacher Tools" }), desc: t("teacher-tools_desc", { defaultValue: "Classrooms and rosters." }), teacherOnly: true },
    { id: "analytics-and-certificates", title: t("analytics-and-certificates", { defaultValue: "Analytics & Certificates" }), desc: t("analytics-and-certificates_desc", { defaultValue: "Your stats and achievements." }) },
    { id: "my-progress", title: t("my-progress", { defaultValue: "My Progress" }), desc: t("my-progress_desc", { defaultValue: "Course-specific milestones." }) }
  ].filter(c => !c.teacherOnly || userRole === "teacher");

  return (
    <>
      <button
        data-tour="header-help-btn"
        onClick={() => setIsOpen(true)}
        className="p-2 text-[#CECADF] hover:text-[#FAF9FD] hover:bg-[#2A2443] rounded-xl transition-colors flex items-center justify-center relative"
        aria-label={t("title", { defaultValue: "Guided Tours" })}
      >
        <HelpCircle className="w-5 h-5" />
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
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">{t("title", { defaultValue: "Guided Tours" })}</h3>
                <p className="text-sm text-[#CECADF] mt-2 leading-relaxed">
                  {t("desc", { defaultValue: "Revisit any part of the app walkthrough. Select a chapter below to begin your guided tour." })}
                </p>
              </div>
            </div>
            
            <div className="overflow-y-auto pr-1 space-y-3 max-h-[300px] custom-scrollbar">
              <button
                onClick={() => launchChapter("full")}
                className="w-full text-left p-3 rounded-xl hover:bg-[#2A2443] transition-colors flex items-start gap-3 group bg-[#4F46E5]/10 border border-[#4F46E5]/20"
              >
                <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-[#4F46E5] flex items-center justify-center text-white">
                  <Play className="w-3 h-3 ml-0.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#FAF9FD] group-hover:text-white">{t("takeFullTour", { defaultValue: "Take the Full Tour" })}</h4>
                  <p className="text-xs text-[#CECADF] mt-0.5">{t("fullTourDesc", { defaultValue: "Explore everything step-by-step." })}</p>
                </div>
              </button>
              
              <div className="space-y-1">
                {visibleChapters.map(chapter => {
                  const seen = isSeen(chapter.id as TourChapterId);
                  return (
                    <button
                      key={chapter.id}
                      onClick={() => launchChapter(chapter.id as TourChapterId)}
                      className="w-full text-left p-3 rounded-xl hover:bg-[#2A2443] transition-colors flex items-start gap-3 group"
                    >
                      <div className="mt-0.5 shrink-0 flex items-center justify-center w-5 h-5">
                        {seen ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]/50" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#FAF9FD] group-hover:text-white flex items-center gap-2">
                          {chapter.title}
                          {seen && <span className="text-[9px] uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">{t("seen", { defaultValue: "Seen" })}</span>}
                        </h4>
                        <p className="text-xs text-[#8E88AB] mt-0.5">{chapter.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs cursor-pointer w-full sm:w-auto text-center"
              >
                {t("close", { defaultValue: "Close" })}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
