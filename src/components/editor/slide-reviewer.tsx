'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Check, Pencil, SkipForward, Sparkles, X } from 'lucide-react';
import { SlidePreview } from './slide-preview';
import { SlideEditPanel } from './slide-edit-panel';
import { InfographicsPanel } from './editor-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateSingleSlide } from '@/hooks/use-project';
import type { Slide, UnderlineStyle, CircleStyle } from '@/types';
import { toast } from 'sonner';

interface SlideReviewerProps {
  projectId: string;
  slides: Slide[];
  onComplete: () => void;
  forceShowSlides?: boolean;
  initialIndex?: number;
  autoEdit?: boolean;
  onIndexChange?: (index: number) => void;
  onEditingChange?: (isEditing: boolean) => void;
  savedInfographicImages?: any[];
  savedInfographicPrompt?: string;
  savedInfographicVideos?: Record<string, { uri: string; data?: string }>;
  onToggleEmotionalBeats?: () => void;
  showEmotionalBeats?: boolean;
  onTogglePreview?: () => void;
  showPreviewAll?: boolean;
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
  forceShowSlides,
  initialIndex = 0,
  autoEdit = false,
  onIndexChange,
  onEditingChange,
  savedInfographicImages,
  savedInfographicPrompt,
  savedInfographicVideos,
  onToggleEmotionalBeats,
  showEmotionalBeats,
  onTogglePreview,
  showPreviewAll,
}: SlideReviewerProps) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    onIndexChange?.(currentIndex);
  }, [currentIndex, onIndexChange]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);
  const [editSlide, setEditSlide] = useState<Slide | null>(null);
  const [skipToValue, setSkipToValue] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const [applyToAllActive, setApplyToAllActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const holdAnimRef = useRef<number>(0);
  const holdStartRef = useRef<number>(0);
  const headshotInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const overviewStripRef = useRef<HTMLDivElement>(null);
  const overviewItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const updateSingleSlide = useUpdateSingleSlide();
  const queryClient = useQueryClient();
  const HOLD_DURATION = 1000;
  const [showInfographics, setShowInfographics] = useState(false);

  const syncProjectSlides = useCallback(
    (updatedSlides: Slide[]) => {
      queryClient.setQueryData(['project', projectId], (old: any) => {
        if (!old) return old;
        return { ...old, slides: updatedSlides };
      });
    },
    [projectId, queryClient]
  );

  // Use a ref for slides to avoid stale closures in hold animation
  const slidesRef = useRef(slides);
  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  // Sync local state with props to ensure we have the latest IDs (especially after regeneration)
  useEffect(() => {
    setSlides(initialSlides);

    // If we are currently editing a slide, and that slide has been updated externally (e.g. via Emotional Beats),
    // we need to merge those changes into our local edit state without overwriting text changes.
    if (editing && editSlide) {
      const updatedSlide = initialSlides.find((s) => s.id === editSlide.id);
      if (updatedSlide) {
        // Check for background/visual changes specifically
        const hasVisualChanges = 
          updatedSlide.backgroundVideoUrl !== editSlide.backgroundVideoUrl ||
          updatedSlide.backgroundImage?.url !== editSlide.backgroundImage?.url ||
          updatedSlide.style.background !== editSlide.style.background ||
          updatedSlide.style.textColor !== editSlide.style.textColor ||
          updatedSlide.talkingHeadVideoUrl !== editSlide.talkingHeadVideoUrl;

        if (hasVisualChanges) {
          setEditSlide((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              hasBackgroundImage: updatedSlide.hasBackgroundImage,
              backgroundImage: updatedSlide.backgroundImage,
              backgroundVideoUrl: updatedSlide.backgroundVideoUrl,
              talkingHeadImage: updatedSlide.talkingHeadImage,
              talkingHeadVideoUrl: updatedSlide.talkingHeadVideoUrl,
              style: {
                ...prev.style, // Keep existing style props like textSize
                background: updatedSlide.style.background,
                textColor: updatedSlide.style.textColor,
              },
            };
          });
        }
      }
    }
  }, [initialSlides, editing]); // removed editSlide from deps to avoid infinite loop if we were deep comparing

  const preventAutoEditRef = useRef(false);

  // Sync current index when navigating from emotional beats sidebar
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Auto-open editing if jumped to a slide
  // NOTE: Don't include 'slides' in deps - it causes re-opening when slides update
  // Use slidesRef to get current slides without triggering effect
  useEffect(() => {
    if (autoEdit) {
      if (preventAutoEditRef.current) {
        preventAutoEditRef.current = false;
        return;
      }
      setEditing(true);
      setEditSlide({ ...slidesRef.current[currentIndex] });
    }
  }, [autoEdit, currentIndex]);

  const currentSlide = slides[currentIndex];
  const reviewedCount = slides.filter((s) => s.reviewed).length;
  const allReviewed = reviewedCount === slides.length;

  // Save a single slide to the DB
  const saveSingleSlide = useCallback(
    async (slide: Slide) => {
      try {
        await updateSingleSlide.mutateAsync({
          slideId: slide.id,
          updates: slide,
        });
      } catch {
        // Silent save failure — don't interrupt the user
      }
    },
    [updateSingleSlide]
  );

  // Bulk save (for apply to all) - use individual slide updates to preserve audio data
  const saveBulkSlides = useCallback(
    async (updatedSlides: Slide[]) => {
      try {
        // Use parallel updateSingleSlide for each slide instead of delete-all-then-insert
        // This prevents accidental data loss of audio/other fields
        await Promise.all(
          updatedSlides.map((slide) =>
            updateSingleSlide.mutateAsync({
              slideId: slide.id,
              updates: slide,
            })
          )
        );
      } catch {
        toast.error('Failed to save slides');
      }
    },
    [updateSingleSlide]
  );

  const longPressTriggeredRef = useRef(false);

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
    if (longPressTriggeredRef.current) return;
    
    const slideToSave = { ...slides[currentIndex], reviewed: true };
    const updated = [...slides];
    updated[currentIndex] = slideToSave;
    setSlides(updated);
    syncProjectSlides(updated);

    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setViewingSlidesAnyway(false);
    }

    // Save this specific slide immediately
    saveSingleSlide(slideToSave);
  };

  // Hold "Looks Good" for 5 seconds → approve all remaining slides
  const handleHoldStart = () => {
    longPressTriggeredRef.current = false;
    holdStartRef.current = Date.now();
    const animate = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        longPressTriggeredRef.current = true;
        handleApproveAllRemaining();
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

  const handleEditSave = async (applyToAll?: boolean) => {
    if (!editSlide) return;

    setIsSaving(true);
    try {
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
        syncProjectSlides(finalSlides);
        await saveBulkSlides(finalSlides);
        setEditing(false);
        setEditSlide(null);
        setApplyToAllActive(false);
        return;
      }

      const slideToSave = { ...editSlide, reviewed: true };
      
      // Check if this is the last slide BEFORE filtering
      const isLastSlide = currentIndex >= slides.length - 1;
      // Filter out any slides that were absorbed into this one
      const absorbedIds = new Set(editSlide.absorbedSlideIds || []);
      let updated = slides.map((s, i) => (i === currentIndex ? slideToSave : s));
      
      if (absorbedIds.size > 0) {
        updated = updated.filter((s) => s.id === editSlide.id || !absorbedIds.has(s.id));
        await saveBulkSlides(updated);
      } else {
        await saveSingleSlide(slideToSave);
      }

      setSlides(updated);
      syncProjectSlides(updated);

      // Move to next slide and keep editing, or close if done
      if (!isLastSlide && currentIndex < updated.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setEditing(true);
        setEditSlide({ ...updated[nextIndex] });
      } else {
        // Last slide - close editor (same as clicking Cancel)
        setEditing(false);
        setEditSlide(null);
      }
    } finally {
      setIsSaving(false);
    }
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
    syncProjectSlides(updated);
    setApplyToAllActive(true);
    toast.success('Style applied to remaining slides — save to finish review');
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      if (editing && editSlide) {
        // Save current slide before navigating
        const slideToSave = { ...editSlide, reviewed: true };
        const updated = [...slides];
        updated[currentIndex] = slideToSave;
        setSlides(updated);
        syncProjectSlides(updated);
        saveSingleSlide(slideToSave);
        // Move to previous slide and keep editing
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);
        setEditSlide({ ...updated[prevIndex] });
      } else {
        preventAutoEditRef.current = true;
        setCurrentIndex(currentIndex - 1);
        setEditing(false);
        setEditSlide(null);
      }
    }
  };

  const handleSkip = () => {
    if (currentIndex < slides.length - 1) {
      preventAutoEditRef.current = true;
      setCurrentIndex(currentIndex + 1);
      setEditing(false);
      setEditSlide(null);
    }
  };

  const handleSkipTo = () => {
    const num = parseInt(skipToValue);
    if (num >= 1 && num <= slides.length) {
      preventAutoEditRef.current = true;
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
      syncProjectSlides(updated);
      
      // Save this slide (without changing reviewed status)
      saveSingleSlide(result.slide);
    }
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editSlide) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const uploadToast = toast.loading('Uploading image...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'vsl123-backgrounds');

      const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      setEditSlide({
        ...editSlide,
        hasBackgroundImage: true,
        backgroundImage: {
          ...(editSlide.backgroundImage || { opacity: 40, blur: 8, displayMode: 'blurred' }),
          url: data.url,
        },
        style: {
          ...editSlide.style,
          background: editSlide.style.background === 'split' ? 'split' : 'image',
          textColor: 'white',
        },
      });
      toast.success('Image uploaded!', { id: uploadToast });
    } catch (err: any) {
      toast.error(err.message || 'Background upload failed. Please check Cloudinary configuration.', { id: uploadToast });
    }
    e.target.value = '';
  };

  const handleApproveAllRemaining = async () => {
    // 1. Prepare updated slides from the Ref to avoid stale closure
    const finalSlides = slidesRef.current.map((s) => ({
      ...s,
      reviewed: true,
    }));

    // 2. Update UI IMMEDIATELY to trigger the completion screen
    setSlides(finalSlides);
    syncProjectSlides(finalSlides);
    setHoldProgress(0);
    setViewingSlidesAnyway(false);
    setForceViewActive(false);

    // 3. Sync with DB in the background
    saveBulkSlides(finalSlides);
  };

  const handleComplete = async () => {
    onComplete();
  };

  const [showCompletionForce, setShowCompletionForce] = useState(false);
  const [viewingSlidesAnyway, setViewingSlidesAnyway] = useState(false);
  const [forceViewActive, setForceViewActive] = useState(!!forceShowSlides);

  useEffect(() => {
    if (!editing) return;
    const activeSlideId = slides[currentIndex]?.id;
    if (!activeSlideId) return;

    const container = overviewStripRef.current;
    const activeEl = overviewItemRefs.current[activeSlideId];
    if (!container || !activeEl) return;

    const elementLeft = activeEl.offsetLeft;
    const elementRight = elementLeft + activeEl.offsetWidth;
    const viewportLeft = container.scrollLeft;
    const viewportRight = viewportLeft + container.clientWidth;

    if (elementLeft < viewportLeft || elementRight > viewportRight) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex, slides, editing]);

  // Sync forceShowSlides prop into local state
  useEffect(() => {
    if (forceShowSlides) {
      setForceViewActive(true);
    }
  }, [forceShowSlides]);

  // All slides reviewed screen
  if ((allReviewed || currentIndex >= slides.length) && !editing && !viewingSlidesAnyway && !forceViewActive) {
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
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={handleComplete}
            size="lg"
            className="bg-black text-white hover:bg-gray-800 text-lg px-8 py-6 w-full"
          >
            Continue to Audio &rarr;
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setViewingSlidesAnyway(true);
              setCurrentIndex(0); // Go back to start
            }}
            className="text-gray-400 hover:text-black"
          >
            Review & Edit Slides
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={editing ? 'w-full h-full p-0' : (showInfographics ? 'max-w-7xl mx-auto px-4 py-8' : 'max-w-6xl mx-auto px-4 py-8')}>
      {/* Slide counter */}
      {!editing && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">
            Slide {currentIndex + 1} of {slides.length}
          </span>
          <span className="text-sm text-gray-400">
            {Math.round((reviewedCount / slides.length) * 100)}% reviewed
          </span>
        </div>
      )}

      {/* Hidden file input for background image upload via double-click */}
      <input
        ref={bgImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBgImageUpload}
      />

      {/* Slide preview (review mode) */}
      {!editing && (
        <div className="flex justify-center mb-6">
          <SlidePreview
            slide={currentSlide}
            onWordClick={handleWordClick}
          />
        </div>
      )}

      {/* Action buttons (when not editing) */}
      {!editing && (
        <div className="flex justify-center items-start gap-3 mb-8">
          <Button
            variant="outline"
            onClick={handleEdit}
            className="gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit Slide
          </Button>
          <div className="flex flex-col items-center gap-1.5">
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
            <p className="text-[10px] text-gray-400 font-medium tracking-tight">
              press & hold to approve all
            </p>
          </div>
        </div>
      )}

      {/* Navigation — always visible */}
      {!editing && (
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
      )}

      {/* Edit layout: Canva-style left sidebar + preview workspace */}
      {editing && editSlide && (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-0 h-[calc(100vh-56px)]">
          <div className="bg-white border-r border-gray-200 h-full overflow-y-auto p-3 xl:p-4">
            {/* Infographics toggle button */}
            {!showInfographics && (
              <button
                onClick={() => setShowInfographics(true)}
                className="mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-700 text-xs font-medium hover:from-purple-100 hover:to-indigo-100 transition-all hover:shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Open Infographics
              </button>
            )}

            {/* Infographics Panel in sidebar */}
            <InfographicsPanel
              projectId={projectId}
              open={showInfographics}
              onClose={() => setShowInfographics(false)}
              savedImages={savedInfographicImages}
              savedPrompt={savedInfographicPrompt}
              savedVideos={savedInfographicVideos}
              onApplyToSlide={(imageUrl) => {
                if (editSlide) {
                  setEditSlide({
                    ...editSlide,
                    hasBackgroundImage: true,
                    backgroundImage: {
                      url: imageUrl,
                      opacity: 100,
                      blur: 0,
                      displayMode: 'crisp',
                    },
                    style: {
                      ...editSlide.style,
                      background: 'image',
                    },
                  });
                  toast.success('Image applied to slide');
                }
              }}
              onApplyVideoToSlide={(videoUrl) => {
                if (editSlide) {
                  setEditSlide({
                    ...editSlide,
                    backgroundVideoUrl: videoUrl,
                  });
                  toast.success('Video applied to slide');
                }
              }}
            />

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
              totalSlides={slides.length}
              canGoPrevious={currentIndex > 0}
              onPrevious={handlePrevious}
              onSkip={handleSkip}
              onSkipTo={(index) => {
                if (editSlide) {
                  const slideToSave = { ...editSlide, reviewed: true };
                  const updated = [...slides];
                  updated[currentIndex] = slideToSave;
                  setSlides(updated);
                  syncProjectSlides(updated);
                  saveSingleSlide(slideToSave);
                }
                setCurrentIndex(index);
                setEditing(true);
                setEditSlide({ ...slides[index] });
              }}
              onJumpToSlide={(index) => {
                if (editSlide) {
                  const slideToSave = { ...editSlide, reviewed: true };
                  const updated = [...slides];
                  updated[currentIndex] = slideToSave;
                  setSlides(updated);
                  syncProjectSlides(updated);
                  saveSingleSlide(slideToSave);
                }
                setCurrentIndex(index);
                setEditing(true);
                setEditSlide({ ...slides[index] });
              }}
              onToggleEmotionalBeats={onToggleEmotionalBeats}
              showEmotionalBeats={showEmotionalBeats}
              onTogglePreview={onTogglePreview}
              showPreviewAll={showPreviewAll}
              isSaving={isSaving}
              showTopActionButtons={false}
              onAsyncUpdate={(slideId, updates) => {
                setSlides((prevSlides) => {
                  const updated = prevSlides.map((s) => (s.id === slideId ? { ...s, ...updates } : s));
                  syncProjectSlides(updated);

                  const slideToSave = updated.find((s) => s.id === slideId);
                  if (slideToSave) {
                    saveSingleSlide(slideToSave);
                  }
                  return updated;
                });

                setEditSlide((prevEdit) => {
                  if (prevEdit && prevEdit.id === slideId) {
                    return { ...prevEdit, ...updates };
                  }
                  return prevEdit;
                });
              }}
            />
          </div>

          <div className="h-full bg-gray-200 overflow-auto p-4 xl:p-8">
            <div className="flex flex-col items-center justify-start gap-4">
              <SlidePreview
                slide={editSlide}
                onHeadshotClick={
                  editSlide?.headshot
                    ? () => headshotInputRef.current?.click()
                    : undefined
                }
                onSplitImageDrag={
                  editSlide && (editSlide.style.background === 'split' || editSlide.backgroundImage?.displayMode === 'split')
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
                  editSlide?.hasBackgroundImage
                    ? () => bgImageInputRef.current?.click()
                    : undefined
                }
                onWordClick={handleWordClick}
              />

              <div className="mt-4 w-full max-w-[980px] bg-white/85 backdrop-blur-sm border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-700">Overview</span>
                  <span className="text-[10px] font-semibold text-gray-400">{slides.length} slides</span>
                </div>
                <div ref={overviewStripRef} className="flex gap-3 overflow-x-auto pb-1 thin-scrollbar">
                  {slides
                    .filter((s) => !slides.some((ps) => ps.absorbedSlideIds?.includes(s.id)))
                    .map((s) => {
                      const originalIndex = slides.findIndex((as) => as.id === s.id);
                      return (
                        <button
                          key={`overview-inline-${s.id}`}
                          ref={(el) => {
                            overviewItemRefs.current[s.id] = el;
                          }}
                          type="button"
                          onClick={() => {
                            if (editSlide) {
                              const slideToSave = { ...editSlide, reviewed: true };
                              const updated = [...slides];
                              updated[currentIndex] = slideToSave;
                              setSlides(updated);
                              syncProjectSlides(updated);
                              saveSingleSlide(slideToSave);
                            }
                            setCurrentIndex(originalIndex);
                            setEditing(true);
                            setEditSlide({ ...slides[originalIndex] });
                          }}
                          className={`relative shrink-0 w-44 aspect-video rounded-lg border overflow-hidden text-left transition-all ${
                            originalIndex === currentIndex
                              ? 'ring-2 ring-black border-black shadow-md'
                              : 'border-gray-300 hover:border-gray-500 hover:shadow-sm'
                          }`}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                s.style.background === 'gradient' && s.style.gradient
                                  ? s.style.gradient
                                  : s.style.background === 'dark'
                                    ? '#1a1a1a'
                                    : '#ffffff',
                            }}
                          />
                          {!s.backgroundVideoUrl && s.backgroundImage?.url && (
                            <div
                              className="absolute inset-0 bg-cover bg-center"
                              style={{
                                backgroundImage: `url(${s.backgroundImage.url})`,
                                backgroundPosition: `center ${s.backgroundImage.imagePositionY ?? 50}%`,
                                opacity: s.style.background === 'split' ? 1 : 0.72,
                              }}
                            />
                          )}
                          {s.backgroundVideoUrl && (
                            <video
                              className="absolute inset-0 w-full h-full object-cover"
                              src={s.backgroundVideoUrl}
                              autoPlay
                              loop
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundColor:
                                s.style.textColor === 'white'
                                  ? 'rgba(0,0,0,0.28)'
                                  : 'rgba(255,255,255,0.16)',
                            }}
                          />
                          <div className="absolute inset-0 p-3 flex items-center justify-center">
                            <p
                              className="text-xs font-bold text-center line-clamp-3"
                              style={{
                                color: s.style.textColor === 'white' ? 'white' : 'black',
                                textShadow: s.style.textColor === 'white' ? '0 1px 4px rgba(0,0,0,0.45)' : 'none',
                              }}
                            >
                              {s.fullScriptText}
                            </p>
                          </div>
                          <span className="absolute top-1.5 left-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                            {originalIndex + 1}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setEditSlide(null);
                  }}
                  className="gap-1 h-8 text-xs text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="gap-1 h-9 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  onClick={() => handleEditSave()}
                  disabled={isSaving}
                  className="bg-black text-white hover:bg-gray-800 gap-1.5 h-9 px-5 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isSaving ? (
                    <>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Save &amp; Next &rarr;
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}



