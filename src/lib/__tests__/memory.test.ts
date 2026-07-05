import { describe, it, expect } from "vitest";
import { chunkText } from "../memory";

describe("memory-chunking", () => {
  describe("chunkText", () => {
    it("should chunk a long text with specified sizes and overlap", () => {
      // 200 characters total
      const text = "0123456789".repeat(20); 
      // Chunk size 100, overlap 20
      const chunks = chunkText(text, 100, 20);

      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk except the last should have length around 100
      expect(chunks[0].length).toBe(100);
      
      // Check for overlap of 20 characters ("01234567890123456789") between chunks
      const firstChunkEnd = chunks[0].slice(-20);
      const secondChunkStart = chunks[1].slice(0, 20);
      expect(firstChunkEnd).toBe(secondChunkStart);
    });

    it("should filter out chunks that are under 50 characters", () => {
      const text = "This is a very short sentence."; // 30 chars
      const chunks = chunkText(text, 500, 100);
      expect(chunks.length).toBe(0); // Should be empty because it is under 50 characters
    });

    it("should retain chunk if it exceeds 50 characters", () => {
      const text = "This is a sentence that is sufficiently long to exceed the fifty character limit for chunks."; // 92 chars
      const chunks = chunkText(text, 500, 100);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(text);
    });
  });
});
