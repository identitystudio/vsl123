import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, provider, apiKey } = await request.json();

    if (!prompt || !provider || !apiKey) {
      return NextResponse.json(
        { error: 'Prompt, provider, and API key are required' },
        { status: 400 }
      );
    }

    if (provider === 'openai') {
      return await generateWithOpenAI(prompt, apiKey);
    } else if (provider === 'gemini') {
      return await generateWithGemini(prompt, apiKey);
    } else {
      return NextResponse.json(
        { error: 'Invalid provider. Use "openai" or "gemini".' },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error('Generate image error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate image';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function generateWithOpenAI(prompt: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: `Ultra realistic, professional: ${prompt}`,
      n: 1,
      size: '1792x1024',
      quality: 'hd',
      style: 'natural',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `OpenAI API error (${response.status})`;
    return NextResponse.json({ error: msg }, { status: response.status });
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  const revisedPrompt = data.data?.[0]?.revised_prompt;

  if (!imageUrl) {
    return NextResponse.json(
      { error: 'No image returned from OpenAI' },
      { status: 500 }
    );
  }

  return NextResponse.json({ imageUrl, revisedPrompt, provider: 'openai' });
}

async function generateWithGemini(prompt: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: `Ultra realistic, professional: ${prompt}`,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg =
      err?.error?.message || `Gemini API error (${response.status})`;
    return NextResponse.json({ error: msg }, { status: response.status });
  }

  const data = await response.json();
  const imageBytes = data.predictions?.[0]?.bytesBase64Encoded;

  if (!imageBytes) {
    return NextResponse.json(
      { error: 'No image returned from Gemini' },
      { status: 500 }
    );
  }

  // Return as base64 data URL
  const imageUrl = `data:image/png;base64,${imageBytes}`;
  return NextResponse.json({ imageUrl, provider: 'gemini' });
}
