import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { script, slides, beatCount = 8 } = await request.json();

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

    // Aggressively truncate slide text to keep the prompt focused and avoid noise
    let slidesContext = '';
    if (slides && Array.isArray(slides) && slides.length > 0) {
      slidesContext = `\n\nSLIDE MAP (MANDATORY: Map beats across slides 1 to ${slides.length}):\n` +
        slides.map((s: any, i: number) => `[S${i + 1}] ${s.fullScriptText.substring(0, 80)}...`).join('\n');
    }

    const finalBeatCount = Math.max(1, beatCount);
    
    const prompt = `
    Analyze the script provided and break it down into exactly ${finalBeatCount} emotional beats.
    Each beat MUST map to a range of slides (from startSlideIndex to endSlideIndex).
    
    JSON SCHEMA FOR RESPONSE:
    {
      "beats": [
        {
          "name": "Summary of beat",
          "emotion": "Single emotion word",
          "visualPrompt": "20-word visual description",
          "videoPrompt": "4-word motion",
          "startSlideIndex": number,
          "endSlideIndex": number,
          "scriptExcerpt": "Brief quote"
        }
      ]
    }

    STRICT CONSTRAINTS:
    - You must return exactly ${finalBeatCount} beats.
    - Covering all slides from 1 to ${slides.length}.
    - Be extremely concise in strings to avoid JSON truncation.
    - Output ONLY pure JSON.

    SLIDE INDEXES TO USE:
    ${slidesContext}

    SCRIPT CONTENT:
    ${script.substring(0, 25000)}
    `;

    console.log(`[AI] Analyzing ${slides.length} slides into ${finalBeatCount} beats using gemini-2.5-flash...`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
        temperature: 0.2,
      },
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let text = result.response.text().trim();
    
    let data: any;
    
    // Surgical JSON recovery
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        text = text.substring(start, end + 1);
      }
      data = JSON.parse(text);
    } catch (e) {
      console.warn('Primary JSON parse failed. Raw response snippet:', text.substring(0, 500));
      try {
        if (text.includes('"beats"')) {
          const lastValidIndex = text.lastIndexOf('}');
          if (lastValidIndex !== -1) {
            let repaired = text.substring(0, lastValidIndex + 1);
            if (!repaired.endsWith(']}')) repaired += ']}';
            if (!repaired.endsWith('}')) repaired += '}';
            data = JSON.parse(repaired);
          }
        }
      } catch (innerE) {
        console.error('JSON REPAIR FAILED. Full raw response:', text);
        throw new Error('AI response was unstable for this length. Try analyzing a slightly smaller portion or retry.');
      }
      if (!data) throw e;
    }

    if (!data || !data.beats || !Array.isArray(data.beats)) {
      throw new Error('Invalid format: AI did not return a beats array');
    }

    // Map indices back to UUID slideIds
    if (slides && Array.isArray(slides) && slides.length > 0) {
      data.beats = data.beats.map((beat: any) => {
        const startIdxRaw = parseInt(beat.startSlideIndex);
        const endIdxRaw = parseInt(beat.endSlideIndex);
        
        const startIdx = Math.max(1, isNaN(startIdxRaw) ? 1 : startIdxRaw) - 1;
        const endIdx = Math.min(slides.length, isNaN(endIdxRaw) ? slides.length : endIdxRaw);
        
        const slideIds = slides.slice(startIdx, endIdx).map((s: any) => s.id);
        
        return {
          ...beat,
          slideIds: slideIds
        };
      });
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
