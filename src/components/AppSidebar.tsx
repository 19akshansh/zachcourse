import React, { useState, useEffect } from "react";
import { Map, MessageSquare, FileText, TrendingUp, LogOut, Plus, MoreVertical, Trash2, Edit2, GitBranch, BarChart2, Users, GraduationCap, Loader2 } from "lucide-react";
import type { Course } from "@prisma/client";
import { trpc } from "../lib/trpc-client";
import { toast } from "sonner";

export interface CourseListItem {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  experienceLevel: string;
  completedLessons: any;
  roadmapData: any;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

interface AppSidebarProps {
  courses: CourseListItem[];
  activeCourseId: string | null;
  setActiveCourseId: (id: string | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  session: any;
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onSignOut: () => void;
  onDeleteCourse: (id: string) => void;
  onRenameCourse: (id: string, newTitle: string) => void;
  isLoadingCourses?: boolean;
}

export default function AppSidebar({
  courses,
  activeCourseId,
  setActiveCourseId,
  activeTab,
  setActiveTab,
  session,
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
  onSignOut,
  onDeleteCourse,
  onRenameCourse,
  isLoadingCourses,
}: AppSidebarProps) {
  const [contextMenuCourseId, setContextMenuCourseId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [courseToDelete, setCourseToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const currentRole = (session?.user as any)?.role || "student";

  const handleToggleRole = async () => {
    const nextRole = currentRole === "teacher" ? "student" : "teacher";
    setIsUpdating(true);
    try {
      await trpc.setUserRole.mutate({ role: nextRole });
      toast.success(`Role switched to ${nextRole}! Refreshing...`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const effectivelyCollapsed = isCollapsed && !isMobile;

  useEffect(() => {
    if (!contextMenuCourseId) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-context-menu]")) {
        setContextMenuCourseId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenuCourseId]);
  
  const navItems = [
    { id: "roadmap", label: "My Roadmap", icon: Map },
    { id: "mentor", label: "Ask Mentor", icon: MessageSquare },
    { id: "quiz", label: "Quick Quiz", icon: FileText },
    { id: "progress", label: "My Progress", icon: TrendingUp },
  ];

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "G";

  const displayName = user?.name || "Guest Account";
  const displayEmail = user?.email || "Temporary Trial";

  // Calculate course progress
  const getCourseProgress = (course: CourseListItem) => {
    let completedCount = 0;
    if (Array.isArray(course.completedLessons)) {
      completedCount = course.completedLessons.length;
    }
    
    let totalLessons = 0;
    if (course.roadmapData && course.roadmapData.modules) {
      course.roadmapData.modules.forEach((mod: any) => {
        if (mod.lessons) totalLessons += mod.lessons.length;
      });
    }
    
    if (totalLessons === 0) return 0;
    return Math.round((completedCount / totalLessons) * 100);
  };

  const handleNewCourseClick = () => {
    setActiveCourseId(null);
    setActiveTab("roadmap");
    if (window.innerWidth < 768) onClose();
  };

  const handleExecuteDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeletingCourse(true);
    try {
      await onDeleteCourse(courseToDelete.id);
      setCourseToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete course");
    } finally {
      setIsDeletingCourse(false);
    }
  };

  return (
    <>
      <aside
        id="app-sidebar"
        aria-label="Sidebar Navigation"
        className={`fixed top-0 left-0 h-full z-40 bg-[#111118] border-r border-[#1E1E2E] flex flex-col justify-between transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0 
          w-64 ${isCollapsed ? "md:w-16" : "md:w-64"}
        `}
      >
      {/* SIDEBAR HEADER */}
      <div className="flex items-center justify-between p-4 border-b border-[#1E1E2E] h-14 shrink-0">
        <div className={`flex-col min-w-0 ${effectivelyCollapsed ? 'flex md:hidden' : 'flex'}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl select-none">🎓</span>
            <span className="font-bold text-white text-lg truncate">ZachCourse</span>
          </div>
          <span className="text-[10px] text-[#8E88AB] mt-0.5 truncate">Your learning companion</span>
        </div>
        <div className={`mx-auto text-xl select-none ${effectivelyCollapsed ? 'hidden md:block' : 'hidden'}`}>🎓</div>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* GLOBAL NAV SECTION */}
        <div className="p-3">
          {!effectivelyCollapsed && (
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-bold text-[#8E88AB] uppercase tracking-wider">Explore</span>
            </div>
          )}
          
          <button
            onClick={() => {
              setActiveCourseId(null);
              setActiveTab("visual-roadmaps");
              if (window.innerWidth < 768) onClose();
            }}
            className={`w-full flex items-center h-10 rounded-xl transition-all duration-200 cursor-pointer mb-1
              ${effectivelyCollapsed ? "px-0 justify-center" : "px-3"}
              ${activeTab === "visual-roadmaps"
                ? "bg-[#4F46E5]/15 text-[#818CF8]" 
                : "text-[#8E88AB] hover:bg-white/5 hover:text-[#FAF9FD]"
              }
            `}
          >
            <GitBranch className="w-4 h-4 shrink-0" />
            {!effectivelyCollapsed && (
              <div className="flex items-center justify-between w-full ml-3">
                <span className="text-xs font-semibold truncate transition-opacity duration-200">
                  Visual Roadmaps
                </span>
                <span className="bg-[#10B981]/20 text-[#10B981] text-[9px] font-bold px-1.5 py-0.5 rounded-sm ml-2">
                  NEW
                </span>
              </div>
            )}
          </button>
          
          <button
            onClick={() => {
              setActiveCourseId(null);
              setActiveTab("cohorts");
              if (window.innerWidth < 768) onClose();
            }}
            className={`w-full flex items-center h-10 rounded-xl transition-all duration-200 cursor-pointer mb-1
              ${effectivelyCollapsed ? "px-0 justify-center" : "px-3"}
              ${activeTab === "cohorts"
                ? "bg-[#4F46E5]/15 text-[#818CF8]" 
                : "text-[#8E88AB] hover:bg-white/5 hover:text-[#FAF9FD]"
              }
            `}
          >
            <Users className="w-4 h-4 shrink-0" />
            {!effectivelyCollapsed && (
              <div className="flex items-center justify-between w-full ml-3">
                <span className="text-xs font-semibold truncate transition-opacity duration-200">
                  Learning Cohorts
                </span>
              </div>
            )}
          </button>

          <button
            onClick={() => {
              setActiveCourseId(null);
              setActiveTab("analytics");
              if (window.innerWidth < 768) onClose();
            }}
            className={`w-full flex items-center h-10 rounded-xl transition-all duration-200 cursor-pointer
              ${effectivelyCollapsed ? "px-0 justify-center" : "px-3"}
              ${activeTab === "analytics"
                ? "bg-[#4F46E5]/15 text-[#818CF8]" 
                : "text-[#8E88AB] hover:bg-white/5 hover:text-[#FAF9FD]"
              }
            `}
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            {!effectivelyCollapsed && (
              <div className="flex items-center justify-between w-full ml-3">
                <span className="text-xs font-semibold truncate transition-opacity duration-200">
                  Learning Analytics
                </span>
              </div>
            )}
          </button>

          {(session?.user as any)?.role === "teacher" && (
            <button
              onClick={() => {
                setActiveCourseId(null);
                setActiveTab("teacher");
                if (window.innerWidth < 768) onClose();
              }}
              className={`w-full flex items-center h-10 rounded-xl transition-all duration-200 cursor-pointer
                ${effectivelyCollapsed ? "px-0 justify-center" : "px-3"}
                ${activeTab === "teacher"
                  ? "bg-amber-600/15 text-amber-400" 
                  : "text-amber-400/70 hover:bg-white/5 hover:text-amber-400"
                }
              `}
            >
              <div className="flex items-center justify-center relative w-4 h-4 shrink-0">
                <span className="text-[10px]">🍎</span>
              </div>
              {!effectivelyCollapsed && (
                <div className="flex items-center justify-between w-full ml-3">
                  <span className="text-xs font-semibold truncate transition-opacity duration-200">
                    Teacher Tools
                  </span>
                </div>
              )}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-[#1E1E2E]" />

        {/* COURSES SECTION */}
        <div className="p-3">
          {!effectivelyCollapsed && (
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-bold text-[#8E88AB] uppercase tracking-wider">Your Courses</span>
            </div>
          )}
          
          <button
            onClick={handleNewCourseClick}
            className={`w-full flex items-center h-10 rounded-xl transition-all duration-200 cursor-pointer text-[#FAF9FD] bg-[#4F46E5]/10 hover:bg-[#4338CA]/20 border border-[#4F46E5]/20 mb-3
              ${effectivelyCollapsed ? "px-0 justify-center" : "px-3"}
            `}
          >
            <Plus className="w-4 h-4 shrink-0 text-[#818CF8]" />
            {!effectivelyCollapsed && (
              <span className="ml-2 text-xs font-bold truncate">New Course</span>
            )}
          </button>

          <div className="space-y-1">
            {isLoadingCourses ? (
              // Loading skeletons
              Array(3).fill(0).map((_, i) => (
                <div key={i} className={`h-11 rounded-xl bg-white/5 animate-pulse ${effectivelyCollapsed ? "w-10 mx-auto" : "w-full"}`} />
              ))
            ) : courses.length === 0 ? (
              !effectivelyCollapsed && (
                <div className="px-2 py-4 text-center">
                  <p className="text-xs text-[#8E88AB]">No courses yet — create your first!</p>
                </div>
              )
            ) : (
              courses.map((course) => {
                const isActive = activeCourseId === course.id;
                const progress = getCourseProgress(course);
                const isMenuOpen = contextMenuCourseId === course.id;
                
                return (
                  <div key={course.id} className="relative">
                    <div
                      onClick={() => {
                        setActiveCourseId(course.id);
                        if (window.innerWidth < 768) onClose();
                      }}
                      className={`w-full flex items-center h-12 rounded-xl transition-all duration-200 cursor-pointer relative group
                        ${effectivelyCollapsed ? "px-0 justify-center" : "px-3"}
                        ${isActive 
                          ? "bg-[#1E1B36] border-l-[3px] border-l-[#4F46E5]" 
                          : "hover:bg-white/5 border-l-[3px] border-l-transparent"
                        }
                      `}
                    >
                      <span className="text-base shrink-0 select-none">🎓</span>
                      
                      {!effectivelyCollapsed && (
                        <div className="ml-3 flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-2">
                            {editingCourseId === course.id ? (
                              <input
                                type="text"
                                autoFocus
                                value={editingTitle}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={() => {
                                  if (editingTitle.trim() && editingTitle.trim() !== course.title) {
                                    onRenameCourse(course.id, editingTitle.trim());
                                  }
                                  setEditingCourseId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    if (editingTitle.trim() && editingTitle.trim() !== course.title) {
                                      onRenameCourse(course.id, editingTitle.trim());
                                    }
                                    setEditingCourseId(null);
                                  } else if (e.key === "Escape") {
                                    setEditingCourseId(null);
                                  }
                                }}
                                className="w-full bg-[#181628] text-sm font-semibold text-[#FAF9FD] rounded px-1.5 py-0.5 border border-[#4F46E5] outline-none"
                              />
                            ) : (
                              <span className={`text-sm font-semibold truncate ${isActive ? "text-[#FAF9FD]" : "text-[#8E88AB] group-hover:text-[#FAF9FD]"}`}>
                                {course.title.length > 20 ? course.title.substring(0, 20) + "..." : course.title}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 text-[#8E88AB] border border-white/5">{course.difficulty}</span>
                            <span className="text-[9px] text-[#8E88AB]">{progress}%</span>
                          </div>
                        </div>
                      )}

                      {!effectivelyCollapsed && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenuCourseId(isMenuOpen ? null : course.id);
                          }}
                          className={`absolute right-2 p-1.5 rounded-lg transition-opacity ${isMenuOpen ? "opacity-100 bg-white/10" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-white/10"}`}
                        >
                          <MoreVertical className="w-3.5 h-3.5 text-[#8E88AB]" />
                        </button>
                      )}
                    </div>
                    
                    {/* Context Menu */}
                    {isMenuOpen && !effectivelyCollapsed && (
                      <div data-context-menu className="absolute right-0 top-10 mt-1 w-36 bg-[#181628] border border-[#2B2446] rounded-xl shadow-xl overflow-hidden z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitle(course.title);
                            setEditingCourseId(course.id);
                            setContextMenuCourseId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#FAF9FD] hover:bg-white/5 transition text-left"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseToDelete({ id: course.id, title: course.title });
                            setContextMenuCourseId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition text-left cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BOTTOM NAV SECTION (Only show if course selected) */}
        {activeCourseId && (
          <div className="p-3 border-t border-[#1E1E2E]">
            {!effectivelyCollapsed && (
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[10px] font-bold text-[#8E88AB] uppercase tracking-wider">Course Views</span>
              </div>
            )}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (window.innerWidth < 768) {
                        onClose();
                      }
                    }}
                    className={`w-full flex items-center h-10 rounded-xl transition-all duration-200 cursor-pointer
                      ${effectivelyCollapsed ? "px-0 justify-center" : "px-3"}
                      ${isActive 
                        ? "bg-[#4F46E5]/15 text-[#818CF8]" 
                        : "text-[#8E88AB] hover:bg-white/5 hover:text-[#FAF9FD]"
                      }
                    `}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    <span className={`ml-3 text-xs font-semibold truncate transition-opacity duration-200 ${effectivelyCollapsed ? 'block md:hidden' : 'block'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* SIDEBAR FOOTER */}
      <div className="p-3 border-t border-[#1E1E2E] shrink-0">
        <div className={`flex items-center justify-between gap-2 bg-white/5 p-2 rounded-xl ${effectivelyCollapsed ? 'flex md:hidden' : 'flex'}`}>
          <div className="flex items-center gap-2 min-w-0">
            {user?.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover border border-[#4F46E5]/30 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#8B5CF6] flex items-center justify-center text-xs text-white font-extrabold shadow-md shrink-0">
                {initials}
              </div>
            )}
            <div className="text-left min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs font-bold text-[#FAF9FD] truncate leading-tight">{displayName}</p>
                <button
                  onClick={handleToggleRole}
                  disabled={isUpdating}
                  className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded text-[9px] text-amber-400 font-extrabold hover:bg-amber-500/20 transition cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
                  title={`Current: ${currentRole}. Click to Switch!`}
                >
                  {isUpdating ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <span>{currentRole}</span>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-[#8E88AB] truncate leading-none mt-1">{displayEmail}</p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="text-[#8E88AB] hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition cursor-pointer shrink-0"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className={`flex flex-col items-center gap-3 py-1 ${effectivelyCollapsed ? 'hidden md:flex' : 'hidden'}`}>
          <div className="relative group">
            {user?.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover border border-[#4F46E5]/30 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#8B5CF6] flex items-center justify-center text-xs text-white font-extrabold shadow-md shrink-0">
                {initials}
              </div>
            )}
            {/* Tooltip */}
            <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-[#111118] border border-[#1E1E2E] text-white text-xs font-semibold rounded-lg px-2 py-1 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {displayName} ({currentRole})
            </div>
          </div>
          <button
            onClick={handleToggleRole}
            disabled={isUpdating}
            className="w-8 h-8 rounded-lg hover:bg-amber-500/15 hover:text-amber-400 text-[#8E88AB] flex items-center justify-center transition cursor-pointer"
            title={`Role: ${currentRole}. Click to Switch!`}
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <GraduationCap className="w-4 h-4 text-amber-500 hover:text-amber-400" />
            )}
          </button>
          <button
            onClick={onSignOut}
            className="w-8 h-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-400 text-[#8E88AB] flex items-center justify-center transition cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
      
    </aside>

      {courseToDelete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121021] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">Delete Course?</h3>
                <p className="text-sm text-[#CECADF] mt-2 leading-relaxed">
                  Are you sure you want to permanently delete <span className="font-bold text-red-400">{courseToDelete.title}</span>? This action is absolute and irreversible. All study guides, saved messages, and quiz history for this course will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                className="px-4 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs cursor-pointer"
                disabled={isDeletingCourse}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteCourse}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition font-bold text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                disabled={isDeletingCourse}
              >
                {isDeletingCourse ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Yes, Delete Course"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
