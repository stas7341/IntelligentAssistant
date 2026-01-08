import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { executeQuery } from "./commands";
import { logger, getLogs } from "./logger";
import { initialize as initializeGemini } from "./services/gemini";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API endpoint to get logs
app.get("/api/logs", (_req, res) => {
  return res.json({ logs: getLogs() });
});

// API endpoint to execute console commands
app.post("/api/execute", async (req, res) => {
  const { input, userId } = req.body as { input?: string; userId?: string };

  if (typeof input !== "string" || typeof userId !== "string") {
    logger.warn("Invalid request: 'input' must be a string", "request");
    return res.status(400).json({
      type: "error",
      lines: ["Invalid request: 'input' must be a string."],
    });
  }

  logger.log(`Executing command: "${input}" for user: ${userId}`, "command");
  try {
    const result = await executeQuery(input, userId);
    logger.log(`Command result: ${result.type}`, "command");
    return res.json(result);
  } catch (error) {
    logger.error(`Command execution error: ${error}`, "command");
    return res.status(500).json({
      type: "error",
      lines: ["An error occurred while processing your request."],
    });
  }
});

// Serve static frontend files (index.html, main.js, style.css) from project root
const staticRoot = path.join(__dirname, "..");
app.use(express.static(staticRoot));

// Fallback to index.html for root
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticRoot, "index.html"));
});

// Initialize Gemini service
let geminiInitialized = false;
try {
  initializeGemini();
  geminiInitialized = true;
  logger.log("Gemini service initialized successfully", "server");
} catch (error) {
  logger.warn(`Gemini initialization failed: ${error}. Some features may not work.`, "server");
  logger.warn("Make sure GOOGLE_AI_API_KEY is set in your .env file", "server");
}

app.listen(PORT, () => {
  logger.log(`Server running on http://localhost:${PORT}`, "server");
  if (!geminiInitialized) {
    logger.warn("Server started but Gemini is not available. Create a .env file with GOOGLE_AI_API_KEY", "server");
  }
});

