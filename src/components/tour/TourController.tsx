import React, { useState, useEffect, useRef } from "react";
import { Joyride, EventData, EVENTS, STATUS } from "react-joyride";
import { getTourChapters, TourChapterId, ExtendedStep, CURRENT_TOUR_VERSION } from "../../lib/tour-content";
import { TourTooltip } from "./TourTooltip";
import { TourBeacon } from "./TourBeacon";
import { useSession } from "../../lib/auth-client";
import { trpc } from "../../lib/trpc-client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export interface TourControllerProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeCourseId: string | null;
  setActiveCourseId: (id: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isMobile: boolean;
}

export const tourEventEmitter = new EventTarget();

export function TourController({
  activeTab,
  setActiveTab,
  activeCourseId,
  setActiveCourseId,
  sidebarOpen,
  setSidebarOpen,
  isMobile
}: TourControllerProps) {
  const { t } = useTranslation(["tour"]);
  const { data: sessionData, isPending: sessionPending } = useSession();
  const userRole = (sessionData?.user as any)?.role || "student";
  
  const [tourProgress, setTourProgress] = useState<{ chaptersSeen: string[]; completedAt: string | Date | null; contentVersion: number } | null>(null);
  const [tourLoading, setTourLoading] = useState(true);

  useEffect(() => {
    if (sessionData?.user) {
      setTourLoading(true);
      trpc.getTourProgress.query()
        .then(data => {
          setTourProgress({
            chaptersSeen: data.chaptersSeen || [],
            completedAt: data.completedAt,
            contentVersion: data.contentVersion || 0
          });
        })
        .catch(console.error)
        .finally(() => setTourLoading(false));
    }
  }, [sessionData?.user]);
  
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<ExtendedStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeChapter, setActiveChapter] = useState<TourChapterId | "full" | null>(null);

  const latestStartChapter = useRef<any>(null);
  const activeCourseIdRef = useRef(activeCourseId);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeCourseIdRef.current = activeCourseId;
  }, [activeCourseId]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleStartTour = (e: Event) => {
      const customEvent = e as CustomEvent<{ chapter: TourChapterId | "full" }>;
      if (latestStartChapter.current) {
        latestStartChapter.current(customEvent.detail.chapter);
      }
    };
    tourEventEmitter.addEventListener("startTour", handleStartTour);
    return () => tourEventEmitter.removeEventListener("startTour", handleStartTour);
  }, []);

  useEffect(() => {
    // Auto-start contextual tours
    if (!sessionPending && sessionData?.user && !tourLoading && tourProgress && !run) {
      if (tourProgress.completedAt === null || tourProgress.contentVersion < CURRENT_TOUR_VERSION) {
        const timer = setTimeout(() => {
          startChapter("full"); // "full" now acts as the intro
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        const seen = tourProgress.chaptersSeen || [];
        const timer = setTimeout(() => {
          const currentTab = activeTabRef.current;
          const currentActiveCourseId = activeCourseIdRef.current;

          if (currentTab === "visual-roadmaps" && !seen.includes("visual-roadmaps")) {
            startChapter("visual-roadmaps");
          } else if (currentTab === "cohorts" && !seen.includes("cohorts")) {
            startChapter("cohorts");
          } else if (currentTab === "analytics" && !seen.includes("analytics-and-certificates")) {
            startChapter("analytics-and-certificates");
          } else if (currentTab === "teacher" && !seen.includes("teacher-tools")) {
            startChapter("teacher-tools");
          } else if (currentActiveCourseId && !seen.includes("course-views")) {
            startChapter("course-views");
          } else if (currentActiveCourseId && currentTab === "progress" && !seen.includes("my-progress")) {
            startChapter("my-progress");
          }
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [sessionPending, sessionData, tourLoading, tourProgress, run]);

  const processStepPlacements = (sequence: ExtendedStep[], isMobileArg: boolean): ExtendedStep[] => {
    return sequence.map(s => {
      let placement = s.placement || 'auto';
      if (placement !== 'center') {
        const targetStr = typeof s.target === 'string' ? s.target : '';
        const isLargeComponent = 
          targetStr.includes('badges') || 
          targetStr.includes('performance') || 
          targetStr.includes('lessons') || 
          targetStr.includes('charts') ||
          targetStr.includes('roadmap-graph');

        if (isMobileArg) {
          if (isLargeComponent) {
            placement = 'center';
          } else {
            placement = 'bottom';
          }
        } else {
          if (s.placement && s.placement !== 'auto') {
            placement = s.placement;
          } else {
            if (
              targetStr.includes('badges') || 
              targetStr.includes('performance') || 
              targetStr.includes('lessons') || 
              targetStr.includes('avatar') || 
              targetStr.includes('help') ||
              targetStr.includes('key-badge') ||
              targetStr.includes('cert-download-btn')
            ) {
              placement = 'left';
            } else {
              placement = 'right';
            }
          }
        }
      }
      return {
        ...s,
        placement,
        scrollOffset: isMobileArg ? 120 : 100,
        floatingOptions: {
          flipOptions: {
            fallbackPlacements: isMobileArg ? ['bottom', 'top'] : ['left', 'right', 'bottom', 'top']
          }
        }
      };
    });
  };

  const startChapter = (chapter: TourChapterId | "full") => {
    setActiveChapter(chapter);

    let startDelay = 600;
    const currentTab = activeTabRef.current;
    const currentActiveCourseId = activeCourseIdRef.current;

    if (chapter === "building-a-course") {
      setActiveCourseId(null);
      activeCourseIdRef.current = null;
      startDelay = 1200;
    }

    let sequence: ExtendedStep[] = [];
    if (chapter === "full") {
      sequence = [
        ...getTourChapters(t)["welcome"],
        ...getTourChapters(t)["sidebar-and-account"],
        ...getTourChapters(t)["building-a-course"]
      ];
    } else {
      sequence = getTourChapters(t)[chapter];
    }
    
    // Safety check: if chapter requires a course but none is selected
    const requiresCourse = sequence.some(s => s.route?.requiresCourse);

    if (requiresCourse && !currentActiveCourseId) {
      // Try to fetch courses and auto-select one if available
      trpc.getCourses.query()
        .then(courses => {
          if (courses && courses.length > 0) {
            const firstCourseId = courses[0].id;
            setActiveCourseId(firstCourseId);
            activeCourseIdRef.current = firstCourseId;
            
            // Wait for course to load/mount
            setTimeout(() => {
              if (chapter === "my-progress" && activeTabRef.current !== "progress") {
                setActiveTab("progress");
                activeTabRef.current = "progress";
              } else if (chapter === "course-views" && activeTabRef.current !== "roadmap") {
                setActiveTab("roadmap");
                activeTabRef.current = "roadmap";
              }
              
              const processedSequence = processStepPlacements(sequence, isMobile);
              setSteps(processedSequence);
              setStepIndex(0);
              setRun(true);
            }, 1000);
          } else {
            toast(t("createOrSelectCourseToast", { defaultValue: "Please create or select a course first to view this tour." }), { icon: "🎓" });
            setActiveChapter(null);
          }
        })
        .catch(err => {
          console.error("Error auto-fetching courses for tour:", err);
          toast(t("createOrSelectCourseToast", { defaultValue: "Please create or select a course first to view this tour." }), { icon: "🎓" });
          setActiveChapter(null);
        });
      return;
    }

    // Pre-navigate to correct tab
    if (chapter === "visual-roadmaps" && currentTab !== "visual-roadmaps") {
      setActiveTab("visual-roadmaps");
      activeTabRef.current = "visual-roadmaps";
      startDelay = 1200;
    } else if (chapter === "cohorts" && currentTab !== "cohorts") {
      setActiveTab("cohorts");
      activeTabRef.current = "cohorts";
      startDelay = 1200;
    } else if (chapter === "analytics-and-certificates" && currentTab !== "analytics") {
      setActiveTab("analytics");
      activeTabRef.current = "analytics";
      startDelay = 1200;
    } else if (chapter === "teacher-tools" && currentTab !== "teacher") {
      setActiveTab("teacher");
      activeTabRef.current = "teacher";
      startDelay = 1200;
    } else if ((chapter === "building-a-course" || chapter === "full") && currentTab !== "roadmap") {
       setActiveTab("roadmap");
       activeTabRef.current = "roadmap";
       startDelay = 1200;
    } else if (chapter === "my-progress" && currentTab !== "progress") {
       setActiveTab("progress");
       activeTabRef.current = "progress";
       startDelay = 1200;
    } else if (chapter === "course-views" && currentTab !== "roadmap") {
       setActiveTab("roadmap");
       activeTabRef.current = "roadmap";
       startDelay = 1200;
    } else if ((chapter === "building-a-course" || chapter === "full") && currentActiveCourseId !== null) {
       // On roadmap tab already, but need to go to "New Course" view
       startDelay = 1200;
    }

    // Filter out steps requiring a role the user doesn't have
    sequence = sequence.filter(s => !s.route?.requiresRole || s.route.requiresRole === userRole);

    const processedSequence = processStepPlacements(sequence, isMobile);
    setSteps(processedSequence);
    setStepIndex(0);
    setTimeout(() => {
      setRun(true);
    }, startDelay);
  };

  latestStartChapter.current = startChapter;
  
  const handleJoyrideCallback = (data: EventData) => {
    const { status, type, index, step } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (type === EVENTS.TOUR_END || finishedStatuses.includes(status) || data.action === "close") {
      setRun(false);
      if (activeChapter === "full") {
        trpc.markTourCompleted.mutate({ version: CURRENT_TOUR_VERSION }).catch(console.error);
        if (tourProgress) {
          setTourProgress({ ...tourProgress, completedAt: new Date() });
        }
      } else if (activeChapter) {
        trpc.markTourChapterSeen.mutate({ chapterId: activeChapter }).catch(console.error);
        if (tourProgress) {
          setTourProgress({ ...tourProgress, chaptersSeen: [...tourProgress.chaptersSeen, activeChapter] });
        }
      }
      setActiveChapter(null);
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // Advance step or handle missing target
      if (type === EVENTS.TARGET_NOT_FOUND) {
        const currentStep = step as ExtendedStep;
        console.warn("Tour target not found:", currentStep.id, currentStep.target);

        // Check if we can recover by toggling dropdowns or changing routes
        if (currentStep.id === "header-profile-item" || currentStep.target === '[data-tour="header-profile-item"]') {
          // Dispatch event to open dropdown, pause joyride, and retry
          tourEventEmitter.dispatchEvent(new CustomEvent("tour-step", { detail: { stepId: "header-profile-item" } }));
          setRun(false);
          setTimeout(() => {
            setRun(true);
          }, 800);
          return;
        }

        if (currentStep.route) {
          const { tab, requiresCourse, sidebarOpenOnMobile } = currentStep.route;
          const currentTab = activeTabRef.current;
          const currentActiveCourseId = activeCourseIdRef.current;
          let recovered = false;

          if (tab && currentTab !== tab) {
            setActiveTab(tab);
            activeTabRef.current = tab;
            recovered = true;
          }

          if (tab === "roadmap" && requiresCourse === false && currentActiveCourseId !== null) {
            setActiveCourseId(null);
            activeCourseIdRef.current = null;
            recovered = true;
          }

          if (requiresCourse === true && currentActiveCourseId === null) {
            setRun(false);
            trpc.getCourses.query()
              .then(courses => {
                if (courses && courses.length > 0) {
                  const firstCourseId = courses[0].id;
                  setActiveCourseId(firstCourseId);
                  activeCourseIdRef.current = firstCourseId;
                  setTimeout(() => {
                    setRun(true);
                  }, 1200);
                } else {
                  setStepIndex(index + 1);
                  setTimeout(() => {
                    setRun(true);
                  }, 500);
                }
              })
              .catch(() => {
                setStepIndex(index + 1);
                setTimeout(() => {
                  setRun(true);
                }, 500);
              });
            return;
          }

          if (isMobile && sidebarOpenOnMobile && !sidebarOpen) {
            setSidebarOpen(true);
            recovered = true;
          }

          if (recovered) {
            setRun(false);
            setTimeout(() => {
              setRun(true);
            }, 1200);
            return;
          }
        }

        // Handle backward target-not-found
        if (data.action === "prev" && index > 0) {
          setStepIndex(index - 1);
          setRun(false);
          setTimeout(() => {
            setRun(true);
          }, 600);
          return;
        }

        // Fallback: Skip the step instead of breaking the entire tour
        if (index < steps.length - 1) {
          console.log(`Skipping missing step ${currentStep.id} (${index}) and continuing tour...`);
          setStepIndex(index + 1);
          setRun(false);
          setTimeout(() => {
            setRun(true);
          }, 600);
        } else {
          setRun(false);
          setActiveChapter(null);
        }
      } else if (data.action === "next") {
        const nextStep = steps[index + 1];
        if (nextStep) {
          // Dispatch step early so header dropdown can open
          tourEventEmitter.dispatchEvent(new CustomEvent("tour-step", { detail: { stepId: nextStep.id } }));

          if (nextStep.route) {
            const { tab, requiresCourse, sidebarOpenOnMobile } = nextStep.route;
            const currentTab = activeTabRef.current;
            const currentActiveCourseId = activeCourseIdRef.current;
            let hasTransition = false;

            if (tab && currentTab !== tab) {
              setActiveTab(tab);
              activeTabRef.current = tab;
              hasTransition = true;
            }

            if (tab === "roadmap" && requiresCourse === false && currentActiveCourseId !== null) {
              setActiveCourseId(null);
              activeCourseIdRef.current = null;
              hasTransition = true;
            }

            if (requiresCourse === true && currentActiveCourseId === null) {
              setRun(false);
              trpc.getCourses.query()
                .then(courses => {
                  if (courses && courses.length > 0) {
                    const firstCourseId = courses[0].id;
                    setActiveCourseId(firstCourseId);
                    activeCourseIdRef.current = firstCourseId;
                    setTimeout(() => {
                      setStepIndex(index + 1);
                      setRun(true);
                    }, 1200);
                  } else {
                    setStepIndex(index + 1);
                    setTimeout(() => {
                      setRun(true);
                    }, 500);
                  }
                })
                .catch(() => {
                  setStepIndex(index + 1);
                  setTimeout(() => {
                    setRun(true);
                  }, 500);
                });
              return;
            }

            if (isMobile && sidebarOpenOnMobile && !sidebarOpen) {
              setSidebarOpen(true);
              hasTransition = true;
            } else if (isMobile && !sidebarOpenOnMobile && sidebarOpen) {
              setSidebarOpen(false);
              hasTransition = true;
            }

            if (hasTransition) {
              setRun(false); // Pause Joyride to let DOM update
              setTimeout(() => {
                setStepIndex(index + 1);
                setRun(true); // Resume
              }, 1200); // Wait for page to load
              return;
            }
          }

          // Special pause for header menu opening
          if (nextStep.id === "header-profile-item" || nextStep.target === '[data-tour="header-profile-item"]') {
            setRun(false);
            setTimeout(() => {
              setStepIndex(index + 1);
              setRun(true);
            }, 800);
            return;
          }
        }
        setStepIndex(index + 1);
      } else if (data.action === "prev") {
        const prevStep = steps[index - 1];
        if (prevStep) {
          tourEventEmitter.dispatchEvent(new CustomEvent("tour-step", { detail: { stepId: prevStep.id } }));

          if (prevStep.route) {
            const { tab, requiresCourse, sidebarOpenOnMobile } = prevStep.route;
            const currentTab = activeTabRef.current;
            const currentActiveCourseId = activeCourseIdRef.current;
            let hasTransition = false;

            if (tab && currentTab !== tab) {
              setActiveTab(tab);
              activeTabRef.current = tab;
              hasTransition = true;
            }

            if (tab === "roadmap" && requiresCourse === false && currentActiveCourseId !== null) {
              setActiveCourseId(null);
              activeCourseIdRef.current = null;
              hasTransition = true;
            }

            if (isMobile && sidebarOpenOnMobile && !sidebarOpen) {
              setSidebarOpen(true);
              hasTransition = true;
            } else if (isMobile && !sidebarOpenOnMobile && sidebarOpen) {
              setSidebarOpen(false);
              hasTransition = true;
            }

            if (hasTransition) {
              setRun(false); // Pause
              setTimeout(() => {
                setStepIndex(index - 1);
                setRun(true); // Resume
              }, 1200);
              return;
            }
          }

          if (prevStep.id === "header-profile-item" || prevStep.target === '[data-tour="header-profile-item"]') {
            setRun(false);
            setTimeout(() => {
              setStepIndex(index - 1);
              setRun(true);
            }, 800);
            return;
          }
        }
        setStepIndex(index - 1);
      }
    } else if (type === EVENTS.STEP_BEFORE) {
      // Run side effects before the step is shown (as backup and for index 0)
      const currentStep = step as ExtendedStep;
      tourEventEmitter.dispatchEvent(new CustomEvent("tour-step", { detail: { stepId: currentStep.id } }));

      if (currentStep.route) {
        const { tab, requiresCourse, sidebarOpenOnMobile } = currentStep.route;
        const currentTab = activeTabRef.current;
        const currentActiveCourseId = activeCourseIdRef.current;
        
        if (tab && currentTab !== tab) {
          setActiveTab(tab);
          activeTabRef.current = tab;
        }

        if (tab === "roadmap" && requiresCourse === false && currentActiveCourseId !== null) {
          setActiveCourseId(null);
          activeCourseIdRef.current = null;
        }
        
        if (requiresCourse === true && currentActiveCourseId === null) {
          // Skip step if we need a course but none is selected
          setStepIndex(index + 1);
          return;
        }

        if (isMobile && sidebarOpenOnMobile && !sidebarOpen) {
          setSidebarOpen(true);
        } else if (isMobile && !sidebarOpenOnMobile && sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous={true}
      scrollToFirstStep={true}
      onEvent={handleJoyrideCallback}
      tooltipComponent={TourTooltip}
      beaconComponent={TourBeacon}
      options={{
        overlayColor: "rgba(10, 10, 15, 0.75)",
        zIndex: 10000,
        spotlightRadius: 8,
        spotlightPadding: 4,
        blockTargetInteraction: true,
        skipBeacon: false,
        dismissKeyAction: "close"
      }}
      styles={{
        spotlight: {
          stroke: '#4F46E5', // Indigo stroke
          strokeWidth: 2,
          fill: 'transparent'
        }
      }}
    />
  );
}
