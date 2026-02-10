'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateProject } from '@/hooks/use-project';
import type { Slide, SlideStyle, TextSegment, BackgroundImage, InfographicVisual } from '@/types';
import { toast } from 'sonner';

interface ScriptInputProps {
  projectId: string;
  initialScript: string;
  onSlidesGenerated: (slides: Slide[]) => void;
}

// Magical rotating messages — Blair Warren inspired
const MAGIC_MESSAGES = [
  // Encourage their dreams
  { text: 'Your vision is about to come to life...', emoji: '✨' },
  { text: 'This is the funnel you always knew you could build.', emoji: '🚀' },
  { text: 'While others are still stuck in templates, you\'re creating magic.', emoji: '🪄' },
  { text: 'Your message deserves to be seen. We\'re making sure it will be.', emoji: '💎' },
  { text: 'Imagine your audience watching this, slide by slide, unable to look away.', emoji: '🎯' },

  // Confirm their suspicions
  { text: 'You were right — VSLs shouldn\'t take weeks to produce.', emoji: '⚡' },
  { text: 'It was never about the tools. It was about finding the right one.', emoji: '🔑' },
  { text: 'Every hour you spent struggling with other editors led you here.', emoji: '🛤️' },
  { text: 'You always knew there had to be a faster way. There is.', emoji: '💡' },

  // Allay their fears
  { text: 'No design degree needed. Your words are doing the heavy lifting.', emoji: '🎨' },
  { text: 'Every slide is being crafted with intention. Nothing random.', emoji: '🧠' },
  { text: 'Relax. We\'ve got your script — the hard part is already done.', emoji: '☕' },
  { text: 'Your audience won\'t see a "template." They\'ll see authority.', emoji: '👑' },

  // Throw rocks at enemies
  { text: 'No more $5K agency invoices for a simple slide deck.', emoji: '🔥' },
  { text: 'Freelancers who take 3 weeks? You\'re doing it in 3 minutes.', emoji: '⏱️' },
  { text: 'While your competitors fumble with Canva, you\'re already launching.', emoji: '🏁' },

  // Give them their time back
  { text: 'Think of what you\'ll do with all that time you just got back...', emoji: '🎸' },
  { text: 'After this? Maybe that guitar lesson. Or a walk with the kids.', emoji: '🌅' },
  { text: 'The painting, the traveling, the living — it starts after this click.', emoji: '🎨' },
  { text: 'This is the part where you get your weekends back.', emoji: '🌴' },

  // Hype / it's happening
  { text: 'Every word in your script is being turned into a conversion machine.', emoji: '⚙️' },
  { text: 'Your VSL is being assembled right now. This is really happening.', emoji: '🎬' },
  { text: 'Scene by scene. Slide by slide. Your funnel is being born.', emoji: '🌟' },
  { text: 'Almost there... your future audience has no idea what\'s coming.', emoji: '🔮' },
];

function createSlideFromText(
  text: string,
  hasImage: boolean,
  imageKeyword?: string,
  sceneNumber?: number,
  sceneTitle?: string,
  emotion?: string
): Slide {
  const words = text.split(/\s+/);
  const wordCount = words.length;

  // Auto-size text based on word count (default 120px for short slides)
  let textSize = 120;
  if (wordCount <= 3) textSize = 120;
  else if (wordCount <= 6) textSize = 120;
  else if (wordCount <= 10) textSize = 96;
  else if (wordCount <= 15) textSize = 72;
  else textSize = 60;

  const segments: TextSegment[] = words.map((word) => ({
    text: word,
    emphasis: 'none' as const,
  }));

  const style: SlideStyle = {
    background: 'white',
    textColor: 'black',
    textSize,
    textWeight: 'bold',
  };

  return {
    id: crypto.randomUUID(),
    fullScriptText: text,
    segments,
    style,
    boldWords: [],
    underlineWords: [],
    circleWords: [],
    redWords: [],
    underlineStyles: {},
    circleStyles: {},
    hasBackgroundImage: false,
    backgroundImage: undefined,
    sceneNumber,
    sceneTitle,
    emotion,
    imageKeyword,
    reviewed: false,
  };
}

