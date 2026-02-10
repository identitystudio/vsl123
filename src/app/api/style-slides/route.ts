import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface SlideInput {
  id: string;
  fullScriptText: string;
  sceneNumber?: number;
  sceneTitle?: string;
  emotion?: string;
  hasImage?: boolean;
  imageKeyword?: string;
}

interface SlideStyleDecision {
  slideId: string;
  preset: 'black-background' | 'white-background' | 'headshot-bio' | 'image-backdrop' | 'image-text' | 'infographic';
  displayMode?: 'blurred' | 'crisp' | 'split';
  crispness?: number; // 0-100, for blurred mode
  textColor: 'white' | 'black';
  boldWords: string[];
  underlineWords: string[];
  circleWords: string[];
  redWords: string[];
  isInfographic: boolean;
  infographicAbsorbCount?: number; // How many next slides to absorb
  isHeadshot: boolean;
}

// Process slides in chunks to handle large scripts
async function processChunk(
  slides: SlideInput[],
  chunkIndex: number,
  totalSlides: number,
  previousStyles: string
): Promise<SlideStyleDecision[]> {
  const slidesText = slides
    .map((s, i) => {
      const globalIndex = chunkIndex * 20 + i + 1;
      return `${globalIndex}. [${s.id}] "${s.fullScriptText}" (scene: ${s.sceneTitle || 'unknown'}, emotion: ${s.emotion || 'neutral'}, hasImage: ${s.hasImage || false})`;
    })
    .join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert VSL (Video Sales Letter) slide designer. Analyze these slides and decide the PERFECT styling for each one.

TOTAL SLIDES IN PROJECT: ${totalSlides}
${previousStyles ? `PREVIOUS STYLING DECISIONS (for context/variety):\n${previousStyles}\n` : ''}

SLIDES TO STYLE:
${slidesText}

FOR EACH SLIDE, DECIDE:

1. **PRESET** - Pick the best visual style:
   - "black-background" — Clean, dramatic, for punchy statements, CTAs
   - "white-background" — Clean, professional, for simple facts
   - "headshot-bio" — When speaker introduces themselves ("I'm Dr. X", "My name is", etc.)
   - "image-backdrop" — Emotional moments, visual scenes, stories (needs image behind text)
   - "image-text" — Split layout, image on top, text below (good for showing + telling)
   - "infographic" — Teaching moments, explaining science/stats, lists of benefits

2. **DISPLAY MODE** (for image presets only):
   - "blurred" — Soft background, text readable (most common)
   - "crisp" — Clear image visible, text overlay
   - "split" — Image top half, text bottom half

3. **CRISPNESS** (0-100, for blurred mode): 20-40 is usually good

4. **TEXT COLOR**: "white" for dark/image backgrounds, "black" for light backgrounds

5. **WORD EMPHASIS** (pick 0-3 key words per slide):
   - boldWords: Power words, benefits, key phrases
   - underlineWords: Important terms that need highlighting
   - circleWords: Critical numbers, warnings, key takeaways (use sparingly)
   - redWords: Danger words, warnings, pain points

6. **INFOGRAPHIC**: Set true if this is an "explain" moment. Set infographicAbsorbCount to how many NEXT slides should be bundled as cycling captions (0-4).

7. **HEADSHOT**: Set true if speaker is introducing themselves.

VARIETY RULES:
- Don't use same preset 5+ times in a row
- Mix text-only and image slides
- Use infographic for 1-2 teaching moments per script
- Headshot only when speaker literally introduces themselves
- Not every slide needs word emphasis — sometimes clean text is best

Return ONLY valid JSON array (no markdown):
[
  {
    "slideId": "abc",
    "preset": "image-backdrop",
    "displayMode": "blurred",
    "crispness": 40,
    "textColor": "white",
    "boldWords": ["breakthrough"],
    "underlineWords": [],
    "circleWords": [],
    "redWords": [],
    "isInfographic": false,
    "infographicAbsorbCount": 0,
    "isHeadshot": false
  }
]`,
      },
    ],
  });

  const textContent = message.content.find((b) => b.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    // Fallback: return basic styling
    return slides.map((s) => ({
      slideId: s.id,
      preset: 'black-background' as const,
      textColor: 'white' as const,
      boldWords: [],
      underlineWords: [],
      circleWords: [],
      redWords: [],
      isInfographic: false,
      isHeadshot: false,
    }));
  }

  let json = textContent.text.trim();
  // Clean markdown if present
  if (json.startsWith('```json')) json = json.slice(7);
  else if (json.startsWith('```')) json = json.slice(3);
  if (json.endsWith('```')) json = json.slice(0, -3);
  json = json.trim();

  try {
    return JSON.parse(json);
  } catch {
    // Fallback on parse error
    return slides.map((s) => ({
      slideId: s.id,
      preset: 'black-background' as const,
      textColor: 'white' as const,
      boldWords: [],
      underlineWords: [],
      circleWords: [],
      redWords: [],
      isInfographic: false,
      isHeadshot: false,
    }));
  }
}

export async function POST(request: NextRequest) {
  try {
    const { slides } = await request.json();

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: 'Slides array is required' },
        { status: 400 }
      );
    }

    // Process in chunks of 20 slides
    const chunkSize = 20;
    const allStyles: SlideStyleDecision[] = [];

    for (let i = 0; i < slides.length; i += chunkSize) {
      const chunk = slides.slice(i, i + chunkSize);

      // Build context from previous styling decisions for variety
      const previousContext = allStyles.length > 0
        ? allStyles.slice(-10).map((s) => `${s.slideId}: ${s.preset}`).join(', ')
        : '';

      const chunkStyles = await processChunk(
        chunk,
        Math.floor(i / chunkSize),
        slides.length,
        previousContext
      );

      allStyles.push(...chunkStyles);
    }

    return NextResponse.json({ styles: allStyles });
  } catch (error: unknown) {
    console.error('Style slides error:', error);
    const message = error instanceof Error ? error.message : 'Failed to style slides';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
