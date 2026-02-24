import { NextRequest, NextResponse } from 'next/server';
import { buildPromptWithTheme, type ImageTheme } from '@/lib/image-themes';

export async function POST(request: NextRequest) {
  try {
    const { slideText, imageKeyword, sceneTitle, emotion, theme = 'realism' } = await request.json();

    if (!slideText) {
      return NextResponse.json(
        { error: 'Slide text is required' },
        { status: 400 }
      );
    }

    // Call the n8n webhook to generate an image prompt
    const response = await fetch(
      'https://themacularprogram.app.n8n.cloud/webhook/generate-prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideText,
          imageKeyword: imageKeyword || '',
          sceneTitle: sceneTitle || '',
          emotion: emotion || '',
          theme,
          style: theme === 'infographic'
            ? 'modern infographic style, flat design, minimalist, bold colors, vector illustration'
            : 'ultra realistic, professional, high quality, 4K, cinematic lighting',
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Webhook error:', errText);
      // Fallback: generate a theme-based prompt locally
      const fallbackPrompt = buildPromptWithTheme(theme as ImageTheme, slideText, imageKeyword);
      return NextResponse.json({ prompt: fallbackPrompt, source: 'fallback' });
    }

    const data = await response.json();

    // The webhook may return the prompt in various formats
    const prompt = typeof data === 'string'
      ? data
      : data.prompt || data.output || data.text || data.message || JSON.stringify(data);

    return NextResponse.json({ prompt, source: 'webhook' });
  } catch (error: unknown) {
    console.error('Generate prompt error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate prompt';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
