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
  textColor: 'white' | 'black';
  boldWords: string[];
  underlineWords: string[];
  circleWords: string[];
  redWords: string[];
  underlineStyle?: 'brush-red' | 'brush-black' | 'regular' | 'brush-stroke-red';
  circleStyle?: 'red-solid' | 'red-dotted' | 'black-solid';
  isInfographic: boolean;
  infographicAbsorbCount?: number;
  gradientColor?: 'blue' | 'purple' | 'teal' | 'orange';
  isHeadshot: boolean;
  refinedImageKeyword?: string;
  textSize?: number;
  splitRatio?: number;
  blur?: number;
  opacity?: number;
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
      const globalIndex = chunkIndex * 50 + i + 1;
      return `${globalIndex}. [${s.id}] "${s.fullScriptText}" (scene: ${s.sceneTitle || 'unknown'}, emotion: ${s.emotion || 'neutral'}, hasImage: ${s.hasImage || false})`;
    })
    .join('\n');

  console.log(`[AI] Designing styles for chunk ${chunkIndex + 1} (${slides.length} slides)...`);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: `You are a World-Class VSL (Video Sales Letter) Creative Director and Slide Designer. 
Your goal is to create a high-conversion, visually stunning, and cinematic slide deck.

DESIGN PHILOSOPHY:
1. **The "Image-First" Requirement**: Every single slide MUST use an image. Rotate between:
   - **Image + Text** (preset: "image-text"): This is the SPLIT IMAGE style. Use this for approximately 50% of the slides.
   - **Image Backdrop** (preset: "image-backdrop"): Emotional, cinematic, full-screen background with text overlay. Use this for the other 50% of slides.
   - **Headshot + Bio** (preset: "headshot-bio"): Use ONLY when the person is specifically introducing themselves or providing social proof.
2. **Emotional Matching**: Every slide must visually depict the emotion of the script.
3. **MANDATORY IMAGES**: Since you are a cinematic director, EVERY slide must use an image-based preset ("image-backdrop" or "image-text"). Never use plain white, plain black, or plain gradient backgrounds.
4. **Cinematic Imagery**: Your "refinedImageKeyword" must be a 4-7 word professional photography prompt (e.g., "distressed businessman in shadow, blue cinematic lighting, sharp focus").
5. **Bold Layouts**: Vary the "splitRatio", "blur", and "opacity" to create a unique rhythm.
6. **Dynamic Emphasis**: Use underlines, circles, and bolding to guide the viewer's eye.
7. **MANDATORY ROTATION**: You are forbidden from using the same preset for two slides in a row. You must rotate between Split and Backdrop to maintain viewer engagement.
8. **FACTS & LISTS**: Use "image-text" (Split) for all factual statements or new points.
9. **STRICT VARIETY**: In every 4-slide sequence, there MUST be at least one "image-text" (Split) and at least one "image-backdrop".

JSON SCHEMA:
Return ONLY a valid JSON array of objects.
[
  {
    "slideId": "string",
    "preset": "black-background" | "white-background" | "headshot-bio" | "image-backdrop" | "image-text" | "infographic",
    "displayMode": "blurred" | "crisp" | "split",
    "textColor": "white" | "black",
    "boldWords": ["string"],
    "underlineWords": ["string"],
    "circleWords": ["string"],
    "redWords": ["string"],
    "underlineStyle": "brush-red" | "brush-black" | "regular" | "brush-stroke-red",
    "circleStyle": "red-solid" | "red-dotted" | "black-solid",
    "isInfographic": boolean,
    "infographicAbsorbCount": 0-4,
    "gradientColor": "blue" | "purple" | "teal" | "orange",
    "isHeadshot": boolean,
    "refinedImageKeyword": "Detailed Pexels Search Query",
    "textSize": 60 | 72 | 84 | 96 | 108 | 120,
    "splitRatio": 30-70,
    "blur": 0-15,
    "opacity": 10-100
  }
]`,
      messages: [
        {
          role: 'user',
          content: `Style these slides for a high-impact VSL.
TOTAL SLIDES: ${totalSlides}
SLIDES:
${slidesText}`,
        },
      ],
    });

    const textContent = message.content.find((b) => b.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in AI response');
    }

    let json = textContent.text.trim();
    if (json.startsWith('```json')) json = json.slice(7);
    else if (json.startsWith('```')) json = json.slice(3);
    if (json.endsWith('```')) json = json.slice(0, -3);
    json = json.trim();

    return JSON.parse(json);
  } catch (err: any) {
    if (err?.status === 402 || err?.message?.toLowerCase().includes('billing') || err?.message?.toLowerCase().includes('credit')) {
      console.error('❌ AI FAILED: Out of Anthropic credits or billing issue.');
    } else {
      console.error(`Chunk ${chunkIndex} styling error:`, err);
    }
    
    // Return basic styling as fallback
    return slides.map((s) => ({
      slideId: s.id,
      preset: 'white-background' as const,
      textColor: 'black' as const,
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

    // Process in chunks of 50 slides for efficiency
    const chunkSize = 50;
    const allStyles: SlideStyleDecision[] = [];
    const chunks: SlideInput[][] = [];

    for (let i = 0; i < slides.length; i += chunkSize) {
      chunks.push(slides.slice(i, i + chunkSize));
    }

    // Process chunks in parallel with a concurrency limit of 5
    const CONCURRENCY_LIMIT = 5;
    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map((chunk, j) => {
          const chunkIndex = i + j;
          return processChunk(
            chunk,
            chunkIndex,
            slides.length,
            '' // Context is harder in parallel, skipping for performance on huge decks
          );
        })
      );
      for (const results of batchResults) {
        allStyles.push(...results);
      }
    }

    return NextResponse.json({ styles: allStyles });
  } catch (error: unknown) {
    console.error('Style slides error:', error);
    const message = error instanceof Error ? error.message : 'Failed to style slides';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
