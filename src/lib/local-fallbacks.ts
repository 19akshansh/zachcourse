// Local fallback content generator for roadmaps
export function getLocalFallbackRoadmap(topic: string, sourceUrl?: string, textContent?: string): any {
  const cleanTopic = (topic || "Personalized Skills").trim();
  return {
    title: `Mastering ${cleanTopic}`,
    description: `A beautiful, step-by-step personalized learning path to mastering ${cleanTopic}, prepared by your companion coach to guide you from foundational principles to creative practice.`,
    difficulty: "Beginner Friendly",
    modules: [
      {
        id: "m1_basics",
        title: "Step 1: Foundational Core & Mechanics",
        description: `Get comfortable with the basic building blocks and central ideas behind ${cleanTopic}.`,
        lessons: [
          {
            id: "m1_l1_intro",
            title: `Introduction & Setting the Stage for ${cleanTopic}`,
            duration: "15 mins",
            concepts: ["Core definitions", "First steps", "Why it matters"]
          },
          {
            id: "m1_l2_building",
            title: "Working with Core Concepts",
            duration: "20 mins",
            concepts: ["Main mechanics", "Simple structures", "Hands-on exploration"]
          }
        ]
      },
      {
        id: "m2_intermediate",
        title: "Step 2: Practical Application",
        description: `Apply your knowledge to solve real-world challenges and design interactive solutions.`,
        lessons: [
          {
            id: "m2_l1_patterns",
            title: "Common Patterns & Best Practices",
            duration: "20 mins",
            concepts: ["Design patterns", "Avoiding common pitfalls", "Organizing your ideas"]
          },
          {
            id: "m2_l2_tools",
            title: "Utilizing Tools and Extensions",
            duration: "25 mins",
            concepts: ["Expanding capabilities", "Streamlining workflows", "Creative exercises"]
          }
        ]
      },
      {
        id: "m3_advanced",
        title: "Step 3: Advanced Horizons & Mastery",
        description: `Deepen your mastery and explore advanced techniques to bring your creations to life.`,
        lessons: [
          {
            id: "m3_l1_deployment",
            title: "Perfecting & Launching Your Work",
            duration: "20 mins",
            concepts: ["Refining results", "Sharing with others", "Future directions"]
          },
          {
            id: "m3_l2_mastery",
            title: "Continuous Learning & Next Steps",
            duration: "15 mins",
            concepts: ["Mastery check", "Resource exploration", "Final project showcase"]
          }
        ]
      }
    ]
  };
}

// Local fallback content generator for lessons
export function getLocalFallbackLesson(lessonTitle: string, concepts: string[]): string {
  const conceptList = concepts && concepts.length > 0 ? concepts : ["Foundational Ideas", "Application Principles"];
  return `### Study Guide: ${lessonTitle} 📚

Welcome to this tailored study guide! While our live AI server is experiencing temporary high demand, your companion tutor has formulated this high-quality learning reference for you so that you can continue your study adventure without interruption.

---

### 1. **Introduction** 💡

Every great skill starts with a clear map of the territory. Understanding **${lessonTitle}** is like learning to cook with fresh ingredients—once you grasp how the flavors combine, you can create anything from scratch!

To make this intuitive, think of this concept like **a postal delivery system**:
- Instead of carrying letters across the country yourself, you place them in a mailbox.
- The mail carriers route the letters, sort them, and deliver them to the exact destinations.
- This represents how we pass and delegate instructions smoothly, without blocking our primary day-to-day operations.

---

### 2. **Detailed Breakdown** 🔍

Let's dive deep into the core elements:

${conceptList.map((concept, index) => `#### 🌟 **Element ${index + 1}: ${concept}**
- **What it is**: The fundamental mechanism that allows us to manage ${concept.toLowerCase()} with elegance and predictability.
- **Why it matters**: Without this, systems become disorganized, hard to debug, and prone to silent errors. By isolating and mastering this concept, you build an ironclad foundation.`).join("\n\n")}

---

### 3. **Interactive Code & Examples** 🛠️

Here is a practical, clear example showing how these concepts come together:

\`\`\`typescript
// A clean, predictable example demonstrating ${lessonTitle}
function practiceSample() {
  const activeConcepts = ${JSON.stringify(conceptList)};
  console.log("🚀 Initializing practice session...");
  
  for (const concept of activeConcepts) {
    console.log(\`✨ Reviewing active block: \${concept}\`);
    // Master each building block step-by-step
  }
  
  console.log("🎉 Review session complete!");
  return true;
}

practiceSample();
\`\`\`

---

### 4. **Summary & Key Takeaways** 📈

- **Takeaway 1**: Master the individual blocks (${conceptList.slice(0, 2).join(" & ")}) before attempting to build complex systems.
- **Takeaway 2**: Always rely on clear, descriptive names and simple logic structures.
- **Takeaway 3**: Mistakes are just stepping stones. Test small parts frequently to build robust intuition!`;
}

