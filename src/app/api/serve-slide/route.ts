import { NextRequest, NextResponse } from 'next/server';
import type { Slide } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { slide } = await req.json() as { slide: Slide };

    if (!slide) {
      return NextResponse.json({ error: 'Slide data is required' }, { status: 400 });
    }

    // Generate standalone HTML for the slide
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div style="
    width: 1920px;
    height: 1080px;
    background-color: ${slide.style.background === 'dark' ? '#1a1a1a' : '#ffffff'};
    ${slide.style.background === 'gradient' && slide.style.gradient ? `background: ${slide.style.gradient};` : ''}
    position: relative;
    overflow: hidden;
  ">
    ${slide.backgroundImage?.url && slide.style.background === 'image' ? `
      <div style="
        position: absolute;
        inset: 0;
        background-image: url('${slide.backgroundImage.url}');
        background-size: cover;
        background-position: center;
        opacity: ${(slide.backgroundImage.opacity || 40) / 100};
        ${slide.backgroundImage.blur ? `filter: blur(${slide.backgroundImage.blur}px);` : ''}
      "></div>
    ` : ''}
    
    <div style="
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 0 80px;
    ">
      <p style="
        text-align: center;
        font-size: ${(slide.style.textSize || 72) * 0.35}px;
        color: ${slide.style.textColor === 'white' ? '#ffffff' : '#1a1a1a'};
        font-weight: ${slide.style.textWeight === 'extrabold' ? '800' : '700'};
        line-height: 1.15;
        margin: 0;
      ">${slide.fullScriptText}</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Store the HTML temporarily and return a unique ID
    const slideId = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // For now, return the HTML directly - in production you'd store this
    return NextResponse.json({ html, slideId });
  } catch (error: unknown) {
    console.error('Serve slide error:', error);
    const message = error instanceof Error ? error.message : 'Failed to serve slide';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
