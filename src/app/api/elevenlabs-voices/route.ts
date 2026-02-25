import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    console.log(`ElevenLabs Voices check: Key length ${apiKey.length}`);

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || errorData.detail || 'ElevenLabs error';
      return NextResponse.json(
        { error: message, code: errorData.error?.status },
        { status: response.status }
      );
    }

    const data = await response.json();

    const voices = data.voices.map(
      (voice: { voice_id: string; name: string; category: string }) => ({
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category,
      })
    );

    // Sort: cloned voices first
    voices.sort((a: { category: string }, b: { category: string }) => {
      if (a.category === 'cloned' && b.category !== 'cloned') return -1;
      if (a.category !== 'cloned' && b.category === 'cloned') return 1;
      return 0;
    });

    return NextResponse.json({ voices });
  } catch (error: unknown) {
    console.error('ElevenLabs voices error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voices' },
      { status: 500 }
    );
  }
}
