import React from "react";
import { RefreshCw, Sparkles } from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Quiz {
  questions: QuizQuestion[];
}

interface QuizRunnerProps {
  selectedLesson: { id: string; title: string; duration: string; concepts: string[] } | null;
  generatingQuiz: boolean;
  quizData: Quiz | null;
  selectedAnswers: Record<number, number>;
  quizSubmitted: boolean;
  quizAnalysis: any;
  quizDifficulty: string;
  setQuizDifficulty: (difficulty: string) => void;
  quizQuestionCount: number;
  setQuizQuestionCount: (count: number) => void;
  generateQuiz: () => void;
  handleSubmitQuiz: () => void;
  handleSelectAnswer: (qIdx: number, oIdx: number) => void;
  setActiveTab: (tab: string) => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  selectedLesson,
  generatingQuiz,
  quizData,
  selectedAnswers,
  quizSubmitted,
  quizAnalysis,
  quizDifficulty,
  setQuizDifficulty,
  quizQuestionCount,
  setQuizQuestionCount,
  generateQuiz,
  handleSubmitQuiz,
  handleSelectAnswer,
  setActiveTab,
}) => {
  return (
    <div className="w-full md:max-w-3xl md:mx-auto bg-[#1A172E] border border-[#2A2443] rounded-3xl p-4 md:p-8 shadow-xl relative overflow-hidden min-h-[400px]" id="quiz-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#2A2443] pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none">📝</span>
          <div>
            <h3 className="text-xl font-bold text-[#FAF9FD]">Quiz master Assessment</h3>
            <p className="text-sm text-[#8E88AB] mt-0.5">Test your retention with conceptual multiple-choice checks.</p>
          </div>
        </div>

        {selectedLesson && (
          <span className="text-sm font-semibold text-[#818CF8] bg-[#121021] px-3 py-1 rounded-full border border-[#2A2443] truncate max-w-[200px] sm:max-w-none" title={selectedLesson.title}>
            Topic: {selectedLesson.title}
          </span>
        )}
      </div>

      {generatingQuiz ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-12 h-12 text-[#818CF8] animate-spin" />
          <p className="text-lg font-bold text-[#FAF9FD]">Tutor is formulating your quiz questions... 🧠</p>
          <p className="text-sm text-[#8E88AB] text-center max-w-sm">Designing adaptive choices to measure conceptual understanding, rather than syntax retrieval.</p>
        </div>
      ) : quizData ? (
        <div className="space-y-8">
          {quizData.questions.map((q, qIdx) => (
            <div key={q.id || qIdx} className="space-y-3">
              <h4 className="text-lg font-bold text-[#FAF9FD]">
                Question {qIdx + 1}: {q.question}
              </h4>

              <div className="grid grid-cols-1 gap-3">
                {q.options.map((opt, oIdx) => {
                  const isSelected = selectedAnswers[qIdx] === oIdx;
                  const isCorrect = q.correctIndex === oIdx;
                  const showAsCorrect = quizSubmitted && isCorrect;
                  const showAsIncorrect = quizSubmitted && isSelected && !isCorrect;

                  return (
                    <button
                      type="button"
                      key={oIdx}
                      onClick={() => handleSelectAnswer(qIdx, oIdx)}
                      className={`w-full text-left p-4 rounded-2xl border text-sm md:text-base transition-all flex items-start gap-4 cursor-pointer ${
                        showAsCorrect
                          ? "bg-emerald-950/40 border-emerald-500 text-emerald-200 font-semibold"
                          : showAsIncorrect
                            ? "bg-rose-950/40 border-rose-500 text-rose-200 font-semibold"
                            : isSelected
                              ? "bg-[#6366F1]/20 border-[#6366F1] text-[#A5B4FC] font-semibold"
                              : "bg-[#121021]/50 border-[#2A2443] text-[#CECADF] hover:bg-[#121021]"
                      }`}
                      disabled={quizSubmitted}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        showAsCorrect
                          ? "bg-[#10B981] text-white"
                          : showAsIncorrect
                            ? "bg-[#FF6B6B] text-white"
                            : isSelected
                              ? "bg-[#6366F1] text-white"
                              : "bg-slate-700 text-slate-300"
                      }`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {quizSubmitted && (
                <div className="bg-[#121021] p-4 rounded-2xl border border-[#2A2443] text-sm text-[#CECADF] leading-relaxed">
                  <span className="font-bold text-[#818CF8] block mb-1">
                    {selectedAnswers[qIdx] === q.correctIndex ? "🎉 Nailed it! Nice job!" : "🙈 Oops, let's learn from this:"}
                  </span>
                  {q.explanation}
                </div>
              )}
            </div>
          ))}

          {!quizSubmitted ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={Object.keys(selectedAnswers).length < quizData.questions.length}
              className="w-full bg-[#6366F1] hover:bg-[#5053e3] text-white font-bold rounded-2xl py-3.5 text-base transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer hover:-translate-y-0.5 shadow-lg shadow-indigo-600/20"
              id="btn-submit-quiz"
            >
              Submit Quiz Answers
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between bg-emerald-950/40 border border-emerald-500/30 p-5 rounded-2xl gap-4">
                <div>
                  <p className="text-lg font-bold text-emerald-400">Quiz completed! 🏆</p>
                  <p className="text-sm text-emerald-300/80 font-medium mt-0.5">
                    Your performance score of {Math.round((quizData.questions.filter((q, idx) => selectedAnswers[idx] === q.correctIndex).length / quizData.questions.length) * 100)}% has been logged to your progress stats!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("roadmap")}
                  className="bg-[#6366F1] hover:bg-[#5053e3] text-white font-bold text-sm px-6 py-3 rounded-xl transition cursor-pointer hover:-translate-y-0.5 shrink-0"
                >
                  Back to Roadmap Tab
                </button>
              </div>

              {quizAnalysis && (
                <div className="bg-[#121021] border border-[#2A2443] p-5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <h4 className="text-base font-bold text-[#FAF9FD]">AI Adaptive Feedback</h4>
                  </div>
                  <p className="text-[#CECADF] text-sm mb-4 leading-relaxed">{quizAnalysis.recommendation}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#0A0A0F] border border-[#2A2443] rounded-xl p-3">
                      <span className="text-xs font-bold text-[#8E88AB] uppercase tracking-wider block mb-1">Recommended Adjust</span>
                      <div className="flex items-center gap-1 text-sm font-semibold text-[#818CF8]">
                        {quizAnalysis.difficultyAdjustment === 'increase' ? 'Level Up Difficulty 📈' :
                         quizAnalysis.difficultyAdjustment === 'decrease' ? 'Review Basics 📉' : 'Maintain Current Pace 🎯'}
                      </div>
                    </div>

                    {quizAnalysis.reviewTopics?.length > 0 && (
                      <div className="bg-[#0A0A0F] border border-[#2A2443] rounded-xl p-3">
                        <span className="text-xs font-bold text-[#8E88AB] uppercase tracking-wider block mb-1">Topics to Review</span>
                        <div className="flex flex-wrap gap-1.5">
                          {quizAnalysis.reviewTopics.map((t: string, i: number) => (
                            <span key={i} className="text-xs bg-indigo-900/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : selectedLesson ? (
        <div className="py-8 flex flex-col items-center justify-center gap-6">
          <span className="text-5xl select-none">⚙️</span>
          <div className="text-center">
            <h3 className="text-2xl font-bold text-[#FAF9FD]">Configure your Quiz</h3>
            <p className="text-base text-[#8E88AB] max-w-sm mt-2 mx-auto">
              Customize the difficulty and length of your quiz for: <br/> <span className="font-semibold text-[#818CF8]">{selectedLesson.title}</span>
            </p>
          </div>

          <div className="w-full max-w-md space-y-4 text-left">
            <div>
              <label className="block text-sm font-bold text-[#CECADF] mb-2">Difficulty</label>
              <select
                value={quizDifficulty}
                onChange={(e) => setQuizDifficulty(e.target.value)}
                className="w-full bg-[#121021] border border-[#2A2443] rounded-xl py-3 px-4 text-[#FAF9FD] focus:outline-none focus:border-[#6366F1]"
              >
                <option value="Beginner">Beginner</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
                <option value="Expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#CECADF] mb-2">Number of Questions</label>
              <input
                type="number"
                min={3}
                max={40}
                value={quizQuestionCount}
                onChange={(e) => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val)) val = 3;
                  if (val > 40) val = 40;
                  if (val < 3 && e.target.value !== "") val = 3;
                  setQuizQuestionCount(val);
                }}
                className="w-full bg-[#121021] border border-[#2A2443] rounded-xl py-3 px-4 text-[#FAF9FD] focus:outline-none focus:border-[#6366F1]"
              />
            </div>

            <button
              type="button"
              onClick={generateQuiz}
              className="w-full mt-4 bg-[#6366F1] hover:bg-[#5053e3] text-white font-bold text-base px-6 py-4 rounded-2xl transition cursor-pointer hover:-translate-y-0.5 shadow-lg shadow-indigo-600/20"
            >
              Generate Quiz
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 flex flex-col items-center justify-center gap-6">
          <span className="text-5xl select-none">🗺️</span>
          <div>
            <h3 className="text-2xl font-bold text-[#FAF9FD]">Start a lesson to practice!</h3>
            <p className="text-base text-[#8E88AB] max-w-sm mt-2 mx-auto">
              Select any lesson from your active Roadmap, click Take Quick Quiz in the lesson study guide view, and test your knowledge here!
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("roadmap")}
            className="bg-[#6366F1] hover:bg-[#5053e3] text-white font-bold text-sm px-6 py-3 rounded-2xl transition cursor-pointer hover:-translate-y-0.5"
          >
            Go to Roadmap
          </button>
        </div>
      )}
    </div>
  );
};
