import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai-provider';

interface SlideInput {
  id: string;
  fullScriptText: string;
  sceneTitle?: string;
  emotion?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { currentSlide, nextSlides, maxLines = 5 } = await request.json();

    if (!currentSlide || !currentSlide.fullScriptText) {
      return NextResponse.json(
        { error: 'Current slide is required' },
        { status: 400 }
      );
    }

    // Build context from current and next slides
    const slidesForContext: SlideInput[] = [currentSlide];
    if (nextSlides && Array.isArray(nextSlides)) {
      slidesForContext.push(...nextSlides.slice(0, 10)); // Max 10 next slides for context
    }

    const slidesText = slidesForContext
      .map((s, i) => `${i + 1}. [${s.id}] "${s.fullScriptText}"${s.emotion ? ` (${s.emotion})` : ''}`)
      .join('\n');

    const textResponse = await generateText({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You're creating an infographic slide for a Video Sales Letter. The first slide will become an infographic that "holds" while multiple lines of script play as cycling captions.

Analyze these slides and decide which ones should be BUNDLED together into the infographic:

${slidesText}

LOOK FOR "EXPLAIN" OR "TEACH" MOMENTS:
- A doctor/expert explaining something
- Science or technical explanations
- Lists of benefits or features
- Emotional build-up moments
- Story beats that flow together

RULES:
- Always include slide 1 (the trigger slide)
- Bundle 2-${maxLines} total lines that form a coherent "moment"
- Stop bundling when the topic/emotion clearly shifts
- Don't bundle unrelated content just to fill quota
- Return the slide IDs to absorb and the caption text for each

Return ONLY valid JSON (no markdown):
{
  "bundledSlideIds": ["id1", "id2", ...],
  "captions": ["First caption text", "Second caption text", ...],
  "reasoning": "Brief explanation of why these lines belong together"
}`,
        },
      ],
    });

    let json = textResponse.trim();
    // Clean markdown if present
    if (json.startsWith('```json')) json = json.slice(7);
    else if (json.startsWith('```')) json = json.slice(3);
    if (json.endsWith('```')) json = json.slice(0, -3);
    json = json.trim();

    const result = JSON.parse(json);

    // Ensure current slide is always included
    if (!result.bundledSlideIds.includes(currentSlide.id)) {
      result.bundledSlideIds.unshift(currentSlide.id);
      result.captions.unshift(currentSlide.fullScriptText);
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Infographic lines error:', error);
    // Fallback to just current slide
    const { currentSlide } = await request.json().catch(() => ({ currentSlide: null }));
    return NextResponse.json({
      bundledSlideIds: currentSlide ? [currentSlide.id] : [],
      captions: currentSlide ? [currentSlide.fullScriptText] : [],
      reasoning: 'Fallback due to error',
    });
  }
}
