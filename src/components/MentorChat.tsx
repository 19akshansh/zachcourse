import React from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Loader2, Send } from "lucide-react";
import { trpc } from "../lib/trpc-client";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  content?: string;
}

interface MentorChatProps {
  currentRoadmap: any;
  selectedLesson: { id: string; title: string } | null;
  mentorInput: string;
  setMentorInput: (v: string) => void;
  mentorMessages: ChatMessage[];
  mentorLoading: boolean;
  activeCourseId: string | null;
  setActiveCourse: React.Dispatch<React.SetStateAction<any>>;
  handleSendMentorMessage: (e: React.FormEvent) => void;
}

export const MentorChat: React.FC<MentorChatProps> = ({
  currentRoadmap,
  selectedLesson,
  mentorInput,
  setMentorInput,
  mentorMessages,
  mentorLoading,
  activeCourseId,
  setActiveCourse,
  handleSendMentorMessage,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative overflow-hidden min-h-[400px]">
      {/* Quick Helper Prompts (span 4) */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-4 sm:p-6 shadow-xl">
          <h3 className="text-lg font-bold text-[#FAF9FD] mb-2 flex items-center gap-2">
            <span>🧑‍🏫</span>
            <span>Companion Help desk</span>
          </h3>
          <p className="text-sm text-[#8E88AB] mb-4 leading-relaxed">
            Click any of these helper templates to ask me questions about your current study material:
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMentorInput("Can you give me an intuitive real-world analogy for this lesson?")}
              className="w-full text-left p-3.5 bg-[#121021] hover:bg-[#151227] border border-[#2A2443] text-[#CECADF] text-sm font-semibold rounded-2xl transition cursor-pointer hover:-translate-y-0.5"
            >
              💡 "Give me a real-world analogy."
            </button>
            <button
              type="button"
              onClick={() => setMentorInput("Can you break down this topic in much simpler terms for me?")}
              className="w-full text-left p-3.5 bg-[#121021] hover:bg-[#151227] border border-[#2A2443] text-[#CECADF] text-sm font-semibold rounded-2xl transition cursor-pointer hover:-translate-y-0.5"
            >
              🧸 "Explain it simpler, please."
            </button>
            <button
              type="button"
              onClick={() => setMentorInput("What is a fun interactive mini-project I can build to practice this topic?")}
              className="w-full text-left p-3.5 bg-[#121021] hover:bg-[#151227] border border-[#2A2443] text-[#CECADF] text-sm font-semibold rounded-2xl transition cursor-pointer hover:-translate-y-0.5"
            >
              🛠️ "Give me a fun mini-project idea."
            </button>
          </div>
        </div>

        {/* Course Context Card */}
        <div className="bg-[#1A172E] border border-[#2A2443] rounded-3xl p-4 sm:p-6 shadow-xl">
          <h4 className="text-sm font-bold text-[#8E88AB] uppercase tracking-wider mb-2">Active Context</h4>
          <div className="space-y-2">
            <p className="text-base font-semibold text-[#FAF9FD] truncate">📚 {currentRoadmap?.title}</p>
            {selectedLesson ? (
              <p className="text-sm text-[#818CF8] font-medium">🎯 Selected Topic: {selectedLesson.title}</p>
            ) : (
              <p className="text-sm text-[#8E88AB] italic">No topic active—select a lesson in the roadmap tab to focus our questions.</p>
            )}
          </div>
        </div>
      </div>

      {/* Chat Box (span 8) */}
      <div className="lg:col-span-8 bg-[#1A172E] border border-[#2A2443] rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col h-[80vh] min-h-[600px] md:h-[600px] lg:h-[700px]">
        <div className="flex items-center gap-3 border-b border-[#2A2443] pb-4 mb-4">
          <span className="text-3xl select-none">🧑‍🏫</span>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-[#FAF9FD]">Your Friendly Learning Tutor</h3>
            <p className="text-sm text-[#10B981] font-medium flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-[#10B981] rounded-full animate-pulse"></span>
              Ready to chat and help you understand!
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                if (!activeCourseId) return;
                await trpc.clearChatMemory.mutate({ courseId: activeCourseId });
                toast.success("Memory cleared for this course");
                setActiveCourse((prev: any) => prev ? { ...prev, messages: [] } : prev);
              } catch (e) {
                toast.error("Failed to clear memory");
              }
            }}
            className="px-3 py-1.5 bg-[#121021] hover:bg-[#151227] border border-[#2A2443] rounded-lg text-sm text-[#8E88AB] transition-colors cursor-pointer"
          >
            🧠 Clear memory
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2">
          {mentorMessages.map((msg, index) => {
            const isUser = msg.role === "user";
            const msgText = msg.content || msg.text;
            return (
              <div
                key={index}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex items-start gap-2.5 max-w-[92%] sm:max-w-[85%] md:max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 select-none text-lg">
                    {isUser ? "👤" : "🧑‍🏫"}
                  </div>
                  <div
                    className={`p-4 rounded-3xl text-base ${
                      isUser
                        ? "bg-[#4F46E5] text-white rounded-tr-none shadow-md shadow-[#4F46E5]/10"
                        : "bg-[#121021] text-[#FAF9FD] border border-[#2A2443] rounded-tl-none shadow-md"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msgText}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-invert overflow-x-auto">
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msgText}</Markdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {mentorLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg select-none">
                  🧑‍🏫
                </div>
                <div className="bg-[#121021] border border-[#2A2443] p-4 rounded-3xl rounded-tl-none shadow-md flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#818CF8] animate-spin" />
                  <span className="text-sm text-[#8E88AB] font-medium">Tutor is writing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input form */}
        <form onSubmit={handleSendMentorMessage} className="mt-auto pt-3 border-t border-[#2A2443]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={mentorInput}
              onChange={(e) => setMentorInput(e.target.value)}
              placeholder="Ask anything — paste a URL and I'll read it 🔗"
              className="flex-1 bg-[#121021] border border-[#2A2443] rounded-2xl py-3 px-4 text-sm md:text-base text-[#FAF9FD] focus:outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10 font-medium placeholder:text-[#8E88AB]/60"
            />
            <button
              type="submit"
              disabled={mentorLoading || !mentorInput.trim()}
              className="w-12 h-12 flex items-center justify-center shrink-0 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-2xl shadow-md transition disabled:opacity-40 hover:-translate-y-0.5 cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
