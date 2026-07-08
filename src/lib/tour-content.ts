import { Step } from "react-joyride";

export type TourChapterId = 
  | "welcome"
  | "sidebar-and-account"
  | "building-a-course"
  | "course-views"
  | "visual-roadmaps"
  | "vroadmap-graph-tour"
  | "cohorts"
  | "cohort-detail-tour"
  | "teacher-tools"
  | "analytics-and-certificates"
  | "my-progress";

export const CURRENT_TOUR_VERSION = 1;

export interface ExtendedStep extends Step {
  id: string;
  route?: {
    tab?: string;
    requiresCourse?: boolean;
    sidebarOpenOnMobile?: boolean;
    requiresRole?: "teacher" | "student";
  };
}

export const getTourChapters = (t: any): Record<TourChapterId, ExtendedStep[]> => ({
  "welcome": [
    {
      id: "welcome-banner",
      target: "body",
      placement: "center",
      title: t("stepWelcomeTitle", { defaultValue: "Welcome to ZachCourse 🎓" }),
      content: t("stepWelcomeContent", { defaultValue: "Let's take a quick, two-minute look at everything you can do here — your AI-powered learning companion for courses, visual roadmaps, cohorts, and more." }),
      skipBeacon: true,
    }
  ],
  "sidebar-and-account": [
    {
      id: "sidebar-brand",
      target: '[data-tour="sidebar-brand"]',
      title: t("stepHomeBaseTitle", { defaultValue: "Your Home Base" }),
      content: t("stepHomeBaseContent", { defaultValue: "This is your home base. From here you can jump between every course and every tool in the app." }),
      skipBeacon: true,
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "sidebar-collapse",
      target: '[data-tour="sidebar-collapse"]',
      title: t("stepCollapseSidebarTitle", { defaultValue: "Collapse Sidebar" }),
      content: t("stepCollapseSidebarContent", { defaultValue: "Collapse the sidebar for more room — on mobile, this same button opens and closes it." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "nav-visual-roadmaps",
      target: '[data-tour="nav-visual-roadmaps"]',
      title: t("stepVisualRoadmapsTitle", { defaultValue: "Visual Roadmaps" }),
      content: t("stepVisualRoadmapsContent", { defaultValue: "Generate a visual, node-based roadmap for any topic — perfect for mapping out a subject before committing to a full course." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "nav-cohorts",
      target: '[data-tour="nav-cohorts"]',
      title: t("stepLearningCohortsTitle", { defaultValue: "Learning Cohorts" }),
      content: t("stepLearningCohortsContent", { defaultValue: "Create or join a cohort to learn alongside others — see a shared leaderboard and activity feed." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "nav-analytics",
      target: '[data-tour="nav-analytics"]',
      title: t("stepLearningAnalyticsTitle", { defaultValue: "Learning Analytics" }),
      content: t("stepLearningAnalyticsContent", { defaultValue: "Your stats live here: weekly activity, quiz score trends, and certificates for finished courses." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "nav-teacher",
      target: '[data-tour="nav-teacher"]',
      title: t("stepTeacherToolsTitle", { defaultValue: "Teacher Tools" }),
      content: t("stepTeacherToolsContent", { defaultValue: "Manage your classrooms, rosters, and student progress here." }),
      route: { sidebarOpenOnMobile: true, requiresRole: "teacher" }
    },
    {
      id: "new-course-btn",
      target: '[data-tour="new-course-btn"]',
      title: t("stepNewCourseTitle", { defaultValue: "New Course" }),
      content: t("stepNewCourseContent", { defaultValue: "Start a brand-new personalized course — pick a topic, paste a URL, or upload your own material, and get a full lesson-by-lesson roadmap." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "course-list",
      target: '[data-tour="course-list"]',
      title: t("stepYourCoursesTitle", { defaultValue: "Your Courses" }),
      content: t("stepYourCoursesContent", { defaultValue: "Every course you create appears here with live progress. Tap the ⋮ menu on any course to rename or delete it." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "sidebar-account-card",
      target: '[data-tour="sidebar-account-card"]',
      title: t("stepYourAccountTitle", { defaultValue: "Your Account" }),
      content: t("stepYourAccountContent", { defaultValue: "That's you — your name, avatar, and current role." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "sidebar-role-badge",
      target: '[data-tour="sidebar-role-badge"]',
      title: t("stepSwitchRoleTitle", { defaultValue: "Switch Role" }),
      content: t("stepSwitchRoleContent", { defaultValue: "Tap this any time to switch between Student and Teacher mode. Switching applies immediately and refreshes the page — Teacher mode unlocks classroom management." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "sidebar-sign-out",
      target: '[data-tour="sidebar-sign-out"]',
      title: t("stepSignOutTitle", { defaultValue: "Sign Out" }),
      content: t("stepSignOutContent", { defaultValue: "Sign out from here whenever you're done." }),
      route: { sidebarOpenOnMobile: true }
    },
    {
      id: "header-key-badge",
      target: '[data-tour="header-key-badge"]',
      title: t("stepApiKeyStatusTitle", { defaultValue: "API Key Status" }),
      content: t("stepApiKeyStatusContent", { defaultValue: "This shows your Gemini API key status and any free queries remaining. Tap it to add or manage your own key." })
    },
    {
      id: "header-avatar-menu",
      target: '[data-tour="header-avatar-menu"]',
      title: t("stepAccountMenuTitle", { defaultValue: "Account Menu" }),
      content: t("stepAccountMenuContent", { defaultValue: "Your account menu — profile settings, role switching, and sign out, all in one place." })
    },
    {
      id: "header-profile-item",
      target: '[data-tour="header-profile-item"]',
      title: t("stepMyProfileTitle", { defaultValue: "My Profile" }),
      content: t("stepMyProfileContent", { defaultValue: "Edit your bio and connect verified GitHub or Discord badges to your profile." })
    },
    {
      id: "header-help-btn",
      target: '[data-tour="header-help-btn"]',
      title: t("stepHelpMenuTitle", { defaultValue: "Help Menu" }),
      content: t("stepHelpMenuContent", { defaultValue: "Come back to this tour, or explore a specific part of the app, any time from here." })
    }
  ],
  "building-a-course": [
    {
      id: "course-topic-input",
      target: '[data-tour="course-topic-input"]',
      title: t("stepPickTopicTitle", { defaultValue: "Pick a Topic" }),
      content: t("stepPickTopicContent", { defaultValue: "Type anything you want to learn — as broad or specific as you like." }),
      route: { tab: "roadmap", requiresCourse: false },
      placement: "auto",
      skipBeacon: true,
    },
    {
      id: "course-topic-pills",
      target: '[data-tour="course-topic-pills"]',
      title: t("stepSuggestedTopicsTitle", { defaultValue: "Suggested Topics" }),
      content: t("stepSuggestedTopicsContent", { defaultValue: "Or tap a suggested topic to get started instantly." }),
      route: { tab: "roadmap", requiresCourse: false },
      placement: "auto"
    },
    {
      id: "course-source-url",
      target: '[data-tour="course-source-url"]',
      title: t("stepSourceUrlTitle", { defaultValue: "Source URL" }),
      content: t("stepSourceUrlContent", { defaultValue: "Optionally paste a link (an article, docs, or a syllabus) and the roadmap will be grounded in that material." }),
      route: { tab: "roadmap", requiresCourse: false },
      placement: "auto"
    },
    {
      id: "course-doc-upload",
      target: '[data-tour="course-doc-upload"]',
      title: t("stepUploadDocumentsTitle", { defaultValue: "Upload Documents" }),
      content: t("stepUploadDocumentsContent", { defaultValue: "Or upload up to 3 files — the roadmap will be built from their content instead of a general topic." }),
      route: { tab: "roadmap", requiresCourse: false },
      placement: "auto"
    },
    {
      id: "course-level-hours",
      target: '[data-tour="course-level-hours"]',
      title: t("stepPersonalizeTitle", { defaultValue: "Personalize" }),
      content: t("stepPersonalizeContent", { defaultValue: "Tell us your experience level and how many hours a week you can commit, so the pace fits you." }),
      route: { tab: "roadmap", requiresCourse: false },
      placement: "auto"
    },
    {
      id: "course-generate-btn",
      target: '[data-tour="course-generate-btn"]',
      title: t("stepGenerateRoadmapTitle", { defaultValue: "Generate Roadmap" }),
      content: t("stepGenerateRoadmapContent", { defaultValue: "This builds a full, multi-module roadmap with individual lessons tailored to everything you just entered." }),
      route: { tab: "roadmap", requiresCourse: false },
      placement: "auto"
    }
  ],
  "course-views": [
    {
      id: "course-subnav",
      target: '[data-tour="course-subnav"]',
      title: t("stepCourseViewsTitle", { defaultValue: "Course Views" }),
      content: t("stepCourseViewsContent", { defaultValue: "Once you pick a course, these four views appear: your Roadmap, an Ask Mentor chat, a Quick Quiz generator, and My Progress (streaks, badges, quiz history)." }),
      route: { sidebarOpenOnMobile: true, requiresCourse: true },
      skipBeacon: true
    },
    {
      id: "course-roadmap-graph",
      target: '[data-tour="course-roadmap-graph"]',
      title: t("stepLearningPathTitle", { defaultValue: "Your Learning Path" }),
      content: t("stepLearningPathContent", { defaultValue: "Click any lesson node to read its content, ask your mentor about it, or take a quiz — completed lessons are checked off automatically." }),
      route: { tab: "roadmap", requiresCourse: true },
      placement: "auto"
    }
  ],
  "visual-roadmaps": [
    {
      id: "vroadmap-form",
      target: '[data-tour="vroadmap-form"]',
      title: t("stepVisualRoadmapsFormTitle", { defaultValue: "Visual Roadmaps" }),
      content: t("stepVisualRoadmapsFormContent", { defaultValue: "Same idea as course creation, but standalone — great for quickly sketching out a learning path without starting a full course." }),
      route: { tab: "visual-roadmaps" },
      placement: "auto",
      skipBeacon: true
    },
    {
      id: "vroadmap-list",
      target: '[data-tour="vroadmap-list"]',
      title: t("stepSavedRoadmapsTitle", { defaultValue: "Saved Roadmaps" }),
      content: t("stepSavedRoadmapsContent", { defaultValue: "All your saved visual roadmaps live here. Star ⭐ your favorites, or open one to keep exploring its graph." }),
      route: { tab: "visual-roadmaps" }
    }
  ],
  "vroadmap-graph-tour": [
    {
      id: "vroadmap-graph",
      target: '[data-tour="vroadmap-graph"]',
      title: t("stepInteractiveGraphTitle", { defaultValue: "Interactive Graph" }),
      content: t("stepInteractiveGraphContent", { defaultValue: "Click through the nodes to mark milestones complete and track progress independently of any course." }),
      route: { tab: "visual-roadmaps" },
      placement: "auto"
    }
  ],
  "cohorts": [
    {
      id: "cohort-create-btn",
      target: '[data-tour="cohort-create-btn"]',
      title: t("stepCreateCohortTitle", { defaultValue: "Create Cohort" }),
      content: t("stepCreateCohortContent", { defaultValue: "Start a cohort and attach one of your courses or roadmaps — you'll get an invite code to share." }),
      route: { tab: "cohorts" },
      skipBeacon: true
    },
    {
      id: "cohort-join-btn",
      target: '[data-tour="cohort-join-btn"]',
      title: t("stepJoinCohortTitle", { defaultValue: "Join Cohort" }),
      content: t("stepJoinCohortContent", { defaultValue: "Got an invite code? Join a friend's or classmate's cohort here." }),
      route: { tab: "cohorts" }
    },
    {
      id: "cohort-list",
      target: '[data-tour="cohort-list"]',
      title: t("stepYourCohortsTitle", { defaultValue: "Your Cohorts" }),
      content: t("stepYourCohortsContent", { defaultValue: "Every cohort you own or belong to shows up here — select one to see its leaderboard and activity." }),
      route: { tab: "cohorts" }
    }
  ],
  "cohort-detail-tour": [
    {
      id: "cohort-leaderboard",
      target: '[data-tour="cohort-leaderboard"]',
      title: t("stepLeaderboardTitle", { defaultValue: "Leaderboard" }),
      content: t("stepLeaderboardContent", { defaultValue: "See how everyone in the cohort is progressing, ranked by estimated proficiency." }),
      route: { tab: "cohorts" }
    },
    {
      id: "cohort-activity",
      target: '[data-tour="cohort-activity"]',
      title: t("stepActivityFeedTitle", { defaultValue: "Activity Feed" }),
      content: t("stepActivityFeedContent", { defaultValue: "A live feed of what your cohort mates have been studying recently." }),
      route: { tab: "cohorts" }
    },
    {
      id: "cohort-member-actions",
      target: '[data-tour="cohort-member-actions"]',
      title: t("stepCohortActionsTitle", { defaultValue: "Cohort Actions" }),
      content: t("stepCohortActionsContent", { defaultValue: "Leave a cohort you've joined, or — if you created it — delete it entirely." }),
      route: { tab: "cohorts" }
    }
  ],
  "teacher-tools": [
    {
      id: "teacher-create-classroom",
      target: '[data-tour="teacher-create-classroom"]',
      title: t("stepCreateClassroomTitle", { defaultValue: "Create Classroom" }),
      content: t("stepCreateClassroomContent", { defaultValue: "Create a classroom, attach a course or roadmap, and share the generated invite code with your students." }),
      route: { tab: "teacher", requiresRole: "teacher" },
      skipBeacon: true
    },
    {
      id: "teacher-classroom-list",
      target: '[data-tour="teacher-classroom-list"]',
      title: t("stepYourClassroomsTitle", { defaultValue: "Your Classrooms" }),
      content: t("stepYourClassroomsContent", { defaultValue: "All your classrooms live here." }),
      route: { tab: "teacher", requiresRole: "teacher" }
    },
    {
      id: "teacher-roster",
      target: '[data-tour="teacher-roster"]',
      title: t("stepStudentRosterTitle", { defaultValue: "Student Roster" }),
      content: t("stepStudentRosterContent", { defaultValue: "See each student's proficiency, average quiz score, and streak. Click a student for their weak-topic breakdown, or export the full roster as CSV." }),
      route: { tab: "teacher", requiresRole: "teacher" }
    }
  ],
  "analytics-and-certificates": [
    {
      id: "analytics-stats",
      target: '[data-tour="analytics-stats"]',
      title: t("stepQuickSnapshotTitle", { defaultValue: "Quick Snapshot" }),
      content: t("stepQuickSnapshotContent", { defaultValue: "A quick snapshot of your study habits." }),
      route: { tab: "analytics" },
      skipBeacon: true
    },
    {
      id: "analytics-charts",
      target: '[data-tour="analytics-charts"]',
      title: t("stepProgressChartsTitle", { defaultValue: "Progress Charts" }),
      content: t("stepProgressChartsContent", { defaultValue: "Track your weekly lesson activity and how your quiz scores are trending over time." }),
      route: { tab: "analytics" }
    },
    {
      id: "analytics-certificates-btn",
      target: '[data-tour="analytics-certificates-btn"]',
      title: t("stepCertificatesTitle", { defaultValue: "Certificates" }),
      content: t("stepCertificatesContent", { defaultValue: "Once you finish a course, your certificate appears here — click to view and download it." }),
      route: { tab: "analytics" }
    }
  ],
  "my-progress": [
    {
      id: "progress-ring",
      target: '[data-tour="progress-ring"]',
      title: t("stepOverallProgressTitle", { defaultValue: "Overall Progress" }),
      content: t("stepOverallProgressContent", { defaultValue: "Your overall completion for this course, plus your daily study streak." }),
      route: { tab: "progress", requiresCourse: true },
      skipBeacon: true
    },
    {
      id: "progress-badges",
      target: '[data-tour="progress-badges"]',
      title: t("stepAchievementsTitle", { defaultValue: "Achievements" }),
      content: t("stepAchievementsContent", { defaultValue: "Badges you unlock as you learn." }),
      route: { tab: "progress", requiresCourse: true }
    },
    {
      id: "progress-quiz-performance",
      target: '[data-tour="progress-quiz-performance"]',
      title: t("stepQuizPerformanceTitle", { defaultValue: "Quiz Performance" }),
      content: t("stepQuizPerformanceContent", { defaultValue: "Every quiz you've completed for this course, with your score." }),
      route: { tab: "progress", requiresCourse: true }
    },
    {
      id: "progress-mastered-lessons",
      target: '[data-tour="progress-mastered-lessons"]',
      title: t("stepMasteredLessonsTitle", { defaultValue: "Mastered Lessons" }),
      content: t("stepMasteredLessonsContent", { defaultValue: "Every lesson you've marked complete, all in one place." }),
      route: { tab: "progress", requiresCourse: true }
    }
  ]
});
