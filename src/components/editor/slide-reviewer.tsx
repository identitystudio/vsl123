'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, Check, Pencil, SkipForward } from 'lucide-react';
import { SlidePreview } from './slide-preview';
import { SlideEditPanel } from './slide-edit-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateSlides } from '@/hooks/use-project';
import type { Slide, UnderlineStyle, CircleStyle } from '@/types';
import { toast } from 'sonner';

interface SlideReviewerProps {
  projectId: string;
  slides: Slide[];
  onComplete: () => void;
}

const UNDERLINE_CYCLE: UnderlineStyle[] = [
  'brush-red',
  'brush-black',
  'regular',
  'brush-stroke-red',
];

const CIRCLE_CYCLE: CircleStyle[] = ['red-solid', 'red-dotted', 'black-solid'];

type EmphasisType = 'bold' | 'underline' | 'red' | 'circle' | 'clear';

function getNextEmphasis(
  word: string,
  slide: Slide
): { type: EmphasisType; slide: Slide } {
  const isBold = slide.boldWords.includes(word);
  const isUnderlined = slide.underlineWords.includes(word);
  const isRed = slide.redWords.includes(word);
  const isCircled = slide.circleWords.includes(word);

  if (!isBold && !isUnderlined && !isRed && !isCircled) {
    return {
      type: 'bold',
      slide: { ...slide, boldWords: [...slide.boldWords, word] },
    };
  }

  if (isBold && !isUnderlined && !isRed && !isCircled) {
    return {
      type: 'underline',
      slide: {
        ...slide,
        boldWords: slide.boldWords.filter((w) => w !== word),
        underlineWords: [...slide.underlineWords, word],
        underlineStyles: { ...slide.underlineStyles, [word]: 'brush-red' },
      },
    };
  }

  if (isUnderlined) {
    const currentStyle = slide.underlineStyles[word] || 'brush-red';
    const currentIdx = UNDERLINE_CYCLE.indexOf(currentStyle);
    if (currentIdx < UNDERLINE_CYCLE.length - 1) {
      return {
        type: 'underline',
        slide: {
          ...slide,
          underlineStyles: {
            ...slide.underlineStyles,
            [word]: UNDERLINE_CYCLE[currentIdx + 1],
          },
        },
      };
    }
    return {
      type: 'red',
      slide: {
        ...slide,
        underlineWords: slide.underlineWords.filter((w) => w !== word),
        underlineStyles: (() => {
          const s = { ...slide.underlineStyles };
          delete s[word];
          return s;
        })(),
        redWords: [...slide.redWords, word],
      },
    };
  }

  if (isRed) {
    return {
      type: 'circle',
      slide: {
        ...slide,
        redWords: slide.redWords.filter((w) => w !== word),
        circleWords: [...slide.circleWords, word],
        circleStyles: { ...slide.circleStyles, [word]: 'red-solid' },
      },
    };
  }

  if (isCircled) {
    const currentStyle = slide.circleStyles[word] || 'red-solid';
    const currentIdx = CIRCLE_CYCLE.indexOf(currentStyle);
    if (currentIdx < CIRCLE_CYCLE.length - 1) {
      return {
        type: 'circle',
        slide: {
          ...slide,
          circleStyles: {
            ...slide.circleStyles,
            [word]: CIRCLE_CYCLE[currentIdx + 1],
          },
        },
      };
    }
    return {
      type: 'clear',
      slide: {
        ...slide,
        circleWords: slide.circleWords.filter((w) => w !== word),
        circleStyles: (() => {
          const s = { ...slide.circleStyles };
          delete s[word];
          return s;
        })(),
      },
    };
  }

  return { type: 'clear', slide };
}

