export type CommandResultType = "output" | "system" | "error" | "none";

export interface CommandResult {
  type: CommandResultType;
  lines?: string[];
}

export interface ParsedInput {
  command: string;
  args: string[];
}


export function executeCommand(raw: string): CommandResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { type: "none" };
  }

  // Process any input as a tourist assistant query
  // For now, echo back with a friendly response
  // This can be extended with actual tourist assistant logic later
  const response = `I understand you're asking: "${trimmed}". I'm here to help with tourist information!`;
  
  return {
    type: "output",
    lines: [response],
  };
}

