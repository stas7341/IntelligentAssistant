// Basic web console simulator (plain JS) with Node.js + TypeScript backend

const outputEl = document.getElementById("terminal-output");
const inputEl = document.getElementById("terminal-input");
//const promptLabelEl = document.getElementById("prompt-label");

let history = [];
let historyIndex = null;

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
      body: JSON.stringify({ input: rawInput }),
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

function init() {
  printWelcome();
  inputEl.addEventListener("keydown", handleKeyDown);
  // Auto focus on load
  setTimeout(() => inputEl.focus(), 0);

  // Focus input when clicking anywhere on the terminal
  document.querySelector(".terminal-container")?.addEventListener("click", () => {
    inputEl.focus();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

