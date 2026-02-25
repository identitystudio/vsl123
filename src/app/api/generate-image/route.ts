import { NextRequest, NextResponse } from 'next/server';
import { getThemeConfig, type ImageTheme } from '@/lib/image-themes';

export async function POST(request: NextRequest) {
  try {
    const { prompt, provider, apiKey, theme = 'realism' } = await request.json();

    if (!prompt || !provider || !apiKey) {
      return NextResponse.json(
        { error: 'Prompt, provider, and API key are required' },
        { status: 400 }
      );
    }

    if (provider === 'openai') {
      return await generateWithOpenAI(prompt, apiKey, theme as ImageTheme);
    } else if (provider === 'gemini') {
      return await generateWithGemini(prompt, apiKey, theme as ImageTheme);
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

async function generateWithOpenAI(prompt: string, apiKey: string, theme: ImageTheme = 'realism') {
  const themeConfig = getThemeConfig(theme);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: `${themeConfig.promptPrefix} ${prompt}`,
      n: 1,
      size: '1792x1024',
      quality: 'hd',
      style: themeConfig.openAIStyle,
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

async function generateWithGemini(prompt: string, apiKey: string, theme: ImageTheme = 'realism') {
  const themeConfig = getThemeConfig(theme);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: `${themeConfig.promptPrefix} ${prompt}`,
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

  // Create a blob and upload to Cloudinary
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const clApiKey = process.env.CLOUDINARY_API_KEY;
  const clApiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && clApiKey && clApiSecret) {
    try {
      const crypto = await import('crypto');
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `gen_img_${Date.now()}`;
      
      const params = {
        folder: 'vsl123-background-images',
        public_id: publicId,
        timestamp: timestamp.toString(),
      };

      const sortedParams = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key as keyof typeof params]}`)
        .join('&');

      const stringToSign = sortedParams + clApiSecret;
      const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

      const formData = new FormData();
      formData.append('file', `data:image/png;base64,${imageBytes}`);
      formData.append('api_key', clApiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('folder', 'vsl123-background-images');
      formData.append('public_id', publicId);
      formData.append('signature', signature);

      const clResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (clResponse.ok) {
        const clData = await clResponse.json();
        return NextResponse.json({ imageUrl: clData.secure_url, provider: 'gemini' });
      }
      console.error('Cloudinary upload failed for Gemini image');
    } catch (err) {
      console.error('Cloudinary processing error:', err);
    }
  }

  // Fallback to base64 if Cloudinary fails or is not configured
  const imageUrl = `data:image/png;base64,${imageBytes}`;
  return NextResponse.json({ imageUrl, provider: 'gemini' });
}
