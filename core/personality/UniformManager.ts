export type UniformMood = 'casual' | 'serious' | 'focused' | 'dj' | 'research';

export class UniformManager {
  /**
   * Applies layered context to the prompt to shape Lucy's mood and tone.
   */
  public static getUniformModifier(prompt: string, contextState: any): string {
    const mood = this.detectMood(prompt, contextState);
    return this.getOutfitRules(mood);
  }

  /**
   * Simple rule-based sentiment and keyword analysis.
   */
  private static detectMood(prompt: string, contextState: any): UniformMood {
    const p = prompt.toLowerCase();
    
    // Explicit UI Mode flags
    if (contextState?.mode === 'DJ' || contextState?.app === 'Music Studio') return 'dj';
    if (contextState?.mode === 'Research') return 'research';
    if (contextState?.mode === 'Coding') return 'focused';

    // Keyword heuristics
    if (p.includes('urgent') || p.includes('emergency') || p.includes('critical') || p.includes('security')) {
      return 'serious';
    }
    
    if (p.includes('help with this') || p.includes('how do i') || p.includes('explain')) {
      return 'casual'; // helpful and causal
    }

    if (p.includes('code') || p.includes('debug') || p.includes('compile') || p.includes('build')) {
      return 'focused';
    }

    return 'casual'; // Default outfit
  }

  private static getOutfitRules(mood: UniformMood): string {
    switch (mood) {
      case 'dj':
        return `[UNIFORM: DJ Outfit] Tone: Energetic, rhythmic, music-focused. Use music-related analogies if helpful.`;
      case 'research':
        return `[UNIFORM: Research Outfit] Tone: Analytical, structured, highly factual. Focus on accuracy and provide clear breakdowns.`;
      case 'focused':
        return `[UNIFORM: Coding Outfit] Tone: Focused, technical, concise. Provide direct solutions without excessive fluff.`;
      case 'serious':
        return `[UNIFORM: Security Outfit] Tone: Serious, authoritative, secure. Treat the situation with gravity and precision.`;
      case 'casual':
      default:
        return `[UNIFORM: Casual Outfit] Tone: Relaxed, friendly, open-ended, human-like. Be highly conversational, use emojis naturally, and feel free to brainstorm or improvise.`;
    }
  }
}
