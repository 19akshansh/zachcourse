import { useState, useEffect } from "react";

// Inactivity configuration (14 days)
const INACTIVITY_LIMIT_MS = 14 * 24 * 60 * 60 * 1000;

// Type definitions matching Prisma Course/VisualRoadmap shapes
export interface TrialCourse {
  id: string;
  title: string;
  description?: string;
  topic: string;
  sourceUrl?: string;
  textContent?: string;
  documentContext?: string;
  difficulty: string;
  totalDuration?: string;
  prerequisites: string[];
  experienceLevel: string;
  backgroundContext?: string;
  tone: string;
  weeklyHours: number;
  isActive: boolean;
  roadmapData: any;
  completedLessons: string[];
  completedQuizzes: Record<string, any>;
  completedLessonsAt: { lessonId: string; completedAt: string }[];
  completedQuizzesAt: { quizId: string; completedAt: string; score: number }[];
  currentLessonId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrialVisualRoadmap {
  id: string;
  title: string;
  topic: string;
  description?: string;
  difficulty: string;
  totalDuration?: string;
  experienceLevel: string;
  backgroundContext?: string;
  tone: string;
  weeklyHours: number;
  roadmapData: any;
  completedNodeIds: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

// Module-level cache
let isInitialized = false;
let trialCourses: TrialCourse[] = [];
let trialVRoadmaps: TrialVisualRoadmap[] = [];
let activeCourseId: string | null = null;
let activeVRoadmapId: string | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

// Perform initialization and inactivity check
function initializeStore() {
  if (typeof window === "undefined" || isInitialized) return;

  // Inactivity check
  const lastActive = localStorage.getItem("zc_trial_last_active");
  if (lastActive) {
    const lastActiveTime = parseInt(lastActive, 10);
    if (!isNaN(lastActiveTime) && Date.now() - lastActiveTime > INACTIVITY_LIMIT_MS) {
      // Purge all zc_trial_* keys
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("zc_trial_")) {
          localStorage.removeItem(key);
        }
      });
    }
  }
  localStorage.setItem("zc_trial_last_active", Date.now().toString());

  // Load from localStorage
  try {
    const cachedCourses = localStorage.getItem("zc_trial_courses");
    if (cachedCourses) trialCourses = JSON.parse(cachedCourses);
  } catch (e) {
    console.error("Error parsing trial courses", e);
    trialCourses = [];
  }

  try {
    const cachedVR = localStorage.getItem("zc_trial_visual_roadmaps");
    if (cachedVR) trialVRoadmaps = JSON.parse(cachedVR);
  } catch (e) {
    console.error("Error parsing trial visual roadmaps", e);
    trialVRoadmaps = [];
  }

  activeCourseId = localStorage.getItem("zc_trial_active_course_id");
  // Default to first course if none is active
  if (!activeCourseId && trialCourses.length > 0) {
    activeCourseId = trialCourses[0].id;
  }

  activeVRoadmapId = localStorage.getItem("zc_trial_active_vroadmap_id");
  if (!activeVRoadmapId && trialVRoadmaps.length > 0) {
    activeVRoadmapId = trialVRoadmaps[0].id;
  }

  isInitialized = true;
}

// Save helpers
function saveCourses() {
  localStorage.setItem("zc_trial_courses", JSON.stringify(trialCourses));
  if (activeCourseId) {
    localStorage.setItem("zc_trial_active_course_id", activeCourseId);
  } else {
    localStorage.removeItem("zc_trial_active_course_id");
  }
  localStorage.setItem("zc_trial_last_active", Date.now().toString());
  notify();
}

function saveVRoadmaps() {
  localStorage.setItem("zc_trial_visual_roadmaps", JSON.stringify(trialVRoadmaps));
  if (activeVRoadmapId) {
    localStorage.setItem("zc_trial_active_vroadmap_id", activeVRoadmapId);
  } else {
    localStorage.removeItem("zc_trial_active_vroadmap_id");
  }
  localStorage.setItem("zc_trial_last_active", Date.now().toString());
  notify();
}

