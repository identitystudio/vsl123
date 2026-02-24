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

    // Truncate slide text for reference to save context and avoid output lag
    let slidesContext = '';
    if (slides && Array.isArray(slides) && slides.length > 0) {
      slidesContext = `\n\nSLIDES FOR REFERENCE:\n` +
        slides.map((s: any, i: number) => `[S${i + 1}] ${s.fullScriptText.substring(0, 150)}...`).join('\n');
    }

    const finalBeatCount = Math.max(1, beatCount);
    
    const prompt = `
    Analyze the script into EXACTLY ${finalBeatCount} emotional beats.
    
    REQUIRED JSON FORMAT:
    {
      "beats": [
        {
          "name": "Short summary",
          "emotion": "Single word",
          "visualPrompt": "20-word visual description, no text",
          "videoPrompt": "4-word motion",
          "startSlideIndex": number,
          "endSlideIndex": number,
          "scriptExcerpt": "Quote"
        }
      ]
    }

    CONSTRAINTS:
    - ONLY return the JSON.
    - Be concise to prevent truncation.

    SCRIPT:
    ${script.substring(0, 6000)}
    `;

    console.log(`[AI] Analyzing into ${finalBeatCount} beats...`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
        temperature: 0.1,
      } as any,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let text = result.response.text().trim();
    
    // Extraction: find the outermost { }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      text = text.substring(start, end + 1);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Repair strategy: find the last completed object in the "beats" array
      try {
        if (text.includes('"beats"')) {
          const lastObjectEnd = text.lastIndexOf('}');
          if (lastObjectEnd !== -1) {
            let repaired = text.substring(0, lastObjectEnd + 1);
            // Close array and object
            if (!repaired.endsWith(']}')) repaired += ']}';
            if (!repaired.endsWith('}')) repaired += '}';
            data = JSON.parse(repaired);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      } catch (innerE) {
        console.error('JSON REPAIR FAILED. Raw text:', text);
        throw new Error('AI response was unstable. Please try again with a shorter script portion.');
      }
    }

    if (!data || !data.beats || !Array.isArray(data.beats)) {
      throw new Error('Invalid format: AI did not return a beats array');
    }

    // Map indices back to UUID slideIds
    if (slides && Array.isArray(slides) && slides.length > 0) {
      data.beats = data.beats.map((beat: any) => {
        // Handle potential string vs number from AI
        const startIdxRaw = parseInt(beat.startSlideIndex);
        const endIdxRaw = parseInt(beat.endSlideIndex);
        
        const startIdx = Math.max(1, isNaN(startIdxRaw) ? 1 : startIdxRaw) - 1;
        const endIdx = Math.min(slides.length, isNaN(endIdxRaw) ? slides.length : endIdxRaw);
        
        // Extract the actual IDs for the range
        const slideIds = slides.slice(startIdx, endIdx).map((s: any) => s.id);
        
        return {
          ...beat,
          slideIds: slideIds // Frontend expects slideIds array
        };
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Analyze script beats error:', error);
    // Log more detail if available
    if (error.response) {
      console.error('AI Response Error:', JSON.stringify(error.response, null, 2));
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to analyze script beats' },
      { status: 500 }
    );
  }
}
