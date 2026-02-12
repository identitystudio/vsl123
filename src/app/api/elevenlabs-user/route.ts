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

    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || errorData.detail || 'Invalid API key or ElevenLabs error';
      return NextResponse.json(
        { error: message, code: errorData.error?.status },
        { status: 401 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      character_count: data.character_count,
      character_limit: data.character_limit,
      remaining_characters: data.character_limit - data.character_count
    });
  } catch (error: unknown) {
    console.error('ElevenLabs user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user info' },
      { status: 500 }
    );
  }
}
