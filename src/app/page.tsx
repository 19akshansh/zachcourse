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

export default function LandingPage() {
  const handleGetStarted = () => {
    navigate("/sign-up");
  };

  const handleSignIn = () => {
    navigate("/sign-in");
  };

  // Testimonials list
  const testimonials = [
    {
      initials: "JD",
      name: "Jordan Davies",
      role: "Self-taught Developer",
      quote: "ZachCourse took the overwhelming Coursera syllabus and turned it into a bite-sized, 6-week daily roadmap. I actually finished a course for the first time in my life!"
    },
    {
      initials: "AM",
      name: "Aisha Miller",
      role: "Career Changer",
      quote: "The adaptive quizzes made sure I actually understood database relations before letting me move forward. The AI mentor felt like having a friendly private tutor 24/7."
    },
    {
      initials: "TL",
      name: "Takahiro Lee",
      role: "Computer Science Student",
      quote: "Being able to paste any textbook syllabus link and get a structured tracking workspace instantly is a superpower. Best companion app out there!"
    }
  ];

  // Features list
  const features = [
    {
      emoji: "🗺️",
      title: "AI Roadmap Builder",
      description: "Generates custom weekly objectives, milestones, and daily tracking lists from any curriculum or outline."
    },
    {
      emoji: "💬",
      title: "Smart Mentor Chat",
      description: "Ask questions, get step-by-step code explanations, or request real-time hints tailored to your active lesson."
    },
    {
      emoji: "🧠",
      title: "Adaptive Quizzes",
      description: "Automatically tests your understanding at each milestone with clear answers and personalized feedback."
    },
    {
      emoji: "📈",
      title: "Progress Tracking",
      description: "Log hours, tick off completed items, earn achievement badges, and watch your daily study streak soar."
    },
    {
      emoji: "📎",
      title: "URL + Text Input",
      description: "Import your course outline by pasting a syllabus link, raw markdown syllabus text, or even a book index."
    },
    {
      emoji: "📚",
      title: "Multi-Course Support",
      description: "Organize your entire learning journey. Switch between multiple courses without losing your progress."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC] font-sans antialiased selection:bg-[#6366F1]/30 selection:text-white overflow-x-hidden">
      
      {/* BACKGROUND ORBS */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#6366F1]/10 to-[#8B5CF6]/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-gradient-to-bl from-[#8B5CF6]/10 to-[#6366F1]/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-1/4 left-1/3 w-[450px] h-[450px] bg-gradient-to-r from-indigo-900/10 to-violet-950/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 w-full border-b border-[#1E1E2E] bg-[#0A0A0F]/80 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
            <span className="text-3xl select-none" id="nav-logo">🎓</span>
            <span className="font-extrabold text-2xl tracking-tight text-[#F8FAFC] hover:text-[#6366F1] transition">
              ZachCourse
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={handleSignIn}
              className="text-xs sm:text-sm font-bold text-[#94A3B8] hover:text-[#F8FAFC] px-2.5 sm:px-3.5 py-2 rounded-xl hover:bg-[#1E1E2E]/50 transition cursor-pointer shrink-0"
            >
              Sign In
            </button>
            <button
              onClick={handleGetStarted}
              className="text-xs sm:text-sm font-extrabold bg-[#6366F1] hover:bg-[#4F46E5] text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl cursor-pointer transition shadow-lg shadow-indigo-600/20 active:scale-95 shrink-0"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Badge */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/5 text-xs text-[#818CF8] font-bold tracking-wide uppercase mb-8"
          style={{ boxShadow: "0 0 15px rgba(99,102,241,0.1)" }}
        >
          <span className="flex h-2 w-2 rounded-full bg-[#6366F1] animate-ping" />
          <span>🎓 Built for serious learners</span>
        </motion.div>

        {/* Heading */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-black text-[#F8FAFC] tracking-tight leading-[1.1] max-w-4xl"
        >
          Turn Any Course Into a <br />
          <span className="bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent drop-shadow-sm">
            Personal Learning Roadmap
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl text-[#94A3B8] font-medium leading-relaxed max-w-3xl mt-6"
        >
          Paste a course URL or topic, and ZachCourse builds a week-by-week plan tailored to your schedule, tests your knowledge, and keeps you on track.
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
            className="w-full sm:w-auto text-base font-extrabold bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5053e3] hover:to-[#4338CA] text-white px-8 py-4 rounded-2xl cursor-pointer transition-all shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>Start Learning Free</span>
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
          No credit card needed • Free forever plan • 2 min setup
        </motion.p>

        {/* HERO VISUAL MOCKUP */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="w-full max-w-5xl mt-16 relative"
        >
          {/* Subtle Glow Behind Mockup */}
          <div className="absolute inset-0 bg-[#6366F1]/10 rounded-3xl blur-3xl -z-10 transform scale-95" />

          {/* simulated dashboard container */}
          <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-5 md:p-8 text-left shadow-2xl relative overflow-hidden"
               style={{ boxShadow: "0 0 50px rgba(99,102,241,0.08)" }}>
            
            {/* Top window dots */}
            <div className="flex items-center justify-between border-b border-[#1E1E2E] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-rose-500 rounded-full opacity-60"></span>
                <span className="w-3 h-3 bg-amber-500 rounded-full opacity-60"></span>
                <span className="w-3 h-3 bg-emerald-500 rounded-full opacity-60"></span>
                <span className="text-xs text-[#94A3B8]/40 font-mono ml-3">roadmap_core_v1.config</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#10B981] bg-emerald-950/20 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                <span>Active study block</span>
              </div>
            </div>

            {/* Simulated Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left sidebar: Timeline */}
              <div className="lg:col-span-1 space-y-4">
                <div className="p-4 bg-[#1A1A2E]/50 border border-[#1E1E2E] rounded-2xl">
                  <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider mb-2">My Active Course</p>
                  <h4 className="text-base font-extrabold text-[#F8FAFC]">Advanced Machine Learning</h4>
                  <div className="mt-4 flex items-center justify-between text-xs text-[#94A3B8]">
                    <span>Weekly progress</span>
                    <span className="text-[#10B981] font-bold">66% Done</span>
                  </div>
                  <div className="w-full bg-[#1E1E2E] h-2 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] h-full w-[66%]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#94A3B8]/50 uppercase tracking-wider pl-1">Course Milestones</p>
                  
                  <div className="flex items-center gap-3 p-3 bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-xl">
                    <span className="text-sm bg-[#6366F1] text-white font-extrabold h-6 w-6 rounded-full flex items-center justify-center">1</span>
                    <div className="text-left">
                      <p className="text-xs text-white font-bold">Week 1: Fundamentals</p>
                      <p className="text-[10px] text-[#818CF8] font-semibold">Completed • 4 Lessons</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl opacity-90">
                    <span className="text-sm bg-[#1E1E2E] text-[#94A3B8] font-extrabold h-6 w-6 rounded-full flex items-center justify-center">2</span>
                    <div className="text-left">
                      <p className="text-xs text-[#F8FAFC] font-bold">Week 2: Neural Nets</p>
                      <p className="text-[10px] text-[#10B981] font-semibold">In Progress • Quiz Unlocked</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-[#1A1A2E]/40 border border-transparent rounded-xl opacity-60">
                    <span className="text-sm bg-[#1E1E2E] text-[#94A3B8] font-extrabold h-6 w-6 rounded-full flex items-center justify-center">3</span>
                    <div className="text-left">
                      <p className="text-xs text-[#94A3B8] font-bold">Week 3: Deep Architectures</p>
                      <p className="text-[10px] text-[#94A3B8]/60 font-semibold">Locked • 5 Lessons</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right area: Active Lesson Workspace */}
              <div className="lg:col-span-2 bg-[#1A1A2E]/30 border border-[#1E1E2E] rounded-2xl p-5 md:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-[#6366F1]/10 text-[#818CF8] text-[10px] font-extrabold uppercase tracking-widest py-1 px-2.5 rounded-md border border-[#6366F1]/20">
                      Lesson 2.3
                    </span>
                    <span className="text-xs text-[#94A3B8] font-semibold">Backpropagation Demystified</span>
                  </div>

                  <h3 className="text-xl font-bold text-[#F8FAFC] tracking-tight">Understanding Error Gradients and Chain Rule</h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed mt-2.5">
                    To compute updates for deeper layers, we apply the chain rule of calculus to find how loss changes in response to each connection weight...
                  </p>

                  <div className="mt-5 p-4 bg-[#111118] border border-[#1E1E2E] rounded-xl flex items-start gap-3">
                    <span className="text-xl mt-0.5 select-none">💬</span>
                    <div>
                      <p className="text-xs text-[#818CF8] font-bold">AI Companion Mentor:</p>
                      <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                        “Think of error propagation like distributing grades in a group project: we trace backwards to see exactly who contributed to each final result!”
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1E1E2E] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#10B981] font-semibold">
                    <span className="p-1 rounded-full bg-emerald-500/10 text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span>Ready for Weekly Quiz check</span>
                  </div>
                  <button className="text-xs bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-2 px-4 rounded-xl shadow-md transition cursor-pointer">
                    Take Quiz (10 Questions) →
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
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6366F1]">Methodology</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight mt-3">
              From lost to on-track in 3 steps
            </p>
            <p className="text-[#94A3B8] text-sm sm:text-base max-w-xl mx-auto mt-3 font-medium">
              We bridge the gap between bookmarking learning content and actually understanding it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 relative overflow-hidden group hover:border-[#6366F1]/30 transition-all duration-300">
              <span className="absolute top-4 right-6 text-6xl font-black text-indigo-950/40 select-none">01</span>
              <div className="text-4xl mb-6 select-none">📎</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Paste a course or topic</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed mt-3 font-medium">
                Provide a website URL, a syllabus text, a chapter list, or simply type the name of a subject you want to master from scratch.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 relative overflow-hidden group hover:border-[#6366F1]/30 transition-all duration-300">
              <span className="absolute top-4 right-6 text-6xl font-black text-indigo-950/40 select-none">02</span>
              <div className="text-4xl mb-6 select-none">🗺️</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Get your personal roadmap</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed mt-3 font-medium">
                Our AI engine instantly slices the content into structured, manageable weekly goals, lesson targets, and actionable checklists.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 relative overflow-hidden group hover:border-[#6366F1]/30 transition-all duration-300">
              <span className="absolute top-4 right-6 text-6xl font-black text-indigo-950/40 select-none">03</span>
              <div className="text-4xl mb-6 select-none">🧠</div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Learn, quiz, and track</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed mt-3 font-medium">
                Talk to your built-in AI tutor to explain tricky modules, pass interactive concept quizzes, and rack up daily habit streaks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID SECTION */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-xs font-black uppercase tracking-widest text-[#8B5CF6]">Features</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight mt-3">
            Every tool you need to stick with it
          </p>
          <p className="text-[#94A3B8] text-sm sm:text-base max-w-xl mx-auto mt-3 font-medium">
            No bloated tools. Only simple, powerful study mechanics designed to build daily academic discipline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="bg-[#111118] border border-[#1E1E2E] p-6.5 rounded-2xl transition-all duration-300 hover:border-[#6366F1]/40 hover:-translate-y-1 group"
              style={{ boxShadow: "hover: 0 4px 20px rgba(99,102,241,0.05)" }}
            >
              <div className="text-3xl mb-4 select-none bg-[#1A1A2E] w-12 h-12 rounded-xl flex items-center justify-center border border-[#1E1E2E] group-hover:border-[#6366F1]/20 group-hover:bg-[#6366F1]/5 transition-all">
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
          <h2 className="text-xs font-black uppercase tracking-widest text-[#6366F1]">Testimonials</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight mt-3">
            Loved by learners worldwide
          </p>
          <p className="text-[#94A3B8] text-sm sm:text-base max-w-lg mx-auto mt-3 font-medium">
            See how self-motivated developers, students, and professionals complete curriculum goals.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 text-left">
            {testimonials.map((test, index) => (
              <div 
                key={index}
                className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-7 relative"
              >
                <p className="text-sm text-[#F8FAFC] leading-relaxed font-medium italic mb-6">
                  “{test.quote}”
                </p>
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-xs text-white font-extrabold shadow-md">
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
              Join <span className="text-[#6366F1]">2,400+ learners</span> already on track
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#6366F1]/5 rounded-3xl blur-3xl pointer-events-none transform -translate-y-12"></div>
        
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-[#111118] to-[#0A0A0F] border border-[#1E1E2E] rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
             style={{ boxShadow: "0 0 50px rgba(99,102,241,0.12)" }}>
          
          {/* subtle inside gradient accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#6366F1]/10 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F8FAFC] tracking-tight relative">
            Ready to actually finish that course?
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8] max-w-xl mx-auto mt-4 font-medium relative">
            Stop collecting unread bookmarks. Build your custom week-by-week roadmap, sync your study goals, and master your subjects.
          </p>

          <div className="mt-10 relative flex justify-center">
            <button
              onClick={handleGetStarted}
              className="w-full sm:w-auto text-base font-extrabold bg-[#6366F1] hover:bg-[#4F46E5] text-white px-10 py-4 rounded-xl cursor-pointer transition shadow-xl shadow-indigo-600/30 active:scale-95"
            >
              Get Started Free
            </button>
          </div>

          <p className="text-[10px] font-bold text-[#94A3B8]/50 mt-4 uppercase tracking-wider relative">
            Free plan includes 1 active course and 3 quizzes/week
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#1E1E2E] bg-[#0A0A0F] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl select-none">🎓</span>
            <span className="text-sm font-bold text-[#FAF9FD] tracking-tight">
              © 2026 ZachCourse
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#94A3B8] font-semibold">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#FAF9FD] transition flex items-center gap-1">
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>Built for Google x Kaggle AI Agents 2026</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
