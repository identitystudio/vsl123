import { NextRequest, NextResponse } from 'next/server';
import { getThemeConfig, type ImageTheme } from '@/lib/image-themes';

export async function POST(request: NextRequest) {
  try {
    const { prompt, theme = 'realism', apiKey } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('🎨 Generate beat image: Sending prompt to webhook...');

    const themeConfig = getThemeConfig(theme as ImageTheme);
    const enhancedPrompt = `${themeConfig.promptPrefix} ${prompt.trim()}`;

    const response = await fetch(
      'https://themacularprogram.app.n8n.cloud/webhook/generate-infographics',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enhancedPrompt, apiKey }),
      }
    );

    console.log('📡 Webhook Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Webhook Failed:', errorText);
      return NextResponse.json(
        { error: `Webhook error (${response.status}): ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Webhook Response:', JSON.stringify(data).substring(0, 200));

    // Response is an array — grab the first item's secure_url
    const item = Array.isArray(data) ? data[0] : data;
    const imageUrl = item?.secure_url || item?.url;

    if (!imageUrl) {
      console.error('No URL found in webhook response:', data);
      return NextResponse.json(
        { error: 'No image URL returned from webhook' },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error('Generate beat image error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate image' },
      { status: 500 }
    );
  }
}
