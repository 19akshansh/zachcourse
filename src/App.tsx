import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSession, signIn, signUp, signOut, authClient } from "./lib/auth-client";
import { trpc } from "./lib/trpc-client";
import { usePath, navigate } from "./lib/router";
import SignInPage from "./app/(auth)/sign-in/page";
import SignUpPage from "./app/(auth)/sign-up/page";
import ForgotPasswordPage from "./app/(auth)/forgot-password/page";
import ResetPasswordPage from "./app/(auth)/reset-password/page";
import VerifyEmailPage from "./app/(auth)/verify-email/page";
import LandingPage from "./app/page";
import { callGemini } from "./lib/gemini-client";
import AppSidebar, { CourseListItem } from "./components/AppSidebar";
import AppHeader from "./components/AppHeader";
import { apiFetch } from "./lib/api";
import { ApiKeyOnboarding } from "./components/ApiKeyOnboarding";
import RoadmapGraph from "./components/RoadmapGraph";
import VisualRoadmapsTab from "./components/VisualRoadmapsTab";
import { PersonalizationFields } from "./components/PersonalizationFields";
import { TONE_INSTRUCTIONS, LANGUAGE_INSTRUCTIONS } from "./lib/tone-options";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import CohortsDashboard from "./components/CohortsDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import { DocumentUpload } from "./components/DocumentUpload";
import { QuizRunner } from "./components/QuizRunner";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { PublicCertificatePage } from "./components/PublicCertificatePage";
import { MentorChat } from "./components/MentorChat";
import { toast, Toaster } from "sonner";
import { 
  BookOpen, 
  Map, 
  Award, 
  ChevronRight, 
  Sparkles, 
  CheckCircle, 
  Circle, 
  ArrowRight, 
  Check, 
  Loader2, 
  RefreshCw,
  Search,
  MessageSquare,
  Send,
  HelpCircle,
  Clock,
  Link,
  ChevronDown,
  ChevronUp,
  Flame,
  Star,
  Compass,
  Trophy,
  Smile,
  FileText
} from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Types
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

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Quiz {
  questions: QuizQuestion[];
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  text?: string;
  content?: string;
  courseId?: string;
  createdAt?: Date;
}

// Warm Default Companion Course
const PRELOADED_ROADMAP: Roadmap = {
  title: "Mastering Python & Smart Software Creation",
  description: "A friendly, welcoming path to writing beautiful code, designing intelligent programs, and bringing your ideas to life.",
  difficulty: "Beginner Friendly",
  modules: [
    {
      id: "m1_basics",
      title: "Step 1: Your First Steps with Python",
      description: "Learn how programs think, save information, and make smart decisions automatically.",
      lessons: [
        {
          id: "m1_l1_types",
          title: "Variables and Making Sense of Data",
          duration: "15 mins",
          concepts: ["Saving values", "How Python stores info", "Keeping data neat"]
        },
        {
          id: "m1_l2_async",
          title: "Asynchronous Coding (Multi-Tasking)",
          duration: "20 mins",
          concepts: ["What is async?", "Making tasks run together", "Cooperative scheduling"]
        }
      ]
    },
    {
      id: "m2_agents",
      title: "Step 2: Smart Digital Assistants",
      description: "Discover how we can teach programs to think step-by-step and use digital tools.",
      lessons: [
        {
          id: "m2_l1_arch",
          title: "Introduction to Smart Assistants",
          duration: "15 mins",
          concepts: ["Assistant architecture", "Giving helpful instructions", "Remembering context"]
        },
        {
          id: "m2_l2_tools",
          title: "Teaching Assistants to Use Tools",
          duration: "25 mins",
          concepts: ["Defining custom skills", "Structuring answers", "Taking actions"]
        }
      ]
    },
    {
      id: "m3_production",
      title: "Step 3: Storing Memories & Building Apps",
      description: "Help your programs remember things forever and serve millions of learners.",
      lessons: [
        {
          id: "m3_l1_fastapi",
          title: "Building Warm Interactive App Gates",
          duration: "20 mins",
          concepts: ["Connecting apps", "Receiving user requests", "Sending friendly replies"]
        },
        {
          id: "m3_l2_db",
          title: "Smart Memory Storage",
          duration: "20 mins",
          concepts: ["Saving progress", "Remembering student sessions", "Smart caching"]
        }
      ]
    }
  ]
};

const MOTIVATIONAL_QUOTES = [
  "Learning is a beautiful journey, and you are doing amazing! 🌟",
  "Every small step brings you closer to your big dreams. Keep shining! ✨",
  "Your potential is endless. Let's learn something wonderful today! 📚",
  "Errors are just happy little proofs that you are trying! 🧡",
  "Mistakes help our brains grow bigger and stronger. You got this! 💪",
  "Curiosity is the spark behind every great discovery. Keep exploring! 🧭"
];

import { TourController } from "./components/tour/TourController";

function formatJsonLessonToMarkdown(content: string): string {
  if (!content) return "";
  const trimmed = content.trim();
  
  // Check if it looks like JSON
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) || 
    trimmed.includes('"core_concepts_breakdown"') || 
    trimmed.includes('"introduction"') ||
    trimmed.includes('"lesson_title"')
  ) {
    try {
      let jsonStr = trimmed;
      // Extract from markdown code blocks if the AI wrapped the JSON in them
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }
      const data = JSON.parse(jsonStr);
      
      let markdown = "";
      if (data.lesson_title || data.study_guide_title) {
        markdown += `# ${data.study_guide_title || data.lesson_title}\n\n`;
      }
      
      if (data.introduction) {
        markdown += `### 💡 Introduction\n${data.introduction}\n\n`;
      }
      
      if (data.analogy) {
        if (typeof data.analogy === "string") {
          markdown += `### 🎭 Analogy\n${data.analogy}\n\n`;
        } else if (typeof data.analogy === "object" && data.analogy) {
          markdown += `### 🎭 Analogy: ${data.analogy.title || ""}\n${data.analogy.description || ""}\n\n`;
        }
      }
      
      if (Array.isArray(data.core_concepts_breakdown)) {
        markdown += `### 🚀 Core Concepts Breakdown\n\n`;
        data.core_concepts_breakdown.forEach((concept: any, idx: number) => {
          if (typeof concept === "string") {
            markdown += `#### ${idx + 1}. ${concept}\n\n`;
          } else if (typeof concept === "object" && concept) {
            markdown += `#### ${concept.title || `Concept ${idx + 1}`}\n${concept.description || ""}\n\n`;
          }
        });
      } else if (data.core_concepts_breakdown && typeof data.core_concepts_breakdown === "object") {
        markdown += `### 🚀 Core Concepts Breakdown\n\n`;
        Object.entries(data.core_concepts_breakdown).forEach(([key, val]: [string, any]) => {
          markdown += `#### ${key}\n${typeof val === "string" ? val : JSON.stringify(val)}\n\n`;
        });
      }
      
      if (data.code_example) {
        markdown += `### 🛠️ Practice Example\n\n`;
        if (typeof data.code_example === "string") {
          markdown += data.code_example.includes("```") ? data.code_example : `\`\`\`python\n${data.code_example}\n\`\`\``;
        } else if (typeof data.code_example === "object" && data.code_example) {
          if (data.code_example.title) markdown += `#### ${data.code_example.title}\n`;
          if (data.code_example.explanation) markdown += `${data.code_example.explanation}\n\n`;
          if (data.code_example.code) {
            const codeContent = data.code_example.code;
            markdown += codeContent.includes("```") ? codeContent : `\`\`\`python\n${codeContent}\n\`\`\`\n\n`;
          }
        }
        markdown += "\n";
      }
      
      if (Array.isArray(data.key_takeaways)) {
        markdown += `### 📈 Key Takeaways\n`;
        data.key_takeaways.forEach((takeaway: any) => {
          markdown += `- ${takeaway}\n`;
        });
        markdown += "\n";
      } else if (typeof data.key_takeaways === "string") {
        markdown += `### 📈 Key Takeaways\n${data.key_takeaways}\n\n`;
      }
      
      if (markdown.trim()) {
        return markdown;
      }
    } catch (e) {
      console.error("Failed to parse lesson content JSON:", e);
    }
  }
  return content;
}

async function translateWithRetry(
  params: { type?: "roadmap" | "quiz" | "vroadmap"; content: any; language: string },
  userKey: string,
  retries = 2,
  delayMs = 1500
): Promise<any> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch("/api/translate-lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-key": userKey,
        },
        body: JSON.stringify(params),
      });

      if (response.status === 403) {
        window.dispatchEvent(new CustomEvent("zc-quota-exceeded"));
        throw new Error("API_KEY_INVALID");
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.content;
    } catch (err: any) {
      lastError = err;
      if (err.message === "API_KEY_INVALID") {
        throw err;
      }
      console.warn(`Translation attempt ${attempt} failed:`, err);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError || new Error("Translation failed after retries");
}

