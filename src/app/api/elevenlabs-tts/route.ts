import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, apiKey, stability, similarityBoost, speed } =
      await request.json();

    if (!text || !voiceId || !apiKey) {
      return NextResponse.json(
        { error: 'text, voiceId, and apiKey are required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: stability || 0.5,
            similarity_boost: similarityBoost || 0.75,
            speed: speed || 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs error: ${response.status} ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');
    const audioContent = `data:audio/mpeg;base64,${base64}`;

    // Estimate duration (~150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60;

    return NextResponse.json({
      audioContent,
      duration: estimatedDuration,
    });
  } catch (error: unknown) {
    console.error('ElevenLabs TTS error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to generate audio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
