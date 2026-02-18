import { NextRequest, NextResponse } from 'next/server';
import { generateText, lastDebugInfo } from '@/lib/ai-provider';

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
  userPrompt?: string
): Promise<SlideStyleDecision[]> {
  const slidesText = slides
    .map((s, i) => {
      const globalIndex = chunkIndex * 50 + i + 1;
      return `SLIDE ${globalIndex}:
  - ID: ${s.id}
  - Text: "${s.fullScriptText}"
  - Scene: ${s.sceneTitle || 'unknown'}
  - Emotion: ${s.emotion || 'neutral'}
  - Word Count: ${s.fullScriptText.split(/\s+/).length}
  - Has Question: ${s.fullScriptText.includes('?')}
  - Has Numbers: ${/\d/.test(s.fullScriptText)}
  - Is Short (≤5 words): ${s.fullScriptText.split(/\s+/).length <= 5}
  - Is Long (>15 words): ${s.fullScriptText.split(/\s+/).length > 15}`;
    })
    .join('\n\n');

  console.log(`[AI CREATIVE DIRECTOR] Analyzing ${slides.length} slides for chunk ${chunkIndex + 1}...`);

  try {
    const text = await generateText({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      system: `You are an Elite VSL (Video Sales Letter) Creative Director with complete creative control.

YOUR MISSION: Analyze EACH slide individually and make intelligent design decisions based on:
- The emotional tone of the text
- The content type (question, statement, statistic, call-to-action)
- The word count and readability
- The narrative flow and pacing
- Visual variety while maintaining professionalism

═══════════════════════════════════════════════════════════════
AVAILABLE PRESETS & WHEN TO USE THEM:
═══════════════════════════════════════════════════════════════

⚠️ IMPORTANT: DO NOT use "black-background" - it is forbidden!

1. "image-backdrop" - EMOTIONAL IMPACT (25% of slides)
   - Use for: Emotional statements, powerful claims, dramatic moments
   - Visual: Full blurred background image with text overlay
   - Best for: Short punchy text (≤10 words)
   - textColor: "white" (always for readability)
   - displayMode: "blurred"
   - blur: 6-12 (higher = more blur)
   - opacity: 30-50 (image darkness)

2. "image-text" - SPLIT VIEW / INFORMATIONAL (25% of slides)
   - Use for: Facts, statistics, explanations, features, benefits
   - Visual: Image on one side, text on other
   - Best for: Medium-length text (5-15 words)
   - textColor: "black"
   - displayMode: "split"
   - splitRatio: 40-60 (% of space for image)
   - blur: 0
   - opacity: 100

3. "white-background" - CLEAN & PROFESSIONAL (30% of slides)
   - Use for: Questions, transitions, simple statements, breathing room
   - Visual: Clean white bg with black text - elegant and easy to read
   - Best for: Any text length, creates visual rest between image-heavy slides
   - textColor: "black"
   - displayMode: "crisp"
   - IMPORTANT: Use this after every 2-3 image slides for visual breathing room!

4. "headshot-bio" - AUTHORITY & TRUST (15% of slides)
   - Use for: Personal stories, testimonials, "I" statements, "we" statements
   - Use for: Introduction slides, credibility building, founder stories
   - Use for: Any text with first-person pronouns (I, me, my, we, our)
   - Visual: Circular headshot placeholder with clean white background
   - textColor: "black"
   - isHeadshot: true
   - IMPORTANT: Great for building trust and personal connection!

5. "infographic" - DATA VISUALIZATION (5% of slides)
   - Use for: Statistics with specific numbers, lists, step-by-step processes
   - Visual: Icon/emoji with supporting text
   - isInfographic: true
   - infographicAbsorbCount: 0-4 (combine adjacent slides)

⛔ FORBIDDEN PRESET:
- "black-background" - DO NOT USE THIS PRESET. It looks harsh and unprofessional.

═══════════════════════════════════════════════════════════════
TEXT EMPHASIS MECHANICS (use strategically, not on every slide):
═══════════════════════════════════════════════════════════════

• boldWords: ["word1", "word2"] - Make words BOLD (key concepts, important terms)
• underlineWords: ["word"] - Underline for emphasis
  - underlineStyle: "brush-red" | "brush-black" | "brush-stroke-red" | "regular"
• circleWords: ["word"] - Circle important words
  - circleStyle: "red-solid" | "red-dotted" | "black-solid"
• redWords: ["word"] - Make words RED (warnings, urgency, problems)

EMPHASIS RULES:
- Use emphasis on ~30% of slides, not every slide
- Maximum 2-3 words emphasized per slide
- boldWords: Use for key benefits, features, or important nouns
- redWords: Use for problems, urgency, or negative emotions
- circleWords: Use sparingly for THE most important word
- underlineWords: Use for action words or calls-to-action

═══════════════════════════════════════════════════════════════
IMAGE KEYWORD GENERATION:
═══════════════════════════════════════════════════════════════

For EVERY slide with image-backdrop or image-text preset:
- Provide "refinedImageKeyword" (2-4 words for Pexels search)
- Make it specific and visual (not abstract concepts)
- Good: "business meeting office", "mountain sunrise", "happy family dinner"
- Bad: "success", "growth", "feeling" (too abstract)

═══════════════════════════════════════════════════════════════
DESIGN PRINCIPLES FOR FLOW:
═══════════════════════════════════════════════════════════════

1. VISUAL RHYTHM: Alternate between image-heavy and clean slides
2. BREATHING ROOM: After every 2-3 image slides, INSERT a white-background slide
3. PERSONAL TOUCH: Use headshot-bio for ANY first-person text (I, me, my, we, our)
4. QUESTION SLIDES: Questions work best on white-background
5. STATISTICS: Numbers pop on image-text split or infographic
6. EMOTIONAL PEAKS: Use image-backdrop for maximum impact
7. NO BLACK: Never use black-background - it's forbidden!

IDEAL DISTRIBUTION:
- white-background: 30% (visual breathing room, clean professional look)
- image-text: 25% (informational, facts, features)
- image-backdrop: 25% (emotional impact, dramatic moments)
- headshot-bio: 15% (personal stories, trust building, first-person)
- infographic: 5% (statistics, data visualization)

═══════════════════════════════════════════════════════════════
JSON OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════

Return ONLY a valid JSON array.
⚠️ NEVER use "black-background" - only use: white-background, image-text, image-backdrop, headshot-bio, infographic

[
  {
    "slideId": "uuid-here",
    "preset": "white-background",
    "displayMode": "blurred",
    "textColor": "white",
    "boldWords": ["important", "word"],
    "underlineWords": [],
    "circleWords": [],
    "redWords": [],
    "underlineStyle": "brush-red",
    "circleStyle": "red-solid",
    "isInfographic": false,
    "infographicAbsorbCount": 0,
    "isHeadshot": false,
    "refinedImageKeyword": "specific visual keyword",
    "textSize": 72,
    "splitRatio": 50,
    "blur": 8,
    "opacity": 40
  }
]`,
      messages: [
        {
          role: 'user',
          content: `ANALYZE each slide and make intelligent design decisions.

You have COMPLETE CREATIVE CONTROL. Design each slide based on:
- What the text is communicating
- The emotional tone
- The word count and structure
- How it fits in the overall narrative flow

${userPrompt ? `
═══════════════════════════════════════════════════════════════
⚡ USER'S CREATIVE DIRECTION (FOLLOW THIS):
"${userPrompt}"
═══════════════════════════════════════════════════════════════
` : ''}

TOTAL SLIDES IN PROJECT: ${totalSlides}
CURRENT CHUNK: ${chunkIndex + 1} (slides ${chunkIndex * 50 + 1} to ${chunkIndex * 50 + slides.length})

═══════════════════════════════════════════════════════════════
SLIDES TO DESIGN:
═══════════════════════════════════════════════════════════════

${slidesText}

═══════════════════════════════════════════════════════════════
INSTRUCTIONS:
═══════════════════════════════════════════════════════════════

1. Analyze each slide's content, emotion, and purpose
2. Choose the BEST preset for each slide using ALL 5 options:
   - white-background (30%): Questions, transitions, breathing room
   - image-text (25%): Facts, features, explanations
   - image-backdrop (25%): Emotional moments, dramatic impact
   - headshot-bio (15%): First-person text (I/me/my/we/our), testimonials
   - infographic (5%): Statistics, numbers, data
3. NEVER use black-background - it is forbidden!
4. Use headshot-bio whenever text contains: I, me, my, we, our, I'm, we're
5. Insert white-background every 2-3 slides for visual breathing room
6. Select emphasis words strategically (not on every slide)
7. Generate specific image keywords for image-based presets

Return a JSON array with one object per slide. Think carefully about each design choice.`,
        },
      ],
    });

    let json = text.trim();
    if (json.startsWith('```json')) json = json.slice(7);
    else if (json.startsWith('```')) json = json.slice(3);
    if (json.endsWith('```')) json = json.slice(0, -3);
    json = json.trim();

    const decisions = JSON.parse(json);
    
    // Log AI's creative decisions
    console.log(`[AI DECISIONS] Chunk ${chunkIndex + 1} preset distribution:`);
    const presetCounts: Record<string, number> = {};
    decisions.forEach((d: SlideStyleDecision) => {
      presetCounts[d.preset] = (presetCounts[d.preset] || 0) + 1;
    });
    Object.entries(presetCounts).forEach(([preset, count]) => {
      console.log(`  - ${preset}: ${count} slides`);
    });
    
    return decisions;
  } catch (err: any) {
    if (err?.status === 402 || err?.message?.toLowerCase().includes('billing') || err?.message?.toLowerCase().includes('credit')) {
      console.error('❌ AI FAILED: Out of credits or billing issue.');
    } else {
      console.error(`Chunk ${chunkIndex} styling error:`, err);
    }
    
    // Return intelligent fallback styling based on content analysis
    return slides.map((s, i) => {
      const words = s.fullScriptText.split(/\s+/);
      const isQuestion = s.fullScriptText.includes('?');
      const isShort = words.length <= 5;
      const hasNumber = /\d/.test(s.fullScriptText);
      const hasFirstPerson = /\b(I|me|my|we|our|I'm|I've|we're|we've)\b/i.test(s.fullScriptText);
      
      // Intelligent fallback decisions - with variety
      let preset: SlideStyleDecision['preset'] = 'image-text';
      let textColor: 'white' | 'black' = 'black';
      let displayMode: 'blurred' | 'crisp' | 'split' = 'split';
      let isHeadshot = false;
      
      // First-person text gets headshot-bio
      if (hasFirstPerson) {
        preset = 'headshot-bio';
        displayMode = 'crisp';
        isHeadshot = true;
      }
      // Questions get clean white background
      else if (isQuestion) {
        preset = 'white-background';
        displayMode = 'crisp';
      }
      // Short punchy text gets image backdrop
      else if (isShort) {
        preset = 'image-backdrop';
        textColor = 'white';
        displayMode = 'blurred';
      }
      // Numbers/stats get infographic
      else if (hasNumber) {
        preset = 'infographic';
        displayMode = 'crisp';
      }
      // Every 4th slide that would be image-text, make it white-background for breathing room
      else if (i % 4 === 3) {
        preset = 'white-background';
        displayMode = 'crisp';
      }
      
      return {
        slideId: s.id,
        preset,
        displayMode,
        textColor,
        boldWords: [],
        underlineWords: [],
        circleWords: [],
        redWords: [],
        isInfographic: preset === 'infographic',
        isHeadshot,
        refinedImageKeyword: s.imageKeyword || words.slice(0, 3).join(' '),
        blur: preset === 'image-backdrop' ? 8 : 0,
        opacity: preset === 'image-backdrop' ? 40 : 100,
        splitRatio: preset === 'image-text' ? 50 : 0,
      };
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { slides, userPrompt } = await request.json();

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: 'Slides array is required' },
        { status: 400 }
      );
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎨 AI CREATIVE DIRECTOR - FULL CONTROL MODE`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`📊 Total slides: ${slides.length}`);
    if (userPrompt) console.log(`🎯 User direction: "${userPrompt}"`);
    console.log(`${'═'.repeat(60)}\n`);

    // Process in chunks of 50 slides for efficiency
    const chunkSize = 50;
    const allStyles: SlideStyleDecision[] = [];
    const chunks: SlideInput[][] = [];

    for (let i = 0; i < slides.length; i += chunkSize) {
      chunks.push(slides.slice(i, i + chunkSize));
    }

    // Process chunks in parallel with a concurrency limit of 3
    const CONCURRENCY_LIMIT = 3;
    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map((chunk, j) => {
          const chunkIndex = i + j;
          return processChunk(
            chunk,
            chunkIndex,
            slides.length,
            userPrompt
          );
        })
      );
      for (const results of batchResults) {
        allStyles.push(...results);
      }
    }

    // NO ENFORCEMENT - AI has full creative control
    // But convert any black-background to white-background (forbidden preset)
    allStyles.forEach(s => {
      if (s.preset === 'black-background') {
        console.log(`[WARNING] Converting forbidden black-background to white-background for slide ${s.slideId}`);
        s.preset = 'white-background';
        s.textColor = 'black';
        s.displayMode = 'crisp';
      }
    });

    // Log final distribution
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ AI CREATIVE DECISIONS COMPLETE`);
    console.log(`${'═'.repeat(60)}`);
    
    const finalCounts: Record<string, number> = {};
    allStyles.forEach(s => {
      finalCounts[s.preset] = (finalCounts[s.preset] || 0) + 1;
    });
    
    console.log(`📊 Final Distribution:`);
    Object.entries(finalCounts).forEach(([preset, count]) => {
      const pct = ((count / allStyles.length) * 100).toFixed(1);
      console.log(`  - ${preset}: ${count} slides (${pct}%)`);
    });
    
    const emphasisCount = allStyles.filter(s => 
      s.boldWords?.length || s.underlineWords?.length || s.circleWords?.length || s.redWords?.length
    ).length;
    console.log(`  - Slides with emphasis: ${emphasisCount} (${((emphasisCount/allStyles.length)*100).toFixed(1)}%)`);
    
    const imageCount = allStyles.filter(s => s.refinedImageKeyword).length;
    console.log(`  - Slides with image keywords: ${imageCount}`);
    console.log(`${'═'.repeat(60)}\n`);

    return NextResponse.json({ styles: allStyles, debug: lastDebugInfo });
  } catch (error: unknown) {
    console.error('Style slides error:', error);
    const message = error instanceof Error ? error.message : 'Failed to style slides';
    return NextResponse.json({ error: message, debug: lastDebugInfo }, { status: 500 });
  }
}
