import { NextRequest, NextResponse } from 'next/server';
import type { Slide } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { slide } = await req.json() as { slide: Slide };

    if (!slide) {
      return NextResponse.json({ error: 'Slide data is required' }, { status: 400 });
    }

    // Build the HTML/CSS for the slide
    const bgColor = slide.style.background === 'dark' ? '#1a1a1a' : '#ffffff';
    const textColor = slide.style.textColor === 'white' ? '#ffffff' : '#1a1a1a';
    
    let backgroundStyle = `background-color: ${bgColor};`;
    if (slide.style.background === 'gradient' && slide.style.gradient) {
      backgroundStyle = `background: ${slide.style.gradient};`;
    }
    
    const html = `
      <div style="width: 1920px; height: 1080px; ${backgroundStyle} position: relative; overflow: hidden; font-family: system-ui, -apple-system, sans-serif;">
        ${slide.backgroundImage?.url && slide.style.background === 'image' ? `
          <div style="position: absolute; inset: 0; background-image: url('${slide.backgroundImage.url}'); background-size: cover; background-position: center; opacity: ${(slide.backgroundImage.opacity || 40) / 100}; ${slide.backgroundImage.blur ? `filter: blur(${slide.backgroundImage.blur}px);` : ''}"></div>
        ` : ''}
        <div style="position: relative; z-index: 10; display: flex; align-items: center; justify-content: center; height: 100%; padding: 0 80px;">
          <p style="text-align: center; font-size: ${(slide.style.textSize || 72) * 0.35}px; color: ${textColor}; font-weight: ${slide.style.textWeight === 'extrabold' ? '800' : '700'}; line-height: 1.15; margin: 0;">${slide.fullScriptText}</p>
        </div>
      </div>
    `;

    // Call htmlcsstoimage.com API
    const response = await fetch('https://hcti.io/v1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.HCTI_USER_ID}:${process.env.HCTI_API_KEY}`).toString('base64'),
      },
      body: JSON.stringify({
        html,
        css: '',
        google_fonts: '',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`htmlcsstoimage API error: ${error}`);
    }

    const result = await response.json();
    
    return NextResponse.json({ imageUrl: result.url });
  } catch (error: unknown) {
    console.error('Render slide error:', error);
    const message = error instanceof Error ? error.message : 'Failed to render slide';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