// Exportable functions
export const trialStore = {
  getCourses: () => {
    initializeStore();
    return trialCourses;
  },

  getVRoadmaps: () => {
    initializeStore();
    return trialVRoadmaps;
  },

  getActiveCourseId: () => {
    initializeStore();
    return activeCourseId;
  },

  setActiveCourseId: (id: string | null) => {
    initializeStore();
    activeCourseId = id;
    saveCourses();
  },

  getActiveVRoadmapId: () => {
    initializeStore();
    return activeVRoadmapId;
  },

  setActiveVRoadmapId: (id: string | null) => {
    initializeStore();
    activeVRoadmapId = id;
    saveVRoadmaps();
  },

  addCourse: (courseData: Omit<TrialCourse, "id" | "createdAt" | "updatedAt" | "completedLessons" | "completedQuizzes" | "completedLessonsAt" | "completedQuizzesAt">) => {
    initializeStore();
    if (trialCourses.length >= 2) {
      throw new Error("TRIAL_LIMIT_COURSES");
    }

    const newCourse: TrialCourse = {
      ...courseData,
      id: "trial_course_" + Math.random().toString(36).substring(2, 11),
      completedLessons: [],
      completedQuizzes: {},
      completedLessonsAt: [],
      completedQuizzesAt: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    trialCourses.push(newCourse);
    activeCourseId = newCourse.id;
    saveCourses();
    return newCourse;
  },

  deleteCourse: (id: string) => {
    initializeStore();
    trialCourses = trialCourses.filter((c) => c.id !== id);
    if (activeCourseId === id) {
      activeCourseId = trialCourses.length > 0 ? trialCourses[0].id : null;
    }
    saveCourses();
    // Also clean up messages and lessons for this course
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(`zc_trial_chat_${id}`) || key.startsWith(`zc_trial_lesson_${id}`)) {
        localStorage.removeItem(key);
      }
    });
  },

  updateCourseProgress: (courseId: string, completedLessons: string[], completedQuizzes: Record<string, any>) => {
    initializeStore();
    trialCourses = trialCourses.map((c) => {
      if (c.id === courseId) {
        // Find newly completed lessons
        const currentCompleted = c.completedLessons || [];
        const newlyCompleted = completedLessons.filter((l) => !currentCompleted.includes(l));
        const updatedCompletedLessonsAt = [...(c.completedLessonsAt || [])];
        newlyCompleted.forEach((l) => {
          updatedCompletedLessonsAt.push({ lessonId: l, completedAt: new Date().toISOString() });
        });

        // Find newly completed quizzes
        const currentQuizzes = c.completedQuizzes || {};
        const updatedCompletedQuizzesAt = [...(c.completedQuizzesAt || [])];
        Object.keys(completedQuizzes).forEach((qId) => {
          if (currentQuizzes[qId] === undefined && completedQuizzes[qId] !== undefined) {
            updatedCompletedQuizzesAt.push({
              quizId: qId,
              completedAt: new Date().toISOString(),
              score: completedQuizzes[qId],
            });
          }
        });

        return {
          ...c,
          completedLessons,
          completedQuizzes,
          completedLessonsAt: updatedCompletedLessonsAt,
          completedQuizzesAt: updatedCompletedQuizzesAt,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });
    saveCourses();
  },

  updateCourseActiveLesson: (courseId: string, lessonId: string) => {
    initializeStore();
    trialCourses = trialCourses.map((c) => {
      if (c.id === courseId) {
        return {
          ...c,
          currentLessonId: lessonId,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });
    saveCourses();
  },

  addVisualRoadmap: (vrData: Omit<TrialVisualRoadmap, "id" | "createdAt" | "updatedAt" | "completedNodeIds" | "isFavorite">) => {
    initializeStore();
    if (trialVRoadmaps.length >= 2) {
      throw new Error("TRIAL_LIMIT_VROADMAPS");
    }

    const newVR: TrialVisualRoadmap = {
      ...vrData,
      id: "trial_vr_" + Math.random().toString(36).substring(2, 11),
      completedNodeIds: [],
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    trialVRoadmaps.push(newVR);
    activeVRoadmapId = newVR.id;
    saveVRoadmaps();
    return newVR;
  },

  deleteVisualRoadmap: (id: string) => {
    initializeStore();
    trialVRoadmaps = trialVRoadmaps.filter((v) => v.id !== id);
    if (activeVRoadmapId === id) {
      activeVRoadmapId = trialVRoadmaps.length > 0 ? trialVRoadmaps[0].id : null;
    }
    saveVRoadmaps();
  },

  updateVisualRoadmapProgress: (vroadmapId: string, completedNodeIds: string[]) => {
    initializeStore();
    trialVRoadmaps = trialVRoadmaps.map((v) => {
      if (v.id === vroadmapId) {
        return {
          ...v,
          completedNodeIds,
          updatedAt: new Date().toISOString(),
        };
      }
      return v;
    });
    saveVRoadmaps();
  },

  // Lessons content caching in local storage
  saveLessonContent: (courseId: string, lessonId: string, content: string) => {
    localStorage.setItem(`zc_trial_lesson_${courseId}_${lessonId}`, content);
    localStorage.setItem("zc_trial_last_active", Date.now().toString());
  },

  getLessonContent: (courseId: string, lessonId: string) => {
    return localStorage.getItem(`zc_trial_lesson_${courseId}_${lessonId}`);
  },

  // Messages caching in local storage
  getCourseMessages: (courseId: string) => {
    try {
      const messagesStr = localStorage.getItem(`zc_trial_chat_${courseId}`);
      return messagesStr ? JSON.parse(messagesStr) : [];
    } catch {
      return [];
    }
  },

  addCourseMessage: (courseId: string, msg: { sender: "user" | "mentor" | "system"; text: string }) => {
    const messages = trialStore.getCourseMessages(courseId);
    const newMsg = {
      ...msg,
      id: "msg_" + Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
    };
    messages.push(newMsg);
    localStorage.setItem(`zc_trial_chat_${courseId}`, JSON.stringify(messages));
    localStorage.setItem("zc_trial_last_active", Date.now().toString());
    notify();
    return newMsg;
  },

  clearAllTrialData: () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("zc_trial_")) {
        localStorage.removeItem(key);
      }
    });
    trialCourses = [];
    trialVRoadmaps = [];
    activeCourseId = null;
    activeVRoadmapId = null;
    notify();
  },
};

