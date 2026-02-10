import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Common icon library for quick fallback
const ICON_LIBRARY: Record<string, string> = {
  // Science/Medical
  brain: '🧠',
  dna: '🧬',
  microscope: '🔬',
  pill: '💊',
  heart: '❤️',
  syringe: '💉',

  // Business/Money
  money: '💰',
  chart: '📈',
  rocket: '🚀',
  trophy: '🏆',
  target: '🎯',
  lightbulb: '💡',

  // Emotions
  happy: '😊',
  sad: '😢',
  angry: '😠',
  shocked: '😱',
  love: '💕',
  fire: '🔥',
  star: '⭐',

  // People/Actions
  person: '👤',
  group: '👥',
  handshake: '🤝',
  thumbsup: '👍',
  clap: '👏',
  muscle: '💪',

  // Objects
  book: '📖',
  clock: '⏰',
  key: '🔑',
  lock: '🔒',
  shield: '🛡️',
  warning: '⚠️',
  checkmark: '✅',
};

export async function POST(request: NextRequest) {
  try {
    const { text, emotion, context } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You're creating a visual element for an infographic slide in a video sales letter.

TEXT: "${text}"
EMOTION/CONTEXT: ${emotion || context || 'general'}

Decide the BEST visual approach for this content:

1. "emoji" - Use when a single emoji perfectly captures the concept (simple, universal ideas)
2. "icon" - Use when content maps to common visual concepts (money, health, success, etc.)
3. "svg" - Use when content is abstract, unique, or deserves a custom illustration

RULES:
- Prefer simplicity — emoji/icon when they work well
- Use SVG for complex concepts, metaphors, or when a custom visual would be more impactful
- SVGs should be clean, minimal line art style (NotebookLM aesthetic)
- SVGs must be valid, self-contained, viewBox="0 0 100 100", stroke-based, no external dependencies

Return ONLY valid JSON (no markdown):
{
  "type": "emoji" | "icon" | "svg",
  "value": "the emoji character" | "icon name from library" | "complete SVG code",
  "reasoning": "brief explanation of choice"
}

ICON LIBRARY: ${Object.keys(ICON_LIBRARY).join(', ')}

If type is "svg", the value should be complete SVG markup like:
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">...</svg>`,
        },
      ],
    });

    const textContent = message.content.find((b) => b.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      // Fallback to emoji
      return NextResponse.json({
        type: 'emoji',
        value: '💡',
        reasoning: 'Fallback due to AI response format',
      });
    }

    let json = textContent.text.trim();
    // Clean markdown if present
    if (json.startsWith('```json')) json = json.slice(7);
    else if (json.startsWith('```')) json = json.slice(3);
    if (json.endsWith('```')) json = json.slice(0, -3);
    json = json.trim();

    const result = JSON.parse(json);

    // If icon type, convert to actual emoji
    if (result.type === 'icon') {
      const iconEmoji = ICON_LIBRARY[result.value.toLowerCase()];
      if (iconEmoji) {
        result.value = iconEmoji;
        result.type = 'emoji'; // Icons are rendered as emoji
      } else {
        // Fallback if icon not in library
        result.type = 'emoji';
        result.value = '💡';
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Infographic visual error:', error);
    // Fallback to generic emoji on any error
    return NextResponse.json({
      type: 'emoji',
      value: '💡',
      reasoning: 'Fallback due to error',
    });
  }
}