// Local fallback content generator for quizzes
export function getLocalFallbackQuiz(lessonTitle: string, concepts: string[]): any {
  const concept1 = concepts?.[0] || "Foundations";
  const concept2 = concepts?.[1] || "Core Concepts";
  return {
    questions: [
      {
        id: "fq1",
        question: `What is the primary key behind mastering: "${lessonTitle}"?`,
        options: [
          `Connecting concepts back to your real-world goals, focusing on ${concept1}`,
          "Memorizing syntax structures line-by-line without understanding",
          "Skipping practice entirely to rush to the next step",
          "Writing incredibly long and complex code blocks on the first day"
        ],
        correctIndex: 0,
        explanation: `Focusing on ${concept1} and connecting it to real-world scenarios is the most effective way to develop a deep, intuitive understanding.`
      },
      {
        id: "fq2",
        question: `Why is active practice so important when learning about: "${concept2}"?`,
        options: [
          "It satisfies background system telemetry and logging metrics",
          "It builds strong mental pathways and lets you learn from mistake reflections",
          "It is the only way to avoid computer errors completely",
          "It lets you bypass study guidelines entirely"
        ],
        correctIndex: 1,
        explanation: "Active practice, hands-on experimentation, and reviewing mistakes are the most vital parts of the human learning process!"
      },
      {
        id: "fq3",
        question: "When encountering a difficult topic or complex error, what is the best strategy?",
        options: [
          "Giving up immediately and choosing a different topic",
          "Ignoring the error and hoping it goes away",
          "Breaking the challenge down into smaller, bite-sized components and consulting your mentor",
          "Copying and pasting random code solutions without reading them"
        ],
        correctIndex: 2,
        explanation: "Breaking complex issues into simpler, manageable pieces is the ultimate problem-solving superpower!"
      }
    ]
  };
}

// Local fallback content generator for mentor replies
export function getLocalFallbackMentorReply(message: string, currentCourseTitle: string, currentLessonTitle?: string): string {
  const msgLower = message.toLowerCase();
  
  if (msgLower.includes("analogy") || msgLower.includes("explain") || msgLower.includes("how does") || msgLower.includes("why")) {
    return `### Let's look at this with an intuitive analogy! 💡

Think of **${currentLessonTitle || "this concept"}** like a **busy kitchen in a popular restaurant**:
- The **chef** represents your core execution loop—making sure everything is prepared.
- If the chef had to personally wash every plate, greet every guest, and deliver every order, the kitchen would grind to a halt. This is like a single-threaded program blocking on operations.
- Instead, the chef delegates tasks to the **dishwashers, servers, and hosts**. They all work together, allowing the chef to focus purely on cooking delicious meals.

In the same way, breaking your goals into modular, digestible pieces makes learning and building incredibly smooth! Does this analogy help clarify how we think about structure in **${currentCourseTitle}**? Let me know what specific part you'd like to dive into next! 🌟`;
  }
  
  if (msgLower.includes("project") || msgLower.includes("practice") || msgLower.includes("build") || msgLower.includes("exercise")) {
    return `### Here is a fun, hands-on mini-project to practice! 🛠️

Since you're exploring **${currentLessonTitle || currentCourseTitle}**, let's build a **"Personal Hobby Tracker"**!

#### 📋 The Challenge:
Create a simple utility that logs your daily progress in your favorite hobby (coding, reading, drawing, etc.).

#### 🔧 Functional Requirements:
1. Allow the user to input a new activity description.
2. Store a cumulative count of hours or minutes spent.
3. Display a small, encouraging greeting card when they reach a milestone (like 5 hours!).

This project is fantastic because it lets you practice variables, list collections, and basic user interactions! Would you like me to help you outline the step-by-step code structure for this? 🚀`;
  }

  return `### Hello! I'm here for you! 🧑‍🏫

I would love to help you explore more about **${currentCourseTitle}** ${currentLessonTitle ? `(specifically focusing on **${currentLessonTitle}**)` : ""}.

*Note: Our live AI model is currently experiencing high demand, but I've activated my warm local tutoring mode so we don't skip a beat!*

To help me give you the best guidance, tell me a little more:
1. Are you working on a specific challenge right now?
2. Would you like a simpler breakdown of a term?
3. Or would you like to brainstorm a fun coding exercise?

I'm super excited to keep learning together! What's on your mind? 💫`;
}