export default function App() {
  const { t, i18n } = useTranslation(["common", "roadmap", "progressDashboard"]);
  const { data: sessionData, isPending: isSessionPending, refetch: refetchSession } = useSession();
  const path = usePath();

  useEffect(() => {
    if (isSessionPending) return;
    
    const authPaths = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email"];
    const isAuthPath = authPaths.some(p => path.startsWith(p));
    
    if (path.startsWith("/api")) return null;
    
    if (!sessionData?.user) {
      // Not logged in — redirect to sign-in if on protected route
      const isCertificatePath = path === "/certificate" || path.startsWith("/certificate/");
      if (!isAuthPath && path !== "/" && !isCertificatePath) {
        window.location.href = "/sign-in";
      }
    } else {
      // Logged in — redirect away from auth pages
      const preventLoggedPaths = ["/sign-in", "/sign-up", "/forgot-password"];
      const isPreventLoggedPath = preventLoggedPaths.some(p => path.startsWith(p));
      if (isPreventLoggedPath || path === "/") {
        window.location.href = "/dashboard";
      }
    }
  }, [sessionData, isSessionPending, path]);

  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");

  useEffect(() => {
    const handleQuota = () => {
      localStorage.removeItem("zc_user_key");
      setHasKey(false);
      toast.error(t("toast.apiKeyQuotaExceededCheckYourUsageAtAistudiogooglecom", { defaultValue: "API Key is missing or invalid! Please provide a new key." }));
    };
    window.addEventListener("zc-quota-exceeded", handleQuota);
    return () => window.removeEventListener("zc-quota-exceeded", handleQuota);
  }, []);


  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");


  
  // User DB Progress
  const [userDbProgress, setUserDbProgress] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<string>("roadmap");
  const [quoteIndex, setQuoteIndex] = useState<number>(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zc_sidebar");
      if (saved !== null) return saved === "true";
      return window.innerWidth < 768;
    }
    return false;
  });

  const handleSignOut = async () => {
    await signOut();
    document.cookie = "zc_guest_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    window.location.href = "/";
  };

  // Course management states
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeCourse, setActiveCourse] = useState<any | null>(null);
  const [reloadCourseTrigger, setReloadCourseTrigger] = useState<number>(0);
  const [isForceRetranslating, setIsForceRetranslating] = useState<boolean>(false);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);
  const lastActiveCourseIdRef = useRef<string | null>(null);

  // Visual Roadmaps states
  const [vroadmaps, setVRoadmaps] = useState<any[]>([]);
  const [vroadmapsPage, setVroadmapsPage] = useState(1);
  const [vroadmapsTotalPages, setVroadmapsTotalPages] = useState(1);
  const [activeVRoadmapId, setActiveVRoadmapId] = useState<string | null>(null);

  // Load visual roadmaps on mount, page change and language change
  useEffect(() => {
    if (!sessionData?.user) return;
    trpc.getVisualRoadmaps.query({ page: vroadmapsPage, pageSize: 6, language: i18n.language }).then(data => {
      if (Array.isArray(data)) {
        setVRoadmaps(data);
      } else {
        setVRoadmaps(data.items);
        setVroadmapsTotalPages(data.totalPages);
      }
    }).catch(console.error);
  }, [sessionData, vroadmapsPage, i18n.language]);

  // Load, fetch, or translate full visual roadmap when activeVRoadmapId or language changes
  useEffect(() => {
    if (!activeVRoadmapId || !sessionData?.user) return;
    
    let cancelled = false;

    const loadAndTranslateVR = async () => {
      setIsRetranslatingVRoadmap(true);
      try {
        const currentLang = i18n.language;
        const roadmap = await trpc.getVisualRoadmap.query({ id: activeVRoadmapId, language: currentLang });
        if (cancelled) return;
        
        let loadedRoadmap = roadmap;
        if (currentLang !== 'en' && !(roadmap as any)._isTranslated) {
          const userKey = localStorage.getItem("zc_user_key");
          if (userKey) {
            try {
              const translatedVRoadmap = await translateWithRetry({ type: "vroadmap", content: roadmap.roadmapData, language: currentLang }, userKey);
              if (cancelled) return;
              loadedRoadmap = {
                ...roadmap,
                roadmapData: translatedVRoadmap,
                title: translatedVRoadmap.title || roadmap.title,
                topic: translatedVRoadmap.topic || roadmap.topic,
                description: translatedVRoadmap.description || roadmap.description,
                _isTranslated: true
              } as any;

              trpc.saveVisualRoadmapTranslation.mutate({
                visualRoadmapId: roadmap.id,
                language: currentLang,
                title: translatedVRoadmap.title || roadmap.title,
                topic: translatedVRoadmap.topic || roadmap.topic,
                description: translatedVRoadmap.description || roadmap.description || "",
                roadmapData: translatedVRoadmap
              }).catch(console.error);
            } catch (e) {
              console.error("Visual roadmap translation failed", e);
            }
          }
        }

        if (cancelled) return;
        // Update vroadmaps state with the fully loaded/translated version
        setVRoadmaps(prev => prev.map(r => r.id === activeVRoadmapId ? loadedRoadmap : r));
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load/translate visual roadmap:", err);
        }
      } finally {
        if (!cancelled) {
          setIsRetranslatingVRoadmap(false);
        }
      }
    };

    loadAndTranslateVR();

    return () => {
      cancelled = true;
    };
  }, [activeVRoadmapId, i18n.language, sessionData]);

  // Derived states from activeCourse
  const currentRoadmap = activeCourse?.roadmapData;
  const completedLessons = activeCourse?.completedLessons || [];
  const completedQuizzes = activeCourse?.completedQuizzes || {};
  const mentorMessages = activeCourse?.messages || [];

  // Load courses list on mount and language change
  useEffect(() => {
    if (!sessionData?.user) return;
    setIsLoadingCourses(true);
    trpc.getCourses.query({ language: i18n.language })
      .then((data: any) => {
        setCourses(data);
        setIsLoadingCourses(false);
        if (data.length > 0 && !activeCourseId) {
          setActiveCourseId(data[0].id);
        }
      })
      .catch((err: any) => {
        console.error("tRPC getCourses error:", err);
        setIsLoadingCourses(false);
        if (!err?.message?.includes("UNAUTHORIZED")) {
          toast.error(t("toast.couldntLoadYourCoursesPleaseRefresh", { defaultValue: "Couldn't load your courses — please refresh" }));
        }
      });
  }, [sessionData, i18n.language]);

  // Load full course when activeCourseId changes
  useEffect(() => {
    if (!activeCourseId) {
      setActiveCourse(null);
      lastActiveCourseIdRef.current = null;
      return;
    }
    setIsLoadingCourse(true);
    
    let cancelled = false;
    
    const loadCourse = async () => {
      try {
        if (!navigator.onLine) throw new Error("Offline");
        const course = await trpc.getCourse.query({ courseId: activeCourseId, language: i18n.language });
        if (cancelled) return;
        
        let loadedCourse = course;
        if (i18n.language !== 'en' && !(course as any)._isTranslated) {
          const userKey = localStorage.getItem("zc_user_key");
          if (userKey) {
            try {
              const translatedRoadmap = await translateWithRetry({ type: "roadmap", content: course.roadmapData, language: i18n.language }, userKey);
              if (cancelled) return;
              loadedCourse = { 
                ...course, 
                roadmapData: {
                  ...translatedRoadmap,
                  title: translatedRoadmap.title || course.title,
                }, 
                title: translatedRoadmap.title || course.title, 
                description: translatedRoadmap.description || course.description 
              } as any;
              
              trpc.saveCourseTranslation.mutate({
                 courseId: course.id,
                 language: i18n.language,
                 title: translatedRoadmap.title || course.title,
                 description: translatedRoadmap.description || course.description,
                 modules: translatedRoadmap.modules
              }).catch(console.error);
            } catch (e: any) {
              if (cancelled) return;
              console.error("Roadmap translation failed", e);
              toast.error(t("toast.failedToTranslateRoadmap", { defaultValue: "Roadmap translation failed. Displaying the original English version." }));
            }
          }
        }
        
        if (cancelled) return;
        setActiveCourse(loadedCourse as any);
        setIsLoadingCourse(false);
        
        if (lastActiveCourseIdRef.current !== activeCourseId) {
          setActiveTab("roadmap");
          setSelectedLesson(null);
          setSelectedProject(null);
          setSelectedModuleId(null);
          setQuizData(null);
          setLessonContent("");
          lastActiveCourseIdRef.current = activeCourseId;
        }
        
        // Cache for offline
        const localforage = (await import('localforage')).default;
        await localforage.setItem(`course-${activeCourseId}`, course);
      } catch (err) {
        if (cancelled) return;
        // Fallback to cache
        const localforage = (await import('localforage')).default;
        const cached = await localforage.getItem(`course-${activeCourseId}`);
        if (cancelled) return;
        if (cached) {
          setActiveCourse(cached as any);
          toast.success(t("toast.loadedOfflineVersion", { defaultValue: "Loaded offline version 📶" }));
        } else {
          toast.error(t("toast.youAreOfflineAndThisCourseIsNotCached", { defaultValue: "You are offline and this course is not cached." }));
        }
        setIsLoadingCourse(false);
      }
    };
    
    loadCourse();
    
    return () => {
      cancelled = true;
    };
  }, [activeCourseId, reloadCourseTrigger, i18n.language]);

  // Load user progress
  useEffect(() => {
    if (!sessionData?.user) {
      setUserDbProgress(null);
      return;
    }
    let cancelled = false;
    trpc.getUserProgress.query()
      .then(data => {
        if (!cancelled && data) setUserDbProgress(data);
      })
      .catch(err => {
        if (cancelled) return;
        console.error("tRPC getUserProgress error:", err);
        // Only show toast if it's not an auth error
        // (auth errors are expected when session is loading)
        if (!err?.message?.includes("UNAUTHORIZED")) {
          toast.error(t("toast.failedToLoadProgressRetrying", { defaultValue: "Failed to load progress — retrying..." }));
          // Retry once after 2 seconds
          setTimeout(() => {
            if (cancelled) return;
            trpc.getUserProgress.query()
              .then(data => { if (data) setUserDbProgress(data); })
              .catch(() => {}); // silent on retry fail
          }, 2000);
        }
      });
    return () => { cancelled = true; };
  }, [sessionData?.user?.id]);



  
  // Collapsible syllabus inputs
  const [showUrlInputs, setShowUrlInputs] = useState<boolean>(false);

  // Roadmap states
  const [roadmapView, setRoadmapView] = useState<"list" | "graph">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zc_roadmap_view");
      if (saved) return saved as "list" | "graph";
    }
    return "list";
  });
  
  const handleToggleRoadmapView = (view: "list" | "graph") => {
    setRoadmapView(view);
    localStorage.setItem("zc_roadmap_view", view);
  };

  const [topicInput, setTopicInput] = useState<string>("");
  const [sourceUrlInput, setSourceUrlInput] = useState<string>("");
  const [textContentInput, setTextContentInput] = useState<string>("");
  const [documentContext, setDocumentContext] = useState<string>("");
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<string>("beginner");
  const [backgroundContext, setBackgroundContext] = useState<string>("");
  const [tone, setTone] = useState<string>("friendly");
  const [weeklyHours, setWeeklyHours] = useState<number>(5);
  const [generatingRoadmap, setGeneratingRoadmap] = useState<boolean>(false);

  // Study states
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [generatingLesson, setGeneratingLesson] = useState<boolean>(false);
  const [lessonContent, setLessonContent] = useState<string>("");
  const [lessonModuleTitle, setLessonModuleTitle] = useState<string>("");
  const [lessonQualityScore, setLessonQualityScore] = useState<number | null>(null);
  const [lessonEvaluationData, setLessonEvaluationData] = useState<any>(null);
  const [revalidating, setRevalidating] = useState<boolean>(false);

  // Quiz states
  const [generatingQuiz, setGeneratingQuiz] = useState<boolean>(false);
  const [quizData, setQuizData] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizDifficulty, setQuizDifficulty] = useState<string>("Medium");
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(3);
  const [quizAnalysis, setQuizAnalysis] = useState<any>(null);

  // Chat Mentor states
  const [mentorInput, setMentorInput] = useState<string>("");
  const [mentorLoading, setMentorLoading] = useState<boolean>(false);

  const [isRetranslatingCourse, setIsRetranslatingCourse] = useState(false);
  const [isRetranslatingVRoadmap, setIsRetranslatingVRoadmap] = useState(false);
  const [isTranslatingLesson, setIsTranslatingLesson] = useState(false);
  const [isTranslatingProject, setIsTranslatingProject] = useState(false);

  const [hasKey, setHasKey] = useState(() => {
    if (typeof window !== "undefined") {
      const k = localStorage.getItem("zc_user_key");
      return !!k && k !== "null" && k !== "undefined" && k.trim() !== "";
    }
    return false;
  });

  useEffect(() => {
    const handleKeyChange = () => {
      const k = localStorage.getItem("zc_user_key");
      setHasKey(!!k && k !== "null" && k !== "undefined" && k.trim() !== "");
    };
    window.addEventListener("zc-key-status-changed", handleKeyChange);
    return () => window.removeEventListener("zc-key-status-changed", handleKeyChange);
  }, []);

  // Load or translate active project when language changes
  useEffect(() => {
    if (!activeCourseId || !selectedModuleId || !selectedProject) return;

    let cancelled = false;

    const reloadProject = async () => {
      setIsTranslatingProject(true);
      setGeneratingLesson(true);
      try {
        const project = await trpc.getModuleProject.query({ 
          courseId: activeCourseId, 
          moduleId: selectedModuleId, 
          language: i18n.language 
        });
        if (cancelled) return;

        if (project) {
          setSelectedProject(project);
        } else {
          const currentRoadmap = activeCourse?.roadmapData;
          const newProj = await trpc.generateProject.mutate({
            courseId: activeCourseId,
            moduleId: selectedModuleId,
            moduleTitle: lessonModuleTitle,
            topic: currentRoadmap?.title || activeCourse?.title || "",
            level: currentRoadmap?.difficulty || "Beginner",
            language: i18n.language
          });
          if (cancelled) return;
          setSelectedProject(newProj);
        }
      } catch (err) {
        console.error("Failed to reload/translate project:", err);
      } finally {
        if (!cancelled) {
          setGeneratingLesson(false);
          setIsTranslatingProject(false);
        }
      }
    };

    if (selectedProject.language !== i18n.language) {
      reloadProject();
    }

    return () => {
      cancelled = true;
    };
  }, [i18n.language, selectedModuleId, activeCourseId, activeCourse, lessonModuleTitle]);

  // Handle dynamic language switching for loaded content
  useEffect(() => {
    const handleLangChange = async (lng: string) => {
      const userKey = localStorage.getItem("zc_user_key");
      if (!userKey || !activeCourseId) return;

      if (selectedLesson && lessonContent && !generatingLesson) {
        setIsTranslatingLesson(true);
        setGeneratingLesson(true);
        try {
          // Check DB cache via TRPC
          const existing = await trpc.getLessonContent.query({ courseId: activeCourseId, lessonId: selectedLesson.id, language: lng });
          if (existing && existing.content) {
            setLessonContent(existing.content);
            setLessonQualityScore(existing.qualityScore ?? null);
            setLessonEvaluationData(existing.evaluationData ?? null);
          } else {
            try {
              const contentTranslated = await translateWithRetry({ content: lessonContent, language: lng }, userKey);
              setLessonContent(contentTranslated);
              await trpc.saveLessonContent.mutate({
                courseId: activeCourseId,
                lessonId: selectedLesson.id,
                language: lng,
                content: contentTranslated,
                qualityScore: lessonQualityScore ?? undefined,
                evaluationData: lessonEvaluationData ?? undefined
              });
            } catch (e) {
              console.error("Lesson translation failed", e);
            }
          }
        } catch (e) {
          console.error("Failed to translate lesson:", e);
        }
        setGeneratingLesson(false);
        setIsTranslatingLesson(false);
      }

      // Translate Quiz if active
      if (quizData && !generatingQuiz && !quizSubmitted) {
        setGeneratingQuiz(true);
        try {
          try {
            const translatedQuiz = await translateWithRetry({ type: "quiz", content: quizData, language: lng }, userKey);
            setQuizData(translatedQuiz);
          } catch (e) {
            console.error("Quiz translation failed", e);
          }
        } catch(e) { console.error("Quiz translation failed", e); }
        setGeneratingQuiz(false);
      }
    };

    i18n.on('languageChanged', handleLangChange);
    return () => {
      i18n.off('languageChanged', handleLangChange);
    };
  }, [i18n, activeCourseId, selectedLesson, lessonContent, generatingLesson, lessonQualityScore, lessonEvaluationData, quizData, generatingQuiz, quizSubmitted, trpc]);

  // Process offline sync queue
  useEffect(() => {
    const processQueue = async () => {
      if (!navigator.onLine) return;
      const localforage = (await import('localforage')).default;
      let queue: any[] = (await localforage.getItem('sync-queue')) || [];
      if (queue.length === 0) return;

      let remainingQueue: any[] = [];
      for (const item of queue) {
        if (item.type === 'progress') {
          try {
            await trpc.updateCourseProgress.mutate(item.data);
            trpc.getUserProgress.query().then(data => { if (data) setUserDbProgress(data); }).catch(() => {});
            toast.success(t("toast.offlineProgressSyncedSuccessfully", { defaultValue: "Offline progress synced successfully! ☁️" }));
          } catch (err) {
            console.error("Failed to sync item", item, err);
            remainingQueue.push(item);
          }
        }
      }
      await localforage.setItem('sync-queue', remainingQueue);
    };

    window.addEventListener('online', processQueue);
    processQueue();

    return () => window.removeEventListener('online', processQueue);
  }, []);

  // Rotate a motivational quote daily / or manually
  useEffect(() => {
    const today = new Date().getDate();
    setQuoteIndex(today % MOTIVATIONAL_QUOTES.length);
  }, []);

  // Auto scroll to study panel when lesson is selected
  useEffect(() => {
    if (selectedLesson && activeTab === "roadmap") {
      const el = document.getElementById("study-panel");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [selectedLesson, activeTab]);

  // Auth early returns
  if (isSessionPending) {
    return (
      <main className="min-h-screen bg-[#0F0D19] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#4F46E5] animate-spin mb-4" />
        <p className="text-[#A59ECA] font-medium">{t("warmingUpSpace", { defaultValue: "Warming up your space..." })}</p>
      </main>
    );
  }

  // API Key Check
  if (sessionData?.user && !hasKey) {
    return (
      <ApiKeyOnboarding onActivate={() => setHasKey(true)} onSkip={() => {}} />
    );
  }

  if (!sessionData?.user) {
    if (path.startsWith("/api")) return null;
    if (path === "/certificate" || path.startsWith("/certificate/")) {
      const parts = path.split("/");
      const certId = parts[2] || "";
      return <PublicCertificatePage certId={certId} />;
    }
    if (path === "/sign-in") return <SignInPage />;
    if (path.startsWith("/sign-up")) return <SignUpPage />;
    if (path.startsWith("/forgot-password")) return <ForgotPasswordPage />;
    if (path.startsWith("/reset-password")) return <ResetPasswordPage />;
    if (path.startsWith("/verify-email")) return <VerifyEmailPage />;
    return <LandingPage />;
  }

  // Handle roadmap generation
  const handleGenerateRoadmap = async (e?: React.FormEvent, customTopic?: string) => {
    if (e) e.preventDefault();
    const activeTopic = customTopic || topicInput;
    if (!activeTopic.trim() && !sourceUrlInput.trim() && !textContentInput.trim()) return;

    setGeneratingRoadmap(true);
    setSelectedLesson(null);
    setQuizData(null);

    try {
      const userKey = localStorage.getItem("zc_user_key");
      let roadmapDataResult: any;

      if (userKey) {
        // Direct Client-Side Gemini Call
        const systemPrompt = `You are a professional syllabus and curriculum architect. Your job is to return ONLY a JSON object representing a beautiful course roadmap. Do not wrap the JSON in markdown formatting blocks or write any introductory or trailing text. It must be valid, parseable JSON.
Format the JSON according to this exact TypeScript structure:
{
  "title": "Course Title",
  "description": "Short overview",
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "modules": [
    {
      "id": "module_id_1",
      "title": "Module 1 Title",
      "description": "Module description",
      "lessons": [
        { "id": "lesson_id_1", "title": "Lesson 1 Title", "duration": "15 mins", "concepts": ["concept1", "concept2"] }
      ]
    }
  ]
}
${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.friendly}
Ensure exactly 3 modules, with 2 or 3 lessons per module. Make the lessons progressive, comprehensive, and highly engaging.`;

        const prompt = `Create a highly tailored learning roadmap:
Topic: ${activeTopic || "Personalized Technology Fundamentals"}
Student level: ${experienceLevel || "beginner"}
${backgroundContext ? "Learner background: " + backgroundContext : ""}
Hours/week: ${weeklyHours || 5}
${sourceUrlInput ? "Reference: " + sourceUrlInput : ""}
${textContentInput ? "Syllabus: " + textContentInput : ""}

Rules:
- ${experienceLevel === "advanced" ? "Skip basics, start intermediate" : "Start from absolute fundamentals"}
- ${weeklyHours >= 15 ? "Dense curriculum, 4-5 lessons/module" : "Comfortable pace, 2-3 lessons/module"}  
- Last lesson MUST be a hands-on project
- First lesson must be completable in under 30 min`;

        const finalSystemPrompt = systemPrompt + "\n" + (i18n.language !== "en" ? (LANGUAGE_INSTRUCTIONS[i18n.language] || "") : "");
        const reply = await callGemini(prompt, finalSystemPrompt);
        const cleanReply = reply.replace(/```json\s?|```/g, "").trim();
        roadmapDataResult = JSON.parse(cleanReply);
      } else {
        // Server Action / Proxy Call (if guest or skipped key)
        const response = await apiFetch("/api/generate-roadmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: activeTopic || "Personalized Technology Fundamentals",
            sourceUrl: sourceUrlInput,
            textContent: textContentInput,
            documentContext,
            experienceLevel,
            backgroundContext,
            tone,
            weeklyHours,
            language: i18n.language
          })
        });

        if (response.status === 403) {
          window.dispatchEvent(new CustomEvent("zc-quota-exceeded"));
          setGeneratingRoadmap(false);
          return;
        }

        if (!response.ok) throw new Error(t("error.failedToBuildRoadmap", { defaultValue: "Oops! We couldn't build your learning path right now." }));
        const data = await response.json();
        roadmapDataResult = data.roadmap;


      }

      // Save to DB
      if (sessionData?.user) {
        const newCourse = await trpc.createCourse.mutate({
          title: roadmapDataResult.title,
          topic: activeTopic || "Personalized Technology Fundamentals",
          description: roadmapDataResult.description,
          sourceUrl: sourceUrlInput || undefined,
          difficulty: roadmapDataResult.difficulty,
          totalDuration: undefined,
          prerequisites: [],
          experienceLevel: experienceLevel,
          backgroundContext: backgroundContext || undefined,
          tone: tone,
          weeklyHours: weeklyHours,
          roadmapData: roadmapDataResult,
          language: i18n.language,
        });

        const greetings: Record<string, string> = {
          en: "Hey! 👋 I'm your ZachCourse mentor for **{{title}}**. I've built your personalized roadmap — click any lesson on the left to start learning. I'm here to answer any questions about the course or anything else on your mind! What would you like to explore first? 🚀",
          es: "¡Hola! 👋 Soy tu mentor de ZachCourse para **{{title}}**. He creado tu hoja de ruta personalizada. Haz clic en cualquier lección de la izquierda para empezar a aprender. ¡Estoy aquí para responder cualquier pregunta sobre el curso o lo que tengas en mente! ¿Qué te gustaría explorar primero? 🚀",
          fr: "Salut ! 👋 Je suis votre mentor ZachCourse pour **{{title}}**. J'ai créé votre feuille de route personnalisée — cliquez sur n'importe quelle leçon à gauche pour commencer à apprendre. Je suis là pour répondre à toutes vos questions sur le cours ou tout autre sujet en tête ! Qu'aimeriez-vous explorer en premier ? 🚀",
          de: "Hallo! 👋 Ich bin dein ZachCourse-Mentor für **{{title}}**. Ich habe deine personalisierte Roadmap erstellt – klicke links auf eine beliebige Lektion, um mit dem Lernen zu beginnen. Ich bin hier, um all deine Fragen zum Kurs oder zu allem anderen zu beantworten! Was möchtest du als Erstes erkunden? 🚀",
          hi: "अरे! 👋 मैं **{{title}}** के लिए आपका ZachCourse मेंटर हूँ। मैंने आपका व्यक्तिगत रोडमैप तैयार किया है — सीखना शुरू करने के लिए बाईं ओर किसी भी पाठ पर क्लिक करें। मैं यहाँ पाठ्यक्रम या आपके मन में मौजूद किसी भी चीज़ के बारे में आपके प्रश्नों का उत्तर देने के लिए हूँ! आप सबसे पहले क्या तलाशना चाहेंगे? 🚀",
          zh: "嘿！👋 我是你的 ZachCourse 导师，负责 **{{title}}**。我已经为你制定了量身定制的路线图——点击左侧的任意一课即可开始学习。我在这里为你解答有关课程或你脑海中任何其他问题的疑问！你最想先探索什么？ 🚀"
        };
        const template = greetings[i18n.language || "en"] || greetings.en;
        const greetingText = template.replace("{{title}}", roadmapDataResult.title);

        const welcomeMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: greetingText,
          createdAt: new Date(),
          courseId: newCourse.id
        };

        setCourses(prev => [newCourse as any as CourseListItem, ...prev]);
        setActiveCourseId(newCourse.id);
        setActiveCourse({ ...newCourse, messages: [welcomeMessage] });
        toast.success(t("toast.roadmapSavedYourCourseIsReady", { defaultValue: "Roadmap saved! Your course is ready 🗺️" }));
      }
      
      setTopicInput("");
      setSourceUrlInput("");
      setTextContentInput("");
      
      // Auto-switch to roadmap view if on another tab
      setActiveTab("roadmap");
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("toast.connectionIssuePleaseTryAgain", { defaultValue: "Connection issue — please try again" }));
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  // Fetch / Generate Study Guide Content
  const handleSelectProject = async (moduleId: string, moduleTitle: string) => {
    setSelectedLesson(null);
    setSelectedProject(null);
    setSelectedModuleId(moduleId);
    setLessonModuleTitle(moduleTitle);
    setGeneratingLesson(true);
    setQuizData(null);
    setQuizSubmitted(false);
    setSelectedAnswers({});
    setActiveTab("roadmap");

    try {
      if (activeCourseId && currentRoadmap) {
        const project = await trpc.getModuleProject.query({ courseId: activeCourseId, moduleId, language: i18n.language });
        if (project) {
          setSelectedProject(project);
          setGeneratingLesson(false);
          return;
        }

        // Generate
        const newProj = await trpc.generateProject.mutate({
          courseId: activeCourseId,
          moduleId,
          moduleTitle,
          topic: currentRoadmap.title,
          level: currentRoadmap.difficulty || "Beginner",
          language: i18n.language
        });
        setSelectedProject(newProj);
        toast.success(t("toast.projectGenerated", { defaultValue: "Project generated for {{moduleTitle}}!", moduleTitle }));
      }
    } catch (err: any) {
      console.error("Project error", err);
      toast.error(err.message || t("toast.failedToLoadProject", { defaultValue: "Failed to load project" }));
    } finally {
      setGeneratingLesson(false);
    }
  };


  const handleForceRetranslate = async () => {
    if (!activeCourseId) return;
    const currentLanguage = i18n.language;
    if (currentLanguage === "en") {
      toast.error("Retranslation is only supported for non-English languages.");
      return;
    }

    const confirmReset = window.confirm(
      `Are you sure you want to force a re-translation of this course into ${currentLanguage}? This will clear the cached translation and request a fresh translation from the AI model.`
    );
    if (!confirmReset) return;

    setIsForceRetranslating(true);
    const toastId = toast.loading("Clearing translation cache and requesting fresh translation...");

    try {
      // 1. Delete course translation row
      await trpc.deleteCourseTranslation.mutate({
        courseId: activeCourseId,
        language: currentLanguage
      });

      // 2. Trigger active course load/retranslation by updating the trigger
      setReloadCourseTrigger(prev => prev + 1);

      toast.success("Retranslation triggered successfully!", { id: toastId });
    } catch (err: any) {
      console.error("Force retranslate failed:", err);
      toast.error(`Force retranslate failed: ${err.message || "Unknown error"}`, { id: toastId });
    } finally {
      setIsForceRetranslating(false);
    }
  };

  const handleSelectLesson = async (moduleTitle: string, lesson: Lesson) => {
    setSelectedProject(null);
    setSelectedModuleId(null);
    setSelectedLesson(lesson);
    setLessonModuleTitle(moduleTitle);
    setGeneratingLesson(true);
    setQuizData(null);
    setQuizSubmitted(false);
    setSelectedAnswers({});

    try {
      const localforage = (await import('localforage')).default;
      if (activeCourseId) {
        let savedContent = null;
        try {
          if (!navigator.onLine) throw new Error("Offline");
          savedContent = await trpc.getLessonContent.query({ courseId: activeCourseId, lessonId: lesson.id, language: i18n.language });
          // Cache it if found
          if (savedContent && savedContent.content) {
            await localforage.setItem(`lesson-${activeCourseId}-${lesson.id}`, savedContent);
          }
        } catch (err) {
          // If offline, check cache
          savedContent = await localforage.getItem(`lesson-${activeCourseId}-${lesson.id}`);
          if (savedContent) {
            toast.success(t("toast.loadedCachedLesson", { defaultValue: "Loaded cached lesson 📶" }));
          } else if (!navigator.onLine) {
        throw new Error(t("error.offlineLesson", { defaultValue: "You are offline and this lesson is not cached." }));
      }

      
      
            
        }

        if (savedContent && savedContent.content) {
          setLessonContent(savedContent.content);
          setLessonQualityScore(savedContent.qualityScore ?? null);
          setLessonEvaluationData(savedContent.evaluationData ?? null);
          setGeneratingLesson(false);
          return;
        }
      }

      if (!navigator.onLine) {
        throw new Error("You are offline and this lesson is not cached.");
      }

      
      
            

      
      let content: string;
      let qScore: number | null = null;
      let evalData: any = null;

      const userKey = localStorage.getItem("zc_user_key");
      if (userKey) {
        const systemPrompt = `You are a supportive, warm, and elite educational companion. Your job is to write a highly engaging, structured, and deep study guide for the specified lesson using beautiful Markdown formatting.
Include:
1. 💡 An intuitive, real-world analogy to make the topic extremely memorable.
2. 🚀 A deep dive breakdown of each core concept.
3. 🛠️ A small mini-project code snippet or exercise.
${TONE_INSTRUCTIONS[activeCourse?.tone || "friendly"] ?? TONE_INSTRUCTIONS.friendly}

CRITICAL REQUIREMENT: You MUST write your study guide using beautiful raw Markdown formatting only. Do NOT output a JSON object or wrap your response in JSON under any circumstances, even if the lesson title contains words like 'Project' or 'Hands-on'. Output a clean, structured Markdown article.`;

        const prompt = `Please generate a comprehensive study guide for:
Course Title: "${currentRoadmap?.title}"
Lesson Title: "${lesson.title}"
${activeCourse?.experienceLevel ? `Target Level: ${activeCourse.experienceLevel}` : ""}
${activeCourse?.backgroundContext ? `Learner Background: ${activeCourse.backgroundContext}` : ""}
Core Concepts to cover: ${JSON.stringify(lesson.concepts)}`;

        const finalSystemPrompt = systemPrompt + "\n" + (i18n.language !== "en" ? (LANGUAGE_INSTRUCTIONS[i18n.language] || "") : "");
        content = await callGemini(prompt, finalSystemPrompt);
      } else {
        const response = await apiFetch("/api/generate-lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roadmapKey: activeCourseId || "guest_roadmap",
            courseId: activeCourseId || "guest_roadmap",
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            concepts: lesson.concepts,
            experienceLevel: activeCourse?.experienceLevel || "beginner",
            backgroundContext: activeCourse?.backgroundContext || "",
            tone: activeCourse?.tone || "friendly",
            documentContext,
            language: i18n.language
          })
        });

        if (response.status === 403) {
          window.dispatchEvent(new CustomEvent("zc-quota-exceeded"));
          setGeneratingLesson(false);
          return;
        }

        if (!response.ok) throw new Error(t("error.failedToLoadStudyGuide", { defaultValue: "Oops, we couldn't load your study guide. Let's try again! 🙈" }));
        const data = await response.json();
        content = data.content;
        qScore = data.qualityScore ?? null;
        evalData = data.evaluationData ?? null;
      }

      setLessonContent(content);
      setLessonQualityScore(qScore);
      setLessonEvaluationData(evalData);

      if (activeCourseId) {
        // Save the newly generated content to DB
        await trpc.saveLessonContent.mutate({
          courseId: activeCourseId,
          lessonId: lesson.id,
          language: i18n.language,
          content: content,
          qualityScore: qScore ?? undefined,
          evaluationData: evalData ?? undefined
        }).catch(err => {
          console.error("Failed to save lesson content:", err);
        });

        const localforage = (await import('localforage')).default;
        await localforage.setItem(`lesson-${activeCourseId}-${lesson.id}`, {
          content,
          qualityScore: qScore,
          evaluationData: evalData
        });

        // Trigger validation if not evaluated
        trpc.validateLesson.mutate({
          courseId: activeCourseId,
          lessonId: lesson.id,
          content: content,
          topic: currentRoadmap?.title || "",
          level: currentRoadmap?.difficulty || "Beginner",
          language: i18n.language
        }).then(evalResult => {
          setLessonQualityScore(evalResult.clarityScore);
          setLessonEvaluationData(evalResult);
        }).catch(err => {
          console.error("Failed to validate lesson:", err);
        });
      }

    } catch (err) {
      console.error(err);
      toast.error(t("toast.connectionIssuePleaseTryAgain", { defaultValue: "Connection issue — please try again" }));
      setLessonContent(`### Study Guide: ${lesson.title} 📚\n\n*Oops! We couldn't fetch a live guide, but here is your tutor's handy study reference:*\n\n- **Main Goal**: Master these key ideas: ${lesson.concepts.join(", ")}\n\n- **Intuitive Analogy**: Think of this concept like reading a map before starting a hike—it ensures you don't take a wrong turn with variables!\n\n### Core Lessons:\n${lesson.concepts.map(c => `#### 🌟 ${c}\nThis is a beautiful foundational block. When we structure this nicely, our programs run smoothly and securely.`).join("\n\n")}`);
    } finally {
      setGeneratingLesson(false);
    }
  };

  const handleRevalidate = async () => {
    if (!selectedLesson || !activeCourseId) return;
    setRevalidating(true);
    try {
      const evalResult = await trpc.validateLesson.mutate({
        courseId: activeCourseId,
        lessonId: selectedLesson.id,
        content: lessonContent,
        topic: currentRoadmap?.title || "",
        level: currentRoadmap?.difficulty || "Beginner",
        language: i18n.language
      });
      setLessonQualityScore(evalResult.clarityScore);
      setLessonEvaluationData(evalResult);
      toast.success(t("toast.lessonRevalidated", { defaultValue: "Lesson re-validated!" }));
    } catch (err) {
      toast.error(t("toast.failedToRevalidateLesson", { defaultValue: "Failed to re-validate lesson" }));
    } finally {
      setRevalidating(false);
    }
  };

  // Toggle lesson complete
  const toggleCompleteLesson = async (lessonId: string) => {
    let updatedLessons: string[];
    if (completedLessons.includes(lessonId)) {
      updatedLessons = completedLessons.filter(id => id !== lessonId);
    } else {
      updatedLessons = [...completedLessons, lessonId];
    }
    
    // Optimistic UI update
    setActiveCourse(prev => {
      if (!prev) return prev;
      return { ...prev, completedLessons: updatedLessons };
    });
    
    toast.success(t("toast.progressSaved", { defaultValue: "Progress saved ✓" }));

    if (sessionData?.user && activeCourseId) {
      try {
        await trpc.updateCourseProgress.mutate({
          courseId: activeCourseId,
          completedLessons: updatedLessons,
        });
        trpc.getUserProgress.query().then(data => { if (data) setUserDbProgress(data); }).catch(() => {});

        // Check if module was just completed
        if (currentRoadmap && updatedLessons.includes(lessonId)) {
          const mod = currentRoadmap.modules.find((m: any) => m.lessons.some((l: any) => l.id === lessonId));
          if (mod) {
            const allLessonsInMod = mod.lessons.map((l: any) => l.id);
            const isModComplete = allLessonsInMod.every((id: string) => updatedLessons.includes(id));
            if (isModComplete) {
              trpc.generateProject.mutate({
                courseId: activeCourseId,
                moduleId: mod.id,
                moduleTitle: mod.title,
                topic: currentRoadmap.title,
                level: currentRoadmap.difficulty || "Beginner",
                language: i18n.language
              }).then(() => {
                toast.success(t("toast.projectGeneratedMod", { defaultValue: "Project generated for module: {{modTitle}}!", modTitle: mod.title }));
              }).catch(err => {
                console.error("Failed to auto-generate project", err);
              });
            }
          }
        }
      } catch (err) {
        console.error("Error saving complete lesson state:", err);
        toast.error(t("toast.connectionIssuePleaseTryAgain", { defaultValue: "Connection issue — please try again" }));
        // Revert optimistic UI on error
        setActiveCourse(prev => {
            if (!prev) return prev;
            return { ...prev, completedLessons: completedLessons };
        });
      }
    }
  };

  // Start / Generate Quiz
  const handleStartQuiz = () => {
    if (!selectedLesson) return;
    setQuizData(null);
    setQuizSubmitted(false);
    setSelectedAnswers({});
    setQuizAnalysis(null);
    setActiveTab("quiz");
  };

  const generateQuiz = async () => {
    if (!selectedLesson) return;

    setGeneratingQuiz(true);
    setQuizData(null);
    setQuizSubmitted(false);
    setSelectedAnswers({});
    setQuizAnalysis(null);

    try {
      
      let data: any;

      const userKey = localStorage.getItem("zc_user_key");
      if (userKey) {
        const systemPrompt = `You are a professional assessor and educator. Your job is to generate exactly ${quizQuestionCount} interactive multiple choice questions based on the lesson provided. The difficulty level should be ${quizDifficulty}. Return ONLY a valid JSON object matching this schema. Do not write any markdown blocks or explanations before or after the JSON.
Schema:
{
  "questions": [
    {
      "id": "q1",
      "question": "What is ...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Explanation here..."
    }
  ]
}`;

        const prompt = `Generate a ${quizQuestionCount}-question quiz at ${quizDifficulty} difficulty for:
Lesson Title: "${selectedLesson.title}"
Study Guide Content:
${lessonContent}`;

        const finalSystemPrompt = systemPrompt + "\n" + (i18n.language !== "en" ? (LANGUAGE_INSTRUCTIONS[i18n.language] || "") : "");
        const reply = await callGemini(prompt, finalSystemPrompt);
        const cleanReply = reply.replace(/```json\s?|```/g, "").trim();
        data = JSON.parse(cleanReply);
      } else {
        const response = await apiFetch("/api/generate-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonTitle: selectedLesson.title,
            lessonContent: lessonContent.slice(0, 800),
            concepts: selectedLesson.concepts,
            language: i18n.language
          })
        });

        if (response.status === 403) {
          window.dispatchEvent(new CustomEvent("zc-quota-exceeded"));
          setGeneratingQuiz(false);
          return;
        }

        if (!response.ok) throw new Error(t("error.quizmasterFailed", { defaultValue: "Quizmaster could not compile questions." }));
        data = await response.json();

      }

      setQuizData(data);
    } catch (err) {
      console.error(err);
      toast.error(t("toast.connectionIssuePleaseTryAgain", { defaultValue: "Connection issue — please try again" }));
      // Fallback simple quiz
      setQuizData({
        questions: [
          {
            id: "q1",
            question: `What is the primary key behind mastering: "${selectedLesson.title}"?`,
            options: [
              `Connecting concepts back to your real-world goals, focusing on ${selectedLesson.concepts[0] || "Foundations"}`,
              "Memorizing arbitrary syntax codes line-by-line without understanding",
              "Skipping practice entirely to rush to the next step",
              "Writing incredibly long and complex code blocks on the first day"
            ],
            correctIndex: 0,
            explanation: `Focusing on ${selectedLesson.concepts[0] || "Foundations"} is the best way to develop deep, intuitive understanding.`
          },
          {
            id: "q2",
            question: "Why does having a well-structured roadmap speed up your learning?",
            options: [
              "It breaks scary challenges down into modular, highly achievable bite-sized progress milestones",
              "It gives you a secret cheat sheet to bypass actual practice",
              "It somehow teaches you everything instantly while you sleep",
              "It automatically does all your projects for you with zero effort"
            ],
            correctIndex: 0,
            explanation: "Breaking complex skills into progressive pieces removes overwhelm and guides you smoothly!"
          },
          {
            id: "q3",
            question: "How should you approach master-level exercises?",
            options: [
              "By trying to explain concepts to others, and building small fun practice projects",
              "By ignoring errors and moving on as fast as possible",
              "By looking up the answers immediately without typing any code",
              "By stopping as soon as you hit any error or bug"
            ],
            correctIndex: 0,
            explanation: "Teaching others and hands-on mini-projects build durable pathways in your brain!"
          }
        ]
      });
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // Handle quiz option click
  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    if (quizSubmitted) return;
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: optionIndex
    });
  };

  // Submit Quiz
  const handleSubmitQuiz = async () => {
    if (!quizData) return;
    setQuizSubmitted(true);
    
    // Calculate score
    let correctCount = 0;
    quizData.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
         correctCount++;
      }
    });

    const scorePct = Math.round((correctCount / quizData.questions.length) * 100);
    toast.success(t("toast.quizDone", { defaultValue: "Quiz done! You scored {{scorePct}}% 🎯", scorePct }));

    if (selectedLesson && activeCourseId) {
      const updatedScores = {
        ...completedQuizzes,
        [selectedLesson.id]: scorePct
      };
      
      let updatedLessons = completedLessons;
      // Auto complete lesson on passing score
      if (scorePct >= 60 && !completedLessons.includes(selectedLesson.id)) {
        updatedLessons = [...completedLessons, selectedLesson.id];
      }

      // Optimistic update
      setActiveCourse(prev => {
        if (!prev) return prev;
        return { 
          ...prev, 
          completedQuizzes: updatedScores,
          completedLessons: updatedLessons
        };
      });

      if (sessionData?.user) {
        try {
          if (!navigator.onLine) {
            throw new Error("Offline");
          }
          await trpc.updateCourseProgress.mutate({
            courseId: activeCourseId,
            completedQuizzes: updatedScores,
            completedLessons: updatedLessons,
          });
          trpc.getUserProgress.query().then(data => { if (data) setUserDbProgress(data); }).catch(() => {});

          const analysis = await trpc.analyzeQuizPerformance.mutate({
            courseId: activeCourseId,
            lessonId: selectedLesson.id,
            score: scorePct,
            topic: selectedLesson.title,
            language: i18n.language,
          });
          setQuizAnalysis(analysis);
        } catch (err) {
          console.error("Error saving quiz progress:", err);
          const localforage = (await import('localforage')).default;
          let queue: any[] = (await localforage.getItem('sync-queue')) || [];
          queue.push({
            type: 'progress',
            data: {
              courseId: activeCourseId,
              completedQuizzes: updatedScores,
              completedLessons: updatedLessons,
            }
          });
          await localforage.setItem('sync-queue', queue);
          toast.info(t("toast.offlineProgressSavedLocallyWillSyncWhenOnline", { defaultValue: "Offline — progress saved locally. Will sync when online! 🔄" }));
        }
      }
    }
  };

  // Send a message to the mentor
  const handleSendMentorMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorInput.trim() || mentorLoading || !activeCourseId) return;

    const userMessage = mentorInput.trim();
    setMentorInput("");
    setMentorLoading(true);

    const userMsgObj = { 
      id: Date.now().toString(), 
      role: "user" as const, 
      content: userMessage, 
      createdAt: new Date(),
      courseId: activeCourseId 
    };
    
    // Add empty assistant message that we'll stream into
    const assistantMsgId = Date.now().toString() + "_ai";
    const assistantMsgObj = {
      id: assistantMsgId,
      role: "assistant" as const,
      content: "",   // starts empty
      createdAt: new Date(),
      courseId: activeCourseId 
    };

    setActiveCourse(prev => {
        if (!prev) return prev;
        return { ...prev, messages: [...prev.messages, userMsgObj, assistantMsgObj] };
    });

    try {
      
      const headers: any = { "Content-Type": "application/json" };
      const userKey = localStorage.getItem("zc_user_key");
      if (userKey) headers["x-user-key"] = userKey;
      
      const response = await fetch("/api/mentor-chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMessage,
          courseId: activeCourseId,
          currentLessonId: selectedLesson?.id,
          currentLessonTitle: selectedLesson?.title,
          language: i18n.language,
          currentCourseTitle: activeCourse?.title,
          history: mentorMessages.slice(-10).map(m => ({
            role: m.role,
            content: m.content.slice(0, 1000)
          }))
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          window.dispatchEvent(new CustomEvent("zc-quota-exceeded"));
          setMentorLoading(false);
          return;
        }
        throw new Error("Mentor request failed");
      }
      
      if (!response.body) throw new Error("No stream body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      // Hide the spinner since we are streaming now
      setMentorLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            
            if (json.done) break;
            if (json.error) throw new Error(json.error);
            
            if (json.text) {
              fullText += json.text;
              setActiveCourse(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  messages: prev.messages.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: fullText }
                      : m
                  )
                };
              });
            }
          } catch (err) {
             // ignore parse error for chunks
          }
        }
      }
    } catch (err: any) {
      setActiveCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter(m => m.id !== assistantMsgId)
        }
      });
      toast.error(err.message || t("toast.mentorFailedToRespond", { defaultValue: "Mentor failed to respond" }));
    } finally {
      setMentorLoading(false);
    }
  };

  const handlePillClick = (topicText: string) => {
    setTopicInput(topicText);
    handleGenerateRoadmap(undefined, topicText);
  };

  // Calculations for progress
  const totalLessons = currentRoadmap?.modules?.reduce((acc: any, m: any) => acc + (m.lessons?.length || 0), 0) || 0;
  const completedLessonsCount = currentRoadmap?.modules?.reduce((acc: any, m: any) => {
    return acc + (m.lessons?.filter((l: any) => completedLessons.includes(l.id)).length || 0);
  }, 0) || 0;
  const completionPercentage = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;

  // Render SVG circular progress
  function renderProgressRing(pct: number, size: number = 84, strokeWidth: number = 7) {
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
  }

  // Auth Submit Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");

    try {
      if (authMode === "signup") {
        if (!authName || !authEmail || !authPassword) {
          throw new Error("Please fill in all signup fields.");
        }
        const res = await signUp.email({
          email: authEmail,
          password: authPassword,
          name: authName,
        });
        if (res?.error) {
          throw new Error(res.error.message || "Failed to sign up.");
        }
        setAuthSuccess("Verification link sent! Please check your email inbox to activate your account.");
      } else if (authMode === "signin") {
        if (!authEmail || !authPassword) {
          throw new Error("Please enter both email and password.");
        }
        const res = await signIn.email({
          email: authEmail,
          password: authPassword,
        });
        if (res?.error) {
          throw new Error(res.error.message || "Failed to sign in. Verify credentials.");
        }
        refetchSession();
      } else if (authMode === "forgot") {
        if (!authEmail) {
          throw new Error("Please enter your registered email address.");
        }
        await (authClient as any).requestPasswordReset({
          email: authEmail,
          redirectTo: window.location.origin + "/?reset-password=true",
        });
        setAuthSuccess("A password reset link has been dispatched to your email inbox!");
      }
    } catch (err: any) {
      setAuthError(err.message || "An authentication error occurred.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "github" | "google") => {
    setAuthLoading(true);
    setAuthError("");
    try {
      await signIn.social({
        provider,
      });
    } catch (err: any) {
      setAuthError(err.message || `Failed to authenticate with ${provider}.`);
    } finally {
      setAuthLoading(false);
    }
  };



  if (isSessionPending) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center text-[#FAF9FD] p-6 text-center">
        <Loader2 className="w-12 h-12 text-[#4F46E5] animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">{t("syncingCompanionCore", { defaultValue: "Syncing with companion core..." })}</h2>
        <p className="text-sm text-[#8E88AB] mt-1 font-medium">{t("pleaseWaitSecureConnection", { defaultValue: "Please wait while we establish your secure study connection." })}</p>
      </main>
    );
  }

  // Render public-facing auth pages
  const getPublicPage = () => {
    if (path.startsWith("/api")) return null;
    if (path === "/certificate" || path.startsWith("/certificate/")) {
      const parts = path.split("/");
      const certId = parts[2] || "";
      return <PublicCertificatePage certId={certId} />;
    }
    if (path.startsWith("/verify-email")) return <VerifyEmailPage />;
    if (path.startsWith("/reset-password")) return <ResetPasswordPage />;
    if (path.startsWith("/forgot-password")) return <ForgotPasswordPage />;
    if (!sessionData?.user) {
      if (path === "/") return <LandingPage />;
      if (path.startsWith("/sign-up")) return <SignUpPage />;
      return <SignInPage />;
    }
    return null;
  };

  const publicPage = getPublicPage();
  if (publicPage) {
    return publicPage;
  }

  return (
    <div className="flex h-screen bg-[#0F0D19] overflow-hidden text-[#CECADF] font-sans antialiased selection:bg-indigo-900 selection:text-indigo-200">
      
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <AppSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={sessionData}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        isLoadingCourses={isLoadingCourses}
        isRetranslatingCourse={isRetranslatingCourse}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => {
          setSidebarCollapsed(p => !p)
          localStorage.setItem("zc_sidebar", (!sidebarCollapsed).toString())
        }}
        onSignOut={handleSignOut}
        courses={courses}
        activeCourseId={activeCourseId}
        setActiveCourseId={setActiveCourseId}
        onDeleteCourse={async (id) => {
          try {
            await trpc.deleteCourse.mutate({ courseId: id });
            setCourses(prev => prev.filter(c => c.id !== id));
            if (activeCourseId === id) {
               setActiveCourseId(courses.find(c => c.id !== id)?.id || null);
            }
            toast.success(t("toast.courseDeletedSuccessfully", { defaultValue: "Course deleted successfully" }));
          } catch (e: any) {
            toast.error(e.message || t("toast.failedToDeleteCourse", { defaultValue: "Failed to delete course" }));
          }
        }}
        onRenameCourse={async (id, title) => {
          try {
            await trpc.renameCourse.mutate({ courseId: id, title });
            setCourses(prev => prev.map(c => c.id === id ? { ...c, title } : c));
            toast.success(t("toast.courseRenamedSuccessfully", { defaultValue: "Course renamed successfully" }));
          } catch (e: any) {
            toast.error(e.message || t("toast.failedToRenameCourse", { defaultValue: "Failed to rename course" }));
          }
        }}
      />
      
      <div className={`flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? "md:pl-16" : "md:pl-64"}`}>
        <AppHeader
          onMenuClick={() => {
            if (window.innerWidth < 768) {
              setSidebarOpen(p => !p)
            } else {
              setSidebarCollapsed(p => !p)
            }
          }}
          isCollapsed={sidebarCollapsed}
          isOpen={sidebarOpen}
          session={sessionData}
          onSignOut={handleSignOut}
        />
        
        <TourController
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeCourseId={activeCourseId}
          setActiveCourseId={setActiveCourseId}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          isMobile={window.innerWidth < 768}
        />
        
        <main className="flex-1 overflow-y-auto bg-[#0F0D19]">
          {/* Motivational quote - moved here from header */}
          <div className="bg-[#141223] border-b border-[#231E35] py-3 px-4 md:px-6">
            <p className="text-sm text-[#CECADF] font-medium italic text-center">
              💡 "{t(`quotes.quote${quoteIndex + 1}`, { defaultValue: MOTIVATIONAL_QUOTES[quoteIndex] })}"
            </p>
          </div>
          
          <div className="p-4 md:p-6 lg:p-8 flex flex-col min-h-[calc(100vh-120px)]">
            
            {/* TAB: TEACHER */}
            {activeTab === "teacher" && (
              <TeacherDashboard />
            )}

            {/* TAB: ANALYTICS */}
            {activeTab === "analytics" && (
              <AnalyticsDashboard />
            )}

            {/* TAB: COHORTS */}
            {activeTab === "cohorts" && (
              <CohortsDashboard 
                onNavigateToCourse={(courseId) => {
                  setIsLoadingCourses(true);
                  trpc.getCourses.query({ language: i18n.language })
                    .then((data: any) => {
                      setCourses(data);
                      setIsLoadingCourses(false);
                      setActiveCourseId(courseId);
                      setActiveTab("roadmap");
                    })
                    .catch((err) => {
                      console.error(err);
                      setIsLoadingCourses(false);
                      setActiveCourseId(courseId);
                      setActiveTab("roadmap");
                    });
                }}
                onNavigateToRoadmap={(roadmapId) => {
                  trpc.getVisualRoadmaps.query({ language: i18n.language })
                    .then((data: any) => {
                      setVRoadmaps(data);
                      setActiveVRoadmapId(roadmapId);
                      setActiveTab("visual-roadmaps");
                    })
                    .catch((err) => {
                      console.error(err);
                      setActiveVRoadmapId(roadmapId);
                      setActiveTab("visual-roadmaps");
                    });
                }}
              />
            )}

            {/* TAB 0: VISUAL ROADMAPS */}
            {activeTab === "visual-roadmaps" && (
              <VisualRoadmapsTab
                roadmaps={vroadmaps}
                currentPage={vroadmapsPage}
                totalPages={vroadmapsTotalPages}
                onPageChange={setVroadmapsPage}
                hasKey={hasKey}
                onRoadmapGenerated={async (roadmapData, meta) => {
                  const saved = await trpc.saveVisualRoadmap.mutate({
                    title: roadmapData.title,
                    topic: meta.topic,
                    description: roadmapData.description,
                    difficulty: roadmapData.difficulty,
                    totalDuration: roadmapData.totalDuration,
                    experienceLevel: meta.experienceLevel,
                    backgroundContext: meta.backgroundContext || undefined,
                    weeklyHours: meta.weeklyHours,
                    roadmapData: roadmapData,
                  });
                  const isFirst = vroadmaps.length === 0;
                  setVRoadmaps(prev => [saved, ...prev]);
                  setActiveVRoadmapId(saved.id);
                  toast.success(t("toast.roadmapSaved", { defaultValue: "Roadmap saved! ✨" }));
                  
                  if (isFirst) {
                    setTimeout(() => {
                      import("./components/tour/TourController").then(mod => {
                        mod.tourEventEmitter.dispatchEvent(new CustomEvent('startTour', { detail: { chapter: 'vroadmap-graph-tour' } }));
                      });
                    }, 500);
                  }
                }}
                onDelete={async (id) => {
                  try {
                    await trpc.deleteVisualRoadmap.mutate({ id });
                    // Remove from local state
                    setVRoadmaps(prev => prev.filter(r => r.id !== id));
                    // If deleted roadmap was the active one, clear it
                    if (activeVRoadmapId === id) {
                      setActiveVRoadmapId(null);
                    }
                    toast.success(t("toast.roadmapDeleted", { defaultValue: "Roadmap deleted" }));
                  } catch (err: any) {
                    console.error("Delete roadmap error:", err);
                    toast.error(t("toast.failedToDeletePleaseTryAgain", { defaultValue: "Failed to delete — please try again" }));
                  }
                }}
                onToggleFavorite={async (id, isFavorite) => {
                  await trpc.toggleFavoriteRoadmap.mutate({ id, isFavorite });
                  setVRoadmaps(prev => prev.map(r => r.id === id ? { ...r, isFavorite } : r));
                }}
                activeVRoadmapId={activeVRoadmapId}
                setActiveVRoadmapId={setActiveVRoadmapId}
                onToggleNodeComplete={async (roadmapId, nodeId) => {
                  const roadmap = vroadmaps.find(r => r.id === roadmapId);
                  if (!roadmap) return;
                  const current = (roadmap.completedNodeIds as string[]) || [];
                  const updated = current.includes(nodeId)
                    ? current.filter((id: string) => id !== nodeId)
                    : [...current, nodeId];

                  setVRoadmaps(prev => prev.map(r => r.id === roadmapId ? { ...r, completedNodeIds: updated } : r));

                  try {
                    await trpc.updateVisualRoadmapProgress.mutate({
                      id: roadmapId,
                      completedNodeIds: updated,
                    });
                    trpc.getUserProgress.query().then(data => { if (data) setUserDbProgress(data); }).catch(() => {});
                  } catch (err) {
                    setVRoadmaps(prev => prev.map(r => r.id === roadmapId ? { ...r, completedNodeIds: current } : r));
                    toast.error(t("toast.failedToSaveProgress", { defaultValue: "Failed to save progress" }));
                  }
                }}
                isRetranslating={isRetranslatingVRoadmap}
              />
            )}

            {/* TAB 1: ROADMAP & LESSON VIEW */}
        {activeTab === "roadmap" && (
          <div className="relative">
            {(isRetranslatingCourse || isLoadingCourse) && (
              <div className="absolute inset-0 bg-[#0F0D19]/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6 rounded-3xl animate-in fade-in duration-200" style={{ minHeight: '600px' }}>
                <Loader2 className="w-12 h-12 text-[#4F46E5] animate-spin mb-4" />
                <h3 className="text-lg font-bold text-[#FAF9FD] mb-2">{t("translatingCourse", { defaultValue: "Translating Course... 📚" })}</h3>
                <p className="text-sm text-[#8E88AB] max-w-sm mx-auto">{t("pleaseWaitTranslatingCourse", { defaultValue: "Please wait while we convert your personalized learning course and modules to your chosen language." })}</p>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: CREATOR & NAVIGATION */}
            <div className="lg:col-span-5 flex flex-col gap-8">
              
              {/* Goal-Oriented Course Creator */}
              {!activeCourseId && (
              <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden" id="course-builder-form">

                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl select-none">✨</span>
                  <div>
                    <h2 className="text-2xl font-bold text-[#FAF9FD] tracking-tight">{t("createNewLearningAdventure", { defaultValue: "Create a New Learning Adventure" })}</h2>
                    <p className="text-base text-[#8E88AB] mt-1">{t("createNewLearningAdventureDesc", { defaultValue: "What would you like to explore today? Your companion tutor will customize the perfect path." })}</p>
                  </div>
                </div>

                <form onSubmit={(e) => handleGenerateRoadmap(e)} className="flex flex-col gap-6">
                  <div>
                    <label className="block text-base font-bold text-[#CECADF] mb-2">
                      {t("topicSkillLabel", { defaultValue: "Topic or Skill you want to learn:" })}
                    </label>
                    <div className="relative" data-tour="course-topic-input">
                      <Search className="absolute left-4 top-3.5 w-5 h-5 text-[#8E88AB]" />
                      <input
                        type="text"
                        placeholder={t("topicPlaceholder", { defaultValue: "e.g. Python Programming, UI Design, Photography..." })}
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        className="w-full bg-[#121021] border border-[#2A2443] rounded-2xl py-3.5 pl-12 pr-4 text-base text-[#FAF9FD] placeholder:text-[#8E88AB]/60 focus:outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  {/* Suggestion Chips */}
                  <div>
                    <p className="text-sm font-semibold text-[#8E88AB] mb-2.5">{t("tryPopularTopics", { defaultValue: "Try popular topics:" })}</p>
                    <div className="flex flex-wrap gap-2" data-tour="course-topic-pills">
                      <button
                        type="button"
                        onClick={() => handlePillClick("Python")}
                        className="bg-[#151221] border border-[#2B2446] text-[#D8D4EC] text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#4338CA]/15 hover:border-[#4F46E5] hover:text-[#FAF9FD] transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5"
                      >
                        <span>🐍</span>
                        <span>{t("python", { defaultValue: "Python" })}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePillClick("AI Basics")}
                        className="bg-[#151221] border border-[#2B2446] text-[#D8D4EC] text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#4338CA]/15 hover:border-[#4F46E5] hover:text-[#FAF9FD] transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5"
                      >
                        <span>🤖</span>
                        <span>{t("aiBasics", { defaultValue: "AI Basics" })}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePillClick("Data Science")}
                        className="bg-[#151221] border border-[#2B2446] text-[#D8D4EC] text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#4338CA]/15 hover:border-[#4F46E5] hover:text-[#FAF9FD] transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5"
                      >
                        <span>📊</span>
                        <span>{t("dataScience", { defaultValue: "Data Science" })}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePillClick("UI Design")}
                        className="bg-[#151221] border border-[#2B2446] text-[#D8D4EC] text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#4338CA]/15 hover:border-[#4F46E5] hover:text-[#FAF9FD] transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5"
                      >
                        <span>🎨</span>
                        <span>{t("uiDesign", { defaultValue: "UI Design" })}</span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible reference options */}
                  <div className="border-t border-[#2A2443] pt-4">
                    <button
                      type="button"
                      data-tour="course-source-url"
                      onClick={() => setShowUrlInputs(!showUrlInputs)}
                      className="w-full flex items-center justify-between text-left gap-2 text-base font-semibold text-[#FAF9FD]/80 hover:text-[#818CF8] transition"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="shrink-0">📎</span>
                        <span>{t("addCourseLinkSyllabus", { defaultValue: "Add a course link or textbook syllabus (optional)" })}</span>
                      </div>
                      {showUrlInputs ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                    </button>

                    {showUrlInputs && (
                      <div className="grid grid-cols-1 gap-4 mt-4 p-4 bg-[#121021] rounded-2xl border border-[#2A2443]">
                        <div>
                          <label className="block text-sm font-bold text-[#CECADF] mb-1.5">
                            {t("syllabusWebsiteLink", { defaultValue: "Syllabus Website Link:" })}
                          </label>
                          <input
                            type="url"
                            placeholder={t("syllabusLinkPlaceholder", { defaultValue: "https://your-syllabus-link.com" })}
                            value={sourceUrlInput}
                            onChange={(e) => setSourceUrlInput(e.target.value)}
                            className="w-full bg-[#1A172E] border border-[#2A2443] rounded-xl py-2.5 px-4 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/50 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-[#CECADF] mb-1.5">
                            {t("orPasteOutlineText", { defaultValue: "Or paste outline text:" })}
                          </label>
                          <textarea
                            rows={3}
                            placeholder={t("pasteSyllabusKeyPoints", { defaultValue: "Paste syllabus key points..." })}
                            value={textContentInput}
                            onChange={(e) => setTextContentInput(e.target.value)}
                            className="w-full bg-[#1A172E] border border-[#2A2443] rounded-xl py-2.5 px-4 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/50 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all font-medium"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div data-tour="course-doc-upload">
                    <DocumentUpload
                      onExtracted={(text, names) => {
                        setDocumentContext(text);
                        setUploadedFileNames(names);
                      }}
                      onClear={() => {
                        setDocumentContext("");
                        setUploadedFileNames([]);
                      }}
                      hasDocument={!!documentContext}
                    />
                  </div>
                  <div data-tour="course-level-hours" className="flex flex-col gap-6 border-t border-[#2A2443] pt-6">
                    <PersonalizationFields
                      experienceLevel={experienceLevel}
                      setExperienceLevel={setExperienceLevel}
                      backgroundContext={backgroundContext}
                      setBackgroundContext={setBackgroundContext}
                      tone={tone}
                      setTone={setTone}
                    />

                    <div>
                      <label className="block text-sm font-bold text-[#8E88AB] uppercase tracking-wider mb-3">
                        {t("roadmap:weeklyCommitment", { hours: weeklyHours, defaultValue: "Weekly Commitment: {{hours}} hours", interpolation: { escapeValue: false } })}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={weeklyHours}
                        onChange={(e) => setWeeklyHours(parseInt(e.target.value))}
                        className="w-full accent-[#4F46E5]"
                      />
                      <div className="flex justify-between text-xs font-medium text-[#4B5563] mt-2">
                        <span>{t("weeklyCommitmentCasual", { defaultValue: "Casual (1h)" })}</span>
                        <span>{t("weeklyCommitmentPartTime", { defaultValue: "Part-time (15h)" })}</span>
                        <span>{t("weeklyCommitmentIntensive", { defaultValue: "Intensive (30h)" })}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    data-tour="course-generate-btn"
                    type="submit"
                    disabled={generatingRoadmap}
                    className="w-full bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.985] text-white font-bold rounded-2xl py-4 px-6 text-base md:text-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#4F46E5]/20 hover:shadow-indigo-600/45 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
                    id="btn-generate-roadmap"
                  >
                    {generatingRoadmap ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                        <span>{t("cookingUpRoadmap", { defaultValue: "Cooking up your roadmap... 🍳" })}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 text-white" />
                        <span>{t("buildMyLearningPath", { defaultValue: "Build My Learning Path →" })}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
              )}

              {/* Progress Summary Card */}
              {currentRoadmap && (
              <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 sm:p-6 shadow-xl flex items-center justify-between gap-4 sm:gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🔥</span>
                    <span className="text-base font-bold text-amber-500">
                      {t("progressDashboard:streakText", { count: userDbProgress?.streakDays || 1 })}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#FAF9FD]">{t("doingFantastic", { defaultValue: "You're doing fantastic!" })}</h3>
                  <p className="text-sm text-[#8E88AB] mt-1">{t("keepItUpCompleted", { defaultValue: "Keep it up! Completed {{completed}} of {{total}} topics so far.", completed: completedLessonsCount, total: totalLessons })}</p>
                </div>
                {renderProgressRing(completionPercentage)}
              </div>
              )}

              {/* Active Roadmap Navigator */}
              {currentRoadmap && (
              <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 md:p-8 shadow-xl">
                <div className="border-b border-[#2A2443] pb-5 mb-5 flex flex-col md:flex-row md:justify-between items-start gap-4 md:gap-0">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs bg-indigo-950/40 text-[#818CF8] font-bold px-3 py-1 rounded-full border border-[#4F46E5]/30">
                        {t(currentRoadmap.difficulty?.toLowerCase(), { defaultValue: currentRoadmap.difficulty })}
                      </span>
                      <span className="text-sm text-[#818CF8] font-bold">
                        {t("modulesSetup", { count: currentRoadmap.modules?.length || 0, defaultValue: "{{count}} modules setup" })}
                      </span>
                      {i18n.language !== "en" && (
                        <button
                          onClick={handleForceRetranslate}
                          disabled={isForceRetranslating}
                          className="text-xs bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 font-semibold px-3 py-1 rounded-full border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          <span>⚡ {t("forceRetranslate", { defaultValue: "Force Retranslate" })}</span>
                        </button>
                      )}
                    </div>
                    <h3 className="font-sans font-bold text-[#FAF9FD] text-xl tracking-tight">{currentRoadmap?.title}</h3>
                    <p className="text-base text-[#8E88AB] leading-relaxed mt-2">{currentRoadmap.description}</p>
                  </div>
                  
                  {/* View Toggle */}
                  <div className="flex bg-[#121021] rounded-xl p-1 border border-[#2A2443] shrink-0">
                    <button
                      onClick={() => handleToggleRoadmapView("list")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${roadmapView === "list" ? "bg-[#2A2443] text-[#FAF9FD] shadow" : "text-[#8E88AB] hover:text-[#FAF9FD]"}`}
                    >
                      {t("listView", { defaultValue: "List" })}
                    </button>
                    <button
                      onClick={() => handleToggleRoadmapView("graph")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${roadmapView === "graph" ? "bg-[#2A2443] text-[#FAF9FD] shadow" : "text-[#8E88AB] hover:text-[#FAF9FD]"}`}
                    >
                      {t("graphView", { defaultValue: "Graph" })}
                    </button>
                  </div>
                </div>

                {roadmapView === "graph" ? (
                  <div data-tour="course-roadmap-graph">
                    <RoadmapGraph 
                      roadmap={currentRoadmap} 
                      completedLessons={completedLessons}
                      completedQuizzes={completedQuizzes}
                      selectedLessonId={selectedLesson?.id || null}
                      onSelectLesson={handleSelectLesson}
                    />
                  </div>
                ) : (
                  <div className="space-y-6" data-tour="course-roadmap-graph">
                    {currentRoadmap.modules?.map((mod: any, modIdx: number) => (
                      <div key={mod.id || modIdx} className="space-y-3">
                        <h4 className="text-base font-bold text-[#FAF9FD]">
                          {mod.title}
                        </h4>
                        <p className="text-sm text-[#8E88AB] leading-tight">{mod.description}</p>

                        <div className="space-y-2">
                          {mod.lessons?.map((lesson: any) => {
                          const isCompleted = completedLessons.includes(lesson.id);
                          const isSelected = selectedLesson?.id === lesson.id;
                          const quizScore = completedQuizzes[lesson.id];

                          return (
                            <div
                              key={lesson.id}
                              onClick={() => handleSelectLesson(mod.title, lesson)}
                              className={`group flex items-center justify-between p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                                isSelected 
                                  ? "bg-indigo-950/40 border-[#4F46E5]/30 shadow-md" 
                                  : "bg-[#121021]/40 hover:bg-[#121021]/80 border-[#2A2443]/40"
                              }`}
                              id={`lesson-node-${lesson.id}`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCompleteLesson(lesson.id);
                                  }}
                                  className="text-[#8E88AB] hover:text-[#10B981] p-1 transition shrink-0"
                                >
                                  {isCompleted ? (
                                    <CheckCircle className="w-5 h-5 text-[#10B981]" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-slate-600 group-hover:border-slate-400" />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <p className={`text-base font-semibold leading-snug truncate ${
                                    isSelected ? "text-[#818CF8]" : "text-[#CECADF]"
                                  }`}>
                                    {lesson.title}
                                  </p>
                                  <span className="text-xs text-[#8E88AB] mt-1 inline-block flex items-center gap-1 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-[#8E88AB]" />
                                    {lesson.duration}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {quizScore !== undefined && (
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                    quizScore >= 80 
                                      ? "bg-emerald-950/30 text-emerald-400 border border-emerald-500/30"
                                      : quizScore >= 50
                                        ? "bg-amber-950/30 text-amber-400 border border-amber-500/30"
                                        : "bg-rose-950/30 text-rose-400 border border-rose-500/30"
                                  }`}>
                                    Score: {quizScore}%
                                  </span>
                                )}
                                <ChevronRight className={`w-5 h-5 text-[#8E88AB] transition-transform ${
                                  isSelected ? "translate-x-1 text-[#818CF8]" : "group-hover:translate-x-1"
                                }`} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-[#2A2443]">
                        <button
                          onClick={() => handleSelectProject(mod.id, mod.title)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            selectedModuleId === mod.id && selectedProject
                              ? "bg-amber-950/40 border-amber-500/30 shadow-md text-amber-400"
                              : "bg-[#121021]/60 hover:bg-[#121021] border-[#2A2443]/40 text-[#CECADF]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className={`w-5 h-5 ${selectedModuleId === mod.id && selectedProject ? "text-amber-400" : "text-[#8E88AB]"}`} />
                            <span className="font-semibold">{t("moduleProject", { defaultValue: "Module Project" })}</span>
                          </div>
                          <ChevronRight className={`w-5 h-5 transition-transform ${selectedModuleId === mod.id && selectedProject ? "translate-x-1" : ""}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
              )}

            </div>

            {/* RIGHT COLUMN: STUDY MATERIAL COMPANION */}
            <div className="lg:col-span-7 flex flex-col gap-8" id="study-panel">
              
              {selectedLesson ? (
                <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 md:p-8 shadow-xl flex flex-col gap-6 min-h-[500px]">
                  
                  {/* Lesson Heading */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2A2443] pb-5 gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-[#818CF8] uppercase tracking-wider bg-indigo-950/40 border border-[#4F46E5]/20 px-2.5 py-1 rounded-full">{lessonModuleTitle}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]"></span>
                        <span className="text-sm font-medium text-[#8E88AB]">{t("studyTime", { duration: selectedLesson.duration, defaultValue: `${selectedLesson.duration} study time` })}</span>
                      </div>
                      <h2 className="text-2xl font-bold text-[#FAF9FD] tracking-tight">{selectedLesson.title}</h2>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => toggleCompleteLesson(selectedLesson.id)}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl border text-sm font-semibold cursor-pointer transition w-full sm:w-auto ${
                          completedLessons.includes(selectedLesson.id)
                            ? "bg-indigo-950/40 border-[#4F46E5]/30 text-[#818CF8]"
                            : "bg-[#121021] border-[#2A2443] text-[#CECADF] hover:bg-[#151227]"
                        }`}
                        id="btn-toggle-complete-lesson"
                      >
                        {completedLessons.includes(selectedLesson.id) ? (
                          <>
                            <Check className="w-4.5 h-4.5 text-[#818CF8]" />
                            <span>{t("finished", { defaultValue: "Finished!" })}</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-4.5 h-4.5 text-[#8E88AB]" />
                            <span>{t("markLearned", { defaultValue: "Mark Learned" })}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleStartQuiz}
                        className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold rounded-2xl text-sm transition active:scale-[0.98] shadow-md shadow-[#4F46E5]/10 cursor-pointer hover:-translate-y-0.5 w-full sm:w-auto"
                        id="btn-take-quiz"
                      >
                        <Award className="w-4.5 h-4.5" />
                        <span>{t("takeQuickQuiz", { defaultValue: "Take Quick Quiz" })}</span>
                      </button>
                    </div>
                  </div>

                  {/* Core Content View */}
                  <div className="flex-1">
                    
                    {generatingLesson ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 text-[#818CF8] animate-spin" />
                          <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="text-lg text-[#FAF9FD] font-bold">
                            {isTranslatingLesson 
                              ? t("translatingStudyGuide", { defaultValue: "Translating study guide... 📚" }) 
                              : isTranslatingProject
                                ? t("translatingProject", { defaultValue: "Translating project... 📚" })
                                : selectedProject
                                  ? t("generatingProject", { defaultValue: "Formulating your project... 🏗️" })
                                  : t("writingStudyGuide", { defaultValue: "Writing your study guide... ✏️" })
                            }
                          </p>
                          <p className="text-sm text-[#8E88AB] mt-2 max-w-sm">
                            {isTranslatingLesson 
                              ? t("translatingStudyGuideDesc", { defaultValue: "Please wait while we convert your custom lesson explanations to your chosen language." }) 
                              : isTranslatingProject
                                ? t("translatingProjectDesc", { defaultValue: "Please wait while we convert your project details to your chosen language." })
                                : selectedProject
                                  ? t("generatingProjectDesc", { defaultValue: "Tutor is drafting an immersive hands-on project with clear milestones and goals for this module." })
                                  : t("writingStudyGuideDesc", { defaultValue: "Generating custom explanations, friendly real-world analogies, and safe examples to help you understand." })
                            }
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Study Guide Reader
                      <div className="text-base text-[#CECADF] leading-relaxed space-y-6">
                        
                        {/* Interactive concept pills */}
                        <div className="flex flex-col gap-3 bg-[#121021] p-3.5 rounded-2xl border border-[#2A2443]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#8E88AB]">{t("keyTermsCover", { defaultValue: "Key terms we'll cover:" })}</span>
                            {selectedLesson.concepts.map((concept, idx) => (
                              <span 
                                key={idx}
                                className="text-sm bg-indigo-950/40 text-[#818CF8] border border-[#4F46E5]/20 px-3 py-1 rounded-full font-semibold"
                              >
                                {concept}
                              </span>
                            ))}
                          </div>
                          
                          {lessonQualityScore !== null && (
                            <div className="flex flex-col gap-2 mt-1 border-t border-[#2A2443] pt-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-[#8E88AB]">{t("contentQualityQA", { defaultValue: "Content Quality QA:" })}</span>
                                  <div className="relative group">
                                    <span className={`text-sm px-2 py-0.5 rounded-full font-bold cursor-default ${
                                      lessonEvaluationData?.isApproved ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30' :
                                      'bg-red-950/50 text-red-400 border border-red-500/30'
                                    }`}>
                                      {lessonEvaluationData?.isApproved ? t("approvedCheck", { defaultValue: "Approved ✓" }) : t("flaggedWarning", { defaultValue: "Flagged ⚠" })}
                                    </span>
                                    {lessonEvaluationData && (
                                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 bg-[#1E1A33] border border-[#2A2443] rounded-lg p-3 shadow-xl z-10 text-xs text-[#CECADF]">
                                        <div className="grid grid-cols-2 gap-2 mb-2 pb-2 border-b border-[#2A2443]">
                                          <div>
                                            <p className="text-[#8E88AB] font-semibold">{t("clarityScore", { defaultValue: "Clarity Score" })}</p>
                                            <p className="font-bold">{lessonQualityScore}/5</p>
                                          </div>
                                          <div>
                                            <p className="text-[#8E88AB] font-semibold">{t("difficultyMatch", { defaultValue: "Difficulty Match" })}</p>
                                            <p className="font-bold">{lessonEvaluationData.difficultyMatch ? t("yes", { defaultValue: "Yes" }) : t("no", { defaultValue: "No" })}</p>
                                          </div>
                                        </div>
                                        {lessonEvaluationData.issues?.length > 0 && (
                                          <div className="mb-2">
                                            <p className="font-bold text-red-400 mb-1">{t("issuesIdentified", { defaultValue: "Issues Identified:" })}</p>
                                            <ul className="list-disc pl-4 space-y-1 text-red-300">
                                              {lessonEvaluationData.issues.map((issue: string, i: number) => (
                                                <li key={i}>{issue}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {lessonEvaluationData.suggestions?.length > 0 && (
                                          <div>
                                            <p className="font-bold text-emerald-400 mb-1">{t("suggestionsLabel", { defaultValue: "Suggestions:" })}</p>
                                            <ul className="list-disc pl-4 space-y-1 text-emerald-300">
                                              {lessonEvaluationData.suggestions.map((sug: string, i: number) => (
                                                <li key={i}>{sug}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={handleRevalidate}
                                  disabled={revalidating}
                                  className="text-xs flex items-center gap-1 bg-[#1E1A33] hover:bg-[#2A2443] text-[#8E88AB] transition px-2 py-1 rounded disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-3 h-3 ${revalidating ? "animate-spin" : ""}`} />
                                  <span>{revalidating ? t("revalidating", { defaultValue: "Re-validating..." }) : t("revalidate", { defaultValue: "Re-validate" })}</span>
                                </button>
                              </div>
                              
                              {lessonEvaluationData?.isApproved === false && (
                                <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-1">
                                  <div className="flex items-center gap-2 text-sm text-red-300">
                                    <span className="font-bold text-red-400">{t("warningLabel", { defaultValue: "⚠️ Warning:" })}</span> 
                                    {lessonEvaluationData.issues?.[0] || "Content did not pass quality checks."}
                                  </div>
                                  <button
                                    onClick={() => handleSelectLesson(lessonModuleTitle, selectedLesson)}
                                    className="shrink-0 text-xs font-bold bg-red-900/50 hover:bg-red-900/80 text-red-200 px-3 py-1.5 rounded transition"
                                  >
                                    {t("regenerateLesson", { defaultValue: "Regenerate Lesson" })}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="markdown-body text-base space-y-4 mt-6">
                          <Markdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              pre: ({children}) => (
                                <div className="bg-[#0E0C15] border border-[#2A2443] rounded-2xl p-6 my-5 font-mono text-sm text-indigo-200 shadow-lg overflow-x-auto relative">
                                  <div className="flex gap-1.5 mb-3 select-none">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                                  </div>
                                  <pre className="font-mono text-indigo-100 leading-relaxed">{children}</pre>
                                </div>
                              ),
                              code: ({children}) => (
                                <code className="bg-indigo-950/80 text-indigo-300 font-mono px-2 py-0.5 rounded text-sm font-semibold">{children}</code>
                              ),
                              h1: ({children}) => <h1 className="text-2xl font-bold text-[#FAF9FD] mt-6 mb-3 tracking-tight border-b border-[#2A2443] pb-2">{children}</h1>,
                              h2: ({children}) => <h2 className="text-xl font-bold text-[#FAF9FD] mt-5 mb-2.5 tracking-tight">{children}</h2>,
                              h3: ({children}) => <h3 className="text-lg font-bold text-[#FAF9FD] mt-4 mb-2">{children}</h3>,
                              p: ({children}) => <p className="text-[#CECADF] leading-relaxed mb-4 text-base font-normal">{children}</p>,
                              ul: ({children}) => <ul className="list-disc pl-6 space-y-2 mb-4 text-[#CECADF]">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-6 space-y-2 mb-4 text-[#CECADF]">{children}</ol>,
                              li: ({children}) => <li className="text-[#CECADF]">{children}</li>,
                            }}
                          >
                            {formatJsonLessonToMarkdown(lessonContent)}
                          </Markdown>
                        </div>

                        <div className="border-t border-[#2A2443] pt-5 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <p className="text-sm text-[#8E88AB] font-medium text-center sm:text-left">{t("feelingConfidentLesson", { defaultValue: "Feeling confident about this lesson? Let's verify your retention!" })}</p>
                          <button
                            onClick={handleStartQuiz}
                            className="text-base font-bold text-[#818CF8] hover:text-[#a5b4fc] transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>{t("startQuickQuiz", { defaultValue: "Start Quick Quiz" })}</span>
                            <ArrowRight className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ) : selectedProject ? (
                <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 md:p-8 shadow-xl flex flex-col gap-6 min-h-[500px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2A2443] pb-5 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider bg-amber-950/40 border border-amber-500/20 px-2.5 py-1 rounded-full">{t("moduleProject", { defaultValue: "Module Project" })}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span className="text-sm font-medium text-[#8E88AB]">{t("estimatedHoursVal", { hours: selectedProject.estimatedHours, defaultValue: "~{{hours}} hours", interpolation: { escapeValue: false } })}</span>
                      </div>
                      <h2 className="text-2xl font-bold text-[#FAF9FD] tracking-tight">{selectedProject.title}</h2>
                    </div>
                    
                    <div className="shrink-0 flex items-center gap-3">
                      <select
                        value={selectedProject.status}
                        onChange={(e) => {
                          const status = e.target.value;
                          trpc.updateProjectStatus.mutate({ projectId: selectedProject.id, status })
                            .then(() => setSelectedProject(prev => ({ ...prev, status })))
                            .catch(err => toast.error(t("toast.failedToUpdateStatus", { defaultValue: "Failed to update status" })));
                        }}
                        className={`text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none transition-colors border ${
                          selectedProject.status === 'completed' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' :
                          selectedProject.status === 'in_progress' ? 'bg-amber-950/40 border-amber-500/30 text-amber-400' :
                          'bg-[#121021] border-[#2A2443] text-[#CECADF]'
                        }`}
                      >
                        <option value="not_started">{t("notStarted", { defaultValue: "Not Started" })}</option>
                        <option value="in_progress">{t("inProgress", { defaultValue: "In Progress" })}</option>
                        <option value="completed">{t("completedCheck", { defaultValue: "Completed ✓" })}</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="text-[#CECADF] space-y-6">
                    <p className="text-lg text-[#FAF9FD] font-medium">{selectedProject.description}</p>
                    
                    <div>
                      <h3 className="text-lg font-bold text-[#FAF9FD] mb-3">{t("objectives", { defaultValue: "Objectives" })}</h3>
                      <ul className="list-disc pl-5 space-y-2">
                        {Array.isArray(selectedProject.objectives) && selectedProject.objectives.map((obj: string, i: number) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-[#FAF9FD] mb-3">{t("stepByStepGuide", { defaultValue: "Step-by-Step Guide" })}</h3>
                      <ol className="list-decimal pl-5 space-y-3">
                        {Array.isArray(selectedProject.steps) && selectedProject.steps.map((step: string, i: number) => (
                          <li key={i} className="pl-1 leading-relaxed">{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="bg-[#121021] border border-[#2A2443] p-5 rounded-2xl">
                      <h3 className="text-lg font-bold text-[#FAF9FD] mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400" /> {t("successCriteria", { defaultValue: "Success Criteria" })}
                      </h3>
                      <ul className="space-y-2">
                        {Array.isArray(selectedProject.successCriteria) && selectedProject.successCriteria.map((crit: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-emerald-500 mt-0.5">•</span>
                            <span>{crit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="border-t border-[#2A2443] pt-6">
                      <label className="block text-sm font-bold text-[#CECADF] mb-2">{t("submissionNotesOptional", { defaultValue: "Submission Notes (Optional)" })}</label>
                      <textarea
                        value={selectedProject.submissionNote || ""}
                        onChange={(e) => setSelectedProject(prev => ({ ...prev, submissionNote: e.target.value }))}
                        onBlur={(e) => {
                          trpc.updateProjectStatus.mutate({ 
                            projectId: selectedProject.id, 
                            status: selectedProject.status,
                            submissionNote: e.target.value 
                          });
                        }}
                        placeholder={t("submissionNotesPlaceholder", { defaultValue: "Link to your repo, live demo, or thoughts on the project..." })}
                        className="w-full bg-[#121021] border border-[#2A2443] text-[#FAF9FD] rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-12 shadow-xl flex flex-col items-center justify-center text-center gap-6 min-h-[500px]">
                  <div className="p-5 bg-[#121021] rounded-full text-[#818CF8]">
                    <Compass className="w-12 h-12" />
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-[#FAF9FD] text-2xl">{t("pickTopicToStart", { defaultValue: "Pick a Topic to Start Learning! 🚀" })}</h3>
                    <p className="text-base text-[#8E88AB] max-w-sm mt-2">
                      {t("clickAnyLessonTopic", { defaultValue: "Click any lesson topic in your personalized roadmap on the left. Your companion tutor will formulate study notes, annotated code exercises, and friendly models." })}
                    </p>
                  </div>
                </div>
              )}

            </div>

          </div>
          </div>
        )}

        {/* TAB 2: ASK MENTOR */}
        {activeTab === "mentor" && (
          <MentorChat
            currentRoadmap={currentRoadmap}
            selectedLesson={selectedLesson}
            mentorInput={mentorInput}
            setMentorInput={setMentorInput}
            mentorMessages={mentorMessages}
            mentorLoading={mentorLoading}
            activeCourseId={activeCourseId}
            setActiveCourse={setActiveCourse}
            handleSendMentorMessage={handleSendMentorMessage}
          />
        )}

        {/* TAB 3: QUICK QUIZ */}
        {activeTab === "quiz" && (
          <QuizRunner
            selectedLesson={selectedLesson}
            generatingQuiz={generatingQuiz}
            quizData={quizData}
            selectedAnswers={selectedAnswers}
            quizSubmitted={quizSubmitted}
            quizAnalysis={quizAnalysis}
            quizDifficulty={quizDifficulty}
            setQuizDifficulty={setQuizDifficulty}
            quizQuestionCount={quizQuestionCount}
            setQuizQuestionCount={setQuizQuestionCount}
            generateQuiz={generateQuiz}
            handleSubmitQuiz={handleSubmitQuiz}
            handleSelectAnswer={handleSelectAnswer}
            setActiveTab={setActiveTab}
          />
        )}

        {/* TAB 4: MY PROGRESS & STATS */}
        {activeTab === "progress" && (
          <ProgressDashboard
            completionPercentage={completionPercentage}
            completedLessonsCount={completedLessonsCount}
            totalLessons={totalLessons}
            completedQuizzes={completedQuizzes}
            completedLessons={completedLessons}
            currentRoadmap={currentRoadmap}
            streakDays={userDbProgress?.streakDays || 1}
            activeCourseId={activeCourseId}
          />
        )}

        {/* FOOTER - inside scrollable main container */}
        <footer className="border-t border-[#2A2443]/30 bg-[#141223]/30 py-6 px-4 text-center mt-auto shrink-0">
          <p className="text-xs text-[#8E88AB] font-medium">
            {t("footerText", { defaultValue: "ZachCourse Companion Core • Powered by Warm Generative AI Guidance" })}
          </p>
        </footer>

        </div>
      </main>
    </div>

  </div>
);
}
