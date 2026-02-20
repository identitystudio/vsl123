import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai-provider';

export async function POST(request: NextRequest) {
  try {
    const { slides } = await request.json();

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: 'Slides are required' },
        { status: 400 }
      );
    }

    // Prepare slides for the prompt (index + text)
    const slidesText = slides
      .map((s, i) => `SLIDE ${i + 1} (ID: ${s.id}): ${s.fullScriptText}`)
      .join('\n');

    const prompt = `
    Analyze these slides from a Video Sales Letter (VSL).
    Group them into DISTINCT emotional "beats" or sections.
    
    CONSTRAINTS:
    - Identify between 3 to 8 beats total.
    - Every slide must belong to exactly one beat.
    - Beats should follow the narrative arc (e.g., The Problem -> Agitation -> Solution -> Authority -> Social Proof -> CTA).
    
    FOR EACH BEAT, PROVIDE:
    1. "name": A short 2-4 word title (e.g., "The Frustration", "The Hidden Solution").
    2. "emotion": The dominant emotion (e.g., "Angry", "Hopeful", "Urgent").
    3. "visualPrompt": A highly descriptive, artistic, text-free prompt for an AI image generator (like Midjourney/DALL-E). 
       - Focus on lighting, mood, composition, texture.
       - NO TEXT in the image.
       - Example: "Cinematic shot of a stressed man at a desk, dark moody lighting, rain on window, 8k resolution"
    4. "videoPrompt": A prompt for AI video generation.
       - Focus on camera movement (e.g., "Slow zoom in", "Pan right"), subject action.
    5. "slideIds": An array of the Slide IDs that belong to this beat.

    RETURN JSON ONLY:
    {
      "beats": [
        {
          "name": "...",
          "emotion": "...",
          "visualPrompt": "...",
          "videoPrompt": "...",
          "slideIds": ["id1", "id2"]
        }
      ]
    }
    `;

    const text = await generateText({
      model: 'gemini-pro', // or use the default provided by lib
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nSLIDES:\n${slidesText}`,
        },
      ],
    });

    let json = text.trim();
    if (json.startsWith('```json')) json = json.slice(7);
    if (json.startsWith('```')) json = json.slice(3);
    if (json.endsWith('```')) json = json.slice(0, -3);
    json = json.trim();

    const data = JSON.parse(json);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Analyze emotions error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze emotions' },
      { status: 500 }
    );
  }
}
