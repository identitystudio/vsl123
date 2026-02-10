import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { slideText, emotion, sceneTitle } = await request.json();

    if (!slideText) {
      return NextResponse.json(
        { error: 'slideText is required' },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Generate a 2-4 word stock photo search term that visually represents this text. The term should describe a scene, person, or concept that a stock photo site like Pexels would have.

Text: "${slideText}"
${emotion ? `Emotion: ${emotion}` : ''}
${sceneTitle ? `Scene: ${sceneTitle}` : ''}

Reply with ONLY the search term, nothing else. Examples:
- "You watched your mom struggle to read" → "mother reading difficulty"
- "We made $2 million" → "business success celebration"
- "I was broke and desperate" → "stressed person finances"`,
        },
      ],
    });

    const textContent = message.content.find((b) => b.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ keyword: slideText.split(/\s+/).slice(0, 3).join(' ') });
    }

    const keyword = textContent.text.trim().replace(/['"]/g, '');
    return NextResponse.json({ keyword });
  } catch (error) {
    console.error('Image keyword error:', error);
    // Fallback: extract nouns/meaningful words
    const words = (request.body ? '' : '').split(/\s+/).slice(0, 3).join(' ');
    return NextResponse.json({ keyword: words || 'abstract background' });
  }
}
