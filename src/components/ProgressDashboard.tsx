import React, { useState } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { Trophy, CheckCircle, Download, X, Share2, Award, Loader2 } from "lucide-react";
import { Pagination } from "./Pagination";
import { useSession } from "../lib/auth-client";
import { trpc } from "../lib/trpc-client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ProgressDashboardProps {
  completionPercentage: number;
  completedLessonsCount: number;
  totalLessons: number;
  completedQuizzes: Record<string, number>;
  completedLessons: string[];
  currentRoadmap: any;
  streakDays?: number;
  activeCourseId: string | null;
  isTrial?: boolean;
  onCertificateLockedClick?: () => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  completionPercentage,
  completedLessonsCount,
  totalLessons,
  completedQuizzes,
  completedLessons,
  currentRoadmap,
  streakDays = 1,
  activeCourseId,
  isTrial,
  onCertificateLockedClick,
}) => {
  const { t, i18n } = useTranslation(["progressDashboard"]);
  const { data: sessionData } = useSession();
  const userName = isTrial ? "Trial Learner" : (sessionData?.user?.name || t("common:student", "Student"));
  const [showCertificate, setShowCertificate] = useState(false);
  const [certId, setCertId] = useState<string | null>(null);
  const [issuingCert, setIssuingCert] = useState(false);

  const handleViewCertificate = async () => {
    if (isTrial) {
      if (onCertificateLockedClick) onCertificateLockedClick();
      return;
    }
    if (!activeCourseId) {
      toast.error(t("toastSelectCourse"));
      return;
    }
    setIssuingCert(true);
    try {
      const cert = await trpc.issueCertificate.mutate({ courseId: activeCourseId });
      setCertId(cert.certId);
      setShowCertificate(true);
    } catch (err: any) {
      console.error("Error issuing/fetching certificate:", err);
      toast.error(err.message || t("failedToRetrieveCertificate", { defaultValue: "Failed to retrieve certificate." }));
    } finally {
      setIssuingCert(false);
    }
  };

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
    <div data-tour="cert-dashboard" className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* Left Box: Stats Summary */}
      <div data-tour="progress-ring" className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 md:p-8 shadow-xl flex flex-col items-center text-center gap-6">
        <h3 className="text-2xl font-bold text-[#FAF9FD]">{t("dashboardTitle")}</h3>

        {renderProgressRing(completionPercentage, 120, 9)}

        <div className="w-full space-y-2 text-left mt-4 border-t border-[#2A2443] pt-4">
          <div className="flex justify-between text-base font-semibold text-[#FAF9FD]/80">
            <span>{t("completedTopics")}</span>
            <span className="text-[#FAF9FD]">
              {t("ofLessons", { completed: completedLessonsCount, total: totalLessons })}
            </span>
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
                {t("streakText", { count: streakDays })}
              </p>
              <p className="text-xs text-[#8E88AB] font-medium">{t("streakDesc")}</p>
            </div>
          </div>
          <span className="bg-amber-950/40 text-amber-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">
            {t("streakActive")}
          </span>
        </div>
      </div>

      {/* Right Box: Achievements and perfect quizzes */}
      <div data-tour="progress-badges" className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 md:p-8 shadow-xl space-y-6">
        <h3 className="text-2xl font-bold text-[#FAF9FD] flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" />
          <span>{t("achievementsTitle")}</span>
        </h3>

        <div className="space-y-4">
          {/* Badge 1: New Learner */}
          <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-indigo-950/20 rounded-2xl border border-[#4F46E5]/20">
            <span className="text-3xl select-none mt-1 shrink-0">🌱</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-[#FAF9FD]">{t("curiousExplorerTitle")}</h4>
              <p className="text-sm text-[#8E88AB] font-medium">{t("curiousExplorerDesc")}</p>
            </div>
          </div>

          {/* Badge 2: Quizzes */}
          <div data-tour="progress-quiz-performance" className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-amber-950/20 rounded-2xl border border-amber-500/20">
            <span className="text-3xl select-none mt-1 shrink-0">🏆</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-[#FAF9FD]">{t("quizPerformanceTitle")}</h4>
              <p className="text-sm text-[#8E88AB] font-medium mb-2">
                {t("quizPerformanceCompleted", { count: Object.keys(completedQuizzes).length })}
              </p>
              {quizEntries.length > 0 && (
                <div className="space-y-2 mt-2">
                  {paginatedQuizzes.map(([lessonId, score]) => {
                    const allLessons = (currentRoadmap as any)?.modules?.flatMap((m: any) => m.lessons) || [];
                    const lessonTitle = allLessons.find((l: any) => l.id === lessonId)?.title || t("lessonQuizFallback");
                    return (
                      <div key={lessonId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121021] px-3 py-2 rounded-xl gap-2">
                        <span className="text-xs text-[#CECADF] truncate w-full sm:max-w-[150px]" title={lessonTitle}>{lessonTitle}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap self-start sm:self-auto ${Number(score) >= 60 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {t("quizPercentCorrect", { score: String(score) })}
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
          <div data-tour="progress-mastered-lessons" className="border-t border-[#2A2443] pt-5 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-base font-bold text-[#FAF9FD]">{t("masteredLessonsTitle")}</h4>
              {completionPercentage === 100 && totalLessons > 0 && (
                <button
                  data-tour="cert-download-btn"
                  disabled={issuingCert}
                  onClick={handleViewCertificate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {issuingCert ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Award className="w-3.5 h-3.5" />
                  )}
                  {issuingCert ? t("claiming") : t("viewCertificate")}
                </button>
              )}
            </div>
            {completedLessons.length === 0 ? (
              <p className="text-sm text-[#8E88AB] italic">{t("noLessonsMarked")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {paginatedLessons.map((id) => {
                  const allLessons = currentRoadmap?.modules?.flatMap((m: any) => m.lessons) || [];
                  const foundTitle = allLessons.find((l: any) => l.id === id)?.title || t("customLessonNodeFallback");

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
      {showCertificate && createPortal(
        <div id="certificate-portal-wrapper" className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block print:w-full print:h-auto">
          <style>
            {`
              @media print {
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body > *:not(#certificate-portal-wrapper) {
                  display: none !important;
                }
                #certificate-portal-wrapper {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  background: white !important;
                  display: block !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                #certificate-modal-container {
                  max-height: none !important;
                  height: 100% !important;
                  width: 100% !important;
                  overflow: visible !important;
                  box-shadow: none !important;
                  display: block !important;
                }
                .print-content-wrapper {
                  display: flex !important;
                  height: 100% !important;
                  min-height: 100vh !important;
                  width: 100% !important;
                  border: 16px solid #1A172E !important;
                }
                .no-print {
                  display: none !important;
                }
                @page {
                  size: landscape;
                  margin: 0;
                }
              }
            `}
          </style>
             
          <div id="certificate-modal-container" className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none flex flex-col max-h-[90vh] overflow-y-auto aspect-auto sm:aspect-video">
            {/* Action Bar (hidden in print) */}
            <div className="flex items-center justify-between p-4 bg-slate-100 border-b border-slate-200 print:hidden">
              <h2 className="text-lg font-bold text-slate-800">{t("certCompletion")}</h2>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={async () => {
                    if (!certId) {
                      toast.error(t("toastCertNotLoaded"));
                      return;
                    }
                    const shareUrl = `${window.location.origin}/certificate/${certId}`;
                    const shareData = {
                      title: t("certCompletion"),
                      text: `I just completed "${currentRoadmap?.title || t("certCustomCourseFallback")}" on ZachCourse! Verify my certificate here:`,
                      url: shareUrl
                    };
                    
                    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                      try {
                        await navigator.share(shareData);
                      } catch (error) {
                        console.error("Error sharing certificate:", error);
                        navigator.clipboard.writeText(shareUrl);
                        toast.success(t("toastShareSuccess"));
                      }
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success(t("toastShareSuccess"));
                    }
                  }}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-bold transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("share")}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-sm font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("download")}</span>
                </button>
                <button
                  onClick={() => setShowCertificate(false)}
                  className="p-2 hover:bg-slate-200 rounded-xl transition text-slate-500 ml-1 sm:ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Certificate Content - Desktop & Print */}
            <div id="certificate-content" className="hidden sm:flex print-content-wrapper p-12 md:p-16 flex-1 flex-col justify-center relative bg-white border-[12px] md:border-[16px] border-[#1A172E] print:border-[#1A172E] print:min-h-screen print:flex">
              {/* Background Accents */}
              <div className="absolute top-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-indigo-500/10 rounded-br-[120px]" />
              <div className="absolute bottom-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-emerald-500/10 rounded-tl-[120px]" />
                 
              <div className="relative z-10 text-center space-y-4 sm:space-y-8 h-full flex flex-col justify-center">
                <div>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-[#1A172E] tracking-tight uppercase" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {t("certCompletion")}
                  </h1>
                  <p className="text-sm sm:text-lg text-slate-500 mt-2 sm:mt-4 uppercase tracking-[0.2em] font-semibold">
                    {t("certPlatform")}
                  </p>
                </div>

                <div className="py-4 sm:py-8 border-y-2 border-slate-100">
                  <p className="text-lg sm:text-xl text-slate-600 font-medium mb-2 sm:mb-4">{t("certCertifies")}</p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-indigo-600 mb-2 sm:mb-4">{userName}</h2>
                  <p className="text-lg sm:text-xl text-slate-600 font-medium mt-2 sm:mt-4">
                    {t("certSuccessfullyCompleted")}
                  </p>
                </div>

                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#1A172E] mb-8 sm:mb-12">
                    {currentRoadmap?.title || t("certCustomCourseFallback")}
                  </h3>
                    
                  <div className="flex items-center justify-between w-full max-w-2xl mx-auto pt-6 sm:pt-8 border-t-2 border-slate-100 text-left">
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{t("certDateCompleted")}</p>
                      <p className="text-sm sm:text-lg font-bold text-slate-800">{new Date().toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                       
                    <div className="text-right">
                      <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{t("certId")}</p>
                      <p className="text-sm sm:text-lg font-mono font-bold text-slate-800 tracking-wider">{certId}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile View Placeholder */}
            <div className="flex sm:hidden no-print p-8 flex-col items-center justify-center text-center space-y-4 bg-slate-50 flex-1 print:hidden">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-full mb-4">
                 <Trophy className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{t("certMobileReady")}</h3>
              <p className="text-slate-600 text-sm max-w-[280px]">
                {t("certMobileDesc", { title: currentRoadmap?.title || t("certCustomCourseFallback") })}
              </p>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};
