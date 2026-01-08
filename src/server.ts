import express from "express";
import cors from "cors";
import path from "path";
import { executeCommand } from "./commands";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API endpoint to execute console commands
app.post("/api/execute", (req, res) => {
  const { input } = req.body as { input?: string };

  if (typeof input !== "string") {
    return res.status(400).json({
      type: "error",
      lines: ["Invalid request: 'input' must be a string."],
    });
  }

  const result = executeCommand(input);
  return res.json(result);
});

// Serve static frontend files (index.html, main.js, style.css) from project root
const staticRoot = path.join(__dirname, "..");
app.use(express.static(staticRoot));

// Fallback to index.html for root
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticRoot, "index.html"));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});

