import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  Plus,
  Flame,
  Book,
  Menu,
  Users,
  Lock,
  Search as SearchIcon,
  BookOpen as BookOpenIcon,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { toast, Toaster } from "sonner";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useTrialStore, TrialCourse, TrialVisualRoadmap } from "../../lib/useTrialStore";
import { apiFetch } from "../../lib/api";
import AppSidebar from "../../components/AppSidebar";
import AppHeader from "../../components/AppHeader";
import { QuizRunner } from "../../components/QuizRunner";
import { ProgressDashboard } from "../../components/ProgressDashboard";
import { MentorChat } from "../../components/MentorChat";
import VisualRoadmapsTab from "../../components/VisualRoadmapsTab";
import { PersonalizationFields } from "../../components/PersonalizationFields";
import { DocumentUpload } from "../../components/DocumentUpload";
import { TourController } from "../../components/tour/TourController";
import AnalyticsDashboard from "../../components/AnalyticsDashboard";
import { ApiKeyOnboarding } from "../../components/ApiKeyOnboarding";

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
      const response = await apiFetch("/api/translate-lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-trial-mode": "1",
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

export default function TrialPage() {
  const { t, i18n } = useTranslation(["common", "landing", "header", "progressDashboard", "mentorChat"]);
  const {
    courses,
    vroadmaps,
    activeCourseId,
    activeCourse,
    setActiveCourseId,
    activeVRoadmapId,
    activeVRoadmap,
    setActiveVRoadmapId,
    addCourse,
    deleteCourse,
    updateCourseProgress,
    updateCourseActiveLesson,
    addVisualRoadmap,
    deleteVisualRoadmap,
    updateVisualRoadmapProgress,
    saveLessonContent,
    getLessonContent,
    getCourseMessages,
    addCourseMessage,
    clearAllTrialData,
    courseCount,
    vroadmapCount,
  } = useTrialStore();

  // Navigation State
  const [activeTab, setActiveTab] = useState("roadmap");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleKeyChange = () => {
      const k = localStorage.getItem("zc_user_key");
      setHasKey(!!k && k !== "null" && k !== "undefined" && k.trim() !== "");
    };
    window.addEventListener("zc-key-status-changed", handleKeyChange);
    return () => window.removeEventListener("zc-key-status-changed", handleKeyChange);
  }, []);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");

  // Course Generation Form State
  const [topicInput, setTopicInput] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [weeklyHours, setWeeklyHours] = useState(5);
  const [generatingCourse, setGeneratingCourse] = useState(false);
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [textContentInput, setTextContentInput] = useState("");
  const [documentContext, setDocumentContext] = useState("");
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [showUrlInputs, setShowUrlInputs] = useState(false);
  const [backgroundContext, setBackgroundContext] = useState("");
  const [tone, setTone] = useState("friendly");

  // Active Lesson State
  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);
  const [lessonContent, setLessonContent] = useState<string | null>(null);
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [isTranslatingLesson, setIsTranslatingLesson] = useState(false);

  const [hasKey, setHasKey] = useState(() => {
    if (typeof window !== "undefined") {
      const k = localStorage.getItem("zc_user_key");
      return !!k && k !== "null" && k !== "undefined" && k.trim() !== "";
    }
    return false;
  });

  // Mentor Chat State
  const [mentorInput, setMentorInput] = useState("");
  const [mentorMessages, setMentorMessages] = useState<any[]>([]);
  const [mentorLoading, setMentorLoading] = useState(false);

  // Quiz State
  const [quizData, setQuizData] = useState<any>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizDifficulty, setQuizDifficulty] = useState<string>("Medium");
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(3);

  // Translation States & Triggers for Trial Mode
  const [translatedCourse, setTranslatedCourse] = useState<any | null>(null);
  const [translatedVRoadmap, setTranslatedVRoadmap] = useState<any | null>(null);
  const [isTranslatingCourse, setIsTranslatingCourse] = useState(false);
  const [isTranslatingVR, setIsTranslatingVR] = useState(false);
  const [reloadCourseTrigger, setReloadCourseTrigger] = useState(0);
  const [reloadVRoadmapTrigger, setReloadVRoadmapTrigger] = useState(0);

  const displayCourse = translatedCourse || activeCourse;
  const displayVRoadmap = translatedVRoadmap || activeVRoadmap;

  // Standard Course Translation Effect for Trial Mode
  useEffect(() => {
    if (!activeCourse) {
      setTranslatedCourse(null);
      return;
    }

    if (i18n.language === "en") {
      setTranslatedCourse(null);
      return;
    }

    let cancelled = false;
    const cacheKey = `zc_trial_course_translation_${activeCourse.id}_${i18n.language}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setTranslatedCourse(parsed);
        return;
      } catch (e) {
        console.error("Failed to parse cached course translation", e);
      }
    }

    const userKey = localStorage.getItem("zc_user_key");
    if (!userKey) {
      setTranslatedCourse(null);
      return;
    }

    const translate = async () => {
      setIsTranslatingCourse(true);
      try {
        const translatedRoadmap = await translateWithRetry(
          { type: "roadmap", content: activeCourse.roadmapData, language: i18n.language },
          userKey
        );
        if (cancelled) return;

        const translatedData = {
          ...activeCourse,
          roadmapData: {
            ...translatedRoadmap,
            title: translatedRoadmap.title || activeCourse.title,
          },
          title: translatedRoadmap.title || activeCourse.title,
          description: translatedRoadmap.description || activeCourse.description
        };

        localStorage.setItem(cacheKey, JSON.stringify(translatedData));
        setTranslatedCourse(translatedData);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Trial course translation failed", err);
          toast.error(t("failedToTranslateRoadmap", { defaultValue: "Roadmap translation failed. Displaying original English version." }));
        }
      } finally {
        if (!cancelled) {
          setIsTranslatingCourse(false);
        }
      }
    };

    translate();

    return () => {
      cancelled = true;
    };
  }, [activeCourse?.id, i18n.language, reloadCourseTrigger]);

  // Visual Roadmap Translation Effect for Trial Mode
  useEffect(() => {
    if (!activeVRoadmap) {
      setTranslatedVRoadmap(null);
      return;
    }

    if (i18n.language === "en") {
      setTranslatedVRoadmap(null);
      return;
    }

    let cancelled = false;
    const cacheKey = `zc_trial_vroadmap_translation_${activeVRoadmap.id}_${i18n.language}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setTranslatedVRoadmap(parsed);
        return;
      } catch (e) {
        console.error("Failed to parse cached vroadmap translation", e);
      }
    }

    const userKey = localStorage.getItem("zc_user_key");
    if (!userKey) {
      setTranslatedVRoadmap(null);
      return;
    }

    const translate = async () => {
      setIsTranslatingVR(true);
      try {
        const translatedVRoadmapRes = await translateWithRetry(
          { type: "vroadmap", content: activeVRoadmap.roadmapData, language: i18n.language },
          userKey
        );
        if (cancelled) return;

        const translatedData = {
          ...activeVRoadmap,
          roadmapData: translatedVRoadmapRes,
          title: translatedVRoadmapRes.title || activeVRoadmap.title,
          topic: translatedVRoadmapRes.topic || activeVRoadmap.topic,
          description: translatedVRoadmapRes.description || activeVRoadmap.description,
        };

        localStorage.setItem(cacheKey, JSON.stringify(translatedData));
        setTranslatedVRoadmap(translatedData);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Trial vroadmap translation failed", err);
          toast.error(t("failedToTranslateRoadmap", { defaultValue: "Roadmap translation failed. Displaying original English version." }));
        }
      } finally {
        if (!cancelled) {
          setIsTranslatingVR(false);
        }
      }
    };

    translate();

    return () => {
      cancelled = true;
    };
  }, [activeVRoadmap?.id, i18n.language, reloadVRoadmapTrigger]);

  // Force Retranslate Course Handler
  const handleForceRetranslate = async () => {
    if (!activeCourse) return;
    const currentLanguage = i18n.language;
    if (currentLanguage === "en") {
      toast.error("Retranslation is only supported for non-English languages.");
      return;
    }

    const confirmReset = window.confirm(
      `Are you sure you want to force a re-translation of this course into ${currentLanguage}? This will clear the cached translation and request a fresh translation from the AI model.`
    );
    if (!confirmReset) return;

    setIsTranslatingCourse(true);
    const toastId = toast.loading("Clearing translation cache and requesting fresh translation...");

    try {
      const cacheKey = `zc_trial_course_translation_${activeCourse.id}_${currentLanguage}`;
      localStorage.removeItem(cacheKey);

      setReloadCourseTrigger(prev => prev + 1);
      toast.success("Retranslation triggered successfully!", { id: toastId });
    } catch (err: any) {
      console.error("Force retranslate failed:", err);
      toast.error(`Force retranslate failed: ${err.message || "Unknown error"}`, { id: toastId });
    } finally {
      setIsTranslatingCourse(false);
    }
  };

  // Force Retranslate VRoadmap Handler
  const handleForceRetranslateVR = async () => {
    if (!activeVRoadmap) return;
    const currentLanguage = i18n.language;
    if (currentLanguage === "en") {
      toast.error("Retranslation is only supported for non-English languages.");
      return;
    }

    const confirmReset = window.confirm(
      `Are you sure you want to force a re-translation of this roadmap into ${currentLanguage}? This will clear the cached translation and request a fresh translation from the AI model.`
    );
    if (!confirmReset) return;

    setIsTranslatingVR(true);
    const toastId = toast.loading("Clearing translation cache and requesting fresh translation...");

    try {
      const cacheKey = `zc_trial_vroadmap_translation_${activeVRoadmap.id}_${currentLanguage}`;
      localStorage.removeItem(cacheKey);

      setReloadVRoadmapTrigger(prev => prev + 1);
      toast.success("Retranslation triggered successfully!", { id: toastId });
    } catch (err: any) {
      console.error("Force retranslate failed:", err);
      toast.error(`Force retranslate failed: ${err.message || "Unknown error"}`, { id: toastId });
    } finally {
      setIsTranslatingVR(false);
    }
  };

  // Fetch / Sync details when active course changes
  useEffect(() => {
    if (displayCourse) {
      // Sync active lesson
      if (displayCourse.currentLessonId) {
        // Find lesson in roadmap
        let foundLesson = null;
        if (displayCourse.roadmapData?.modules) {
          for (const mod of displayCourse.roadmapData.modules) {
            const lesson = mod.lessons?.find((l: any) => l.id === displayCourse.currentLessonId);
            if (lesson) {
              foundLesson = lesson;
              break;
            }
          }
        }
        setSelectedLesson(foundLesson);
      } else {
        // Set first lesson as default
        const firstLesson = displayCourse.roadmapData?.modules?.[0]?.lessons?.[0];
        if (firstLesson) {
          setSelectedLesson(firstLesson);
          updateCourseActiveLesson(displayCourse.id, firstLesson.id);
        } else {
          setSelectedLesson(null);
        }
      }

      // Sync chat messages
      const msgs = getCourseMessages(displayCourse.id);
      // Map to shape expected by MentorChat
      const mapped = msgs.map((m: any) => ({
        role: m.sender === "mentor" ? "assistant" : m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));
      setMentorMessages(mapped);
    } else {
      setSelectedLesson(null);
      setMentorMessages([]);
    }
    // Reset states
    setLessonContent(null);
    setQuizData(null);
    setQuizSubmitted(false);
    setSelectedAnswers({});
  }, [activeCourseId, displayCourse?.id, displayCourse?.roadmapData]);

  // Read lesson content cache
  useEffect(() => {
    if (activeCourse && selectedLesson) {
      const cached = getLessonContent(activeCourse.id, selectedLesson.id);
      setLessonContent(cached || null);
    } else {
      setLessonContent(null);
    }
    setQuizData(null);
    setQuizSubmitted(false);
    setSelectedAnswers({});
  }, [selectedLesson?.id]);

  // Translate lesson content when language changes
  useEffect(() => {
    let cancelled = false;

    const translateLesson = async () => {
      if (!activeCourse || !selectedLesson || !lessonContent || generatingLesson || i18n.language === "en") {
        return;
      }

      const userKey = localStorage.getItem("zc_user_key");
      if (!userKey) return;

      setIsTranslatingLesson(true);
      try {
        const contentTranslated = await translateWithRetry({ type: "lesson", content: lessonContent, language: i18n.language }, userKey);
        if (!cancelled) {
          setLessonContent(contentTranslated);
        }
      } catch (err: any) {
        console.error("Failed to translate lesson:", err);
      } finally {
        if (!cancelled) {
          setIsTranslatingLesson(false);
        }
      }
    };

    translateLesson();

    const translateQuiz = async () => {
      if (!quizData || generatingQuiz || i18n.language === "en") return;
      const userKey = localStorage.getItem("zc_user_key");
      if (!userKey) return;
      
      try {
        const contentTranslated = await translateWithRetry({ type: "quiz", content: quizData, language: i18n.language }, userKey);
        if (!cancelled) {
          setQuizData(contentTranslated);
        }
      } catch (err: any) {
        console.error("Failed to translate quiz:", err);
      }
    };

    translateQuiz();

    return () => {
      cancelled = true;
    };
  }, [i18n.language, activeCourse?.id, selectedLesson?.id]);

  // Trigger locked actions
  const triggerUpgrade = (reason: string) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
  };

  // 1. Generate Course Roadmap
  const handleGenerateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;

    if (courseCount >= 2) {
      triggerUpgrade(t("trialCourseLimitExceeded", { defaultValue: "You've reached the free trial limit of 2 courses. Create an account to build unlimited learning pathways!" }));
      return;
    }

    setGeneratingCourse(true);
    const id = toast.loading(t("generatingCourse", { defaultValue: "Designing your personalized learning pathway... ✨" }));

    try {
      const res = await apiFetch("/api/generate-roadmap", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-trial-mode": "1"
        },
        body: JSON.stringify({
          topic: topicInput,
          sourceUrl: sourceUrlInput || undefined,
          textContent: textContentInput || undefined,
          documentContext: documentContext || undefined,
          experienceLevel,
          backgroundContext,
          tone,
          weeklyHours
        })
      });

      if (!res.ok) {
        throw new Error("Failed to generate course roadmap.");
      }

      const rawResponse = await res.json();
      const roadmapData = rawResponse.roadmap;

      if (!roadmapData || !roadmapData.modules) {
        throw new Error("Received an empty or malformed roadmap from the AI.");
      }
      
      const newCourse = addCourse({
        title: roadmapData.title || topicInput,
        topic: topicInput,
        difficulty: roadmapData.difficulty || "Beginner",
        experienceLevel,
        weeklyHours,
        tone,
        isActive: true,
        roadmapData,
        prerequisites: roadmapData.prerequisites || [],
        description: roadmapData.description || "A personalized curriculum on " + topicInput,
        backgroundContext,
        sourceUrl: sourceUrlInput || undefined,
        textContent: textContentInput || undefined,
        documentContext: documentContext || undefined,
      });

      toast.success(t("courseReady", { defaultValue: "Your course is ready! Let's start learning. 🚀" }), { id });
      
      // Reset inputs
      setTopicInput("");
      setSourceUrlInput("");
      setTextContentInput("");
      setDocumentContext("");
      setUploadedFileNames([]);
      setShowUrlInputs(false);
      setBackgroundContext("");
      setTone("friendly");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("failedToGenerateCourse", { defaultValue: "Failed to generate roadmap. Please check your network or try again." }), { id });
    } finally {
      setGeneratingCourse(false);
    }
  };

  // 2. Generate Lesson content
  const handleStartLesson = async () => {
    if (!activeCourse || !selectedLesson) return;
    setGeneratingLesson(true);
    const toastId = toast.loading(t("fetchingLessonContent", { defaultValue: "Drafting lesson material and study guide... 📚" }));

    try {
      const res = await apiFetch("/api/generate-lesson", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-trial-mode": "1"
        },
        body: JSON.stringify({
          lessonTitle: selectedLesson.title,
          courseTopic: activeCourse.topic,
          concepts: selectedLesson.concepts || [],
          experienceLevel: activeCourse.experienceLevel,
          backgroundContext: activeCourse.backgroundContext,
          tone: activeCourse.tone,
          language: i18n.language
        })
      });

      if (!res.ok) {
        throw new Error("Failed to generate study guide.");
      }

      const lessonData = await res.json();
      const content = lessonData.content;
      saveLessonContent(activeCourse.id, selectedLesson.id, content);
      setLessonContent(content);
      toast.success(t("lessonReady", { defaultValue: "Lesson material ready! 📝" }), { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("failedToGenerateLesson", { defaultValue: "Failed to load study guide. Please try again." }), { id: toastId });
    } finally {
      setGeneratingLesson(false);
    }
  };

  // 3. Mark Lesson Completed
  const handleToggleLessonComplete = () => {
    if (!activeCourse || !selectedLesson) return;
    const completed = activeCourse.completedLessons || [];
    let updated: string[];
    if (completed.includes(selectedLesson.id)) {
      updated = completed.filter(id => id !== selectedLesson.id);
      toast.success(t("lessonUncompleted", { defaultValue: "Lesson marked as incomplete." }));
    } else {
      updated = [...completed, selectedLesson.id];
      toast.success(t("lessonCompleted", { defaultValue: "Congratulations on completing the lesson! 🎉" }));
    }
    updateCourseProgress(activeCourse.id, updated, activeCourse.completedQuizzes || {});
  };

  // 4. Send Mentor Message
  const handleSendMentorMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorInput.trim() || !activeCourse) return;

    const userMsg = mentorInput.trim();
    setMentorInput("");
    setMentorLoading(true);

    // Add message locally
    addCourseMessage(activeCourse.id, { sender: "user", text: userMsg });

    // Stream state placeholder
    let assistantText = "";
    const activeMsgs = getCourseMessages(activeCourse.id);
    const mappedHistory = activeMsgs.slice(-8).map((m: any) => ({
      role: m.sender === "mentor" ? "assistant" : "user",
      content: m.text
    }));

    try {
      const response = await apiFetch("/api/mentor-chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-trial-mode": "1"
        },
        body: JSON.stringify({
          message: userMsg,
          history: mappedHistory,
          courseId: activeCourse.id,
          currentCourseTitle: activeCourse.title,
          currentLessonTitle: selectedLesson?.title || "General Context",
          currentLessonId: selectedLesson?.id,
          backgroundContext: activeCourse.backgroundContext,
          experienceLevel: activeCourse.experienceLevel,
          tone: activeCourse.tone,
          language: i18n.language
        })
      });

      if (!response.ok) {
        throw new Error("Mentor connection lost.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) {
        throw new Error("No readable stream.");
      }

      // Add empty mentor reply locally so we can update it in real-time
      const placeholderId = "placeholder_mentor_reply";
      setMentorMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6).trim());
              if (parsed.text) {
                assistantText += parsed.text;
                // Update UI state in real-time
                setMentorMessages(prev => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1].content = assistantText;
                  }
                  return updated;
                });
              }
            } catch (jsonErr) {
              // Ignore boundary failures or end sequences
            }
          }
        }
      }

      // Save complete assistant message to trial store
      addCourseMessage(activeCourse.id, { sender: "mentor", text: assistantText });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("mentorFailedToRespond", { defaultValue: "Failed to connect to Mentor." }));
    } finally {
      setMentorLoading(false);
    }
  };

  // 5. Generate Quiz
  const handleGenerateQuiz = async () => {
    if (!activeCourse || !selectedLesson || !lessonContent) return;
    setGeneratingQuiz(true);
    setQuizData(null);
    setQuizSubmitted(false);
    setSelectedAnswers({});

    try {
      const response = await apiFetch("/api/generate-quiz", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-trial-mode": "1"
        },
        body: JSON.stringify({
          lessonTitle: selectedLesson.title,
          lessonContent: lessonContent.slice(0, 1000), // optimized length
          language: i18n.language,
          tone: activeCourse.tone
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate quiz.");
      }

      const quizResult = await response.json();
      setQuizData(quizResult);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("failedToGenerateQuiz", { defaultValue: "Failed to generate multiple-choice questions. Try again." }));
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleQuizSubmit = (score: number) => {
    if (!activeCourse || !selectedLesson) return;
    setQuizSubmitted(true);
    const currentCompletedQuizzes = { ...(activeCourse.completedQuizzes || {}) };
    currentCompletedQuizzes[selectedLesson.id] = score;

    updateCourseProgress(activeCourse.id, activeCourse.completedLessons || [], currentCompletedQuizzes);
    toast.success(t("quizSubmittedSuccess", { defaultValue: "Quiz submitted! Score: {{score}}/3", score }));
  };

  const handleSubmitQuiz = () => {
    let score = 0;
    if (quizData && quizData.questions) {
      quizData.questions.forEach((q: any, idx: number) => {
        if (selectedAnswers[idx] === q.correctIndex) {
          score++;
        }
      });
    }
    handleQuizSubmit(score);
  };

  const handleSelectAnswer = (qIdx: number, oIdx: number) => {
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const handleRestartQuiz = () => {
    setQuizSubmitted(false);
    setSelectedAnswers({});
  };

  // 6. Generate Visual Roadmap
  const handleGenerateVisualRoadmap = async (data: any, meta: any) => {
    if (vroadmapCount >= 2) {
      triggerUpgrade(t("trialVRLimitExceeded", { defaultValue: "You've reached the free trial limit of 2 Visual Roadmaps. Create an account to build interactive graphical flows!" }));
      return;
    }

    const toastId = toast.loading(t("generatingVisualRoadmap", { defaultValue: "Generating comprehensive node-graph pathway... 🗺️" }));
    try {
      addVisualRoadmap({
        title: data.title || "Visual Roadmap",
        topic: data.topic,
        difficulty: "Intermediate",
        experienceLevel: data.experienceLevel || "beginner",
        weeklyHours: data.weeklyHours || 5,
        tone: "friendly",
        roadmapData: data,
        description: data.description || "Node-graph path on " + data.topic
      });
      toast.success(t("visualRoadmapReady", { defaultValue: "Visual graph roadmap ready! 🗺️" }), { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(t("visualRoadmapFailed", { defaultValue: "Failed to save visual roadmap." }), { id: toastId });
    }
  };

  // Suggestion pill helper
  const handlePillClick = (topic: string) => {
    setTopicInput(topic);
  };

  // Calculated course stats
  const totalLessonsCount = displayCourse?.roadmapData?.modules?.reduce((acc: number, mod: any) => acc + (mod.lessons?.length || 0), 0) || 0;
  const completedLessonsCount = displayCourse?.completedLessons?.length || 0;
  const completionPercentage = totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;
  const completedQuizzes = displayCourse?.completedQuizzes || {};

  if (!hasKey) {
    return (
      <ApiKeyOnboarding onActivate={() => setHasKey(true)} onSkip={() => {}} />
    );
  }

  return (
    <div className="flex h-screen bg-[#0F0D19] overflow-hidden text-[#CECADF] font-sans antialiased selection:bg-indigo-900 selection:text-indigo-200">
      <Toaster position="top-right" richColors />
      <TourController
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCourseId={activeCourseId}
        setActiveCourseId={setActiveCourseId}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isMobile={isMobile}
        mode="trial"
      />

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* App Sidebar customized for Trial */}
      <AppSidebar
        courses={courses as any[]}
        activeCourseId={activeCourseId}
        setActiveCourseId={(id) => {
          setActiveCourseId(id);
          if (id) {
            setActiveTab("roadmap");
          }
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={null}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSignOut={() => triggerUpgrade(t("signUpSaveProgress", { defaultValue: "Create a free account to save your learning history in the cloud!" }))}
        onDeleteCourse={(id) => {
          deleteCourse(id);
          toast.success(t("courseDeleted", { defaultValue: "Course deleted." }));
        }}
        onRenameCourse={(id, title) => {
          // Local update
          toast.info("Renaming local courses is a premium feature!");
        }}
        mode="trial"
        onCohortsLockedClick={() => triggerUpgrade(t("cohortsLockedDesc", { defaultValue: "Cohorts are locked in trial mode. Create an account to collaborate in real-time with other developers!" }))}
      />

      <div className={`flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? "md:pl-16" : "md:pl-64"}`}>
        {/* App Header customized for Trial */}
        <AppHeader
          onMenuClick={() => {
            if (window.innerWidth < 768) {
              setSidebarOpen(!sidebarOpen);
            } else {
              setSidebarCollapsed(!sidebarCollapsed);
            }
          }}
          isCollapsed={sidebarCollapsed}
          isOpen={sidebarOpen}
          session={null}
          onSignOut={() => triggerUpgrade(t("signUpSaveProgress"))}
          mode="trial"
          onUpgradeClick={() => triggerUpgrade(t("upgradeUnlockPremium", { defaultValue: "Unlock Certificates, collaborative Cohorts, Teacher dashboard and premium models!" }))}
        />

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
          
          {/* TAB 1: ROADMAP CURRICULUM VIEW */}
          {activeTab === "roadmap" && (
            <div className="relative">
              {generatingCourse && (
                <div className="absolute inset-0 bg-[#0F0D19]/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6 rounded-3xl animate-in fade-in duration-200" style={{ minHeight: "450px" }}>
                  <Loader2 className="w-12 h-12 text-[#4F46E5] animate-spin mb-4" />
                  <h3 className="text-lg font-bold text-[#FAF9FD] mb-2">{t("curatorForming", { defaultValue: "Analyzing syllabus and generating personalized pathway... ✨" })}</h3>
                  <p className="text-sm text-[#8E88AB] max-w-sm mx-auto">{t("curatorWait", { defaultValue: "Gemini is pacing lessons, adjusting conceptual difficulties, and embedding hands-on final projects." })}</p>
                </div>
              )}

              {!activeCourseId ? (
                /* 1A. COURSE BUILDER FORM */
                <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-200">
                  <div className="bg-gradient-to-br from-[#1E1A38] to-[#121021] border border-[#2A2443] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex items-center gap-3.5 mb-6">
                      <span className="text-4xl">✨</span>
                      <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{t("createNewLearningAdventure", { defaultValue: "Create a New Learning Adventure" })}</h2>
                        <p className="text-sm text-[#8E88AB] mt-1">{t("createNewLearningAdventureDesc", { defaultValue: "What would you like to explore today? Your companion tutor will customize the perfect path." })}</p>
                      </div>
                    </div>

                    <form onSubmit={handleGenerateCourse} className="space-y-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-[#CECADF]">
                          {t("topicSkillLabel", { defaultValue: "Topic or Skill you want to learn:" })}
                        </label>
                        <div className="relative">
                          <SearchIcon className="absolute left-4 top-3.5 w-5 h-5 text-[#8E88AB]" />
                          <input
                            type="text"
                            placeholder="e.g. React 19 Frontend Developer, Deep Learning with PyTorch, Cooking Foundations..."
                            value={topicInput}
                            onChange={(e) => setTopicInput(e.target.value)}
                            className="w-full bg-[#0B0914] border border-[#2A2443] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-[#8E88AB]/70 focus:outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10 transition-all font-medium"
                            required
                          />
                        </div>
                      </div>

                      {/* Suggestions */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-[#8E88AB] uppercase tracking-wider">{t("tryPopularTopics", { defaultValue: "Try popular topics:" })}</p>
                        <div className="flex flex-wrap gap-2">
                          {["Python Programming", "TypeScript & React 19", "Machine Learning", "System Design", "Spanish Basics"].map((pill) => (
                            <button
                              key={pill}
                              type="button"
                              onClick={() => handlePillClick(pill)}
                              className="px-3 py-1.5 bg-[#0F0D19] hover:bg-[#1E1A33] border border-[#2A2443] rounded-xl text-xs font-semibold text-[#CECADF] transition cursor-pointer"
                            >
                              {pill}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Collapsible reference options */}
                      <div className="border-t border-[#2A2443] pt-4">
                        <button
                          type="button"
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
                                className="w-full bg-[#1A1A2E] border border-[#2A2443] rounded-xl py-2.5 px-4 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/70 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all font-medium"
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
                                className="w-full bg-[#1A1A2E] border border-[#2A2443] rounded-xl py-2.5 px-4 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/70 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all font-medium"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Document Upload */}
                      <div>
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

                      {/* Config Options */}
                      <div className="flex flex-col gap-6 border-t border-[#2A2443] pt-6">
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
                        type="submit"
                        disabled={generatingCourse}
                        className="w-full py-4 px-6 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold rounded-2xl transition duration-150 flex items-center justify-center gap-2.5 shadow-lg shadow-[#4F46E5]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        <Sparkles className="w-5 h-5" />
                        <span>{t("generateMyPath", { defaultValue: "Generate My Customized Pathway" })}</span>
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                /* 1B. ACTIVE ROADMAP & STUDY WORKSPACE */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Roadmap Syllabus navigation */}
                  <div className="lg:col-span-4 space-y-6">
                    {isTranslatingCourse && (
                      <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-center gap-3 animate-pulse">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
                        <p className="text-sm font-semibold text-indigo-200">{t("translatingRoadmap", { defaultValue: "Translating course content..." })}</p>
                      </div>
                    )}
                    <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-5 shadow-xl space-y-5 relative">
                      <div className="flex items-center gap-3">
                        <BookOpenIcon className="w-6 h-6 text-indigo-400" />
                        <div>
                          <h2 className="text-lg font-black text-white leading-tight">{displayCourse.title}</h2>
                          <p className="text-xs text-[#8E88AB] mt-0.5">{displayCourse.difficulty} • {displayCourse.experienceLevel}</p>
                          {i18n.language !== "en" && (
                            <div className="mt-2.5">
                              <button
                                onClick={handleForceRetranslate}
                                disabled={isTranslatingCourse}
                                className="text-[10px] bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 font-extrabold px-3 py-1 rounded-full border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                <span>⚡ {t("forceRetranslate", { defaultValue: "Force Retranslate" })}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Course progress bar */}
                      <div className="space-y-1.5 pt-2 border-t border-[#2A2443]/55">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-[#8E88AB]">{t("courseProgress", { defaultValue: "Course Progress" })}</span>
                          <span className="text-indigo-400">{completionPercentage}%</span>
                        </div>
                        <div className="w-full bg-[#121021] rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#8E88AB] text-right">
                          {completedLessonsCount} / {totalLessonsCount} lessons complete
                        </p>
                      </div>

                      {/* Syllabus Lessons list */}
                      <div className="space-y-4 pt-3 overflow-y-auto max-h-[450px]">
                        {displayCourse.roadmapData?.modules?.map((mod: any, mIdx: number) => (
                          <div key={mod.id || mIdx} className="space-y-2">
                            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider mb-2.5">
                              {mod.title}
                            </h4>
                            <div className="space-y-1.5">
                              {mod.lessons?.map((lesson: any, lIdx: number) => {
                                const isCurrent = selectedLesson?.id === lesson.id;
                                const isCompleted = displayCourse.completedLessons?.includes(lesson.id);
                                return (
                                  <button
                                    key={lesson.id || lIdx}
                                    onClick={() => {
                                      setSelectedLesson(lesson);
                                      updateCourseActiveLesson(displayCourse.id, lesson.id);
                                    }}
                                    className={`w-full text-left p-3 rounded-xl transition duration-150 flex items-center justify-between cursor-pointer group text-xs font-semibold
                                      ${isCurrent 
                                        ? "bg-indigo-600/20 border border-indigo-500/40 text-white" 
                                        : "bg-[#121021] hover:bg-[#151227] border border-transparent text-[#8E88AB] hover:text-[#FAF9FD]"
                                      }
                                    `}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {isCompleted ? (
                                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                      ) : (
                                        <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-indigo-400' : 'text-slate-600'}`} />
                                      )}
                                      <span className="truncate pr-2">{lesson.title}</span>
                                    </div>
                                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isCurrent ? 'translate-x-0.5' : 'opacity-0 group-hover:opacity-100'}`} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Active Study Workspace */}
                  <div className="lg:col-span-8">
                    {selectedLesson ? (
                      <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-6 sm:p-8 shadow-xl min-h-[500px] flex flex-col justify-between">
                        
                        {/* Material Display */}
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2443]/60 pb-5">
                            <div>
                              <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest">{t("activeLessonMaterial", { defaultValue: "Active Lesson Material" })}</span>
                              <h1 className="text-2xl font-black text-white tracking-tight mt-1 leading-tight">{selectedLesson.title}</h1>
                            </div>
                            
                            <button
                              onClick={handleToggleLessonComplete}
                              disabled={!lessonContent}
                              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer border shrink-0 transition
                                ${displayCourse.completedLessons?.includes(selectedLesson.id)
                                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                  : "bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                }
                              `}
                            >
                              <Check className="w-4 h-4" />
                              <span>
                                {displayCourse.completedLessons?.includes(selectedLesson.id)
                                  ? t("lessonCompleted", { defaultValue: "Completed ✓" })
                                  : t("completeLesson", { defaultValue: "Complete Lesson" })
                                }
                              </span>
                            </button>
                          </div>

                          {/* STUDY TEXT AREA */}
                          <div className="max-w-none">
                            {generatingLesson || isTranslatingLesson ? (
                              <div className="py-16 text-center space-y-4">
                                <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin mx-auto" />
                                <p className="text-sm font-semibold text-[#8E88AB]">
                                  {isTranslatingLesson 
                                    ? t("translatingStudyGuide", { defaultValue: "Translating study guide... 📚" }) 
                                    : t("geminiDrafting", { defaultValue: "AI Tutor is writing customized syllabus guide..." })
                                  }
                                </p>
                              </div>
                            ) : lessonContent ? (
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
                                    code: ({node, inline, className, children, ...props}: any) => {
                                      const isInline = inline || !className;
                                      return isInline ? (
                                        <code className="bg-indigo-950/80 text-indigo-300 font-mono px-2 py-0.5 rounded text-sm font-semibold" {...props}>{children}</code>
                                      ) : (
                                        <code className="font-mono text-indigo-100 leading-relaxed text-sm block" {...props}>{children}</code>
                                      );
                                    },
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
                            ) : (
                              <div className="py-16 border-2 border-dashed border-[#2A2443] rounded-2xl text-center space-y-4 max-w-lg mx-auto p-6">
                                <span className="text-3xl">🧑‍🎓</span>
                                <h4 className="text-sm font-bold text-white">{t("readyToStudyLesson", { defaultValue: "Ready to study this lesson?" })}</h4>
                                <p className="text-xs text-[#8E88AB] leading-relaxed">
                                  {t("readyToStudyDesc", { defaultValue: "Click below to trigger a live study material draft. Your companion model will customize explanation depth on demand." })}
                                </p>
                                <button
                                  onClick={handleStartLesson}
                                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto cursor-pointer"
                                >
                                  <Sparkles className="w-4 h-4 animate-pulse" />
                                  <span>{t("startLesson", { defaultValue: "Start Lesson ✨" })}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive Widgets row (Quiz / Mentor) */}
                        {lessonContent && !generatingLesson && (
                          <div className="mt-8 pt-6 border-t border-[#2A2443]/60 flex flex-wrap gap-3">
                            <button
                              onClick={() => setActiveTab("mentor")}
                              className="px-4 py-2.5 bg-[#121021] hover:bg-[#151227] border border-[#2A2443] hover:border-indigo-500/40 rounded-xl text-xs font-bold text-indigo-300 transition flex items-center gap-2 cursor-pointer"
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>{t("discussWithMentor", { defaultValue: "Discuss with Mentor" })}</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveTab("quiz");
                                if (!quizData) handleGenerateQuiz();
                              }}
                              className="px-4 py-2.5 bg-[#121021] hover:bg-[#151227] border border-[#2A2443] hover:border-indigo-500/40 rounded-xl text-xs font-bold text-indigo-300 transition flex items-center gap-2 cursor-pointer"
                            >
                              <Book className="w-4 h-4" />
                              <span>
                                {displayCourse.completedQuizzes?.[selectedLesson.id] !== undefined
                                  ? t("reviewQuizScore", { defaultValue: "Review Quiz Result" })
                                  : t("takePracticeQuiz", { defaultValue: "Take Practice Quiz" })
                                }
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-12 text-center shadow-xl flex flex-col justify-center items-center min-h-[400px]">
                        <span className="text-4xl mb-4">👈</span>
                        <h3 className="text-lg font-bold text-white">{t("selectLessonLeft", { defaultValue: "Select a Lesson on the left" })}</h3>
                        <p className="text-xs text-[#8E88AB] max-w-xs mt-1.5">{t("selectLessonLeftDesc", { defaultValue: "Syllabus structures are dynamic! Choose any chapter to start generating material on demand." })}</p>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 2: ASK MENTOR CHAT */}
          {activeTab === "mentor" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-150">
              {activeCourseId ? (
                <MentorChat
                  currentRoadmap={displayCourse.roadmapData}
                  selectedLesson={selectedLesson}
                  mentorInput={mentorInput}
                  setMentorInput={setMentorInput}
                  mentorMessages={mentorMessages}
                  mentorLoading={mentorLoading}
                  activeCourseId={displayCourse.id}
                  setActiveCourse={() => {}} // Local bypass
                  handleSendMentorMessage={handleSendMentorMessage}
                  isTrial={true}
                  onClearTrialMessages={() => {
                    localStorage.removeItem(`zc_trial_chat_${displayCourse.id}`);
                    setMentorMessages([]);
                  }}
                />
              ) : (
                <div className="max-w-md mx-auto bg-[#1A172E] border border-[#2A2443] rounded-3xl p-8 text-center shadow-xl py-12">
                  <span className="text-4xl mb-3 select-none">🧑‍🏫</span>
                  <h3 className="text-lg font-black text-white">{t("noActiveCourseMentor", { defaultValue: "No Active Course Available" })}</h3>
                  <p className="text-xs text-[#8E88AB] leading-relaxed mt-2">
                    {t("noActiveCourseMentorDesc", { defaultValue: "To chat with your AI mentor tutor, please create a custom learning course adventure first! This feeds personalized context to responses." })}
                  </p>
                  <button
                    onClick={() => setActiveTab("roadmap")}
                    className="mt-5 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {t("createCourseNow", { defaultValue: "Create Course Now" })}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUIZ RUNNER */}
          {activeTab === "quiz" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-150">
              {activeCourseId && selectedLesson ? (
                <div className="max-w-2xl mx-auto bg-[#1A172E] border border-[#2A2443] rounded-3xl p-6 sm:p-8 shadow-xl">
                  <div className="border-b border-[#2A2443]/60 pb-4 mb-6">
                    <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest">{t("practiceQuiz", { defaultValue: "Practice Quiz" })}</span>
                    <h2 className="text-xl font-bold text-white tracking-tight mt-1">{selectedLesson.title}</h2>
                  </div>

                  {generatingQuiz ? (
                    <div className="py-16 text-center space-y-4">
                      <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin mx-auto" />
                      <p className="text-xs font-semibold text-[#8E88AB]">{t("geminiDraftingQuiz", { defaultValue: "Formulating MCQs from lesson content..." })}</p>
                    </div>
                  ) : quizData ? (
                    <QuizRunner
                      selectedLesson={selectedLesson}
                      generatingQuiz={generatingQuiz}
                      quizData={quizData}
                      selectedAnswers={selectedAnswers}
                      quizSubmitted={quizSubmitted}
                      quizAnalysis={null}
                      quizDifficulty={quizDifficulty}
                      setQuizDifficulty={setQuizDifficulty}
                      quizQuestionCount={quizQuestionCount}
                      setQuizQuestionCount={setQuizQuestionCount}
                      generateQuiz={handleGenerateQuiz}
                      handleSubmitQuiz={handleSubmitQuiz}
                      handleSelectAnswer={handleSelectAnswer}
                      setActiveTab={setActiveTab}
                    />
                  ) : (
                    <div className="py-12 border-2 border-dashed border-[#2A2443] rounded-2xl text-center space-y-4">
                      <span className="text-3xl">📝</span>
                      <h4 className="text-sm font-bold text-white">{t("readyForPracticeQuiz", { defaultValue: "Ready to test your knowledge?" })}</h4>
                      <p className="text-xs text-[#8E88AB] max-w-sm mx-auto px-4 leading-relaxed">
                        {!lessonContent 
                          ? t("mustReadLessonFirst", { defaultValue: "Please fetch/start the lesson study guide first to unlock practice quiz questions!" })
                          : t("generateQuizDesc", { defaultValue: "Click below to formulate exactly 3 multiple-choice questions matching this chapter's key conceptual goals." })
                        }
                      </p>
                      {lessonContent && (
                        <button
                          onClick={handleGenerateQuiz}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          <span>{t("generateQuiz", { defaultValue: "Generate Quiz Questions ✨" })}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-md mx-auto bg-[#1A172E] border border-[#2A2443] rounded-3xl p-8 text-center shadow-xl py-12">
                  <span className="text-4xl mb-3 select-none">📝</span>
                  <h3 className="text-lg font-black text-white">{t("noLessonSelectedQuiz", { defaultValue: "No Lesson Selected" })}</h3>
                  <p className="text-xs text-[#8E88AB] leading-relaxed mt-2">
                    {t("noLessonSelectedQuizDesc", { defaultValue: "Practice quizzes are compiled specifically from individual chapter syllabi. Please select a lesson from your active roadmap adventure first!" })}
                  </p>
                  <button
                    onClick={() => setActiveTab("roadmap")}
                    className="mt-5 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {t("goToRoadmapSyllabus", { defaultValue: "Go to Roadmap Syllabus" })}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MY PROGRESS & STATS */}
          {activeTab === "progress" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-150">
              {activeCourseId ? (
                <ProgressDashboard
                  completionPercentage={completionPercentage}
                  completedLessonsCount={completedLessonsCount}
                  totalLessons={totalLessonsCount}
                  completedQuizzes={completedQuizzes}
                  completedLessons={displayCourse.completedLessons || []}
                  currentRoadmap={displayCourse.roadmapData}
                  streakDays={1}
                  activeCourseId={displayCourse.id}
                  isTrial={true}
                  onCertificateLockedClick={() => triggerUpgrade(t("certLockedDesc", { defaultValue: "Certificates are locked in trial mode. Complete a full pathway and create an account to issue verifiable public credentials!" }))}
                />
              ) : (
                <div className="max-w-md mx-auto bg-[#1A172E] border border-[#2A2443] rounded-3xl p-8 text-center shadow-xl py-12">
                  <span className="text-4xl mb-3 select-none">📈</span>
                  <h3 className="text-lg font-black text-white">{t("noCourseActiveProgress", { defaultValue: "No Learning History Found" })}</h3>
                  <p className="text-xs text-[#8E88AB] leading-relaxed mt-2">
                    {t("noCourseActiveProgressDesc", { defaultValue: "Once you create a personalized course and toggle chapters completed or take practice quizzes, dynamic proficiency charts will populate here!" })}
                  </p>
                  <button
                    onClick={() => setActiveTab("roadmap")}
                    className="mt-5 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {t("createCourseNow")}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: VISUAL ROADMAPS GRAPH VIEW */}
          {activeTab === "visual-roadmaps" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-150">
              <VisualRoadmapsTab
                roadmaps={vroadmaps.map(vr => {
                  if (vr.id === activeVRoadmapId) {
                    return displayVRoadmap || vr;
                  }
                  return vr;
                })}
                currentPage={1}
                totalPages={1}
                onPageChange={() => {}}
                activeVRoadmapId={activeVRoadmapId}
                setActiveVRoadmapId={setActiveVRoadmapId}
                hasKey={true}
                onRoadmapGenerated={handleGenerateVisualRoadmap}
                onDelete={async (id) => {
                  deleteVisualRoadmap(id);
                  toast.success(t("visualRoadmapDeleted", { defaultValue: "Visual roadmap deleted." }));
                }}
                onForceRetranslate={handleForceRetranslateVR}
                isForceRetranslating={isTranslatingVR}
                isRetranslating={isTranslatingVR}
                onToggleFavorite={async (id, isFav) => {
                  // Local bypass
                  toast.info("Favorites synced in cloud! Create an account.");
                }}
                onToggleNodeComplete={async (roadmapId, nodeId) => {
                  const vr = vroadmaps.find(v => v.id === roadmapId);
                  if (vr) {
                    const currentNodes = vr.completedNodeIds || [];
                    const updated = currentNodes.includes(nodeId)
                      ? currentNodes.filter(nId => nId !== nodeId)
                      : [...currentNodes, nodeId];
                    updateVisualRoadmapProgress(roadmapId, updated);
                  }
                }}
              />
            </div>
          )}

          {/* TAB 6: LEARNING ANALYTICS */}
          {activeTab === "analytics" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-150">
              <AnalyticsDashboard isTrial={true} />
            </div>
          )}

        </main>
      </div>

      {/* UPGRADE / PREMIUM SIGN-UP PROMPT MODAL */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
          <div className="bg-[#121021] border border-indigo-500/30 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden text-left">
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
            
            <div className="space-y-4">
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">{t("unlockPremiumFeatures", { defaultValue: "Unlock full learning experience" })}</h3>
                <p className="text-sm text-[#CECADF] leading-relaxed mt-2.5">
                  {upgradeReason || t("premiumFeaturesLockedDesc", { defaultValue: "Sign up for a free account to save your pathways, track metrics in the cloud, issue public Certificates, and join Cohorts!" })}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[#FAF9FD]">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Verifiable Public Certificates of Completion</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[#FAF9FD]">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Collaborative developer Cohorts & Classroom Rosters</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[#FAF9FD]">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Cloud persistent learning metrics & histories</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="px-5 py-3 bg-[#1A172E] hover:bg-[#201D38] text-[#CECADF] hover:text-white rounded-xl transition font-bold text-xs cursor-pointer text-center"
              >
                {t("cancel", { defaultValue: "Cancel" })}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/sign-up?from=trial";
                }}
                className="flex-1 py-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition font-black text-xs text-center cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {t("signUpFree", { defaultValue: "Create Free Account 🚀" })}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
