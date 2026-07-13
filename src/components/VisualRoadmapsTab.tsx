import React, { useState } from "react";
import { trpc } from "../lib/trpc-client";
import { Map, ArrowRight, Star, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import VisualRoadmapGraph from "./VisualRoadmapGraph";
import { DocumentUpload } from "./DocumentUpload";
import { apiFetch } from "../lib/api";
import { Pagination } from "./Pagination";
import { PersonalizationFields } from "./PersonalizationFields";
import { useTranslation } from "react-i18next";

export interface VisualRoadmapsTabProps {
  roadmaps: any[];
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  activeVRoadmapId: string | null;
  setActiveVRoadmapId: (id: string | null) => void;
  hasKey: boolean;
  onRoadmapGenerated: (data: any, meta: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string, val: boolean) => Promise<void>;
  onForceRetranslate?: () => void;
  isForceRetranslating?: boolean;
  onToggleNodeComplete: (roadmapId: string, nodeId: string) => Promise<void>;
  isRetranslating?: boolean;
}

export default function VisualRoadmapsTab({
  roadmaps,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  activeVRoadmapId,
  setActiveVRoadmapId,
  hasKey,
  onRoadmapGenerated,
  onDelete,
  onToggleFavorite,
  onToggleNodeComplete,
  isRetranslating = false,
  onForceRetranslate,
  isForceRetranslating
}: VisualRoadmapsTabProps) {
  const { t, i18n } = useTranslation(["roadmap", "common"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [backgroundContext, setBackgroundContext] = useState("");
  const [tone, setTone] = useState("friendly");
  const [weeklyHours, setWeeklyHours] = useState(5);
  const [sourceUrl, setSourceUrl] = useState("");
  const [documentContext, setDocumentContext] = useState("");
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [isFormExplicitlyOpen, setIsFormExplicitlyOpen] = useState(false);
  const showForm = isFormExplicitlyOpen || roadmaps.length === 0;
  const [roadmapToDelete, setRoadmapToDelete] = useState<{ id: string; topic: string } | null>(null);
  const [isDeletingRoadmap, setIsDeletingRoadmap] = useState(false);

  const activeRoadmap = roadmaps.find((r) => r.id === activeVRoadmapId);
  const completedNodeIds = (activeRoadmap?.completedNodeIds as string[]) || [];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;

    setIsGenerating(true);
    try {
      const userKey = localStorage.getItem("zc_user_key") || "";
      const res = await apiFetch("/api/generate-visual-roadmap", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-key": userKey 
        },
        body: JSON.stringify({ topic, experienceLevel, backgroundContext, weeklyHours, sourceUrl, documentContext, tone, language: i18n.language }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || t("common:toastGenerationFailed", { defaultValue: "Generation failed" }));

      await onRoadmapGenerated(data.roadmap, { topic, experienceLevel, backgroundContext, weeklyHours, tone });
      setIsFormExplicitlyOpen(false);
      setTopic("");
      setSourceUrl("");
    } catch (err: any) {
      toast.error(err.message || t("common:toastFailedToGenerate", { defaultValue: "Failed to generate roadmap" }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteDeleteRoadmap = async () => {
    if (!roadmapToDelete) return;
    setIsDeletingRoadmap(true);
    try {
      await onDelete(roadmapToDelete.id);
      setRoadmapToDelete(null);
    } catch (err: any) {
      toast.error(err.message || t("common:toastFailedToDelete", { defaultValue: "Failed to delete roadmap" }));
    } finally {
      setIsDeletingRoadmap(false);
    }
  };

  const getProgress = (roadmap: any) => {
    const total = roadmap.roadmapData?.nodes?.filter(
      (n: any) => n.type === "lesson" || n.type === "project"
    ).length || 0;
    const done = (roadmap.completedNodeIds as string[])?.length || 0;
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  };

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto relative px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0F0D19] z-10 pointer-events-none" />
        <div className="relative z-20">
          <div className="w-20 h-20 bg-[#4F46E5]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-[#4F46E5]/20">
            <span className="text-4xl">🔑</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">{t("common:apiKeyRequired", { defaultValue: "API Key Required" })}</h2>
          <p className="text-[#8E88AB] mb-8 leading-relaxed">
            {t("common:apiKeyRequiredDesc", { defaultValue: "Visual Roadmaps use structured output generation to build complex graph paths. Add your Gemini API key to unlock this feature." })}
          </p>
          <button 
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] w-full text-center"
            onClick={() => window.dispatchEvent(new CustomEvent('zc-open-onboarding'))}
          >
            {t("common:addApiKey", { defaultValue: "Add API Key" })} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              {t("generateRoadmap", { defaultValue: "Generate Roadmap" })} <Sparkles className="text-indigo-400 w-6 h-6" />
            </h2>
            <p className="text-[#8E88AB] mt-2">{t("generateRoadmapDesc", { defaultValue: "Map out any learning journey from beginner to mastery." })}</p>
          </div>
          {roadmaps.length > 0 && (
            <button 
              onClick={() => setIsFormExplicitlyOpen(false)}
              className="text-[#8E88AB] hover:text-white transition-colors"
            >
              {t("common:cancel", { defaultValue: "Cancel" })}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form data-tour="vroadmap-form" onSubmit={handleGenerate} className="space-y-8 bg-[#111118] border border-[#2A2443] rounded-2xl p-8 shadow-xl">
            <div>
              <label className="block text-sm font-bold text-[#8E88AB] uppercase tracking-wider mb-3">
                {t("whatToMaster", { defaultValue: "What do you want to master?" })}
              </label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t("topicPlaceholder", { defaultValue: "e.g., Python Backend, React & Tailwind, Machine Learning Foundations" })}
                className="w-full bg-[#0F0D19] border-2 border-[#2A2443] focus:border-[#4F46E5] rounded-xl px-5 py-4 text-white text-lg transition-colors placeholder:text-[#8E88AB]/60 outline-none"
              />
            </div>

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
                {t("weeklyCommitmentLabel", { defaultValue: "Weekly Commitment:" })} <span className="text-white">{t("hoursCount", { count: weeklyHours, defaultValue: "{{count}} hours" })}</span>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(parseInt(e.target.value))}
                className="w-full accent-[#4F46E5]"
              />
              <div className="flex justify-between text-xs font-medium text-[#8E88AB] mt-2">
                <span>{t("casualCommitment", { defaultValue: "Casual (1h)" })}</span>
                <span>{t("partTimeCommitment", { defaultValue: "Part-time (15h)" })}</span>
                <span>{t("intensiveCommitment", { defaultValue: "Intensive (30h)" })}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#8E88AB] uppercase tracking-wider mb-3">
                {t("sourceMaterialLabel", { defaultValue: "Source Material (Optional)" })}
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={t("roadmapUrlPlaceholder", { defaultValue: "https://... (Docs, syllabus, or course link)" })}
                className="w-full bg-[#0F0D19] border border-[#2A2443] focus:border-[#4F46E5] rounded-xl px-4 py-3 text-white transition-colors placeholder:text-[#8E88AB]/60 outline-none"
              />

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

            <button
              type="submit"
              disabled={!topic || isGenerating}
              className="w-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-[#3F395B] disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  {t("generating", { defaultValue: "Mapping your journey... 🗺️" })}
                </>
              ) : (
                <>
                  {t("generateButton", { defaultValue: "Generate Visual Roadmap ✨" })}
                </>
              )}
            </button>
            {isGenerating && <p className="text-center text-[#8E88AB] text-sm mt-4">{t("generatingHint", { defaultValue: "Usually takes 10-20 seconds" })}</p>}
          </form>

          {/* Right Col: Preview */}
          <div className="hidden lg:flex flex-col items-center justify-center bg-[#0F0D19] border border-[#2A2443] rounded-2xl p-8 relative overflow-hidden min-h-[500px]">
             {isGenerating ? (
               <div className="w-full max-w-sm">
                 <div className="flex flex-col items-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-[#1A172E] border-2 border-[#2A2443] animate-pulse"></div>
                    <div className="w-1 bg-[#2A2443] h-12"></div>
                    <div className="w-full h-24 rounded-xl bg-[#1A172E] border-2 border-[#2A2443] animate-pulse"></div>
                    <div className="w-1 bg-[#2A2443] h-12"></div>
                    <div className="flex gap-8">
                       <div className="w-32 h-20 rounded-xl bg-[#1A172E] border-2 border-[#2A2443] animate-pulse"></div>
                       <div className="w-32 h-20 rounded-xl bg-[#1A172E] border-2 border-[#2A2443] animate-pulse"></div>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="text-center opacity-50">
                 <Map className="w-16 h-16 text-[#8E88AB] mx-auto mb-4" />
                 <h3 className="text-lg font-bold text-white mb-2">{t("common:livePreview", { defaultValue: "Live Preview" })}</h3>
                 <p className="text-[#8E88AB] max-w-xs mx-auto">{t("common:graphWillAppearHere", { defaultValue: "Your generated node graph will appear here." })}</p>
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {t("common:yourRoadmaps", { defaultValue: "Your Roadmaps" })} <Map className="text-indigo-400 w-6 h-6" />
          </h2>
        </div>
        <button 
          onClick={() => setIsFormExplicitlyOpen(true)}
          className="bg-[#2A2443] hover:bg-[#3F395B] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors border border-[#3F395B]"
        >
          {t("common:newRoadmap", { defaultValue: "+ New Roadmap" })}
        </button>
      </div>

      {/* Saved list row */}
      <div data-tour="vroadmap-list" className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x px-1 shrink-0 hide-scrollbar">
        {roadmaps.length > 0 ? (
          roadmaps.map((r) => {
            const progress = getProgress(r);
            const isActive = activeVRoadmapId === r.id;
            return (
              <div 
                key={r.id}
                onClick={() => setActiveVRoadmapId(r.id)}
                className={`flex-shrink-0 w-[240px] snap-start bg-[#111118] border-2 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-1 ${
                  isActive ? 'border-[#4F46E5] shadow-[0_0_20px_rgba(99,102,241,0.15)]' : 'border-[#2A2443] hover:border-[#3F395B]'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-2xl">{r.topic.includes('React') || r.topic.includes('Web') ? '🌐' : r.topic.includes('AI') || r.topic.includes('Machine') ? '🤖' : '📚'}</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(r.id, !r.isFavorite) }}
                      className="p-1.5 hover:bg-[#2A2443] rounded-lg transition-colors"
                      title={r.isFavorite ? t("common:unfavorite", { defaultValue: "Unfavorite" }) : t("common:favorite", { defaultValue: "Favorite" })}
                    >
                      <Star className={`w-4 h-4 ${r.isFavorite ? 'fill-[#EAB308] text-[#EAB308]' : 'text-[#8E88AB]'}`} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoadmapToDelete({ id: r.id, topic: r.topic });
                      }}
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors text-[#8E88AB] hover:text-rose-400 cursor-pointer"
                      title={t("common:deleteRoadmap", { defaultValue: "Delete Roadmap" })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-white mb-1 line-clamp-1">{r.topic}</h3>
                <div className="flex items-center gap-2 text-xs font-medium text-[#8E88AB] mb-4">
                  <span>{r.difficulty}</span>
                  <span>•</span>
                  <span>{r.totalDuration || t("common:defaultDuration", { defaultValue: "4 weeks" })}</span>
                </div>
                
                <div className="w-full bg-[#1A172E] rounded-full h-1.5 mb-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-[#10B981]' : 'bg-[#4F46E5]'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className={progress === 100 ? 'text-[#10B981]' : 'text-[#8E88AB]'}>
                    {t("common:progressPercentComplete", { progress, defaultValue: "{{progress}}% Complete" })}
                  </span>
                  {progress === 100 && <span className="text-[#10B981]">{t("common:progressDone", { defaultValue: "🎉 Done!" })}</span>}
                </div>
              </div>
            );
          })
        ) : (
          <div className="w-full flex items-center justify-center py-8 bg-[#111118] border border-dashed border-[#2A2443] rounded-2xl text-[#8E88AB]">
            <p>{t("common:noSavedRoadmaps", { defaultValue: "You don't have any saved roadmaps yet. Generate one to see it here!" })}</p>
          </div>
        )}
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="shrink-0 pt-2">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}

      {/* Graph Area */}
      <div data-tour="vroadmap-graph" className="w-full relative" style={{ contain: 'layout' }}>
        <div className="w-full h-[700px] border border-[#2A2443] rounded-2xl overflow-hidden bg-[#0F0D19] relative">
          {isRetranslating ? (
            <div className="absolute inset-0 bg-[#0F0D19]/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-200">
              <Loader2 className="w-12 h-12 text-[#4F46E5] animate-spin mb-4" />
              <h3 className="text-lg font-bold text-[#FAF9FD] mb-2">{t("translatingRoadmap", { defaultValue: "Translating Roadmap... 🗺️" })}</h3>
              <p className="text-[#8E88AB] max-w-xs mx-auto">{t("pleaseWaitTranslating", { defaultValue: "Please wait while we convert your learning graph to your chosen language." })}</p>
            </div>
          ) : activeRoadmap ? (
            <VisualRoadmapGraph 
              roadmapData={activeRoadmap.roadmapData}
              completedNodeIds={completedNodeIds}
              onToggleComplete={(nodeId) => onToggleNodeComplete(activeRoadmap.id, nodeId)}
              onForceRetranslate={onForceRetranslate}
              isForceRetranslating={isForceRetranslating}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#8E88AB]">
              <div className="text-center">
                <Map className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("common:selectRoadmapToViewGraph", { defaultValue: "Select a roadmap above to view its graph" })}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {roadmapToDelete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121021] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#FAF9FD]">{t("common:deleteRoadmapConfirmTitle", { defaultValue: "Delete Visual Roadmap?" })}</h3>
                <p className="text-sm text-[#CECADF] mt-2 leading-relaxed">
                  {t("common:deleteRoadmapConfirmDesc1", { defaultValue: "Are you sure you want to permanently delete " })}<span className="font-bold text-red-400">{roadmapToDelete.topic}</span>{t("common:deleteRoadmapConfirmDesc2", { defaultValue: "? This action is absolute and irreversible. All nodes, edges, milestones, and completed node progress indicators will be permanently lost." })}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRoadmapToDelete(null)}
                className="px-4 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-[#CECADF] hover:text-white rounded-xl transition font-semibold text-xs cursor-pointer"
                disabled={isDeletingRoadmap}
              >
                {t("common:cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteRoadmap}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition font-bold text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                disabled={isDeletingRoadmap}
              >
                {isDeletingRoadmap ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t("common:deleting", { defaultValue: "Deleting..." })}
                  </>
                ) : (
                  t("common:yesDeleteRoadmap", { defaultValue: "Yes, Delete Roadmap" })
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
