import dotenv from "dotenv";
dotenv.config();

console.log("Checking GEMINI_API_KEY in process.env:");
const key = process.env.GEMINI_API_KEY;
if (key) {
  console.log(`- Key exists! Length: ${key.length}, Starts with: "${key.slice(0, 7)}..."`);
} else {
  console.log("- Key is NOT set in process.env.");
}
