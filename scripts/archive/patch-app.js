const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const sendMentorMessageStart = content.indexOf('const handleSendMentorMessage = async (e: React.FormEvent) => {');
const sendMentorMessageEnd = content.indexOf('// Generate achievement badge', sendMentorMessageStart);

if (sendMentorMessageStart === -1 || sendMentorMessageEnd === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const before = content.slice(0, sendMentorMessageStart);
const after = content.slice(sendMentorMessageEnd);

const newFn = `const handleSendMentorMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorInput.trim() || mentorLoading || !activeCourseId) return;

    const userMessage = mentorInput.trim();
    setMentorInput("");
    setMentorLoading(true);

    const userMsgObj = { 
      id: Date.now().toString(), 
      role: "user" as const, 
      content: userMessage, 
      createdAt: new Date(),
      courseId: activeCourseId 
    };
    
    // Add empty assistant message that we'll stream into
    const assistantMsgId = Date.now().toString() + "_ai";
    const assistantMsgObj = {
      id: assistantMsgId,
      role: "assistant" as const,
      content: "",   // starts empty
      createdAt: new Date(),
      courseId: activeCourseId 
    };

    setActiveCourse(prev => {
        if (!prev) return prev;
        return { ...prev, messages: [...prev.messages, userMsgObj, assistantMsgObj] };
    });

    try {
      const userKey = localStorage.getItem("zc_user_key");
      const headers: any = { "Content-Type": "application/json" };
      if (userKey) headers["x-user-key"] = userKey;
      
      const response = await fetch("/api/mentor-chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMessage,
          courseId: activeCourseId,
          currentLessonId: selectedLesson?.id,
          currentLessonTitle: selectedLesson?.title,
          currentCourseTitle: activeCourse?.title,
          history: mentorMessages.slice(-10).map(m => ({
            role: m.role,
            content: m.content.slice(0, 1000)
          }))
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          window.dispatchEvent(new CustomEvent("zc-quota-exceeded"));
          setMentorLoading(false);
          return;
        }
        throw new Error("Mentor request failed");
      }
      
      if (!response.body) throw new Error("No stream body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      // Hide the spinner since we are streaming now
      setMentorLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n\\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            
            if (json.done) break;
            if (json.error) throw new Error(json.error);
            
            if (json.token) {
              fullText += json.token;
              setActiveCourse(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  messages: prev.messages.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: fullText }
                      : m
                  )
                };
              });
            }
          } catch (err) {
             // ignore parse error for chunks
          }
        }
      }
    } catch (err: any) {
      setActiveCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter(m => m.id !== assistantMsgId)
        }
      });
      toast.error(err.message || "Mentor failed to respond");
    } finally {
      setMentorLoading(false);
    }
  };

  `;

fs.writeFileSync('src/App.tsx', before + newFn + after);
console.log("Success");
