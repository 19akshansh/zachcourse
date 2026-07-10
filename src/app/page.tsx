import React from "react";
import { motion } from "motion/react";
import { 
  ArrowRight, 
  Map, 
  MessageSquare, 
  CheckCircle, 
  TrendingUp, 
  Link, 
  Sparkles, 
  Check, 
  ShieldCheck, 
  FileText, 
  Layers, 
  BookOpen, 
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { navigate } from "../lib/router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export default function LandingPage() {
  const { t } = useTranslation(["landing"]);

  const handleGetStarted = () => {
    navigate("/sign-up");
  };

  const handleSignIn = () => {
    navigate("/sign-in");
  };

  // Testimonials list
  const testimonials = t("testimonials", { returnObjects: true }) as Array<{
    initials: string;
    name: string;
    role: string;
    quote: string;
  }>;

  // Features list
  const features = t("features", { returnObjects: true }) as Array<{
    emoji: string;
    title: string;
    description: string;
  }>;

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] text-[#F8FAFC] font-sans antialiased selection:bg-[#4F46E5]/30 selection:text-white overflow-x-hidden">
      
      {/* BACKGROUND ORBS */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#4F46E5]/10 to-[#8B5CF6]/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-gradient-to-bl from-[#8B5CF6]/10 to-[#4F46E5]/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-1/4 left-1/3 w-[450px] h-[450px] bg-gradient-to-r from-indigo-900/10 to-violet-950/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 w-full border-b border-[#1E1E2E] bg-[#0A0A0F]/80 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
            <span className="text-3xl select-none" id="nav-logo">🎓</span>
            <span className="font-extrabold text-2xl tracking-tight text-[#F8FAFC] hover:text-[#4F46E5] transition">
              {t("logo")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={handleSignIn}
              className="text-xs sm:text-sm font-bold text-[#94A3B8] hover:text-[#F8FAFC] px-2.5 sm:px-3.5 py-2 rounded-xl hover:bg-[#1E1E2E]/50 transition cursor-pointer shrink-0"
            >
              {t("signIn")}
            </button>
            <button
              onClick={handleGetStarted}
              className="text-xs sm:text-sm font-extrabold bg-[#4F46E5] hover:bg-[#4338CA] text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl cursor-pointer transition shadow-lg shadow-[#4F46E5]/20 active:scale-95 shrink-0"
            >
              {t("getStartedFree")}
            </button>
          </div>
        </div>
      </header>

      <main>
      {/* HERO SECTION */}
      <section className="relative pt-20 pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Badge */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#4F46E5]/30 bg-[#4F46E5]/5 text-xs text-[#818CF8] font-bold tracking-wide uppercase mb-8"
          style={{ boxShadow: "0 0 15px rgba(99,102,241,0.1)" }}
        >
          <span className="flex h-2 w-2 rounded-full bg-[#4F46E5] animate-ping" />
          <span>{t("heroBadge")}</span>
        </motion.div>

        {/* Heading */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-black text-[#F8FAFC] tracking-tight leading-[1.1] max-w-4xl"
        >
          {t("heroTitlePart1")} <br />
          <span className="bg-gradient-to-r from-[#4F46E5] via-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent drop-shadow-sm">
            {t("heroTitlePart2")}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl text-[#94A3B8] font-medium leading-relaxed max-w-3xl mt-6"
        >
          {t("heroSubtitle")}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-10 w-full justify-center"
        >
          <button
            onClick={handleGetStarted}
            className="w-full sm:w-auto text-base font-extrabold bg-gradient-to-r from-[#4F46E5] to-[#4338CA] hover:from-[#4338CA] hover:to-[#4338CA] text-white px-8 py-4 rounded-2xl cursor-pointer transition-all shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>{t("startLearningFree")}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Micro-guarantees */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-xs font-bold text-[#94A3B8]/60 mt-4 tracking-wide uppercase"
        >
          {t("noCreditCard")}
        </motion.p>

        {/* HERO VISUAL MOCKUP */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="w-full max-w-5xl mt-16 relative"
        >
          {/* Subtle Glow Behind Mockup */}
          <div className="absolute inset-0 bg-[#4F46E5]/10 rounded-3xl blur-3xl -z-10 transform scale-95" />

          {/* simulated dashboard container */}
          <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-5 md:p-8 text-left shadow-2xl relative overflow-hidden"
               style={{ boxShadow: "0 0 50px rgba(99,102,241,0.08)" }}>
            
            {/* Top window dots */}
            <div className="flex items-center justify-between border-b border-[#1E1E2E] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#10B981] bg-emerald-950/20 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                <span>{t("activeStudyBlock")}</span>
              </div>
            </div>

            {/* Simulated Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left sidebar: Timeline */}
              <div className="lg:col-span-1 space-y-4">
                <div className="p-4 bg-[#1A1A2E]/50 border border-[#1E1E2E] rounded-2xl">
                  <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider mb-2">{t("myActiveCourse")}</p>
                  <h4 className="text-base font-extrabold text-[#F8FAFC]">{t("advancedMachineLearning", { defaultValue: "Advanced Machine Learning" })}</h4>
                  <div className="mt-4 flex items-center justify-between text-xs text-[#94A3B8]">
                    <span>{t("weeklyProgress")}</span>
                    <span className="text-[#10B981] font-bold">{t("percentDone", { count: 66 })}</span>
                  </div>
                  <div className="w-full bg-[#1E1E2E] h-2 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] h-full w-[66%]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#94A3B8]/50 uppercase tracking-wider pl-1">{t("courseMilestones")}</p>
                  
                  <div className="flex items-center gap-3 p-3 bg-[#4F46E5]/10 border border-[#4F46E5]/30 rounded-xl">
                    <span className="text-sm bg-[#4F46E5] text-white font-extrabold h-6 w-6 rounded-full flex items-center justify-center">1</span>
                    <div className="text-left">
                      <p className="text-xs text-white font-bold">{t("week1Fundamentals")}</p>
                      <p className="text-[10px] text-[#818CF8] font-semibold">{t("completedLessons")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl opacity-90">
                    <span className="text-sm bg-[#1E1E2E] text-[#94A3B8] font-extrabold h-6 w-6 rounded-full flex items-center justify-center">2</span>
                    <div className="text-left">
                      <p className="text-xs text-[#F8FAFC] font-bold">{t("week2NeuralNets")}</p>
                      <p className="text-[10px] text-[#10B981] font-semibold">{t("inProgressQuizUnlocked")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-[#1A1A2E]/40 border border-transparent rounded-xl opacity-60">
                    <span className="text-sm bg-[#1E1E2E] text-[#94A3B8] font-extrabold h-6 w-6 rounded-full flex items-center justify-center">3</span>
                    <div className="text-left">
                      <p className="text-xs text-[#94A3B8] font-bold">{t("week3DeepArchitectures")}</p>
                      <p className="text-[10px] text-[#94A3B8]/60 font-semibold">{t("lockedLessons")}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right area: Active Lesson Workspace */}
              <div className="lg:col-span-2 bg-[#1A1A2E]/30 border border-[#1E1E2E] rounded-2xl p-5 md:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-[#4F46E5]/10 text-[#818CF8] text-[10px] font-extrabold uppercase tracking-widest py-1 px-2.5 rounded-md border border-[#4F46E5]/20">
                      {t("lesson23")}
                    </span>
                    <span className="text-xs text-[#94A3B8] font-semibold">{t("backpropagationDemystified")}</span>
                  </div>

                  <h3 className="text-xl font-bold text-[#F8FAFC] tracking-tight">{t("understandingErrorGradients")}</h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed mt-2.5">
                    {t("understandingErrorGradientsDesc")}
                  </p>

                  <div className="mt-5 p-4 bg-[#111118] border border-[#1E1E2E] rounded-xl flex items-start gap-3">
                    <span className="text-xl mt-0.5 select-none">💬</span>
                    <div>
                      <p className="text-xs text-[#818CF8] font-bold">{t("aiCompanionMentor")}</p>
                      <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                        {t("aiMentorQuote")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1E1E2E] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#10B981] font-semibold">
                    <span className="p-1 rounded-full bg-emerald-500/10 text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span>{t("readyForWeeklyQuiz")}</span>
                  </div>
                  <button className="text-xs bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-2 px-4 rounded-xl shadow-md transition cursor-pointer">
                    {t("takeQuiz")}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-24 px-6 border-y border-[#1E1E2E] bg-[#111118]/20 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#4F46E5]">{t("methodology")}</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight mt-3">
              {t("howItWorksPart1")}
            </p>
            <p className="text-[#94A3B8] text-sm sm:text-base max-w-xl mx-auto mt-3 font-medium">
              {t("howItWorksPart2")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 relative overflow-hidden group hover:border-[#4F46E5]/30 transition-all duration-300">
              <span className="absolute top-4 right-6 text-6xl font-black text-indigo-950/40 select-none">01</span>
              <div className="text-4xl mb-6 select-none">📎</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">{t("howItWorksStep1Title")}</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed mt-3 font-medium">
                {t("howItWorksStep1Desc")}
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 relative overflow-hidden group hover:border-[#4F46E5]/30 transition-all duration-300">
              <span className="absolute top-4 right-6 text-6xl font-black text-indigo-950/40 select-none">02</span>
              <div className="text-4xl mb-6 select-none">🗺️</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">{t("howItWorksStep2Title")}</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed mt-3 font-medium">
                {t("howItWorksStep2Desc")}
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 relative overflow-hidden group hover:border-[#4F46E5]/30 transition-all duration-300">
              <span className="absolute top-4 right-6 text-6xl font-black text-indigo-950/40 select-none">03</span>
              <div className="text-4xl mb-6 select-none">🧠</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">{t("howItWorksStep3Title")}</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed mt-3 font-medium">
                {t("howItWorksStep3Desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID SECTION */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-xs font-black uppercase tracking-widest text-[#8B5CF6]">{t("featuresBadge")}</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight mt-3">
            {t("featuresTitle")}
          </p>
          <p className="text-[#94A3B8] text-sm sm:text-base max-w-xl mx-auto mt-3 font-medium">
            {t("featuresSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features && features.map((feat, idx) => (
            <div
              key={idx}
              className="bg-[#111118] border border-[#1E1E2E] p-6.5 rounded-2xl transition-all duration-300 hover:border-[#4F46E5]/40 hover:-translate-y-1 group"
              style={{ boxShadow: "hover: 0 4px 20px rgba(99,102,241,0.05)" }}
            >
              <div className="text-3xl mb-4 select-none bg-[#1A1A2E] w-12 h-12 rounded-xl flex items-center justify-center border border-[#1E1E2E] group-hover:border-[#4F46E5]/20 group-hover:bg-[#4338CA]/5 transition-all">
                {feat.emoji}
              </div>
              <h3 className="text-base font-extrabold text-[#F8FAFC] tracking-tight">{feat.title}</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed mt-2.5 font-medium">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF / TESTIMONIALS */}
      <section className="py-24 px-6 border-t border-[#1E1E2E] bg-[#111118]/10 relative">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-xs font-black uppercase tracking-widest text-[#4F46E5]">{t("testimonialsBadge")}</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight mt-3">
            {t("testimonialsTitle")}
          </p>
          <p className="text-[#94A3B8] text-sm sm:text-base max-w-lg mx-auto mt-3 font-medium">
            {t("testimonialsSubtitle")}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 text-left">
            {testimonials && testimonials.map((test, index) => (
              <div 
                key={index}
                className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-7 relative"
              >
                <p className="text-sm text-[#F8FAFC] leading-relaxed font-medium italic mb-6">
                  “{test.quote}”
                </p>
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#8B5CF6] flex items-center justify-center text-xs text-white font-extrabold shadow-md">
                    {test.initials}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#F8FAFC]">{test.name}</h4>
                    <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider">{test.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overlapping Avatars indicator */}
          <div className="mt-16 flex flex-col items-center justify-center gap-3">
            <div className="flex items-center justify-center -space-x-3">
              {["🎓", "🧠", "☕", "💻", "💡"].map((emoji, i) => (
                <div 
                  key={i} 
                  className="w-9 h-9 rounded-full border-2 border-[#0A0A0F] bg-gradient-to-tr from-[#1E1E2E] to-[#111118] flex items-center justify-center text-xs select-none shadow-md"
                >
                  {emoji}
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-[#94A3B8] tracking-wide uppercase">
              {t("joinLearners")}
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#4F46E5]/5 rounded-3xl blur-3xl pointer-events-none transform -translate-y-12"></div>
        
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-[#111118] to-[#0A0A0F] border border-[#1E1E2E] rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
             style={{ boxShadow: "0 0 50px rgba(99,102,241,0.12)" }}>
          
          {/* subtle inside gradient accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#4F46E5]/10 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F8FAFC] tracking-tight relative">
            {t("readyToFinish")}
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8] max-w-xl mx-auto mt-4 font-medium relative">
            {t("readyToFinishDesc")}
          </p>

          <div className="mt-10 relative flex justify-center">
            <button
              onClick={handleGetStarted}
              className="w-full sm:w-auto text-base font-extrabold bg-[#4F46E5] hover:bg-[#4338CA] text-white px-10 py-4 rounded-xl cursor-pointer transition shadow-xl shadow-indigo-600/30 active:scale-95"
            >
              {t("getStartedFree")}
            </button>
          </div>

          <p className="text-[10px] font-bold text-[#94A3B8]/50 mt-4 uppercase tracking-wider relative">
            {t("freePlanIncludes")}
          </p>
        </div>
      </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1E1E2E] bg-[#0A0A0F] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl select-none">🎓</span>
            <span className="text-sm font-bold text-[#FAF9FD] tracking-tight">
              © 2026 {t("logo")}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSwitcher buttonClassName="hover:text-[#FAF9FD] transition flex items-center gap-1 text-xs text-[#94A3B8] font-semibold" />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#94A3B8] font-semibold">
            <a href="https://github.com/19akshansh/zachcourse" target="_blank" rel="noopener noreferrer" className="hover:text-[#FAF9FD] transition flex items-center gap-1">
              <span>{t("github")}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://www.kaggle.com/competitions/vibecoding-agents-capstone-project/writeups/zachcourse" target="_blank" rel="noopener noreferrer" className="hover:text-[#FAF9FD] transition flex items-center gap-1">
              <span>{t("kaggleSubmission")}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://www.kaggle.com/competitions/5-day-ai-agents-intensive-vibecoding-course-with-google/overview" target="_blank" rel="noopener noreferrer" className="hover:text-[#FAF9FD] transition flex items-center gap-1">
              <span>{t("builtForGoogle")}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
