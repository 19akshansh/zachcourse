import React, { useState, useMemo } from "react";
import { Trophy, CheckCircle, Download, X } from "lucide-react";
import { Pagination } from "./Pagination";
import { useSession } from "../lib/auth-client";

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
  const { data: sessionData } = useSession();
  const userName = sessionData?.user?.name || "Student";
  const [showCertificate, setShowCertificate] = useState(false);
  
  const certId = useMemo(() => {
    return 'ZC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }, []);

  const [lessonsPage, setLessonsPage] = useState(1);
  const lessonsPerPage = 5;
  const totalLessonPages = Math.ceil(completedLessons.length / lessonsPerPage);
  const paginatedLessons = completedLessons.slice(
    (lessonsPage - 1) * lessonsPerPage,
    lessonsPage * lessonsPerPage
  );

  const [quizzesPage, setQuizzesPage] = useState(1);
  const quizzesPerPage = 5;
  const quizEntries = Object.entries(completedQuizzes);
  const totalQuizPages = Math.ceil(quizEntries.length / quizzesPerPage);
  const paginatedQuizzes = quizEntries.slice(
    (quizzesPage - 1) * quizzesPerPage,
    quizzesPage * quizzesPerPage
  );

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
              {quizEntries.length > 0 && (
                <div className="space-y-2 mt-2">
                  {paginatedQuizzes.map(([lessonId, score]) => {
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
                  <Pagination 
                    currentPage={quizzesPage} 
                    totalPages={totalQuizPages} 
                    onPageChange={setQuizzesPage} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* Completed Lessons checklist */}
          <div className="border-t border-[#2A2443] pt-5 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-base font-bold text-[#FAF9FD]">Mastered Lessons Log:</h4>
              {completionPercentage === 100 && totalLessons > 0 && (
                <button
                  onClick={() => setShowCertificate(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Certificate
                </button>
              )}
            </div>
            {completedLessons.length === 0 ? (
              <p className="text-sm text-[#8E88AB] italic">No lessons marked completed yet. Start learning in the Roadmap tab! 🧭</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {paginatedLessons.map((id) => {
                  const allLessons = currentRoadmap?.modules?.flatMap((m: any) => m.lessons) || [];
                  const foundTitle = allLessons.find((l: any) => l.id === id)?.title || "Custom lesson node";

                  return (
                    <div key={id} className="flex items-center gap-2 sm:gap-3 text-sm font-semibold text-[#10B981] bg-emerald-950/20 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl">
                      <CheckCircle className="w-4.5 h-4.5 text-[#10B981] shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-[#CECADF] font-medium">{foundTitle}</span>
                    </div>
                  );
                })}
                <Pagination 
                  currentPage={lessonsPage} 
                  totalPages={totalLessonPages} 
                  onPageChange={setLessonsPage} 
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Certificate Modal */}
      {showCertificate && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:h-auto print:w-full print:block">
          <style>
            {`
              @media print {
                body > *:not(#certificate-modal-container) {
                  display: none !important;
                }
                #certificate-modal-container {
                  display: block !important;
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  margin: 0;
                  padding: 0;
                }
                @page {
                  size: landscape;
                  margin: 0;
                }
              }
            `}
          </style>
          
          <div id="certificate-modal-container" className="relative w-full max-w-4xl bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none flex flex-col">
            {/* Action Bar (hidden in print) */}
            <div className="flex items-center justify-between p-4 bg-slate-100 border-b border-slate-200 print:hidden">
              <h2 className="text-lg font-bold text-slate-800">Certificate of Completion</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-sm font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Save as PDF
                </button>
                <button
                  onClick={() => setShowCertificate(false)}
                  className="p-2 hover:bg-slate-200 rounded-xl transition text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Certificate Content */}
            <div className="p-12 md:p-16 lg:p-24 flex-1 flex flex-col justify-center relative bg-white min-h-[600px] print:min-h-screen border-[16px] border-[#1A172E] print:border-[#1A172E]">
              {/* Background Accents */}
              <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-br-[120px]" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-tl-[120px]" />
              
              <div className="relative z-10 text-center space-y-8">
                <div>
                  <h1 className="text-5xl md:text-6xl font-black text-[#1A172E] tracking-tight uppercase" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Certificate of Completion
                  </h1>
                  <p className="text-lg text-slate-500 mt-4 uppercase tracking-[0.2em] font-semibold">
                    ZachCourse Learning Platform
                  </p>
                </div>

                <div className="py-8 border-y-2 border-slate-100">
                  <p className="text-xl text-slate-600 font-medium mb-4">This certifies that</p>
                  <h2 className="text-4xl md:text-5xl font-bold text-indigo-600 mb-4">{userName}</h2>
                  <p className="text-xl text-slate-600 font-medium mt-4">
                    has successfully completed the course
                  </p>
                </div>

                <div>
                  <h3 className="text-3xl font-bold text-[#1A172E] mb-12">
                    {currentRoadmap?.title || "Custom Course"}
                  </h3>
                  
                  <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-2xl mx-auto pt-8 border-t-2 border-slate-100 text-left">
                    <div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Date Completed</p>
                      <p className="text-lg font-bold text-slate-800">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    
                    <div className="mt-6 md:mt-0 md:text-right">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Certificate ID</p>
                      <p className="text-lg font-mono font-bold text-slate-800 tracking-wider">{certId}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
