import React, { useEffect, useState } from "react";
import { trpc } from "../lib/trpc-client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { Loader2, Flame, BookOpen, Clock, Target, Award, ArrowUpRight, BarChart2, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AnalyticsDashboard() {
  const { t } = useTranslation("analytics");
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trpc.getLearningMetrics.query()
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load metrics", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-[#8E88AB] font-medium">{t("loadingText", { defaultValue: "Crunching your numbers..." })}</p>
      </div>
    );
  }

  if (!metrics || metrics.activityDataAvailable === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] gap-8 px-4 relative">
        <div className="p-10 bg-gradient-to-b from-[#121021] to-[#0A0914] border border-[#2A2443] rounded-3xl text-center shadow-xl max-w-2xl w-full relative z-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-900/40 to-purple-900/40 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#2A2443]">
            <BarChart2 className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-[#FAF9FD] mb-3">{t("noAnalyticsTitle", { defaultValue: "No Analytics Available Yet" })}</h2>
          <p className="text-[#8E88AB] text-lg leading-relaxed mb-8">
            {t("noAnalyticsDesc", { defaultValue: "Keep learning, chatting with your mentor, and taking quizzes to see your stats here! You don't have any certificates or analytics yet. Complete a course 100% to earn your first certificate." })}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
             <div className="px-5 py-2.5 rounded-xl bg-[#1E1A33] border border-[#2A2443] text-[#8E88AB] text-sm flex items-center gap-2 font-medium shadow-sm">
                <Target className="w-4 h-4 text-emerald-400" /> {t("takeQuizzes", { defaultValue: "Take Quizzes" })}
             </div>
             <div className="px-5 py-2.5 rounded-xl bg-[#1E1A33] border border-[#2A2443] text-[#8E88AB] text-sm flex items-center gap-2 font-medium shadow-sm">
                <Award className="w-4 h-4 text-amber-400" /> {t("earnCertificates", { defaultValue: "Earn Certificates" })}
             </div>
          </div>
        </div>

        {/* Hidden targets strictly for Joyride onboarding flow to prevent TARGET_NOT_FOUND crashes */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-0 flex flex-col justify-between -z-10">
          <div data-tour="analytics-stats" className="w-full h-10"></div>
          <div data-tour="analytics-charts" className="w-full h-10"></div>
          <div data-tour="analytics-certificates-btn" className="w-full h-10"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8 fade-in">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#FAF9FD] tracking-tight font-sans">{t("title", { defaultValue: "Learning Analytics" })}</h1>
          <p className="text-[#8E88AB] mt-1">{t("subtitle", { defaultValue: "Track your progress, consistency, and mastery across all courses." })}</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div data-tour="analytics-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121021] border border-[#2A2443] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-xl group-hover:bg-orange-500/20 transition-all"></div>
          <div className="flex items-center gap-3 mb-2 relative">
            <div className="p-2 bg-orange-950/50 rounded-lg text-orange-400">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="text-[#8E88AB] font-semibold text-sm">{t("currentStreak", { defaultValue: "Current Streak" })}</h3>
          </div>
          <div className="flex items-baseline gap-2 relative">
            <span className="text-3xl font-bold text-[#FAF9FD]">{metrics.currentStreak}</span>
            <span className="text-orange-400 text-sm font-semibold">{t("days", { defaultValue: "Days" })}</span>
          </div>
        </div>

        <div className="bg-[#121021] border border-[#2A2443] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#4F46E5]/10 rounded-full blur-xl group-hover:bg-[#4F46E5]/20 transition-all"></div>
          <div className="flex items-center gap-3 mb-2 relative">
            <div className="p-2 bg-indigo-950/50 rounded-lg text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-[#8E88AB] font-semibold text-sm">{t("lessonsCompleted", { defaultValue: "Lessons Completed" })}</h3>
          </div>
          <div className="flex items-baseline gap-2 relative">
            <span className="text-3xl font-bold text-[#FAF9FD]">{metrics.totalLessonsCompleted}</span>
            <span className="text-indigo-400 text-sm font-semibold">{t("total", { defaultValue: "Total" })}</span>
          </div>
        </div>

        <div className="bg-[#121021] border border-[#2A2443] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex items-center gap-3 mb-2 relative">
            <div className="p-2 bg-emerald-950/50 rounded-lg text-emerald-400">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-[#8E88AB] font-semibold text-sm">{t("avgQuizScore", { defaultValue: "Average Quiz Score" })}</h3>
          </div>
          <div className="flex items-baseline gap-2 relative">
            <span className="text-3xl font-bold text-[#FAF9FD]">{metrics.avgQuizScore}%</span>
            <span className="text-emerald-400 text-sm font-semibold">{t("mastery", { defaultValue: "Mastery" })}</span>
          </div>
        </div>

        <div className="bg-[#121021] border border-[#2A2443] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all"></div>
          <div className="flex items-center gap-3 mb-2 relative">
            <div className="p-2 bg-purple-950/50 rounded-lg text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-[#8E88AB] font-semibold text-sm">{t("timeLogged", { defaultValue: "Time Logged" })}</h3>
          </div>
          <div className="flex items-baseline gap-2 relative">
            <span className="text-3xl font-bold text-[#FAF9FD]">{metrics.totalHours.toFixed(1)}</span>
            <span className="text-purple-400 text-sm font-semibold">{t("hours", { defaultValue: "Hours" })}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div data-tour="analytics-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Weekly Activity */}
        <div className="bg-[#121021] border border-[#2A2443] rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-[#FAF9FD] flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-400" />
              {t("weeklyLessonVolume", { defaultValue: "Weekly Lesson Volume" })}
            </h3>
          </div>
          <div className="h-[250px] w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2443" vertical={false} />
                <XAxis dataKey="name" stroke="#8E88AB" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#8E88AB" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#1E1A33' }}
                  contentStyle={{ backgroundColor: '#1E1A33', borderColor: '#2A2443', borderRadius: '8px', color: '#FAF9FD' }}
                  itemStyle={{ color: '#818CF8' }}
                />
                <Bar name={t("lessonsLegend", { defaultValue: "lessons" })} dataKey="lessons" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>{t("weeklyLessonVolume", { defaultValue: "Weekly Lesson Volume" })}</caption>
            <thead>
              <tr><th>{t("dayHeader", { defaultValue: "Day" })}</th><th>{t("lessonsCompletedHeader", { defaultValue: "Lessons Completed" })}</th></tr>
            </thead>
            <tbody>
              {metrics.activityData.map((d: any) => <tr key={d.name}><td>{d.name}</td><td>{d.lessons}</td></tr>)}
            </tbody>
          </table>
        </div>

        {/* Score Trends */}
        <div className="bg-[#121021] border border-[#2A2443] rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-[#FAF9FD] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              {t("recentQuizPerf", { defaultValue: "Recent Quiz Performance" })}
            </h3>
          </div>
          <div className="h-[250px] w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2443" vertical={false} />
                <XAxis dataKey="name" stroke="#8E88AB" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#8E88AB" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E1A33', borderColor: '#2A2443', borderRadius: '8px', color: '#FAF9FD' }}
                  itemStyle={{ color: '#10B981' }}
                />
                <Line name={t("scoreLegend", { defaultValue: "score" })} type="monotone" dataKey="score" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>{t("recentQuizPerf", { defaultValue: "Recent Quiz Performance" })}</caption>
            <thead>
              <tr><th>{t("dayHeader", { defaultValue: "Day" })}</th><th>{t("scoreHeader", { defaultValue: "Score" })}</th></tr>
            </thead>
            <tbody>
              {metrics.activityData.map((d: any) => <tr key={d.name}><td>{d.name}</td><td>{d.score}%</td></tr>)}
            </tbody>
          </table>
        </div>

      </div>
      
      {/* Achievements or Milestones */}
      <div className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-[#4F46E5]/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#4F46E5]/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#FAF9FD]">{t("courseMastery", { defaultValue: "Course Mastery" })}</h3>
              <p className="text-[#8E88AB] text-sm mt-1">{t("completedCoursesDesc", { defaultValue: `You've fully completed ${metrics.completedCoursesCount} courses so far.`, count: metrics.completedCoursesCount })}</p>
            </div>
          </div>
          <button
            data-tour="analytics-certificates-btn"
            onClick={() => {
              if (metrics.completedCoursesCount === 0) {
                toast.error(t("toastNoCertificates", { defaultValue: "You don't have any certificates yet. Complete a course 100% to earn one! 🏆" }), { duration: 4000 });
              } else {
                toast.success(t("toastViewCertificates", { defaultValue: "To view your certificates, open a completed course and go to its 'My Progress' tab! 🏆" }), { duration: 4000 });
              }
            }}
            className={`px-5 py-2.5 font-semibold rounded-xl transition-colors shadow-lg flex items-center gap-2 ${
              metrics.completedCoursesCount > 0 
                ? "bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-indigo-900/20" 
                : "bg-[#1E1A33] text-[#8E88AB] cursor-not-allowed opacity-70"
            }`}
          >
            {metrics.completedCoursesCount > 0 ? (
              <>{t("viewCertificatesBtn", { defaultValue: "View Certificates" })} <ArrowUpRight className="w-4 h-4" /></>
            ) : (
              t("noCertificatesBtn", { defaultValue: "No certificates available" })
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
