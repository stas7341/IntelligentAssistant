// Basic web console simulator (plain JS) with Node.js + TypeScript backend

const outputEl = document.getElementById("terminal-output");
const inputEl = document.getElementById("terminal-input");
//const promptLabelEl = document.getElementById("prompt-label");

// Debug panel elements
const debugPanel = document.querySelector(".debug-panel");
const debugOutput = document.getElementById("debug-output");
const debugToggle = document.getElementById("debug-toggle");
const debugToggleIcon = debugToggle?.querySelector(".debug-toggle-icon");

// Generate unique user ID on page load
function generateUserId() {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random component
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

const userId = generateUserId();

let history = [];
let historyIndex = null;
let debugExpanded = false;
let debugPollInterval = null;
const DEBUG_POLL_INTERVAL = 1500; // 1.5 seconds

function appendLine(text, opts = {}) {
  const { className = "line-output" } = opts;
  const line = document.createElement("div");
  line.className = `line ${className}`;
  line.textContent = text;
  outputEl.appendChild(line);
}

function appendPromptLine(commandText) {
  const line = document.createElement("div");
  line.className = "line line-input";
  const prompt = document.createElement("span");
  prompt.className = "prompt-label";
  //prompt.textContent = promptLabelEl.textContent + " ";

  const commandSpan = document.createElement("span");
  commandSpan.className = "command";
  commandSpan.textContent = commandText;

  line.appendChild(prompt);
  line.appendChild(commandSpan);
  outputEl.appendChild(line);
}

function scrollToBottom() {
  outputEl.scrollTop = outputEl.scrollHeight;
}

function clearOutput() {
  outputEl.innerHTML = "";
}

function printWelcome() {
  appendLine("Welcome to your virtual tourist assistant", { className: "line-system" });
  appendLine(`User: ${userId}`, { className: "line-system" });
  appendLine("", { className: "line-system" });
  scrollToBottom();
}

async function executeCommand(rawInput) {
  // Show prompt + command
  appendPromptLine(rawInput);

  const trimmed = rawInput.trim();
  if (!trimmed) {
    scrollToBottom();
    return;
  }


  try {
    const response = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: rawInput, userId: userId }),
    });

    if (!response.ok) {
      appendLine(`Server error: ${response.status}`, { className: "line-error" });
      scrollToBottom();
      return;
    }

    const result = await response.json();

    if (!result || result.type === "none") {
      scrollToBottom();
      return;
    }

    const className =
      result.type === "system"
        ? "line-system"
        : result.type === "error"
          ? "line-error"
          : "line-output";

    if (Array.isArray(result.lines)) {
      result.lines.forEach((line) => appendLine(line, { className }));
    }
  } catch (err) {
    appendLine("Failed to reach backend server.", { className: "line-error" });
  }

  scrollToBottom();
}

function handleKeyDown(event) {
  if (event.key === "Enter") {
    const value = inputEl.value;
    if (value.trim() !== "") {
      history.push(value);
      historyIndex = null;
      executeCommand(value);
    }
    inputEl.value = "";
    event.preventDefault();
    return;
  }

  if (event.key === "ArrowUp") {
    if (history.length === 0) return;
    if (historyIndex === null) {
      historyIndex = history.length - 1;
    } else if (historyIndex > 0) {
      historyIndex -= 1;
    }
    inputEl.value = history[historyIndex] || "";
    setTimeout(() => {
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    }, 0);
    event.preventDefault();
    return;
  }

  if (event.key === "ArrowDown") {
    if (history.length === 0 || historyIndex === null) return;
    if (historyIndex < history.length - 1) {
      historyIndex += 1;
      inputEl.value = history[historyIndex] || "";
    } else {
      historyIndex = null;
      inputEl.value = "";
    }
    setTimeout(() => {
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    }, 0);
    event.preventDefault();
    return;
  }

}

// Debug panel functions
async function fetchLogs() {
  try {
    const response = await fetch("/api/logs");
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.logs || [];
  } catch (err) {
    console.error("Failed to fetch logs:", err);
    return [];
  }
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function renderLogs(logs) {
  if (!debugOutput) return;

  debugOutput.innerHTML = "";

  logs.forEach((log) => {
    const logLine = document.createElement("div");
    logLine.className = `debug-line debug-${log.level}`;

    const timestamp = formatTimestamp(log.timestamp);
    const level = log.level.toUpperCase().padEnd(5);
    const source = `[${log.source}]`.padEnd(11);

    logLine.textContent = `[${timestamp}] ${level} ${source} ${log.message}`;
    debugOutput.appendChild(logLine);
  });

  // Auto-scroll to bottom
  debugOutput.scrollTop = debugOutput.scrollHeight;
}

function toggleDebugPanel() {
  debugExpanded = !debugExpanded;
  debugPanel?.classList.toggle("expanded", debugExpanded);

  if (debugToggleIcon) {
    debugToggleIcon.textContent = ">";
  }

  if (debugExpanded) {
    // Start polling when expanded
    fetchAndRenderLogs();
    debugPollInterval = setInterval(fetchAndRenderLogs, DEBUG_POLL_INTERVAL);
  } else {
    // Stop polling when collapsed
    if (debugPollInterval) {
      clearInterval(debugPollInterval);
      debugPollInterval = null;
    }
  }
}

async function fetchAndRenderLogs() {
  const logs = await fetchLogs();
  renderLogs(logs);
}

function initDebugPanel() {
  if (!debugToggle || !debugPanel) return;

  // Make both the button and header clickable
  debugToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDebugPanel();
  });

  const debugHeader = debugPanel.querySelector(".debug-header");
  if (debugHeader) {
    debugHeader.addEventListener("click", toggleDebugPanel);
  }

  // Panel starts collapsed by default
  debugPanel.classList.remove("expanded");
}

function init() {
  printWelcome();
  inputEl.addEventListener("keydown", handleKeyDown);
  // Auto focus on load
  setTimeout(() => inputEl.focus(), 0);

  // Focus input when clicking anywhere on the terminal
  document.querySelector(".terminal-container")?.addEventListener("click", () => {
    inputEl.focus();
  });

  // Initialize debug panel
  initDebugPanel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

