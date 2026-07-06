import React, { useState, useEffect } from "react";
import { trpc } from "../lib/trpc-client";
import { Users, Plus, Hash, Trophy, Activity, ArrowRight, Loader2, BookOpen, Map, Check, Trash2, LogOut, Github } from "lucide-react";
import { DiscordIcon } from "./DiscordIcon";
import { toast } from "sonner";
import { useSession } from "../lib/auth-client";
import { Pagination } from "./Pagination";

interface CohortsDashboardProps {
  onNavigateToCourse?: (courseId: string) => void;
  onNavigateToRoadmap?: (visualRoadmapId: string) => void;
}

export default function CohortsDashboard({ onNavigateToCourse, onNavigateToRoadmap }: CohortsDashboardProps) {
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id;

  const [memberships, setMemberships] = useState<any[] | null>(null);
  const [cohortsPage, setCohortsPage] = useState(1);
  const [cohortsTotalPages, setCohortsTotalPages] = useState(1);
  const [activeCohortId, setActiveCohortId] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCourseId, setCreateCourseId] = useState("");
  const [createVisualRoadmapId, setCreateVisualRoadmapId] = useState("");

  const [courses, setCourses] = useState<any[]>([]);
  const [roadmaps, setRoadmaps] = useState<any[]>([]);

  const [isJoining, setIsJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [previewCohort, setPreviewCohort] = useState<any | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isJoinLoading, setIsJoinLoading] = useState(false);

  const loadCohorts = async (page = 1) => {
    try {
      const res = await trpc.getUserCohorts.query({ page, pageSize: 8 });
      if (Array.isArray(res)) {
        setMemberships(res);
      } else {
        setMemberships(res.items);
        setCohortsTotalPages(res.totalPages);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load cohorts");
    }
  };

  const loadUserContent = async () => {
    try {
      const [coursesRes, roadmapsRes] = await Promise.all([
        trpc.getCourses.query(),
        trpc.getVisualRoadmaps.query({ pageSize: 100 })
      ]);
      setCourses(coursesRes || []);
      setRoadmaps(roadmapsRes?.items || []);
    } catch (e) {
      console.error("Failed to load user content", e);
    }
  };

  useEffect(() => {
    loadCohorts(cohortsPage);
  }, [cohortsPage]);

  useEffect(() => {
    loadUserContent();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName) return;
    if (!createCourseId && !createVisualRoadmapId) {
      toast.error("Please select a Course or a Roadmap");
      return;
    }
    try {
      const isFirst = memberships.length === 0;
      const res = await trpc.createCohort.mutate({
        name: createName,
        courseId: createCourseId || null,
        visualRoadmapId: createVisualRoadmapId || null,
      });
      toast.success("Cohort created!");
      setCreateName("");
      setCreateCourseId("");
      setCreateVisualRoadmapId("");
      setIsCreating(false);
      await loadCohorts();
      setActiveCohortId(res.id);
      
      if (isFirst) {
        setTimeout(() => {
          import("./tour/TourController").then(mod => {
            mod.tourEventEmitter.dispatchEvent(new CustomEvent('startTour', { detail: { chapter: 'cohort-detail-tour' } }));
          });
        }, 500);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create cohort");
    }
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    setIsPreviewLoading(true);
    try {
      const res = await trpc.previewCohortByInviteCode.query({ inviteCode: joinCode.trim().toUpperCase() });
      if (!res) {
        toast.error("Invalid invite code");
        setPreviewCohort(null);
      } else {
        setPreviewCohort(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to find cohort");
      setPreviewCohort(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleJoinAndClone = async () => {
    if (!joinCode) return;
    setIsJoinLoading(true);
    try {
      const res = await trpc.joinCohortAndClone.mutate({ inviteCode: joinCode.trim().toUpperCase() });
      toast.success("Successfully joined cohort!");
      setJoinCode("");
      setPreviewCohort(null);
      setIsJoining(false);
      await loadCohorts();
      setActiveCohortId(res.cohortId);

      if (res.courseId && onNavigateToCourse) {
        onNavigateToCourse(res.courseId);
      } else if (res.visualRoadmapId && onNavigateToRoadmap) {
        onNavigateToRoadmap(res.visualRoadmapId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to join cohort");
    } finally {
      setIsJoinLoading(false);
    }
  };

  if (!memberships) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const activeMembership = memberships.find(m => m.cohort.id === activeCohortId);
  const isOwner = userId && activeMembership?.cohort?.ownerId === userId;

  const userCourse = activeMembership?.cohort?.courseId 
    ? courses.find(c => c.clonedFromCourseId === activeMembership.cohort.courseId || c.id === activeMembership.cohort.courseId)
    : null;

  const userRoadmap = activeMembership?.cohort?.visualRoadmapId
    ? roadmaps.find(r => r.clonedFromRoadmapId === activeMembership.cohort.visualRoadmapId || r.id === activeMembership.cohort.visualRoadmapId)
    : null;

  if (activeCohortId) {
    return (
      <CohortDetail 
        cohortId={activeCohortId} 
        onBack={() => setActiveCohortId(null)} 
        cohortName={activeMembership?.cohort.name || "Cohort"}
        inviteCode={activeMembership?.cohort.inviteCode}
        courseTitle={activeMembership?.cohort.course?.title}
        roadmapTitle={activeMembership?.cohort.visualRoadmap?.title}
        isOwner={!!isOwner}
        onDeleted={loadCohorts}
        onLeft={loadCohorts}
        userCourseId={userCourse?.id}
        userRoadmapId={userRoadmap?.id}
        onNavigateToCourse={onNavigateToCourse}
        onNavigateToRoadmap={onNavigateToRoadmap}
      />
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#FAF9FD] tracking-tight font-sans flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-400" />
            Learning Cohorts
          </h1>
          <p className="text-[#8E88AB] mt-1">Join forces, track progress, and learn together.</p>
        </div>
        <div className="flex gap-3">
          <button 
            data-tour="cohort-join-btn"
            onClick={() => { setIsJoining(true); setIsCreating(false); setPreviewCohort(null); }}
            className="px-4 py-2 bg-[#1E1A33] hover:bg-[#2A2443] border border-[#2A2443] text-[#FAF9FD] rounded-xl font-medium transition flex items-center gap-2"
          >
            <Hash className="w-4 h-4 text-emerald-400" /> Join
          </button>
          <button 
            data-tour="cohort-create-btn"
            onClick={() => { setIsCreating(true); setIsJoining(false); }}
            className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-medium transition shadow-lg shadow-indigo-900/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-[#121021] border border-[#4F46E5]/30 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-[#CECADF] mb-2">Cohort Name</label>
              <input 
                type="text" 
                value={createName} 
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g. Frontend Masters Fall 2026"
                className="w-full bg-[#1E1A33] border border-[#2A2443] text-[#FAF9FD] rounded-xl px-4 py-3 focus:outline-none focus:border-[#4F46E5]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#CECADF] mb-2">Select Course (Optional)</label>
              <select
                value={createCourseId}
                onChange={e => {
                  setCreateCourseId(e.target.value);
                }}
                className="w-full bg-[#1E1A33] border border-[#2A2443] text-[#FAF9FD] rounded-xl px-4 py-3 focus:outline-none focus:border-[#4F46E5]"
              >
                <option value="">-- None Selected --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.difficulty})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#CECADF] mb-2">Select Roadmap (Optional)</label>
              <select
                value={createVisualRoadmapId}
                onChange={e => {
                  setCreateVisualRoadmapId(e.target.value);
                }}
                className="w-full bg-[#1E1A33] border border-[#2A2443] text-[#FAF9FD] rounded-xl px-4 py-3 focus:outline-none focus:border-[#4F46E5]"
              >
                <option value="">-- None Selected --</option>
                {roadmaps.map(r => (
                  <option key={r.id} value={r.id}>{r.title} ({r.difficulty})</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-[#8E88AB]">
            * At least one Course or Roadmap must be selected. Members will learn and compete on the course/roadmap you pick here.
          </p>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-3 text-[#CECADF] hover:text-white transition">Cancel</button>
            <button 
              type="submit" 
              disabled={!createName || (!createCourseId && !createVisualRoadmapId)} 
              className="px-6 py-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Create Cohort
            </button>
          </div>
        </form>
      )}

      {isJoining && (
        <div className="bg-[#121021] border border-emerald-500/30 rounded-2xl p-6 space-y-6 animate-in fade-in slide-in-from-top-4">
          {!previewCohort ? (
            <form onSubmit={handlePreview} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-semibold text-[#CECADF] mb-2">Invite Code</label>
                <input 
                  type="text" 
                  value={joinCode} 
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. X7B9HQ"
                  className="w-full bg-[#1E1A33] border border-[#2A2443] text-[#FAF9FD] rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 uppercase tracking-widest font-mono"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setIsJoining(false)} className="px-4 py-3 text-[#CECADF] hover:text-white transition">Cancel</button>
                <button 
                  type="submit" 
                  disabled={!joinCode || isPreviewLoading} 
                  className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center min-w-[120px] transition"
                >
                  {isPreviewLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Lookup Code"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-400" />
                Cohort Invitation Found!
              </h3>

              {previewCohort.isAlreadyMember && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <Check className="w-5 h-5 shrink-0" />
                  <span>You are already a member of this cohort!</span>
                </div>
              )}
              
              <div className="bg-[#1E1A33] border border-[#2A2443] rounded-xl p-5 space-y-3">
                <div>
                  <span className="text-xs text-[#8E88AB] uppercase tracking-wider block">Cohort Name</span>
                  <span className="text-lg font-bold text-[#FAF9FD]">{previewCohort.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-[#8E88AB] uppercase tracking-wider block">Created By</span>
                    <span className="text-sm font-medium text-[#CECADF]">{previewCohort.ownerName || "Teacher"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#8E88AB] uppercase tracking-wider block">Current Members</span>
                    <span className="text-sm font-medium text-[#CECADF]">{previewCohort.memberCount} members</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#2A2443]">
                  <span className="text-xs text-[#8E88AB] uppercase tracking-wider block mb-2">Required Content to Join</span>
                  <div className="space-y-2">
                    {previewCohort.course && (
                      <div className="flex items-center gap-2 text-sm text-[#CECADF]">
                        <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Course: <strong className="text-white">{previewCohort.course.title}</strong> ({previewCohort.course.difficulty})</span>
                      </div>
                    )}
                    {previewCohort.visualRoadmap && (
                      <div className="flex items-center gap-2 text-sm text-[#CECADF]">
                        <Map className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Roadmap: <strong className="text-white">{previewCohort.visualRoadmap.title}</strong> ({previewCohort.visualRoadmap.difficulty})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-[#8E88AB]">
                💡 Joining this cohort will automatically clone the required course and/or roadmap onto your personal account so you can learn and compete on the leaderboard!
              </p>

              <div className="flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setPreviewCohort(null)} 
                  className="px-4 py-3 bg-[#1E1A33] hover:bg-[#2A2443] border border-[#2A2443] text-[#FAF9FD] rounded-xl transition"
                >
                  Change Code
                </button>
                <button 
                  type="button" 
                  onClick={handleJoinAndClone}
                  disabled={isJoinLoading || previewCohort.isAlreadyMember}
                  className={`px-6 py-3 font-bold rounded-xl flex items-center gap-2 transition ${
                    previewCohort.isAlreadyMember 
                      ? "bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600" 
                      : "bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                  }`}
                >
                  {isJoinLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : previewCohort.isAlreadyMember ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-400" />
                      Already Joined in Cohort
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Join & Clone Content
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div data-tour="cohort-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {memberships.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-[#2A2443] rounded-2xl bg-[#121021]/50 animate-fade-in">
            <Users className="w-12 h-12 text-[#2A2443] mx-auto mb-3" />
            <p className="text-[#8E88AB] font-medium">You aren't in any cohorts yet.</p>
            <p className="text-sm text-[#8E88AB]/70 mt-1">Create one or join an existing group to get started.</p>
          </div>
        ) : (
          memberships.map((m) => {
            const userCourse = m.cohort.courseId 
              ? courses.find(c => c.clonedFromCourseId === m.cohort.courseId || c.id === m.cohort.courseId)
              : null;

            const userRoadmap = m.cohort.visualRoadmapId
              ? roadmaps.find(r => r.clonedFromRoadmapId === m.cohort.visualRoadmapId || r.id === m.cohort.visualRoadmapId)
              : null;

            return (
              <div 
                key={m.cohort.id} 
                onClick={() => setActiveCohortId(m.cohort.id)}
                className="bg-[#121021] border border-[#2A2443] hover:border-[#4F46E5]/50 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#4F46E5]/10 text-indigo-400 flex items-center justify-center group-hover:bg-[#4F46E5] group-hover:text-white transition-colors">
                      <Users className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-[#2A2443] group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold text-[#FAF9FD] mb-1 group-hover:text-indigo-300 transition-colors">{m.cohort.name}</h3>
                  <p className="text-sm text-[#CECADF] flex items-center gap-1 mb-4">
                    {m.cohort._count?.members || 1} Member{(m.cohort._count?.members || 1) !== 1 ? 's' : ''}
                  </p>
                </div>

                <div>
                  <div className="space-y-1.5 pt-3 border-t border-[#1E1A33]">
                    {m.cohort.course && (
                      <div className="flex items-center gap-1.5 text-xs text-[#8E88AB]">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">Course: <strong className="text-white">{m.cohort.course.title}</strong></span>
                      </div>
                    )}
                    {m.cohort.visualRoadmap && (
                      <div className="flex items-center gap-1.5 text-xs text-[#8E88AB]">
                        <Map className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">Roadmap: <strong className="text-white">{m.cohort.visualRoadmap.title}</strong></span>
                      </div>
                    )}
                  </div>

                  {(userCourse || userRoadmap) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (userCourse && onNavigateToCourse) {
                          onNavigateToCourse(userCourse.id);
                        } else if (userRoadmap && onNavigateToRoadmap) {
                          onNavigateToRoadmap(userRoadmap.id);
                        }
                      }}
                      className="mt-4 w-full py-2 px-3 bg-[#4F46E5]/20 hover:bg-[#4F46E5] border border-[#4F46E5]/30 hover:border-[#4F46E5] text-indigo-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      Continue to Course <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {cohortsTotalPages > 1 && (
        <div className="pt-2">
          <Pagination
            currentPage={cohortsPage}
            totalPages={cohortsTotalPages}
            onPageChange={setCohortsPage}
          />
        </div>
      )}
    </div>
  );
}

function CohortDetail({ 
  cohortId, 
  onBack, 
  cohortName, 
  inviteCode,
  courseTitle,
  roadmapTitle,
  isOwner,
  onDeleted,
  onLeft,
  userCourseId,
  userRoadmapId,
  onNavigateToCourse,
  onNavigateToRoadmap
}: { 
  cohortId: string, 
  onBack: () => void, 
  cohortName: string, 
  inviteCode?: string,
  courseTitle?: string,
  roadmapTitle?: string,
  isOwner: boolean,
  onDeleted?: () => void,
  onLeft?: () => void,
  userCourseId?: string | null,
  userRoadmapId?: string | null,
  onNavigateToCourse?: (courseId: string) => void,
  onNavigateToRoadmap?: (visualRoadmapId: string) => void
}) {
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardTotalPages, setLeaderboardTotalPages] = useState(1);

  const [activity, setActivity] = useState<any[] | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const handleNameClick = async (userId: string) => {
    setSelectedProfileUserId(userId);
    setIsProfileLoading(true);
    setProfileData(null);
    try {
      const data = await trpc.getCohortMemberProfile.query({ cohortId, userId });
      setProfileData(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load member profile");
      setSelectedProfileUserId(null);
    } finally {
      setIsProfileLoading(false);
    }
  };

  useEffect(() => {
    trpc.getCohortLeaderboard.query({ cohortId, page: leaderboardPage, pageSize: 10 })
      .then(res => {
        if (Array.isArray(res)) setLeaderboard(res);
        else {
          setLeaderboard(res.items);
          setLeaderboardTotalPages(res.totalPages);
        }
      })
      .catch(err => console.error("Failed to load leaderboard", err));
  }, [cohortId, leaderboardPage]);

  useEffect(() => {
    trpc.getCohortActivity.query({ cohortId, page: activityPage, pageSize: 10 })
      .then(res => {
        if (Array.isArray(res)) setActivity(res);
        else {
          setActivity(res.items);
          setActivityTotalPages(res.totalPages);
        }
      })
      .catch(err => console.error("Failed to load activity", err));
  }, [cohortId, activityPage]);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleLeave = () => {
    setShowLeaveConfirm(true);
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      await trpc.deleteCohort.mutate({ cohortId });
      toast.success("Cohort deleted successfully");
      setShowDeleteConfirm(false);
      onBack();
      if (onDeleted) {
        onDeleted();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete cohort");
    } finally {
      setIsDeleting(false);
    }
  };

  const executeLeave = async () => {
    setIsLeaving(true);
    try {
      await trpc.leaveCohort.mutate({ cohortId });
      toast.success("Successfully left the cohort");
      setShowLeaveConfirm(false);
      onBack();
      if (onLeft) {
        onLeft();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to leave cohort");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2A2443]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-[#1E1A33] hover:bg-[#2A2443] rounded-xl text-[#FAF9FD] transition">
            <ArrowRight className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-[#FAF9FD] tracking-tight">{cohortName}</h1>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              {inviteCode && (
                <span className="text-xs bg-[#1E1A33] text-[#CECADF] px-2.5 py-1 rounded-md font-mono tracking-wider">
                  Code: {inviteCode}
                </span>
              )}
              {courseTitle && (
                <button
                  onClick={() => {
                    if (userCourseId && onNavigateToCourse) {
                      onNavigateToCourse(userCourseId);
                    }
                  }}
                  disabled={!userCourseId}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                    userCourseId 
                      ? "bg-[#4F46E5]/15 text-indigo-300 hover:bg-[#4F46E5] hover:text-white border border-[#4F46E5]/30 cursor-pointer" 
                      : "bg-[#1E1A33] text-[#CECADF] border border-[#2A2443] cursor-not-allowed"
                  }`}
                >
                  <BookOpen className="w-3 h-3" /> Course: {courseTitle}
                  {userCourseId && <ArrowRight className="w-3 h-3 text-indigo-400" />}
                </button>
              )}
              {roadmapTitle && (
                <button
                  onClick={() => {
                    if (userRoadmapId && onNavigateToRoadmap) {
                      onNavigateToRoadmap(userRoadmapId);
                    }
                  }}
                  disabled={!userRoadmapId}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                    userRoadmapId 
                      ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer" 
                      : "bg-[#1E1A33] text-[#CECADF] border border-[#2A2443] cursor-not-allowed"
                  }`}
                >
                  <Map className="w-3 h-3" /> Roadmap: {roadmapTitle}
                  {userRoadmapId && <ArrowRight className="w-3 h-3 text-emerald-400" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div data-tour="cohort-member-actions" className="flex flex-col sm:flex-row gap-3 self-start sm:self-center">
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-xl font-medium transition flex items-center gap-2 disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete Cohort
            </button>
          )}

          {!isOwner && (
            <button
              onClick={handleLeave}
              disabled={isLeaving}
              className="px-4 py-2.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 rounded-xl font-medium transition flex items-center gap-2 disabled:opacity-50"
            >
              {isLeaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              Leave Cohort
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div data-tour="cohort-leaderboard" className="lg:col-span-2 space-y-6 min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-[#FAF9FD]">Leaderboard</h2>
          </div>
          
          <div className="bg-[#121021] border border-[#2A2443] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-[#1E1A33] text-[#CECADF] font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Learner</th>
                  <th className="px-6 py-4 text-right">Proficiency</th>
                  <th className="px-6 py-4 text-right">Avg Score</th>
                  <th className="px-6 py-4 text-right">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2443]">
                {leaderboard ? leaderboard.map((user, idx) => (
                  <tr key={user.userId} className="hover:bg-[#1E1A33]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#8E88AB]">
                      {idx === 0 ? <span className="text-amber-400 text-lg font-black">1</span> : 
                       idx === 1 ? <span className="text-slate-300 text-lg font-bold">2</span> : 
                       idx === 2 ? <span className="text-amber-700 text-lg font-bold">3</span> : idx + 1}
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#FAF9FD]">
                      <button
                        type="button"
                        onClick={() => handleNameClick(user.userId)}
                        className="hover:text-indigo-400 hover:underline transition text-left font-semibold cursor-pointer outline-none"
                      >
                        {user.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-400 font-bold">{user.estimatedProficiency}%</td>
                    <td className="px-6 py-4 text-right text-emerald-400">{user.avgQuizScore}%</td>
                    <td className="px-6 py-4 text-right text-orange-400 font-semibold">{user.currentStreak} 🔥</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[#8E88AB]">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading leaderboard...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {leaderboardTotalPages > 1 && (
              <div className="p-4 border-t border-[#2A2443]">
                <Pagination
                  currentPage={leaderboardPage}
                  totalPages={leaderboardTotalPages}
                  onPageChange={setLeaderboardPage}
                />
              </div>
            )}
          </div>
        </div>

        <div data-tour="cohort-activity" className="space-y-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-[#FAF9FD]">Recent Activity</h2>
          </div>

          <div className="bg-[#121021] border border-[#2A2443] rounded-2xl p-5 space-y-4 shadow-xl">
            {activity ? activity.map((act, i) => (
              <div key={i} className="flex gap-3 items-start">
                <button
                  type="button"
                  onClick={() => handleNameClick(act.userId)}
                  className="w-8 h-8 rounded-full bg-[#1E1A33] hover:bg-[#2A2443] flex items-center justify-center shrink-0 text-[#FAF9FD] font-bold text-xs uppercase cursor-pointer transition outline-none"
                  title={`View ${act.userName}'s Profile`}
                >
                  {act.userName.substring(0,2)}
                </button>
                <div>
                  <p className="text-sm text-[#CECADF]">
                    <button
                      type="button"
                      onClick={() => handleNameClick(act.userId)}
                      className="font-bold text-[#FAF9FD] hover:text-indigo-400 hover:underline transition cursor-pointer text-left outline-none"
                    >
                      {act.userName}
                    </button>{" "}
                    {act.action}
                  </p>
                  <p className="text-xs text-[#8E88AB] mt-0.5">
                    {new Date(act.time).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )) : (
              <div className="py-8 text-center text-[#8E88AB]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading activity...
              </div>
            )}
            
            {activity && activity.length === 0 && (
              <p className="text-sm text-[#8E88AB] text-center py-4">No recent activity.</p>
            )}

            {activityTotalPages > 1 && (
              <div className="pt-2 border-t border-[#2A2443] mt-4">
                <Pagination
                  currentPage={activityPage}
                  totalPages={activityTotalPages}
                  onPageChange={setActivityPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121021] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">Delete Cohort?</h3>
                <p className="text-sm text-[#CECADF] mt-2 leading-relaxed">
                  Are you sure you want to permanently delete <span className="font-bold text-red-400">{cohortName}</span>? This action is absolute and irreversible. All student progress metrics within this cohort will be deleted.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Yes, Delete Cohort"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121021] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">Leave Cohort?</h3>
                <p className="text-sm text-[#CECADF] mt-2 leading-relaxed">
                  Are you sure you want to leave <span className="font-bold text-amber-400">{cohortName}</span>? Your scoped leaderboard rank will be removed, though your cloned courses and roadmaps will remain intact in your profile.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs"
                disabled={isLeaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeLeave}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                disabled={isLeaving}
              >
                {isLeaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Leaving...
                  </>
                ) : (
                  "Yes, Leave"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProfileUserId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121021] border border-[#2A2443] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative">
            <button 
              onClick={() => setSelectedProfileUserId(null)}
              className="absolute top-4 right-4 text-[#8E88AB] hover:text-white transition cursor-pointer text-sm font-bold"
            >
              ✕
            </button>

            {isProfileLoading ? (
              <div className="py-12 flex flex-col justify-center items-center gap-2 text-sm text-[#8E88AB]">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span>Loading profile...</span>
              </div>
            ) : profileData ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-[#2A2443] pb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#8B5CF6] flex items-center justify-center text-base text-white font-extrabold shadow-md">
                    {profileData.name ? profileData.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "U"}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#FAF9FD]">{profileData.name}</h3>
                    <p className="text-xs text-[#8E88AB] font-medium">
                      Cohort{" "}
                      {profileData.role === "Student" || profileData.role === "Teacher" || profileData.role === "Owner" ? (
                        <span className="text-[#FBBF24] font-bold px-1.5 py-0.5 rounded bg-[#FBBF24]/10 border border-[#FBBF24]/20">{profileData.role}</span>
                      ) : (
                        "Member"
                      )}
                      {" "}Profile
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#8E88AB] uppercase tracking-wider block">Bio</span>
                  {profileData.bio ? (
                    <p className="text-sm text-[#CECADF] bg-[#1E1A33]/50 border border-[#2A2443]/50 rounded-xl p-3.5 leading-relaxed italic">
                      "{profileData.bio}"
                    </p>
                  ) : (
                    <p className="text-sm text-[#8E88AB] italic bg-[#1E1A33]/20 rounded-xl p-3">
                      This user has not set a bio yet.
                    </p>
                  )}
                </div>

                {profileData.socialLinks && profileData.socialLinks.length > 0 && (
                  <div className="space-y-2.5 pt-1">
                    <span className="text-xs font-semibold text-[#8E88AB] uppercase tracking-wider block">Verified Social Accounts</span>
                    <div className="flex flex-col gap-2">
                      {profileData.socialLinks.map((link: any) => {
                        const isGithub = link.provider === "github";
                        return (
                          <a
                            key={link.id}
                            href={link.profileUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.02] text-xs font-bold bg-[#5865F2]/15 hover:bg-[#5865F2]/25 border-[#5865F2]/30 text-[#FAF9FD]"
                          >
                            <span className="flex items-center gap-2">
                              {isGithub ? <Github className="w-4 h-4 text-[#5865F2]" /> : <DiscordIcon className="w-4 h-4 text-[#5865F2]" />}
                              <span>{isGithub ? "GitHub" : "Discord"} Profile</span>
                            </span>
                            <span className="text-xs text-[#8E88AB] font-normal font-mono">@{link.externalUsername} ↗</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProfileUserId(null)}
                    className="px-5 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs cursor-pointer w-full text-center"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-[#8E88AB] text-sm">
                No profile details could be retrieved.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