// React hook to access and subscribe to trialStore reactively
export function useTrialStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    initializeStore();
    const handleUpdate = () => setTick((t) => t + 1);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const courses = trialStore.getCourses();
  const vroadmaps = trialStore.getVRoadmaps();
  const activeCourse = courses.find((c) => c.id === activeCourseId) || null;
  const activeVRoadmap = vroadmaps.find((v) => v.id === activeVRoadmapId) || null;

  return {
    courses,
    vroadmaps,
    activeCourseId,
    activeCourse,
    setActiveCourseId: trialStore.setActiveCourseId,
    activeVRoadmapId,
    activeVRoadmap,
    setActiveVRoadmapId: trialStore.setActiveVRoadmapId,
    addCourse: trialStore.addCourse,
    deleteCourse: trialStore.deleteCourse,
    updateCourseProgress: trialStore.updateCourseProgress,
    updateCourseActiveLesson: trialStore.updateCourseActiveLesson,
    addVisualRoadmap: trialStore.addVisualRoadmap,
    deleteVisualRoadmap: trialStore.deleteVisualRoadmap,
    updateVisualRoadmapProgress: trialStore.updateVisualRoadmapProgress,
    saveLessonContent: trialStore.saveLessonContent,
    getLessonContent: trialStore.getLessonContent,
    getCourseMessages: trialStore.getCourseMessages,
    addCourseMessage: trialStore.addCourseMessage,
    clearAllTrialData: trialStore.clearAllTrialData,
    courseCount: courses.length,
    vroadmapCount: vroadmaps.length,
  };
}
