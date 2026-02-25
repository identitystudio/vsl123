import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

    // Get Cloudinary credentials from environment
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const clApiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !clApiKey || !apiSecret) {
      throw new Error('Cloudinary credentials missing in .env');
    }

    // Debug logging
    console.log(`🎤 ElevenLabs Request: Voice=${voiceId}, Model=eleven_multilingual_v2`);
    
    // 1. Generate Audio from ElevenLabs
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
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: stability || 0.5,
            similarity_boost: similarityBoost || 0.75,
            style: 0.0,
            use_speaker_boost: true
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ElevenLabs API Error (${response.status}):`, errorText);
      throw new Error(`ElevenLabs error: ${response.status} ${errorText}`);
    }

    console.log('✅ ElevenLabs generation successful, uploading to Cloudinary...');

    const audioBuffer = await response.arrayBuffer();
    
    // 2. Upload to Cloudinary
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Signature for Cloudinary
    const params = {
      folder: 'vsl123-audio',
      public_id: publicId,
      timestamp: timestamp.toString(),
    };

    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key as keyof typeof params]}`)
      .join('&');

    const stringToSign = sortedParams + apiSecret;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    formData.append('file', blob, 'audio.mp3');
    formData.append('api_key', clApiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', 'vsl123-audio');
    formData.append('public_id', publicId);
    formData.append('signature', signature);
    formData.append('resource_type', 'video'); // Cloudinary uses 'video' for audio files

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error('❌ Cloudinary Upload Error:', errorData);
      throw new Error('Failed to store audio in cloud storage');
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ Audio stored on Cloudinary:', uploadData.secure_url);

    // Estimate duration (~150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60;

    return NextResponse.json({
      audioContent: uploadData.secure_url, // Now returns a URL, not base64
      duration: estimatedDuration,
    });
  } catch (error: any) {
    console.error('ElevenLabs TTS route error:', error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || 'Failed to generate audio' }, { status: isNaN(status) ? 500 : status });
  }
}
