import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Lock, Play } from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  duration: string;
  concepts: string[];
}

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

interface Roadmap {
  title: string;
  description: string;
  difficulty: string;
  modules: Module[];
}

interface RoadmapGraphProps {
  roadmap: Roadmap;
  completedLessons: string[];
  completedQuizzes: Record<string, number>;
  selectedLessonId: string | null;
  onSelectLesson: (moduleTitle: string, lesson: Lesson) => void;
}

export default function RoadmapGraph({
  roadmap,
  completedLessons,
  completedQuizzes,
  selectedLessonId,
  onSelectLesson
}: RoadmapGraphProps) {
  const { t } = useTranslation(["roadmap"]);
  // Check if a lesson is locked (only the first incomplete lesson is available, everything after is locked)
  // To keep it simple, let's say a lesson is available if all previous lessons are completed.
  
  const flatLessons: { lesson: Lesson; module: Module }[] = [];
  roadmap.modules?.forEach(m => {
    m.lessons?.forEach(l => {
      flatLessons.push({ lesson: l, module: m });
    });
  });

  const getStatus = (lessonId: string, index: number) => {
    const isCompleted = completedLessons.includes(lessonId);
    let isAvailable = true;
    if (index > 0) {
      const prevLessonId = flatLessons[index - 1].lesson.id;
      isAvailable = completedLessons.includes(prevLessonId);
    }
    
    // Always unlock first lesson
    if (index === 0) isAvailable = true;
    // Always unlock completed lessons
    if (isCompleted) isAvailable = true;

    return {
      isCompleted,
      isAvailable: isAvailable && !isCompleted,
      isLocked: !isAvailable && !isCompleted
    };
  };

  return (
    <div className="w-full min-h-[600px] overflow-x-auto overflow-y-hidden bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 relative hide-scrollbar">
      <div className="flex flex-row md:flex-row flex-col gap-12 md:gap-24 min-w-max items-start">
        {roadmap.modules?.map((mod, modIdx) => (
          <div key={mod.id} className="flex flex-col items-center relative w-64">
            
            {/* Horizontal connecting line between modules */}
            {modIdx > 0 && (
              <div className="absolute top-[26px] right-full w-24 md:w-48 h-[2px] bg-gradient-to-r from-[#10B981] to-[#2A2443] -translate-x-12 -z-10" />
            )}

            {/* Module Header */}
            <div className="bg-[#1A172E] border border-[#2A2443] rounded-xl px-4 py-3 text-center mb-8 w-full z-10 shadow-lg">
              <span className="text-xs font-bold text-[#818CF8] uppercase tracking-wider mb-1 block">{t("moduleNumber", { defaultValue: "Module {{number}}", number: modIdx + 1 })}</span>
              <h4 className="text-sm font-bold text-[#FAF9FD] truncate" title={mod.title}>{mod.title}</h4>
            </div>

            {/* Lessons (Nodes) */}
            <div className="flex flex-col gap-12 items-center relative w-full">
              {/* Vertical trunk line */}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-[#2A2443] -z-10" />
              
              {mod.lessons?.map((lesson, lessonIdx) => {
                const globalIdx = flatLessons.findIndex(fl => fl.lesson.id === lesson.id);
                const status = getStatus(lesson.id, globalIdx);
                const isSelected = selectedLessonId === lesson.id;
                
                let nodeClasses = "w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-300 z-10 relative cursor-pointer group shadow-lg ";
                let icon = null;
                
                if (status.isCompleted) {
                  nodeClasses += "bg-[#10B981] text-white border-2 border-[#10B981] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]";
                  icon = <Check className="w-6 h-6" />;
                } else if (status.isAvailable || isSelected) {
                  nodeClasses += "bg-[#1A172E] text-white border-2 border-[#4F46E5] hover:bg-[#4338CA] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]";
                  icon = <Play className="w-5 h-5 ml-1" />;
                } else {
                  nodeClasses += "bg-[#0F0D19] text-[#8E88AB] border-2 border-[#2A2443] cursor-not-allowed";
                  icon = <Lock className="w-5 h-5" />;
                }

                if (isSelected) {
                  nodeClasses += " ring-4 ring-[#4F46E5]/30 ring-offset-2 ring-offset-[#111118] scale-110";
                }

                return (
                  <div key={lesson.id} className="relative group/tooltip flex justify-center w-full">
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 bg-[#181628] border border-[#2B2446] rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
                      <p className="text-xs font-bold text-[#FAF9FD] leading-tight mb-1">{lesson.title}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-[#8E88AB]">{lesson.duration}</span>
                        {completedQuizzes[lesson.id] !== undefined && (
                          <span className="text-[10px] font-bold text-[#10B981]">{t("scorePercentage", { defaultValue: "Score: {{score}}%", score: completedQuizzes[lesson.id] })}</span>
                        )}
                      </div>
                      {/* Triangle pointer */}
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#181628] border-b border-r border-[#2B2446] rotate-45" />
                    </div>

                    <button
                      onClick={() => {
                        if (!status.isLocked) {
                          onSelectLesson(mod.title, lesson);
                        }
                      }}
                      className={nodeClasses}
                      disabled={status.isLocked}
                    >
                      {icon}
                    </button>
                    
                    {/* Label next to node on desktop, or just keep tooltip? Let's use tooltip to keep graph clean */}
                  </div>
                );
              })}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
