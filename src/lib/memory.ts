import { embed } from "ai"
import { google } from "@ai-sdk/google"
import { prisma as db } from "./db";

// Use Gemini's text embedding model (768 dimensions)
const embeddingModel = google.textEmbeddingModel(
  "text-embedding-004"
)

// Chunk text into ~500 char pieces with 100 char overlap
export function chunkText(
  text: string, 
  chunkSize = 500, 
  overlap = 100
): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end).trim())
    start += chunkSize - overlap
  }
  return chunks.filter(c => c.length > 50)
}

// Generate embedding for a piece of text
export async function generateEmbedding(
  text: string
): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  })
  return embedding
}

// Store lesson content as searchable memory chunks
export async function storeLessonMemory(params: {
  userId: string
  courseId: string
  lessonId: string
  lessonTitle: string
  content: string
}): Promise<void> {
  try {
    const { userId, courseId, lessonId, 
            lessonTitle, content } = params
    
    // Skip if already stored
    const existing = await db.lessonMemory.findFirst({
      where: { userId, courseId, lessonId }
    })
    if (existing) return

    const chunks = chunkText(content)
    
    // Generate embeddings in parallel (max 5 at a time)
    const batchSize = 5
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const embeddings = await Promise.all(
        batch.map(chunk => generateEmbedding(chunk))
      )
      
      // Store via raw SQL (pgvector not supported in Prisma ORM yet)
      for (let j = 0; j < batch.length; j++) {
        const vectorStr = `[${embeddings[j].join(",")}]`
        await db.$executeRaw`
          INSERT INTO lesson_memory 
            (id, "userId", "courseId", "lessonId", 
             "lessonTitle", chunk, embedding, "createdAt")
          VALUES (
            gen_random_uuid(),
            ${userId}, ${courseId}, ${lessonId},
            ${lessonTitle}, ${batch[j]},
            ${vectorStr}::vector,
            NOW()
          )
          ON CONFLICT DO NOTHING
        `
      }
    }
  } catch (err: any) {
    const msg = err?.message || ""
    if (msg.includes("does not exist") || 
        msg.includes("relation") ||
        msg.includes("P2021")) {
      console.warn("[memory] table not ready, skipping store")
      return
    }
    throw err
  }
}

// Retrieve most relevant past memories for a query
export async function retrieveRelevantMemories(params: {
  userId: string
  courseId: string
  query: string
  limit?: number
}): Promise<string[]> {
  const { userId, courseId, query, limit = 5 } = params
  
  try {
    const queryEmbedding = await generateEmbedding(query)
    const vectorStr = `[${queryEmbedding.join(",")}]`
    
    const results = await db.$queryRaw<
      Array<{ chunk: string; similarity: number }>
    >`
      SELECT chunk, 
        1 - (embedding <=> ${vectorStr}::vector) 
        AS similarity
      FROM lesson_memory
      WHERE "userId" = ${userId} 
        AND "courseId" = ${courseId}
        AND 1 - (embedding <=> ${vectorStr}::vector) > 0.7
      ORDER BY similarity DESC
      LIMIT ${limit}
    `
    
    return results.map((r: any) => r.chunk)
  } catch (err: any) {
    console.warn("[memory] retrieval failed gracefully:", err)
    return []  // always degrade gracefully
  }
}

// Store a mentor message pair as memory
export async function storeMentorExchange(params: {
  userId: string
  courseId: string
  lessonId: string
  lessonTitle: string
  question: string
  answer: string
}): Promise<void> {
  const combined = `Q: ${params.question}\nA: ${params.answer}`
  await storeLessonMemory({
    ...params,
    content: combined,
  })
}
