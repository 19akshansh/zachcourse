import React, { useState, useEffect } from "react";
import { trpc } from "../lib/trpc-client";
import { BookOpen, Users, Download, TrendingUp, ChevronLeft, Map, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "./Pagination";
import { useTranslation } from "react-i18next";

export default function TeacherDashboard() {
  const { t } = useTranslation(["teacherDashboard", "common"]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [classroomsPage, setClassroomsPage] = useState(1);
  const [classroomsTotalPages, setClassroomsTotalPages] = useState(1);

  const [activeClassroom, setActiveClassroom] = useState<any | null>(null);
  
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterTotalPages, setRosterTotalPages] = useState(1);

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentDetails, setStudentDetails] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [newClassroomName, setNewClassroomName] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedVisualRoadmapId, setSelectedVisualRoadmapId] = useState("");

  const [courses, setCourses] = useState<any[]>([]);
  const [roadmaps, setRoadmaps] = useState<any[]>([]);

  const [classroomToDelete, setClassroomToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingClassroom, setIsDeletingClassroom] = useState(false);

  const loadClassrooms = async (page = 1) => {
    try {
      const data = await trpc.getTeacherClassrooms.query({ page, pageSize: 8 });
      if (Array.isArray(data)) {
        setClassrooms(data);
      } else {
        setClassrooms(data.items);
        setClassroomsTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherContent = async () => {
    try {
      const [coursesRes, roadmapsRes] = await Promise.all([
        trpc.getCourses.query(),
        trpc.getVisualRoadmaps.query({ pageSize: 100 })
      ]);
      setCourses(coursesRes || []);
      setRoadmaps(roadmapsRes?.items || []);
    } catch (e) {
      console.error("Failed to load content for classroom selection", e);
    }
  };

  useEffect(() => {
    loadClassrooms(classroomsPage);
  }, [classroomsPage]);

  useEffect(() => {
    loadTeacherContent();
  }, []);

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassroomName.trim()) return;
    if (!selectedCourseId && !selectedVisualRoadmapId) {
      toast.error(t("toastSelectCourseOrRoadmap", { defaultValue: "Please select a Course or a Roadmap" }));
      return;
    }
    try {
      await trpc.createClassroom.mutate({
        name: newClassroomName,
        courseId: selectedCourseId || null,
        visualRoadmapId: selectedVisualRoadmapId || null
      });
      setNewClassroomName("");
      setSelectedCourseId("");
      setSelectedVisualRoadmapId("");
      toast.success(t("toastClassroomCreated", { defaultValue: "Classroom created!" }));
      loadClassrooms();
    } catch (err: any) {
      toast.error(err.message || t("toastFailedToCreate", { defaultValue: "Failed to create classroom" }));
    }
  };

  const loadRoster = async (classroom: any, page = 1) => {
    setActiveClassroom(classroom);
    setSelectedStudent(null);
    try {
      const data = await trpc.getClassroomRoster.query({ classroomId: classroom.id, page, pageSize: 10 });
      if (Array.isArray(data)) {
        setRoster(data);
      } else {
        setRoster(data.items);
        setRosterTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
      toast.error(t("toastFailedToLoadRoster", { defaultValue: "Failed to load roster" }));
    }
  };

  useEffect(() => {
    if (activeClassroom) {
      loadRoster(activeClassroom, rosterPage);
    }
  }, [rosterPage]);

  const loadStudentDetail = async (studentId: string, studentName: string) => {
    setSelectedStudent({ id: studentId, name: studentName });
    try {
      const data = await trpc.getStudentDetail.query({ classroomId: activeClassroom.id, studentId });
      setStudentDetails(data);
    } catch (err) {
      console.error(err);
      toast.error(t("toastFailedToLoadDetails", { defaultValue: "Failed to load student details" }));
    }
  };

  const exportCSV = () => {
    if (!roster.length) return toast.error(t("toastNoStudentsToExport", { defaultValue: "No students to export" }));
    const headers = ["Name,Email,Proficiency,Avg Score,Lessons Completed,Streak"];
    const rows = roster.map(r => 
      `${r.name || "Unknown"},${r.email || ""},${r.estimatedProficiency}%,${r.avgQuizScore || 0}%,${r.totalLessonsCompleted},${r.currentStreak}`
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeClassroom.name.replace(/\s+/g, '_')}_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteDeleteClassroom = async () => {
    if (!classroomToDelete) return;
    setIsDeletingClassroom(true);
    try {
      await trpc.deleteCohort.mutate({ cohortId: classroomToDelete.id });
      toast.success(t("toastClassroomDeleted", { defaultValue: "Classroom deleted successfully" }));
      setClassroomToDelete(null);
      if (activeClassroom?.id === classroomToDelete.id) {
        setActiveClassroom(null);
      }
      loadClassrooms();
    } catch (err: any) {
      toast.error(err.message || t("toastFailedToDelete", { defaultValue: "Failed to delete classroom" }));
    } finally {
      setIsDeletingClassroom(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-[#CECADF] flex flex-col items-center justify-center gap-3 h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span>{t("loadingDashboard", { defaultValue: "Loading dashboard..." })}</span>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto w-full space-y-8 fade-in">
        {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#2A2443] pb-6">
        <div className="bg-indigo-950/40 p-3 rounded-2xl">
          <BookOpen className="w-8 h-8 text-[#818CF8]" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-[#FAF9FD] tracking-tight">{t("title", { defaultValue: "Teacher Dashboard" })}</h2>
          <p className="text-[#8E88AB] mt-1">{t("subtitle", { defaultValue: "Manage classrooms, monitor student progress, and identify learning gaps." })}</p>
        </div>
      </div>

      {!activeClassroom ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div data-tour="teacher-create-classroom" className="md:col-span-1 bg-[#1A172E] border border-[#2A2443] rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#FAF9FD]">{t("createClassroom", { defaultValue: "Create Classroom" })}</h3>
            <form onSubmit={handleCreateClassroom} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#8E88AB] mb-1.5 uppercase tracking-wider">{t("classroomName", { defaultValue: "Classroom Name" })}</label>
                <input
                  type="text"
                  placeholder={t("classroomNamePlaceholder", { defaultValue: "e.g. CS101 Autumn 2026" })}
                  value={newClassroomName}
                  onChange={e => setNewClassroomName(e.target.value)}
                  className="w-full bg-[#121021] border border-[#2A2443] text-[#FAF9FD] px-4 py-3 rounded-xl focus:outline-none focus:border-[#4F46E5] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E88AB] mb-1.5 uppercase tracking-wider">{t("selectCourse", { defaultValue: "Select Course" })}</label>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  className="w-full bg-[#121021] border border-[#2A2443] text-[#FAF9FD] px-4 py-3 rounded-xl focus:outline-none focus:border-[#4F46E5] text-sm"
                >
                  <option value="">{t("noneSelected", { defaultValue: "-- None Selected --" })}</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title} ({c.difficulty})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E88AB] mb-1.5 uppercase tracking-wider">{t("selectRoadmap", { defaultValue: "Select Roadmap" })}</label>
                <select
                  value={selectedVisualRoadmapId}
                  onChange={e => setSelectedVisualRoadmapId(e.target.value)}
                  className="w-full bg-[#121021] border border-[#2A2443] text-[#FAF9FD] px-4 py-3 rounded-xl focus:outline-none focus:border-[#4F46E5] text-sm"
                >
                  <option value="">{t("noneSelected", { defaultValue: "-- None Selected --" })}</option>
                  {roadmaps.map(r => (
                    <option key={r.id} value={r.id}>{r.title} ({r.difficulty})</option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-[#8E88AB] leading-relaxed">
                {t("createClassroomHint", { defaultValue: "* At least one Course or Roadmap must be selected. Enrolled students will automatically clone and study this content." })}
              </p>

              <button
                type="submit"
                disabled={!newClassroomName.trim() || (!selectedCourseId && !selectedVisualRoadmapId)}
                className="bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition cursor-pointer"
              >
                {t("createClassroom", { defaultValue: "Create Classroom" })}
              </button>
            </form>
          </div>

          <div data-tour="teacher-classroom-list" className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {classrooms.map(cls => (
              <div key={cls.id} className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-[#4F46E5]/50 transition">
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-xl font-bold text-[#FAF9FD]">{cls.name}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setClassroomToDelete({ id: cls.id, name: cls.name });
                      }}
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors text-[#8E88AB] hover:text-rose-400 cursor-pointer shrink-0"
                      title={t("deleteClassroom", { defaultValue: "Delete Classroom" })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[#8E88AB] mt-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">{t("studentsEnrolled", { count: cls._count.members, defaultValue: "{{count}} students enrolled" })}</span>
                  </div>

                  <div className="space-y-1.5 mt-3 pt-3 border-t border-[#121021]">
                    {cls.course && (
                      <div className="flex items-center gap-1.5 text-xs text-[#8E88AB]">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{t("courseLabel", { defaultValue: "Course:" })} <strong className="text-white">{cls.course.title}</strong></span>
                      </div>
                    )}
                    {cls.visualRoadmap && (
                      <div className="flex items-center gap-1.5 text-xs text-[#8E88AB]">
                        <Map className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{t("roadmapLabel", { defaultValue: "Roadmap:" })} <strong className="text-white">{cls.visualRoadmap.title}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <div className="bg-[#121021] border border-[#2A2443] px-3 py-1.5 rounded-lg text-xs font-mono text-[#FAF9FD]">
                    {t("codeLabel", { defaultValue: "Code:" })} <span className="font-bold text-emerald-400 tracking-wider">{cls.inviteCode}</span>
                  </div>
                  <button
                    onClick={() => loadRoster(cls)}
                    className="text-[#818CF8] hover:text-[#A5B4FC] font-semibold text-sm transition text-left"
                  >
                    {t("viewRoster", { defaultValue: "View Roster →" })}
                  </button>
                </div>
              </div>
            ))}
            {classrooms.length === 0 && (
              <div className="sm:col-span-2 py-12 text-center text-[#8E88AB]">
                {t("emptyState", { defaultValue: "You have no active classrooms. Create one to start monitoring student progress!" })}
              </div>
            )}

            {classroomsTotalPages > 1 && (
              <div className="sm:col-span-2 pt-4 border-t border-[#2A2443] mt-2">
                <Pagination
                  currentPage={classroomsPage}
                  totalPages={classroomsTotalPages}
                  onPageChange={setClassroomsPage}
                />
              </div>
            )}
          </div>

          {/* Hidden targets for Joyride onboarding flow to prevent TARGET_NOT_FOUND crashes */}
          <div className="absolute top-0 left-0 pointer-events-none opacity-0 -z-10">
            <div data-tour="teacher-roster" className="w-10 h-10"></div>
          </div>
        </div>
      ) : !selectedStudent ? (
        <div data-tour="teacher-roster" className="bg-[#1A172E] border border-[#2A2443] rounded-3xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-[#2A2443] flex items-center justify-between bg-[#151221]">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveClassroom(null)} className="text-[#8E88AB] hover:text-[#FAF9FD] transition">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold text-[#FAF9FD]">{t("rosterSuffix", { name: activeClassroom.name, defaultValue: "{{name}} Roster" })}</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 bg-[#2A2443] hover:bg-[#322B4D] text-[#FAF9FD] px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                <Download className="w-4 h-4" /> {t("exportCsv", { defaultValue: "Export CSV" })}
              </button>
              <button
                onClick={() => setClassroomToDelete({ id: activeClassroom.id, name: activeClassroom.name })}
                className="flex items-center gap-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
                title={t("deleteClassroom", { defaultValue: "Delete Classroom" })}
              >
                <Trash2 className="w-4 h-4" /> {t("deleteClassroom", { defaultValue: "Delete Classroom" })}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#121021]/50 border-b border-[#2A2443]">
                <tr>
                  <th className="p-4 text-xs font-bold text-[#8E88AB] uppercase tracking-wider">{t("studentName", { defaultValue: "Student Name" })}</th>
                  <th className="p-4 text-xs font-bold text-[#8E88AB] uppercase tracking-wider text-center">{t("avgQuiz", { defaultValue: "Avg Quiz" })}</th>
                  <th className="p-4 text-xs font-bold text-[#8E88AB] uppercase tracking-wider text-center">{t("lessons", { defaultValue: "Lessons" })}</th>
                  <th className="p-4 text-xs font-bold text-[#8E88AB] uppercase tracking-wider text-center">{t("proficiency", { defaultValue: "Proficiency" })}</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2443]">
                {roster.map(student => (
                  <tr key={student.userId} className="hover:bg-[#151221] transition">
                    <td className="p-4">
                      <div className="font-semibold text-[#FAF9FD]">{student.name || t("common:student", { defaultValue: "Student" })}</div>
                      <div className="text-xs text-[#8E88AB]">{student.email}</div>
                    </td>
                    <td className="p-4 text-center text-[#FAF9FD] font-mono">{Math.round(student.avgQuizScore || 0)}%</td>
                    <td className="p-4 text-center text-[#CECADF]">{student.totalLessonsCompleted}</td>
                    <td className="p-4 text-center">
                      <span className="text-sm font-bold text-indigo-400">
                        {student.estimatedProficiency}%
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => loadStudentDetail(student.userId, student.name)}
                        className="text-sm font-semibold text-[#818CF8] hover:text-indigo-400 transition"
                      >
                        {t("details", { defaultValue: "Details" })}
                      </button>
                    </td>
                  </tr>
                ))}
                {roster.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#8E88AB]">{t("noStudentsJoined", { defaultValue: "No students have joined this classroom yet." })}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {rosterTotalPages > 1 && (
            <div className="p-4 border-t border-[#2A2443]">
              <Pagination
                currentPage={rosterPage}
                totalPages={rosterTotalPages}
                onPageChange={setRosterPage}
              />
            </div>
          )}
        </div>
      ) : (
        <div data-tour="teacher-student-detail" className="space-y-6">
          <div className="flex items-center gap-4 border-b border-[#2A2443] pb-4">
            <button onClick={() => setSelectedStudent(null)} className="text-[#8E88AB] hover:text-[#FAF9FD] transition">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-bold text-[#FAF9FD]">{t("studentProfile", { name: selectedStudent.name, defaultValue: "{{name}}'s Profile" })}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-6 shadow-xl">
              <h4 className="text-lg font-bold text-[#FAF9FD] mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" /> {t("activeCourses", { defaultValue: "Active Courses" })}
              </h4>
              <div className="space-y-3">
                {studentDetails?.courses?.map((c: any) => (
                  <div key={c.id} className="bg-[#121021] border border-[#2A2443] p-4 rounded-xl">
                    <div className="font-semibold text-[#CECADF]">{c.title}</div>
                    <div className="text-xs text-[#8E88AB] mt-1">{t("lessonsCompleted", { count: c.completedLessons.length, defaultValue: "{{count}} lessons completed" })}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-6 shadow-xl">
              <h4 className="text-lg font-bold text-[#FAF9FD] mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-rose-400" /> {t("areasForReview", { defaultValue: "Areas for Review (Score < 70)" })}
              </h4>
              <div className="space-y-2">
                {studentDetails?.weakTopics?.map((wt: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-[#121021] border border-[#2A2443] p-3 rounded-xl">
                    <span className="text-sm text-[#CECADF] truncate max-w-[200px]" title={wt.topic}>{wt.topic}</span>
                    <span className="text-xs font-mono bg-rose-950/40 text-rose-400 border border-rose-500/30 px-2 py-1 rounded">
                      {wt.score}%
                    </span>
                  </div>
                ))}
                {!studentDetails?.weakTopics?.length && (
                  <div className="text-sm text-[#8E88AB]">{t("noWeakTopics", { defaultValue: "No weak topics identified yet." })}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

      {classroomToDelete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121021] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">{t("deleteClassroomConfirmTitle", { defaultValue: "Delete Classroom?" })}</h3>
                <p className="text-sm text-[#CECADF] mt-2 leading-relaxed">
                  {t("deleteClassroomConfirmDesc", { name: classroomToDelete.name, defaultValue: "Are you sure you want to permanently delete the classroom {{name}}? This action is absolute and irreversible. All student enrollment records and gradebook metrics within this classroom will be permanently removed." })}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setClassroomToDelete(null)}
                className="px-4 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs cursor-pointer"
                disabled={isDeletingClassroom}
              >
                {t("cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteClassroom}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition font-bold text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                disabled={isDeletingClassroom}
              >
                {isDeletingClassroom ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t("deleting", { defaultValue: "Deleting..." })}
                  </>
                ) : (
                  t("yesDeleteClassroom", { defaultValue: "Yes, Delete Classroom" })
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