export function SlideReviewer({
  projectId,
  slides: initialSlides,
  onComplete,
}: SlideReviewerProps) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editSlide, setEditSlide] = useState<Slide | null>(null);
  const [skipToValue, setSkipToValue] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const [applyToAllActive, setApplyToAllActive] = useState(false);
  const holdAnimRef = useRef<number>(0);
  const holdStartRef = useRef<number>(0);
  const headshotInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const updateSlides = useUpdateSlides();
  const HOLD_DURATION = 5000;

  const currentSlide = slides[currentIndex];
  const reviewedCount = slides.filter((s) => s.reviewed).length;
  const allReviewed = reviewedCount === slides.length;

  // Auto-save slides periodically
  const saveSlides = useCallback(
    async (updatedSlides: Slide[]) => {
      try {
        await updateSlides.mutateAsync({
          projectId,
          slides: updatedSlides,
        });
      } catch {
        // Silent save failure — don't interrupt the user
      }
    },
    [projectId, updateSlides]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editing) {
        if (e.key === 'Escape') {
          setEditing(false);
          setEditSlide(null);
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          handleEditSave();
        }
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleLooksGood();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleLooksGood = () => {
    const updated = [...slides];
    updated[currentIndex] = { ...updated[currentIndex], reviewed: true };
    setSlides(updated);

    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }

    // Save every 5 slides
    if ((currentIndex + 1) % 5 === 0) {
      saveSlides(updated);
    }
  };

  // Hold "Looks Good" for 5 seconds → approve all remaining slides
  const handleHoldStart = () => {
    holdStartRef.current = Date.now();
    const animate = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        handleFinish();
        return;
      }
      holdAnimRef.current = requestAnimationFrame(animate);
    };
    holdAnimRef.current = requestAnimationFrame(animate);
  };

  const handleHoldEnd = () => {
    if (holdAnimRef.current) {
      cancelAnimationFrame(holdAnimRef.current);
    }
    setHoldProgress(0);
  };

  const handleEdit = () => {
    setEditSlide({ ...currentSlide });
    setEditing(true);
  };

  const handleEditSave = (applyToAll?: boolean) => {
    if (!editSlide) return;

    if (applyToAll || applyToAllActive) {
      // Apply style to all remaining + mark everything reviewed → skip to audio
      const finalSlides = slides.map((s, i) => {
        if (i === currentIndex) return { ...editSlide, reviewed: true };
        if (i < currentIndex || s.reviewed) return s;
        return {
          ...s,
          style: { ...editSlide.style },
          hasBackgroundImage: editSlide.hasBackgroundImage,
          backgroundImage: editSlide.backgroundImage ? { ...editSlide.backgroundImage } : undefined,
          headshot: editSlide.headshot ? { ...editSlide.headshot } : undefined,
          isInfographic: editSlide.isInfographic,
          infographicVisual: editSlide.infographicVisual ? { ...editSlide.infographicVisual } : undefined,
          infographicCaptions: s.infographicCaptions || [s.fullScriptText],
          reviewed: true,
        };
      });
      setSlides(finalSlides);
      setEditing(false);
      setEditSlide(null);
      setApplyToAllActive(false);
      saveSlides(finalSlides).then(() => onComplete());
      return;
    }

    const updated = [...slides];
    updated[currentIndex] = { ...editSlide, reviewed: true };
    setSlides(updated);
    setEditing(false);
    setEditSlide(null);

    // Move to next slide
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }

    saveSlides(updated);
  };

  const handleApplyStyleToAll = () => {
    if (!editSlide) return;
    const updated = slides.map((s, i) => {
      if (i <= currentIndex || s.reviewed) return s;
      return {
        ...s,
        style: { ...editSlide.style },
        hasBackgroundImage: editSlide.hasBackgroundImage,
        backgroundImage: editSlide.backgroundImage ? { ...editSlide.backgroundImage } : undefined,
        headshot: editSlide.headshot ? { ...editSlide.headshot } : undefined,
        isInfographic: editSlide.isInfographic,
        infographicVisual: editSlide.infographicVisual ? { ...editSlide.infographicVisual } : undefined,
        infographicCaptions: s.infographicCaptions || [s.fullScriptText],
      };
    });
    setSlides(updated);
    setApplyToAllActive(true);
    toast.success('Style applied to remaining slides — save to finish review');
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setEditing(false);
      setEditSlide(null);
    }
  };

  const handleSkip = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setEditing(false);
      setEditSlide(null);
    }
  };

  const handleSkipTo = () => {
    const num = parseInt(skipToValue);
    if (num >= 1 && num <= slides.length) {
      setCurrentIndex(num - 1);
      setEditing(false);
      setEditSlide(null);
      setSkipToValue('');
    }
  };

  const handleWordClick = (word: string) => {
    const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
    if (!cleanWord) return;
    
    if (editing && editSlide) {
      const result = getNextEmphasis(cleanWord, editSlide);
      setEditSlide(result.slide);
    } else {
      const result = getNextEmphasis(cleanWord, currentSlide);
      const updated = [...slides];
      updated[currentIndex] = result.slide;
      setSlides(updated);
      
      // Also save if they click while reviewing
      saveSlides(updated);
    }
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editSlide) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setEditSlide({
        ...editSlide,
        hasBackgroundImage: true,
        backgroundImage: {
          ...(editSlide.backgroundImage || { opacity: 40, blur: 8, displayMode: 'blurred' }),
          url: dataUrl,
        },
        style: {
          ...editSlide.style,
          background: editSlide.style.background === 'split' ? 'split' : 'image',
          textColor: 'white',
        },
      });
      toast.success('Image uploaded!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFinish = async () => {
    // Mark any remaining unreviewed slides as auto-reviewed
    const finalSlides = slides.map((s) => ({
      ...s,
      reviewed: true,
    }));
    await saveSlides(finalSlides);
    onComplete();
  };

  // All slides reviewed screen
  if (allReviewed || currentIndex >= slides.length) {
    const manualCount = slides.filter((s) => s.reviewed).length;
    const aiCount = 0; // Will be populated when AI styling is implemented

    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-gray-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">All slides reviewed!</h2>
        <p className="text-gray-500 mb-2">{slides.length} slides ready</p>
        <div className="flex gap-4 text-sm text-gray-400 mb-8">
          <span>&bull; {manualCount} styled by you</span>
          {aiCount > 0 && <span>&#x2728; {aiCount} styled by AI</span>}
        </div>
        <Button
          onClick={handleFinish}
          size="lg"
          className="bg-black text-white hover:bg-gray-800 text-lg px-8 py-6"
        >
          Continue to Audio &rarr;
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Slide counter */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">
          Slide {currentIndex + 1} of {slides.length}
        </span>
        <span className="text-sm text-gray-400">
          {Math.round((reviewedCount / slides.length) * 100)}% reviewed
        </span>
      </div>

      {/* Hidden file input for background image upload via double-click */}
      <input
        ref={bgImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBgImageUpload}
      />

      {/* Slide preview */}
      <div className="flex justify-center mb-6">
        <SlidePreview
          slide={editing && editSlide ? editSlide : currentSlide}
          onHeadshotClick={
            editing && editSlide?.headshot
              ? () => headshotInputRef.current?.click()
              : undefined
          }
          onSplitImageDrag={
            editing && editSlide && (editSlide.style.background === 'split' || editSlide.backgroundImage?.displayMode === 'split')
              ? (newPosY) => setEditSlide({
                  ...editSlide,
                  backgroundImage: {
                    ...editSlide.backgroundImage!,
                    imagePositionY: newPosY,
                  },
                })
              : undefined
          }
          onImageDoubleClick={
            editing && editSlide?.hasBackgroundImage
              ? () => bgImageInputRef.current?.click()
              : undefined
          }
          onWordClick={handleWordClick}
        />
      </div>

      {/* Action buttons (when not editing) */}
      {!editing && (
        <div className="flex justify-center gap-3 mb-8">
          <Button
            variant="outline"
            onClick={handleEdit}
            className="gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit Slide
          </Button>
          <Button
            onClick={handleLooksGood}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            className="bg-black text-white hover:bg-gray-800 gap-2 relative overflow-hidden min-w-[160px]"
          >
            {holdProgress > 0 && (
              <div
                className="absolute inset-0 bg-green-500/40 transition-none"
                style={{ width: `${holdProgress}%` }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Check className="w-4 h-4" />
              {holdProgress > 0
                ? `Approve all... ${Math.ceil((HOLD_DURATION - (holdProgress / 100) * HOLD_DURATION) / 1000)}s`
                : 'Looks Good'}
            </span>
          </Button>
        </div>
      )}

      {/* Edit panel */}
      {editing && editSlide && (
        <div className="mb-8">
          <SlideEditPanel
            slide={editSlide}
            onUpdate={setEditSlide}
            onSave={handleEditSave}
            onCancel={() => {
              setEditing(false);
              setEditSlide(null);
            }}
            onApplyToAll={handleApplyStyleToAll}
            headshotInputRef={headshotInputRef}
            allSlides={slides}
            currentIndex={currentIndex}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Skip to:</span>
          <Input
            value={skipToValue}
            onChange={(e) => setSkipToValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSkipTo()}
            className="w-16 h-8 text-center text-sm"
            placeholder={String(currentIndex + 1)}
          />
        </div>

        <button
          onClick={handleSkip}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black"
        >
          Skip
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
