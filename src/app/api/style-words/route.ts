import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai-provider';

interface WordStyleRequest {
  slideText: string;
  emotion?: string;
  sceneTitle?: string;
  preset?: string;
  userPrompt?: string;
}

interface WordStyleDecision {
  boldWords: string[];
  underlineWords: string[];
  circleWords: string[];
  redWords: string[];
  underlineStyle: 'brush-red' | 'brush-black' | 'regular' | 'brush-stroke-red';
  circleStyle: 'red-solid' | 'red-dotted' | 'black-solid';
}

export async function POST(request: NextRequest) {
  try {
    const { slideText, emotion, sceneTitle, preset, userPrompt }: WordStyleRequest = await request.json();

    if (!slideText) {
      return NextResponse.json({ error: 'Slide text is required' }, { status: 400 });
    }

    console.log(`[AI WORD STYLER] Analyzing: "${slideText.substring(0, 50)}..."`);

    const text = await generateText({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: `You are an expert VSL (Video Sales Letter) copywriter and visual designer.
Your job is to analyze slide text and decide which words should be emphasized for maximum impact.

═══════════════════════════════════════════════════════════════
WORD EMPHASIS OPTIONS:
═══════════════════════════════════════════════════════════════

1. boldWords: Make words BOLD
   - Use for: Key nouns, benefits, important concepts
   - Max 2-3 words per slide

2. underlineWords: Add underline effect
   - Use for: Action words, calls-to-action, verbs
   - Best with: underlineStyle
   - Max 1-2 words

3. redWords: Make words RED colored
   - Use for: Problems, pain points, urgency, warnings, negative emotions
   - Words like: "problem", "struggle", "pain", "risk", "danger", "losing"
   - Max 1 word

4. circleWords: Draw circle around word
   - Use for: THE single most important word - the key takeaway
   - Best with: circleStyle
   - Max 1 word (use sparingly!)

═══════════════════════════════════════════════════════════════
UNDERLINE STYLES:
═══════════════════════════════════════════════════════════════
- "brush-red": Hand-drawn red brush stroke (energetic, casual)
- "brush-black": Hand-drawn black brush stroke (professional, bold)
- "brush-stroke-red": Thick red marker style (very bold)
- "regular": Clean underline (formal, minimal)

═══════════════════════════════════════════════════════════════
CIRCLE STYLES:
═══════════════════════════════════════════════════════════════
- "red-solid": Solid red circle (strong emphasis)
- "red-dotted": Dotted red circle (subtle emphasis)
- "black-solid": Solid black circle (professional)

═══════════════════════════════════════════════════════════════
DESIGN RULES:
═══════════════════════════════════════════════════════════════

1. LESS IS MORE: Don't emphasize everything - pick the most impactful words
2. SHORT TEXT (≤5 words): Maybe 1 bold word only, or no emphasis
3. MEDIUM TEXT (6-12 words): 1-2 bold + maybe 1 underline or red
4. LONG TEXT (>12 words): 2-3 bold + 1 underline + maybe 1 red/circle
5. QUESTIONS: Usually no emphasis or just 1 bold word
6. CALLS TO ACTION: Bold the action verb, maybe underline the benefit
7. EMOTIONAL TEXT: Red for pain words, circle for solution/hope words

═══════════════════════════════════════════════════════════════
JSON OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════

Return ONLY valid JSON:
{
  "boldWords": ["word1", "word2"],
  "underlineWords": ["word"],
  "circleWords": [],
  "redWords": [],
  "underlineStyle": "brush-red",
  "circleStyle": "red-solid"
}

Words MUST exist exactly in the slide text (case-sensitive match).`,
      messages: [
        {
          role: 'user',
          content: `Analyze this slide and decide which words to emphasize.

SLIDE TEXT: "${slideText}"
WORD COUNT: ${slideText.split(/\s+/).length}
EMOTION: ${emotion || 'neutral'}
SCENE: ${sceneTitle || 'unknown'}
CURRENT PRESET: ${preset || 'unknown'}
${userPrompt ? `USER DIRECTION: "${userPrompt}"` : ''}

Choose words to emphasize strategically. Remember:
- Words must exist EXACTLY in the text
- Don't over-emphasize - pick only the most impactful words
- Match the emotional tone
- For short text, use minimal or no emphasis

Return JSON with your word styling decisions.`,
        },
      ],
    });

    let json = text.trim();
    if (json.startsWith('```json')) json = json.slice(7);
    else if (json.startsWith('```')) json = json.slice(3);
    if (json.endsWith('```')) json = json.slice(0, -3);
    json = json.trim();

    const decision: WordStyleDecision = JSON.parse(json);

    // Validate that words actually exist in the text
    const words = slideText.split(/\s+/).map(w => w.replace(/[.,!?;:'"()]/g, ''));
    
    const validateWords = (arr: string[]) => 
      arr.filter(w => words.some(tw => tw.toLowerCase() === w.toLowerCase() || slideText.includes(w)));

    const validated: WordStyleDecision = {
      boldWords: validateWords(decision.boldWords || []),
      underlineWords: validateWords(decision.underlineWords || []),
      circleWords: validateWords(decision.circleWords || []),
      redWords: validateWords(decision.redWords || []),
      underlineStyle: decision.underlineStyle || 'brush-red',
      circleStyle: decision.circleStyle || 'red-solid',
    };

    console.log(`[AI WORD STYLER] Decision:`, validated);

    return NextResponse.json(validated);
  } catch (error: any) {
    console.error('Style words error:', error);
    
    // Return empty styling on error
    return NextResponse.json({
      boldWords: [],
      underlineWords: [],
      circleWords: [],
      redWords: [],
      underlineStyle: 'brush-red',
      circleStyle: 'red-solid',
    });
  }
}
