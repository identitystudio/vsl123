import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai-provider';

export async function POST(request: NextRequest) {
  try {
    const { slideText, emotion, sceneTitle, userPrompt } = await request.json();

    if (!slideText) {
      return NextResponse.json(
        { error: 'slideText is required' },
        { status: 400 }
      );
    }

    const textResponse = await generateText({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Generate a 2-4 word stock photo search term that visually represents this text. The term should describe a scene, person, or concept that a stock photo site like Pexels would have.

Text: "${slideText}"
${emotion ? `Emotion: ${emotion}` : ''}
${sceneTitle ? `Scene: ${sceneTitle}` : ''}
${userPrompt ? `CRITICAL - USER VISUAL DIRECTION: "${userPrompt}"\nYou MUST follow the User Visual Direction above. It overrides any other default style logic.` : ''}

Reply with ONLY the search term, nothing else. The search term MUST respect the User Visual Direction if provided (e.g., if user says "black and white noir", add "noir" or "black and white" to the term). Examples:
- "You watched your mom struggle to read" → "mother reading difficulty"
- "We made $2 million" → "business success celebration"
- "I was broke and desperate" → "stressed person finances"
- User: "No people", Text: "The city was quiet" → "empty city street"
- User: "Young asian woman", Text: "She felt happy" → "happy asian woman"`,
        },
      ],
    });

    const keyword = textResponse.trim().replace(/['"]/g, '');
    return NextResponse.json({ keyword });
  } catch (error) {
    console.error('Image keyword error:', error);
    // Fallback: extract nouns/meaningful words
    const words = (request.body ? '' : '').split(/\s+/).slice(0, 3).join(' ');
    return NextResponse.json({ keyword: words || 'abstract background' });
  }
}
