import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Split script into sentences
function splitIntoSentences(script: string): string[] {
  return script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Chunk an array into groups of N
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface SlideData {
  fullScriptText: string;
  hasImage: boolean;
  imageKeyword: string | null;
}

interface SceneData {
  sceneNumber: number;
  title: string;
  emotion: string;
  slides: SlideData[];
}

// Process a chunk of sentences with Claude
async function processChunk(
  sentences: string[],
  chunkIndex: number,
  totalChunks: number
): Promise<SceneData[]> {
  const numberedSentences = sentences
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  console.log(`[AI] Splitting script chunk ${chunkIndex + 1} of ${totalChunks}...`);
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Split these VSL script lines into slides grouped by scenes. This is chunk ${chunkIndex + 1} of ${totalChunks}.

RULES:
- Each slide = 1-2 lines (keep short)
- DO NOT repeat the same text across multiple slides. Each unique line from the script should appear exactly once in the entire output.
- Group into scenes (Hook, Problem, Agitation, Solution, Authority, Proof, CTA, Close)
- Mark EVERY slide (100%) as hasImage:true
- IMPORTANT: For EVERY slide, provide an imageKeyword — a descriptive cinematic stock photo search term.
- Return ONLY a valid JSON array of scenes.

Format: [{"sceneNumber":1,"title":"Scene Name","emotion":"hook","slides":[{"fullScriptText":"text here","hasImage":true,"imageKeyword":"visual search term"}]}]

LINES:
${numberedSentences}`,
        },
      ],
    });

    const textContent = message.content.find((b) => b.type === 'text');
    if (!textContent || textContent.type !== 'text') return [];

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
      console.error(`Chunk ${chunkIndex} AI error, using fallback:`, err);
    }
    // Fallback: create simple slides from sentences
    return [
      {
        sceneNumber: chunkIndex + 1,
        title: `Section ${chunkIndex + 1}`,
        emotion: 'neutral',
        slides: sentences.map((s) => ({
          fullScriptText: s,
          hasImage: false,
          imageKeyword: null,
        })),
      },
    ];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json();

    if (!script || typeof script !== 'string') {
      return NextResponse.json(
        { error: 'Script is required' },
        { status: 400 }
      );
    }

    const sentences = splitIntoSentences(script);

    if (sentences.length === 0) {
      return NextResponse.json(
        { error: 'No content found in script' },
        { status: 400 }
      );
    }

    // Process in chunks of 40 sentences
    const chunks = chunk(sentences, 40);
    const allScenes: SceneData[] = [];

    // Process chunks in parallel (max 3 at a time)
    for (let i = 0; i < chunks.length; i += 3) {
      const batch = chunks.slice(i, i + 3);
      const results = await Promise.all(
        batch.map((c, j) => processChunk(c, i + j, chunks.length))
      );
      for (const scenes of results) {
        allScenes.push(...scenes);
      }
    }

    // Renumber scenes sequentially
    allScenes.forEach((scene, i) => {
      scene.sceneNumber = i + 1;
    });

    // Calculate stats
    let totalSlides = 0;
    let imageSlides = 0;
    for (const scene of allScenes) {
      if (scene.slides) {
        totalSlides += scene.slides.length;
        imageSlides += scene.slides.filter((s) => s.hasImage).length;
      }
    }

    return NextResponse.json({
      scenes: allScenes,
      stats: { totalSlides, imageSlides },
    });
  } catch (error: unknown) {
    console.error('Split script error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to split script';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
