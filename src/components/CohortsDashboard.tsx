import React, { useState, useEffect } from "react";
import { trpc } from "../lib/trpc-client";
import { Users, Plus, Hash, Trophy, Activity, ArrowRight, Loader2, BookOpen, Map, Check } from "lucide-react";
import { toast } from "sonner";

export default function CohortsDashboard() {
  const [memberships, setMemberships] = useState<any[] | null>(null);
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

  const loadCohorts = async () => {
    try {
      const res = await trpc.getUserCohorts.query();
      setMemberships(res);
    } catch (e: any) {
      toast.error(e.message || "Failed to load cohorts");
    }
  };

  const loadUserContent = async () => {
    try {
      const [coursesRes, roadmapsRes] = await Promise.all([
        trpc.getCourses.query(),
        trpc.getVisualRoadmaps.query()
      ]);
      setCourses(coursesRes || []);
      setRoadmaps(roadmapsRes || []);
    } catch (e) {
      console.error("Failed to load user content", e);
    }
  };

  useEffect(() => {
    loadCohorts();
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

  if (activeCohortId) {
    return (
      <CohortDetail 
        cohortId={activeCohortId} 
        onBack={() => setActiveCohortId(null)} 
        cohortName={activeMembership?.cohort.name || "Cohort"}
        inviteCode={activeMembership?.cohort.inviteCode}
        courseTitle={activeMembership?.cohort.course?.title}
        roadmapTitle={activeMembership?.cohort.visualRoadmap?.title}
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
            onClick={() => { setIsJoining(true); setIsCreating(false); setPreviewCohort(null); }}
            className="px-4 py-2 bg-[#1E1A33] hover:bg-[#2A2443] border border-[#2A2443] text-[#FAF9FD] rounded-xl font-medium transition flex items-center gap-2"
          >
            <Hash className="w-4 h-4 text-emerald-400" /> Join
          </button>
          <button 
            onClick={() => { setIsCreating(true); setIsJoining(false); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition shadow-lg shadow-indigo-900/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-[#121021] border border-indigo-500/30 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-[#CECADF] mb-2">Cohort Name</label>
              <input 
                type="text" 
                value={createName} 
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g. Frontend Masters Fall 2026"
                className="w-full bg-[#1E1A33] border border-[#2A2443] text-[#FAF9FD] rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
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
                className="w-full bg-[#1E1A33] border border-[#2A2443] text-[#FAF9FD] rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
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
                className="w-full bg-[#1E1A33] border border-[#2A2443] text-[#FAF9FD] rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
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
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition"
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
                  disabled={isJoinLoading}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isJoinLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {memberships.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-[#2A2443] rounded-2xl bg-[#121021]/50 animate-fade-in">
            <Users className="w-12 h-12 text-[#2A2443] mx-auto mb-3" />
            <p className="text-[#8E88AB] font-medium">You aren't in any cohorts yet.</p>
            <p className="text-sm text-[#8E88AB]/70 mt-1">Create one or join an existing group to get started.</p>
          </div>
        ) : (
          memberships.map((m) => (
            <div 
              key={m.cohort.id} 
              onClick={() => setActiveCohortId(m.cohort.id)}
              className="bg-[#121021] border border-[#2A2443] hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 group flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#2A2443] group-hover:text-indigo-400 transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-[#FAF9FD] mb-1 group-hover:text-indigo-300 transition-colors">{m.cohort.name}</h3>
                <p className="text-sm text-[#CECADF] flex items-center gap-1 mb-4">
                  {m.cohort._count?.members || 1} Member{(m.cohort._count?.members || 1) !== 1 ? 's' : ''}
                </p>
              </div>

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
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CohortDetail({ 
  cohortId, 
  onBack, 
  cohortName, 
  inviteCode,
  courseTitle,
  roadmapTitle
}: { 
  cohortId: string, 
  onBack: () => void, 
  cohortName: string, 
  inviteCode?: string,
  courseTitle?: string,
  roadmapTitle?: string
}) {
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [activity, setActivity] = useState<any[] | null>(null);

  useEffect(() => {
    trpc.getCohortLeaderboard.query({ cohortId })
      .then(res => setLeaderboard(res))
      .catch(err => console.error("Failed to load leaderboard", err));
    
    trpc.getCohortActivity.query({ cohortId })
      .then(res => setActivity(res))
      .catch(err => console.error("Failed to load activity", err));
  }, [cohortId]);

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
                <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Course: {courseTitle}
                </span>
              )}
              {roadmapTitle && (
                <span className="text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1">
                  <Map className="w-3 h-3" /> Roadmap: {roadmapTitle}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-[#FAF9FD]">Leaderboard</h2>
          </div>
          
          <div className="bg-[#121021] border border-[#2A2443] rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm">
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
                    <td className="px-6 py-4 font-semibold text-[#FAF9FD]">{user.name}</td>
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
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-[#FAF9FD]">Recent Activity</h2>
          </div>

          <div className="bg-[#121021] border border-[#2A2443] rounded-2xl p-5 space-y-4 shadow-xl">
            {activity ? activity.map((act, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1E1A33] flex items-center justify-center shrink-0 text-[#FAF9FD] font-bold text-xs uppercase">
                  {act.userName.substring(0,2)}
                </div>
                <div>
                  <p className="text-sm text-[#CECADF]">
                    <span className="font-bold text-[#FAF9FD]">{act.userName}</span> {act.action}
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
          </div>
        </div>
      </div>
    </div>
  );
}
