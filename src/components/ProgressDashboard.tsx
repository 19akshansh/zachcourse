import React from "react";
import { Trophy, CheckCircle } from "lucide-react";

interface ProgressDashboardProps {
  completionPercentage: number;
  completedLessonsCount: number;
  totalLessons: number;
  completedQuizzes: Record<string, number>;
  completedLessons: string[];
  currentRoadmap: any;
  streakDays?: number;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  completionPercentage,
  completedLessonsCount,
  totalLessons,
  completedQuizzes,
  completedLessons,
  currentRoadmap,
  streakDays = 1,
}) => {
  // Render SVG circular progress inside the component to keep it modular
  const renderProgressRing = (pct: number, size: number = 84, strokeWidth: number = 7) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            className="text-[#2A2443]"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
          />
          <circle
            className="text-[#10B981] transition-all duration-700 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
          />
        </svg>
        <span className="absolute text-lg font-bold text-[#FAF9FD] font-sans">{pct}%</span>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* Left Box: Stats Summary */}
      <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 md:p-8 shadow-xl flex flex-col items-center text-center gap-6">
        <h3 className="text-2xl font-bold text-[#FAF9FD]">Your Progression Dashboard</h3>

        {renderProgressRing(completionPercentage, 120, 9)}

        <div className="w-full space-y-2 text-left mt-4 border-t border-[#2A2443] pt-4">
          <div className="flex justify-between text-base font-semibold text-[#FAF9FD]/80">
            <span>Completed Topics:</span>
            <span className="text-[#FAF9FD]">{completedLessonsCount} of {totalLessons} Lessons</span>
          </div>
          <div className="w-full bg-[#121021] rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[#10B981] h-2.5 transition-all duration-700 rounded-full"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Study Streak indicator */}
        <div className="w-full bg-[#121021]/50 border border-[#2A2443] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔥</span>
            <div className="text-left">
              <p className="text-base font-bold text-[#FAF9FD]">
                {streakDays === 1 ? "1-Day study Streak!" : `${streakDays}-Day study Streak!`}
              </p>
              <p className="text-xs text-[#8E88AB] font-medium">Daily practice makes habits stick.</p>
            </div>
          </div>
          <span className="bg-amber-950/40 text-amber-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">Active</span>
        </div>
      </div>

      {/* Right Box: Achievements and perfect quizzes */}
      <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 md:p-8 shadow-xl space-y-6">
        <h3 className="text-2xl font-bold text-[#FAF9FD] flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" />
          <span>Your badges & Achievements</span>
        </h3>

        <div className="space-y-4">
          {/* Badge 1: New Learner */}
          <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-indigo-950/20 rounded-2xl border border-[#4F46E5]/20">
            <span className="text-3xl select-none mt-1 shrink-0">🌱</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-[#FAF9FD]">Curious Explorer</h4>
              <p className="text-sm text-[#8E88AB] font-medium">You took your first steps on your learning companion roadmap!</p>
            </div>
          </div>

          {/* Badge 2: Quizzes */}
          <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-amber-950/20 rounded-2xl border border-amber-500/20">
            <span className="text-3xl select-none mt-1 shrink-0">🏆</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-[#FAF9FD]">Quiz Performance</h4>
              <p className="text-sm text-[#8E88AB] font-medium mb-2">
                You have completed {Object.keys(completedQuizzes).length} quizzes.
              </p>
              {Object.entries(completedQuizzes).length > 0 && (
                <div className="space-y-2 mt-2">
                  {Object.entries(completedQuizzes).map(([lessonId, score]) => {
                    const allLessons = (currentRoadmap as any)?.modules?.flatMap((m: any) => m.lessons) || [];
                    const lessonTitle = allLessons.find((l: any) => l.id === lessonId)?.title || "Lesson Quiz";
                    return (
                      <div key={lessonId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121021] px-3 py-2 rounded-xl gap-2">
                        <span className="text-xs text-[#CECADF] truncate w-full sm:max-w-[150px]" title={lessonTitle}>{lessonTitle}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap self-start sm:self-auto ${Number(score) >= 60 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {String(score)}% Correct
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Completed Lessons checklist */}
          <div className="border-t border-[#2A2443] pt-5 space-y-3">
            <h4 className="text-base font-bold text-[#FAF9FD]">Mastered Lessons Log:</h4>
            {completedLessons.length === 0 ? (
              <p className="text-sm text-[#8E88AB] italic">No lessons marked completed yet. Start learning in the Roadmap tab! 🧭</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {completedLessons.map((id) => {
                  const allLessons = currentRoadmap?.modules?.flatMap((m: any) => m.lessons) || [];
                  const foundTitle = allLessons.find((l: any) => l.id === id)?.title || "Custom lesson node";

                  return (
                    <div key={id} className="flex items-center gap-2 sm:gap-3 text-sm font-semibold text-[#10B981] bg-emerald-950/20 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl">
                      <CheckCircle className="w-4.5 h-4.5 text-[#10B981] shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-[#CECADF] font-medium">{foundTitle}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
