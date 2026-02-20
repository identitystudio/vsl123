import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { script, slides } = await request.json();

    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      return NextResponse.json(
        { error: 'Script text is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // If slides are provided, include their IDs for mapping
    let slidesContext = '';
    if (slides && Array.isArray(slides) && slides.length > 0) {
      slidesContext = `\n\nSLIDES FOR REFERENCE (map beats to these slide IDs):\n` +
        slides.map((s: any, i: number) => `SLIDE ${i + 1} (ID: ${s.id}): ${s.fullScriptText}`).join('\n');
    }

    const prompt = `
    Analyze the following Video Sales Letter (VSL) script.
    Break it down into EXACTLY 8 distinct emotional "beats" or sections.
    
    CONSTRAINTS:
    - You MUST return EXACTLY 8 beats. No more, no less.
    - Beats should follow the narrative arc of a VSL (e.g., Hook -> Problem -> Agitation -> Story -> Solution -> Authority/Proof -> Offer -> CTA).
    - Each beat should represent a meaningful emotional shift in the script.
    
    FOR EACH BEAT, PROVIDE:
    1. "name": A short 2-4 word title (e.g., "The Frustration", "The Hidden Solution", "Proof It Works").
    2. "emotion": The dominant emotion (e.g., "Curious", "Frustrated", "Hopeful", "Urgent", "Excited", "Trusting").
    3. "visualPrompt": A highly descriptive, artistic, text-free prompt for an AI image generator.
       - Focus on lighting, mood, composition, texture, cinematography.
       - NO TEXT in the image.
       - Make it vivid and specific, at least 20 words.
       - Example: "Cinematic shot of a stressed entrepreneur at a desk with scattered papers, dark moody blue lighting, rain streaking down window, shallow depth of field, 8k resolution"
    4. "videoPrompt": A prompt for AI video generation from the image.
       - Focus on subtle camera movement (e.g., "Slow zoom in", "Gentle pan right", "Dolly forward").
       - Keep it short and cinematic, 10-15 words.
    5. "slideIds": An array of slide IDs that belong to this beat (if slides were provided, otherwise empty array).
    6. "scriptExcerpt": A brief 1-sentence summary of what this part of the script covers.

    RETURN JSON ONLY (no markdown, no explanation):
    {
      "beats": [
        {
          "name": "...",
          "emotion": "...",
          "visualPrompt": "...",
          "videoPrompt": "...",
          "slideIds": [],
          "scriptExcerpt": "..."
        }
      ]
    }

    SCRIPT:
    ${script}${slidesContext}
    `;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        temperature: 0.7,
      } as any,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = result.response.text().trim();
    console.log('Analyze beats raw response length:', text.length);

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('JSON parse error, raw text:', text.substring(0, 500));
      return NextResponse.json(
        { error: 'AI returned invalid JSON. Please try again.' },
        { status: 500 }
      );
    }

    // Ensure beats array exists
    if (!data.beats || !Array.isArray(data.beats)) {
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Analyze script beats error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to analyze script beats' },
      { status: 500 }
    );
  }
}
