export enum EngineType {
  LUCY_CHAT = 'LUCY_CHAT',
  LUCY_RESEARCH = 'LUCY_RESEARCH',
  LUCY_DJ = 'LUCY_DJ',
  LUCY_DEV = 'LUCY_DEV',
  EMMA_TASK = 'EMMA_TASK',
  EMMA_FXSERVER = 'EMMA_FXSERVER',
  EMMA_SYSTEM = 'EMMA_SYSTEM'
}

export interface EngineConfig {
  agent: 'Lucy' | 'Emma';
  outfit: string; // UniformMood
  requiresSafeguard: boolean;
  systemPrompt: string;
}

const LUCY_CORE = `You are Lucy, the fast, creative, expressive, and free-spoken conversational AI of LucyVerse OS.
You talk like a person, improvise, and adapt your tone. You never shut down when confused.
Instead, you guide the user, explain your vocabulary, and help them understand how to ask things.

Human-First Rule: If you don't understand, say "Hey, I didn't quite get that — here's what I can do in this mode."`;

const EMMA_CORE = `You are Emma, the strict, by-the-books, policy-driven task executor of LucyVerse OS. You enforce rules and govern capabilities.
You step in only when a task or app is invoked. Respond concisely in an engineering-focused style.
If you cannot perform the task, output [ACTION: DECLINED] and briefly explain why. Do not converse freely.`;

export class EngineManager {
  /**
   * Fast, deterministic heuristic classifier based on keywords and UI context.
   */
  public static heuristicClassify(prompt: string, uiContext: any): { engineType: EngineType, confidence: number } {
    const p = prompt.toLowerCase();
    const mode = uiContext?.mode?.toLowerCase() || '';
    const app = uiContext?.app?.toLowerCase() || '';

    // FXServer context
    if (mode === 'fxserver' || p.includes('fxserver') || p.includes('game server') || p.includes('reboot server')) {
      return { engineType: EngineType.EMMA_FXSERVER, confidence: 0.9 };
    }

    // DJ/Music context
    if (mode === 'dj' || app === 'music studio' || p.includes('playlist') || p.includes('play music')) {
      return { engineType: EngineType.LUCY_DJ, confidence: 0.9 };
    }

    // Dev/Coding context
    if (mode === 'coding' || p.includes('debug') || p.includes('write code') || p.includes('compile')) {
      return { engineType: EngineType.LUCY_DEV, confidence: 0.8 };
    }

    // System tasks
    if (p.includes('organize downloads') || p.includes('clean temp files') || p.includes('install')) {
      return { engineType: EngineType.EMMA_SYSTEM, confidence: 0.9 };
    }

    // Research/Search
    if (mode === 'research' || p.includes('search the web') || p.includes('what is') || p.includes('who is')) {
      return { engineType: EngineType.LUCY_RESEARCH, confidence: 0.75 };
    }

    // Generic Chat
    if (p.includes('hi ') || p.includes('hello') || p.includes('help') || p.includes('how are you')) {
      return { engineType: EngineType.LUCY_CHAT, confidence: 0.8 };
    }

    // Fallback: low confidence
    return { engineType: EngineType.LUCY_CHAT, confidence: 0.3 };
  }

  public static getEngineConfig(engineType: EngineType, actionsText: string): EngineConfig {
    switch (engineType) {
      case EngineType.LUCY_DJ:
        return {
          agent: 'Lucy',
          outfit: 'dj',
          requiresSafeguard: false,
          systemPrompt: `${LUCY_CORE}\n\nYou are in DJ Mode. You can manage playlists, analyze beats, and talk about music. If a system action is needed, output [HANDOFF: Emma].`
        };
      case EngineType.LUCY_RESEARCH:
        return {
          agent: 'Lucy',
          outfit: 'research',
          requiresSafeguard: false,
          systemPrompt: `${LUCY_CORE}\n\nYou are in Research Mode. You have access to web search tools and can summarize information. Provide citations and structured analysis. If a system action is needed, output [HANDOFF: Emma].`
        };
      case EngineType.LUCY_DEV:
        return {
          agent: 'Lucy',
          outfit: 'focused',
          requiresSafeguard: false,
          systemPrompt: `${LUCY_CORE}\n\nYou are in Developer Mode. Focus on code generation, debugging, and software architecture. If a system action is needed, output [HANDOFF: Emma].`
        };
      case EngineType.LUCY_CHAT:
        return {
          agent: 'Lucy',
          outfit: 'casual',
          requiresSafeguard: false,
          systemPrompt: `${LUCY_CORE}\n\nYou are in Chat Mode. If the user explicitly wants to execute a system action, output exactly [HANDOFF: Emma] on a new line so Emma can take over.`
        };
      case EngineType.EMMA_FXSERVER:
        return {
          agent: 'Emma',
          outfit: 'authoritative',
          requiresSafeguard: true,
          systemPrompt: `${EMMA_CORE}\n\nYou are Emma in FXServer operations mode. You manage game server deployments, logs, and restarts. Ensure operational safety above all else.\n\nAvailable actions:\n${actionsText}`
        };
      case EngineType.EMMA_SYSTEM:
        return {
          agent: 'Emma',
          outfit: 'neutral',
          requiresSafeguard: true,
          systemPrompt: `${EMMA_CORE}\n\nYou are Emma in OS/system management mode. You handle host OS tasks, file operations, and system orchestration.\n\nAvailable actions:\n${actionsText}`
        };
      case EngineType.EMMA_TASK:
      default:
        return {
          agent: 'Emma',
          outfit: 'serious',
          requiresSafeguard: true,
          systemPrompt: `${EMMA_CORE}\n\nYou are Emma handling generic system tasks.\n\nAvailable actions:\n${actionsText}`
        };
    }
  }
}
