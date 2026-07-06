import React, { useState, useEffect } from "react";
import { HelpCircle, Play, Check } from "lucide-react";
import { tourEventEmitter } from "./TourController";
import { TourChapterId } from "../../lib/tour-content";
import { useSession } from "../../lib/auth-client";
import { trpc } from "../../lib/trpc-client";
import { createPortal } from "react-dom";

const chapters: { id: TourChapterId; title: string; desc: string; teacherOnly?: boolean }[] = [
  { id: "welcome", title: "Welcome", desc: "A quick intro to the platform." },
  { id: "sidebar-and-account", title: "Navigation & Account", desc: "Find your way around." },
  { id: "building-a-course", title: "Building a Course", desc: "Create a personalized curriculum." },
  { id: "course-views", title: "Course Navigation", desc: "How to use a generated course." },
  { id: "visual-roadmaps", title: "Visual Roadmaps", desc: "Node-based learning graphs." },
  { id: "cohorts", title: "Cohorts", desc: "Learn with your peers." },
  { id: "teacher-tools", title: "Teacher Tools", desc: "Classrooms and rosters.", teacherOnly: true },
  { id: "analytics-and-certificates", title: "Analytics & Certificates", desc: "Your stats and achievements." },
  { id: "my-progress", title: "My Progress", desc: "Course-specific milestones." }
];

export function TourLauncher() {
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

  const visibleChapters = chapters.filter(c => !c.teacherOnly || userRole === "teacher");

  return (
    <>
      <button
        data-tour="header-help-btn"
        onClick={() => setIsOpen(true)}
        className="p-2 text-[#CECADF] hover:text-[#FAF9FD] hover:bg-[#2A2443] rounded-xl transition-colors flex items-center justify-center relative"
        aria-label="Help & Tours"
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
                <h3 className="text-xl font-bold text-[#FAF9FD]">Guided Tours</h3>
                <p className="text-sm text-[#CECADF] mt-2 leading-relaxed">
                  Revisit any part of the app walkthrough. Select a chapter below to begin your guided tour.
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
                  <h4 className="text-sm font-bold text-[#FAF9FD] group-hover:text-white">Take the Full Tour</h4>
                  <p className="text-xs text-[#CECADF] mt-0.5">Explore everything step-by-step.</p>
                </div>
              </button>
              
              <div className="space-y-1">
                {visibleChapters.map(chapter => {
                  const seen = isSeen(chapter.id);
                  return (
                    <button
                      key={chapter.id}
                      onClick={() => launchChapter(chapter.id)}
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
                          {seen && <span className="text-[9px] uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Seen</span>}
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
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