interface ConfettiPiece {
  id: number;
  x: number;       // % from left edge of bar
  color: string;
  size: number;
  angle: number;    // degrees rotation
  dx: number;       // horizontal drift
  dy: number;       // vertical launch speed
  opacity: number;
  shape: 'circle' | 'square' | 'star';
}

let confettiIdCounter = 0;

function MagicProgress({ progress }: { progress: number }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const shuffledRef = useRef<typeof MAGIC_MESSAGES>([]);
  const [displayProgress, setDisplayProgress] = useState(progress);
  const targetRef = useRef(progress);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const prevProgressRef = useRef(progress);

  // Shuffle messages once on mount
  useEffect(() => {
    shuffledRef.current = [...MAGIC_MESSAGES].sort(() => Math.random() - 0.5);
  }, []);

  // Rotate messages every 5.5 seconds with fade
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % MAGIC_MESSAGES.length);
        setFade(true);
      }, 400);
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  // Spawn confetti helper
  const spawnConfetti = useCallback((atProgress: number, count: number) => {
    const goldSilverColors = [
      '#FFD700', '#FFC107', '#FFDF00', '#F5D300', // golds
      '#C0C0C0', '#D4D4D4', '#B8B8B8', '#E8E8E8', // silvers
    ];
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < count; i++) {
      pieces.push({
        id: ++confettiIdCounter,
        x: Math.max(5, Math.min(95, atProgress - 5 + Math.random() * 10)),
        color: goldSilverColors[Math.floor(Math.random() * goldSilverColors.length)],
        size: 4 + Math.random() * 6,
        angle: Math.random() * 360,
        dx: (Math.random() - 0.5) * 120,
        dy: -(40 + Math.random() * 80),
        opacity: 1,
        shape: (['circle', 'square', 'star'] as const)[Math.floor(Math.random() * 3)],
      });
    }
    setConfetti((prev) => [...prev, ...pieces]);
    setTimeout(() => {
      setConfetti((prev) =>
        prev.filter((p) => !pieces.some((np) => np.id === p.id))
      );
    }, 1800);
  }, []);

  // Update target when real progress changes + spawn confetti on jumps
  useEffect(() => {
    const jump = progress - prevProgressRef.current;
    targetRef.current = progress;
    prevProgressRef.current = progress;

    // Big confetti burst on jumps >= 8%
    if (jump >= 8) {
      const count = Math.min(Math.floor(jump * 2), 40);
      spawnConfetti(progress, count);
    }
  }, [progress, spawnConfetti]);

  // Periodic mini-confetti every 4 seconds to keep it celebratory
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayProgress((current) => {
        if (current > 5 && current < 95) {
          spawnConfetti(current, 6 + Math.floor(Math.random() * 6));
        }
        return current; // don't change progress here
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [spawnConfetti]);

  // Constant micro-movement: creep toward target, capped to never go far ahead
  useEffect(() => {
    const tick = setInterval(() => {
      setDisplayProgress((current) => {
        const target = targetRef.current;
        const gap = target - current;

        // Cap: never creep more than 4% ahead of the real target
        const maxCreep = target + 4;
        if (current >= maxCreep) {
          return current; // hold here, don't go further
        }

        if (gap <= 0.05) {
          // Creep slowly past target (up to cap)
          if (current < maxCreep && current < 96) {
            return current + 0.03 + Math.random() * 0.04;
          }
          return current;
        }

        // Close gap smoothly — faster when gap is big, slower when small
        const step = Math.max(0.1, gap * 0.08 + Math.random() * 0.15);
        return Math.min(current + step, target);
      });
    }, 80);
    return () => clearInterval(tick);
  }, []);

  const msg = shuffledRef.current[msgIndex] || MAGIC_MESSAGES[msgIndex];

  return (
    <div className="w-full space-y-5">
      {/* Neon green progress bar with confetti */}
      <div className="relative w-full h-3.5 bg-gray-100 rounded-full overflow-visible">
        {/* The bar itself */}
        <div className="relative w-full h-full rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${displayProgress}%`,
              background: 'linear-gradient(90deg, #00e676 0%, #69f0ae 30%, #00e676 50%, #76ff03 70%, #00e676 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s linear infinite',
              boxShadow: '0 0 12px rgba(0, 230, 118, 0.5), 0 0 4px rgba(0, 230, 118, 0.3)',
              transition: 'width 0.08s linear',
            }}
          />
        </div>

        {/* Confetti particles */}
        {confetti.map((piece) => (
          <div
            key={piece.id}
            className="absolute pointer-events-none"
            style={{
              left: `${piece.x}%`,
              top: '50%',
              animation: `confetti-fly 1.6s ease-out forwards`,
              '--dx': `${piece.dx}px`,
              '--dy': `${piece.dy}px`,
            } as React.CSSProperties}
          >
            {piece.shape === 'star' ? (
              <svg
                width={piece.size}
                height={piece.size}
                viewBox="0 0 10 10"
                style={{ transform: `rotate(${piece.angle}deg)` }}
              >
                <polygon
                  points="5,0 6.2,3.5 10,3.5 7,5.8 8,10 5,7.5 2,10 3,5.8 0,3.5 3.8,3.5"
                  fill={piece.color}
                />
              </svg>
            ) : (
              <div
                style={{
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  borderRadius: piece.shape === 'circle' ? '50%' : '2px',
                  transform: `rotate(${piece.angle}deg)`,
                }}
              />
            )}
          </div>
        ))}

        {/* Glow dot at the tip */}
        {displayProgress > 2 && displayProgress < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
            style={{
              left: `calc(${displayProgress}% - 4px)`,
              backgroundColor: '#b9f6ca',
              boxShadow: '0 0 8px rgba(0, 230, 118, 0.8), 0 0 16px rgba(0, 230, 118, 0.4)',
              animation: 'pulse-glow 1.2s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Rotating message */}
      <div className="text-center min-h-[64px] flex items-center justify-center">
        <p
          className="text-lg text-gray-600 transition-opacity duration-400 max-w-lg leading-relaxed"
          style={{ opacity: fade ? 1 : 0 }}
        >
          <span className="mr-2 text-xl">{msg.emoji}</span>
          <span className="italic">{msg.text}</span>
        </p>
      </div>

      {/* Step indicator with labels - only Paste is active since we're on step 1 */}
      <div className="flex justify-center gap-6">
        {[
          { step: 1, label: 'Paste' },
          { step: 2, label: 'Edit' },
          { step: 3, label: 'Voice' },
          { step: 4, label: 'Export' },
        ].map(({ step, label }) => (
          <div key={step} className="flex flex-col items-center gap-1">
            <div
              className={`w-12 h-1.5 rounded-full transition-all duration-500 ${
                step === 1 ? 'bg-black' : 'bg-gray-200'
              }`}
            />
            <span
              className={`text-xs transition-colors duration-300 ${
                step === 1 ? 'text-gray-700 font-medium' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; transform: translateY(-50%) scale(1); }
          50% { opacity: 1; transform: translateY(-50%) scale(1.4); }
        }
        @keyframes confetti-fly {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          30% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0.3);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export function ScriptInput({
  projectId,
  initialScript,
  onSlidesGenerated,
}: ScriptInputProps) {
  const [script, setScript] = useState(initialScript);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const updateProject = useUpdateProject();

  const handleGenerate = async () => {
    if (!script.trim()) {
      toast.error('Please paste your VSL script first');
      return;
    }

    setGenerating(true);
    setProgress(5);

    try {
      // Save script to project
      await updateProject.mutateAsync({
        projectId,
        updates: { original_script: script },
      });

      setProgress(10);

      // Step 1: Split script into slides
      const splitResponse = await fetch('/api/split-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });

      if (!splitResponse.ok) {
        const errBody = await splitResponse.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to split script');
      }

      const splitData = await splitResponse.json();

      if (splitData.error) {
        throw new Error(splitData.error);
      }

      if (!splitData.scenes || splitData.scenes.length === 0) {
        throw new Error('No slides were generated');
      }

      setProgress(25);

      // Create initial slides from AI response
      const slides: Slide[] = [];
      for (const scene of splitData.scenes) {
        for (const slideData of scene.slides) {
          slides.push(
            createSlideFromText(
              slideData.fullScriptText,
              slideData.hasImage,
              slideData.imageKeyword,
              scene.sceneNumber,
              scene.title,
              scene.emotion
            )
          );
        }
      }

      setProgress(35);

      // Step 2: AI Style Director - style all slides at once
      const styleResponse = await fetch('/api/style-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: slides.map((s) => ({
            id: s.id,
            fullScriptText: s.fullScriptText,
            sceneNumber: s.sceneNumber,
            sceneTitle: s.sceneTitle,
            emotion: s.emotion,
            hasImage: s.hasBackgroundImage,
            imageKeyword: s.imageKeyword,
          })),
        }),
      });

      let styleData: { styles: Array<{
        slideId: string;
        preset: string;
        displayMode?: string;
        crispness?: number;
        textColor: string;
        boldWords: string[];
        underlineWords: string[];
        circleWords: string[];
        redWords: string[];
        isInfographic: boolean;
        infographicAbsorbCount?: number;
        isHeadshot: boolean;
      }> } = { styles: [] };

      if (styleResponse.ok) {
        styleData = await styleResponse.json();
      }

      setProgress(50);

      // Apply styles to slides
      const styledSlides = slides.map((slide) => {
        const styleDecision = styleData.styles?.find((s) => s.slideId === slide.id);
        if (!styleDecision) return slide;

        const updatedSlide = { ...slide };

        // Apply word emphasis
        updatedSlide.boldWords = styleDecision.boldWords || [];
        updatedSlide.underlineWords = styleDecision.underlineWords || [];
        updatedSlide.circleWords = styleDecision.circleWords || [];
        updatedSlide.redWords = styleDecision.redWords || [];

        // Set underline styles (default to brush-red)
        updatedSlide.underlineStyles = {};
        for (const word of updatedSlide.underlineWords) {
          updatedSlide.underlineStyles[word] = 'brush-red';
        }

        // Set circle styles (default to red-solid)
        updatedSlide.circleStyles = {};
        for (const word of updatedSlide.circleWords) {
          updatedSlide.circleStyles[word] = 'red-solid';
        }

        // Apply preset styles
        switch (styleDecision.preset) {
          case 'black-background':
            updatedSlide.style = {
              ...updatedSlide.style,
              background: 'dark',
              textColor: 'white',
            };
            break;
          case 'white-background':
            updatedSlide.style = {
              ...updatedSlide.style,
              background: 'white',
              textColor: 'black',
            };
            break;
          case 'headshot-bio':
            updatedSlide.style = {
              ...updatedSlide.style,
              background: 'white',
              textColor: 'black',
            };
            updatedSlide.headshot = {}; // Empty headshot, user will upload
            break;
          case 'image-backdrop':
            updatedSlide.style = {
              ...updatedSlide.style,
              background: 'image',
              textColor: styleDecision.textColor === 'black' ? 'black' : 'white',
            };
            updatedSlide.hasBackgroundImage = true;
            updatedSlide.backgroundImage = {
              url: '',
              opacity: styleDecision.crispness || 40,
              blur: 8,
              displayMode: (styleDecision.displayMode as 'blurred' | 'crisp') || 'blurred',
            };
            break;
          case 'image-text':
            updatedSlide.style = {
              ...updatedSlide.style,
              background: 'split',
              textColor: 'black',
              splitRatio: 50,
            };
            updatedSlide.hasBackgroundImage = true;
            updatedSlide.backgroundImage = {
              url: '',
              opacity: 100,
              blur: 0,
              displayMode: 'split',
              imagePositionY: 35,
            };
            break;
          case 'infographic':
            updatedSlide.style = {
              ...updatedSlide.style,
              background: 'gradient',
              textColor: 'white',
              gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              gradientName: 'purple',
            };
            updatedSlide.isInfographic = true;
            break;
        }

        // Handle headshot flag
        if (styleDecision.isHeadshot && styleDecision.preset !== 'headshot-bio') {
          updatedSlide.headshot = {};
        }

        return updatedSlide;
      });

      setProgress(60);

      // Step 3: Fetch images for slides that need them
      const slidesNeedingImages = styledSlides.filter(
        (s) => s.hasBackgroundImage && !s.backgroundImage?.url && s.imageKeyword
      );

      // Fetch images in parallel (max 5 at a time)
      for (let i = 0; i < slidesNeedingImages.length; i += 5) {
        const batch = slidesNeedingImages.slice(i, i + 5);
        const imagePromises = batch.map(async (slide) => {
          try {
            const imgResponse = await fetch('/api/pexels-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: slide.imageKeyword, perPage: 1 }),
            });
            if (imgResponse.ok) {
              const imgData = await imgResponse.json();
              if (imgData.photos?.[0]?.url) {
                return { slideId: slide.id, url: imgData.photos[0].url };
              }
            }
            return null;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(imagePromises);

        // Apply fetched images
        for (const result of results) {
          if (result) {
            const slideIndex = styledSlides.findIndex((s) => s.id === result.slideId);
            if (slideIndex !== -1 && styledSlides[slideIndex].backgroundImage) {
              styledSlides[slideIndex].backgroundImage = {
                ...styledSlides[slideIndex].backgroundImage!,
                url: result.url,
              };
            }
          }
        }

        // Update progress based on image fetching
        const imageProgress = Math.min(85, 60 + (i / slidesNeedingImages.length) * 25);
        setProgress(imageProgress);
      }

      setProgress(88);

      // Step 4: Fetch infographic visuals for infographic slides
      const infographicSlides = styledSlides.filter((s) => s.isInfographic);
      for (const slide of infographicSlides) {
        try {
          const visualResponse = await fetch('/api/infographic-visual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: slide.fullScriptText,
              emotion: slide.emotion,
              context: slide.sceneTitle,
            }),
          });

          if (visualResponse.ok) {
            const visualData = await visualResponse.json();
            const slideIndex = styledSlides.findIndex((s) => s.id === slide.id);
            if (slideIndex !== -1) {
              styledSlides[slideIndex].infographicVisual = {
                type: visualData.type || 'emoji',
                value: visualData.value || '💡',
              } as InfographicVisual;
              styledSlides[slideIndex].infographicCaptions = [slide.fullScriptText];
            }
          }
        } catch {
          // Continue without visual on error
        }
      }

      setProgress(95);

      // Small delay for final message
      await new Promise((r) => setTimeout(r, 600));
      setProgress(100);

      const imageCount = styledSlides.filter((s) => s.backgroundImage?.url).length;
      const infographicCount = styledSlides.filter((s) => s.isInfographic).length;

      toast.success(
        `${styledSlides.length} slides styled with ${imageCount} images${infographicCount > 0 ? ` and ${infographicCount} infographics` : ''}. Magic complete!`
      );
      onSlidesGenerated(styledSlides);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to generate slides: ${msg}`);
      console.error('Slide generation error:', err);
      setGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex flex-col items-center gap-6">
        {/* Icon */}
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
          <FileText className="w-7 h-7 text-gray-600" />
        </div>

        <h1 className="text-3xl font-bold">Paste Your VSL Script.</h1>

        {/* Script textarea */}
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Paste your VSL script here...  Example: You watched your mom struggle to read the medicine bottle. Your dad couldn't recognize faces anymore. It broke your heart to see them lose their independence.  But here's what most people don't know about vision loss..."
          className="max-h-[40vh] text-base border-2 border-gray-200 focus:border-black rounded-xl p-4 resize-none overflow-y-auto"
          disabled={generating}
        />

        {/* Generate button or magical progress */}
        {generating ? (
          <MagicProgress progress={progress} />
        ) : (
          <Button
            onClick={handleGenerate}
            size="lg"
            className="w-full text-lg py-6 bg-black text-white hover:bg-gray-800 rounded-xl gap-2"
            disabled={!script.trim()}
          >
            <Sparkles className="w-5 h-5" />
            Generate Slides &rarr;
          </Button>
        )}

        {!generating && (
          <p className="text-sm text-gray-400 text-center">
            Text-first VSL: Only 30-40% of slides get subtle background images
          </p>
        )}
      </div>
    </div>
  );
}
