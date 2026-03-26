'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Bold,
  X,
  Trash2,
  Upload,
  Sparkles,
  Loader2,
  Search,
  Plus,
  BarChart3,
  Check,
  Pencil,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { AiImageDialog } from './ai-image-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  Slide,
  SlideStyle,
  UnderlineStyle,
  CircleStyle,
  PresetType,
  TextSegment,
  BackgroundImage,
  InfographicVisual,
} from '@/types';
import { toast } from 'sonner';

interface SlideEditPanelProps {
  slide: Slide;
  onUpdate: (slide: Slide) => void;
  onSave: (applyToAll?: boolean) => void;
  onCancel: () => void;
  onApplyToAll?: () => void;
  headshotInputRef?: React.RefObject<HTMLInputElement | null>;
  allSlides?: Slide[];
  currentIndex?: number;
  totalSlides?: number;
  onJumpToSlide?: (index: number) => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  onSkipTo?: (index: number) => void;
  canGoPrevious?: boolean;
}

const PRESETS: { label: string; value: PresetType }[] = [
  { label: 'Black Background', value: 'black-background' },
  { label: 'White Background', value: 'white-background' },
  { label: 'Headshot + Bio', value: 'headshot-bio' },
  { label: 'Image Backdrop', value: 'image-backdrop' },
  { label: 'Image + Text', value: 'image-text' },
  { label: 'Infographic Style', value: 'infographic' },
];

const TEXT_SIZES = [48, 60, 72, 84, 96, 108, 120];

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

function getEmphasisLabel(word: string, slide: Slide): string {
  if (slide.boldWords.includes(word)) return 'Bold';
  if (slide.underlineWords.includes(word)) {
    const style = slide.underlineStyles[word] || 'brush-red';
    const labels: Record<UnderlineStyle, string> = {
      'brush-red': 'Brush Red (click to cycle)',
      'brush-black': 'Brush Black (click to cycle)',
      regular: 'Underline (click to cycle)',
      'brush-stroke-red': 'Brush Stroke Red (click to cycle)',
    };
    return labels[style];
  }
  if (slide.redWords.includes(word)) return 'Red Highlight';
  if (slide.circleWords.includes(word)) {
    const style = slide.circleStyles[word] || 'red-solid';
    const labels: Record<CircleStyle, string> = {
      'red-solid': 'Circle Red (click to cycle)',
      'red-dotted': 'Dotted circle (click to cycle)',
      'black-solid': 'Circle Black (click to cycle)',
    };
    return labels[style];
  }
  return '(click to style)';
}

// Fetch image from Pexels API
async function fetchPexelsImage(keyword: string): Promise<string | null> {
  try {
    const response = await fetch('/api/pexels-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: keyword, perPage: 1 }),
    });
    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      return data.photos[0].url;
    }
    return null;
  } catch {
    return null;
  }
}

// Generate a smart image search keyword from slide text using AI
async function getSmartKeyword(slideText: string, emotion?: string, sceneTitle?: string, userPrompt?: string): Promise<string> {
  try {
    const response = await fetch('/api/image-keyword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideText, emotion, sceneTitle, userPrompt }),
    });
    const data = await response.json();
    return data.keyword || 'abstract background';
  } catch {
    return 'abstract background';
  }
}

export function SlideEditPanel({
  slide,
  onUpdate,
  onSave,
  onCancel,
  onApplyToAll,
  headshotInputRef,
  allSlides = [],
  currentIndex = 0,
  totalSlides = 0,
  onJumpToSlide,
  onPrevious,
  onSkip,
  onSkipTo,
  canGoPrevious = false,
}: SlideEditPanelProps) {
  const nextSlides = allSlides.slice(currentIndex + 1);
  const [editingText, setEditingText] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [showPreviewAll, setShowPreviewAll] = useState(false);
  const [aiImageOpen, setAiImageOpen] = useState(false);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiStylingWords, setAiStylingWords] = useState(false);
  const localHeadshotRef = useRef<HTMLInputElement>(null);

  // Sync text value when slide changes
  useEffect(() => {
    setTextValue(slide.fullScriptText);
  }, [slide.fullScriptText]);

  const headshotRef = headshotInputRef || localHeadshotRef;
  const bgImageUploadRef = useRef<HTMLInputElement>(null);

  const handleHeadshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onUpdate({
        ...slide,
        headshot: {
          ...(slide.headshot || {}),
          imageUrl: dataUrl,
        },
      });
      toast.success('Headshot uploaded!');
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onUpdate({
        ...slide,
        hasBackgroundImage: true,
        backgroundImage: {
          ...(slide.backgroundImage || { opacity: 40, blur: 8, displayMode: 'blurred' }),
          url: dataUrl,
        } as BackgroundImage,
        style: {
          ...slide.style,
          background: slide.style.background === 'split' ? 'split' : 'image',
          textColor: 'white',
        },
      });
      toast.success('Image uploaded!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleWordClick = (word: string) => {
    const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
    if (!cleanWord) return;
    const result = getNextEmphasis(cleanWord, slide);
    onUpdate(result.slide);
  };

  const handleBoldAll = () => {
    const words = slide.fullScriptText
      .split(/\s+/)
      .map((w) => w.replace(/[.,!?;:'"()]/g, ''))
      .filter(Boolean);
    onUpdate({ ...slide, boldWords: words });
  };

  // AI-powered word styling
  const handleAiStyleWords = async () => {
    setAiStylingWords(true);
    try {
      const response = await fetch('/api/style-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideText: slide.fullScriptText,
          emotion: slide.emotion,
          sceneTitle: slide.sceneTitle,
          preset: slide.style.background,
          userPrompt: aiPrompt,
        }),
      });

      if (!response.ok) throw new Error('Failed to style words');

      const decision = await response.json();
      
      // Apply AI's word styling decisions
      const newUnderlineStyles: Record<string, UnderlineStyle> = {};
      decision.underlineWords?.forEach((w: string) => {
        newUnderlineStyles[w] = decision.underlineStyle || 'brush-red';
      });

      const newCircleStyles: Record<string, CircleStyle> = {};
      decision.circleWords?.forEach((w: string) => {
        newCircleStyles[w] = decision.circleStyle || 'red-solid';
      });

      onUpdate({
        ...slide,
        boldWords: decision.boldWords || [],
        underlineWords: decision.underlineWords || [],
        redWords: decision.redWords || [],
        circleWords: decision.circleWords || [],
        underlineStyles: newUnderlineStyles,
        circleStyles: newCircleStyles,
      });

      const totalEmphasis = 
        (decision.boldWords?.length || 0) + 
        (decision.underlineWords?.length || 0) + 
        (decision.redWords?.length || 0) + 
        (decision.circleWords?.length || 0);

      if (totalEmphasis > 0) {
        toast.success(`AI styled ${totalEmphasis} word(s)`);
      } else {
        toast.info('AI chose minimal emphasis for this slide');
      }
    } catch (error) {
      toast.error('Failed to style words with AI');
    } finally {
      setAiStylingWords(false);
    }
  };

  // Clear all word emphasis
  const handleClearEmphasis = () => {
    onUpdate({
      ...slide,
      boldWords: [],
      underlineWords: [],
      redWords: [],
      circleWords: [],
      underlineStyles: {},
      circleStyles: {},
    });
    toast.success('Cleared all emphasis');
  };

  // Fetch AI-generated infographic content (visual + bundled lines)
  const fetchInfographicContent = useCallback(async (newSlide: Slide, newStyle: Partial<SlideStyle>) => {
    try {
      // Fetch visual and lines in parallel
      const [visualResponse, linesResponse] = await Promise.all([
        fetch('/api/infographic-visual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: slide.fullScriptText,
            emotion: slide.emotion,
            context: slide.sceneTitle,
          }),
        }),
        fetch('/api/infographic-lines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentSlide: {
              id: slide.id,
              fullScriptText: slide.fullScriptText,
              sceneTitle: slide.sceneTitle,
              emotion: slide.emotion,
            },
            nextSlides: nextSlides.slice(0, 10).map((s: Slide) => ({
              id: s.id,
              fullScriptText: s.fullScriptText,
              sceneTitle: s.sceneTitle,
              emotion: s.emotion,
            })),
            maxLines: 5,
          }),
        }),
      ]);

      const visualData = await visualResponse.json();
      const linesData = await linesResponse.json();

      // Build the infographic visual
      const infographicVisual: InfographicVisual = {
        type: visualData.type || 'emoji',
        value: visualData.value || '💡',
      };

      // Get bundled captions and absorbed slide IDs
      const captions = linesData.captions || [slide.fullScriptText];
      const absorbedIds = linesData.bundledSlideIds?.filter((id: string) => id !== slide.id) || [];

      onUpdate({
        ...newSlide,
        style: { ...slide.style, ...newStyle },
        isInfographic: true,
        infographicVisual,
        infographicCaptions: captions,
        absorbedSlideIds: absorbedIds,
      });

      if (absorbedIds.length > 0) {
        toast.success(`Infographic created! Bundled ${absorbedIds.length + 1} lines together.`);
      } else {
        toast.success('Infographic created!');
      }
    } catch (error) {
      // Keep the basic infographic setup even on error
      toast.error('Could not auto-generate infographic. You can edit manually.');
    }
  }, [slide, nextSlides, onUpdate]);

  // Auto-fetch Pexels image — uses smart AI keyword when imageKeyword is missing
  const autoFetchImage = useCallback(async (slideForKeyword: Slide, newSlide: Slide, newStyle: Partial<SlideStyle>) => {
    setFetchingImage(true);

    // Use existing imageKeyword, or generate a smart one from slide text
    // If aiPrompt is set, ALWAYS regenerate keyword to respect the prompt
    let keyword = slideForKeyword.imageKeyword;
    if (!keyword || aiPrompt) {
      keyword = await getSmartKeyword(
        slideForKeyword.fullScriptText,
        slideForKeyword.emotion,
        slideForKeyword.sceneTitle,
        aiPrompt
      );
    }

    const url = await fetchPexelsImage(keyword);
    setFetchingImage(false);

    if (url) {
      onUpdate({
        ...newSlide,
        imageKeyword: keyword, // save the keyword for future use
        style: { ...newSlide.style, ...newStyle },
        backgroundImage: {
          ...newSlide.backgroundImage!,
          url,
        },
      });
      if (aiPrompt) toast.success('Image updated based on your prompt!');
    } else {
      onUpdate({
        ...newSlide,
        imageKeyword: keyword,
        style: { ...newSlide.style, ...newStyle },
      });
      toast.error('No image found. Use "Generate AI Image" or search manually.');
    }
  }, [onUpdate, aiPrompt]);

  const handlePresetChange = (preset: PresetType) => {
    let newStyle: Partial<SlideStyle> = {};
    let newSlide = { ...slide };

    switch (preset) {
      case 'black-background':
        newStyle = { background: 'dark', textColor: 'white' };
        newSlide.hasBackgroundImage = false;
        newSlide.backgroundImage = undefined;
        newSlide.headshot = null;
        break;
      case 'white-background':
        newStyle = { background: 'white', textColor: 'black' };
        newSlide.hasBackgroundImage = false;
        newSlide.backgroundImage = undefined;
        newSlide.headshot = null;
        break;
      case 'headshot-bio':
        newStyle = { background: 'white', textColor: 'black' };
        newSlide.headshot = newSlide.headshot || {};
        newSlide.hasBackgroundImage = false;
        newSlide.backgroundImage = undefined;
        break;
      case 'image-backdrop':
        newStyle = { background: 'image', textColor: 'white' };
        newSlide.hasBackgroundImage = true;
        newSlide.headshot = null;
        if (!newSlide.backgroundImage || !newSlide.backgroundImage.url) {
          newSlide.backgroundImage = {
            url: '',
            opacity: 40,
            blur: 8,
            displayMode: 'blurred',
          };
          // Auto-fetch from Pexels with smart keyword
          onUpdate({ ...newSlide, style: { ...slide.style, ...newStyle } });
          autoFetchImage(slide, newSlide, newStyle);
          return;
        }
        break;
      case 'image-text':
        newStyle = { background: 'split', textColor: 'black', splitRatio: 50 };
        newSlide.hasBackgroundImage = true;
        newSlide.headshot = null;
        if (!newSlide.backgroundImage || !newSlide.backgroundImage.url) {
          newSlide.backgroundImage = {
            url: '',
            opacity: 100,
            blur: 0,
            displayMode: 'split',
            imagePositionY: 50,
          };
          onUpdate({ ...newSlide, style: { ...slide.style, ...newStyle } });
          autoFetchImage(slide, newSlide, newStyle);
          return;
        } else {
          newSlide.backgroundImage = {
            ...newSlide.backgroundImage,
            displayMode: 'split',
            imagePositionY: newSlide.backgroundImage.imagePositionY ?? 50,
          };
        }
        break;
      case 'infographic':
        newStyle = {
          background: 'gradient',
          textColor: 'white',
          gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          gradientName: 'purple',
        };
        newSlide.hasBackgroundImage = false;
        newSlide.backgroundImage = undefined;
        newSlide.headshot = null;
        newSlide.isInfographic = true;
        // Start with current slide text as first caption
        newSlide.infographicCaptions = [slide.fullScriptText];
        // Update immediately with basic infographic, then fetch AI-generated content
        onUpdate({
          ...newSlide,
          style: { ...slide.style, ...newStyle },
        });
        // Fetch AI-generated visual and bundled lines
        fetchInfographicContent(newSlide, newStyle);
        return;
    }

    onUpdate({
      ...newSlide,
      style: { ...slide.style, ...newStyle },
    });
  };

  const handleTextSave = () => {
    const words = textValue.split(/\s+/);
    const segments: TextSegment[] = words.map((word) => ({
      text: word,
      emphasis: 'none',
    }));
    onUpdate({
      ...slide,
      fullScriptText: textValue,
      segments,
    });
    setEditingText(false);
  };

  const handleAiImageGenerated = (imageUrl: string) => {
    onUpdate({
      ...slide,
      hasBackgroundImage: true,
      backgroundImage: {
        url: imageUrl,
        opacity: 40,
        blur: 8,
        displayMode: slide.backgroundImage?.displayMode || 'blurred',
      },
      style: {
        ...slide.style,
        background: slide.style.background === 'split' ? 'split' : 'image',
        textColor: 'white',
      },
    });
  };

  // Set image display mode
  const handleDisplayMode = (mode: 'blurred' | 'crisp' | 'split') => {
    if (!slide.backgroundImage) return;

    const bgImage: BackgroundImage = {
      ...slide.backgroundImage,
      displayMode: mode,
    };

    if (mode === 'blurred') {
      bgImage.opacity = 40;
      bgImage.blur = 8;
      onUpdate({
        ...slide,
        backgroundImage: bgImage,
        style: { ...slide.style, background: 'image', textColor: 'white' },
      });
    } else if (mode === 'crisp') {
      bgImage.opacity = 60;
      bgImage.blur = 0;
      onUpdate({
        ...slide,
        backgroundImage: bgImage,
        style: { ...slide.style, background: 'image', textColor: 'white' },
      });
    } else {
      bgImage.opacity = 100;
      bgImage.blur = 0;
      bgImage.imagePositionY = bgImage.imagePositionY ?? 50;
      onUpdate({
        ...slide,
        backgroundImage: bgImage,
        style: { ...slide.style, background: 'split', textColor: 'black', splitRatio: 50 },
      });
    }
  };

  // Image search
  const handleImageSearch = async () => {
    const query = imageSearchQuery.trim();
    if (!query) return;
    setFetchingImage(true);
    const url = await fetchPexelsImage(query);
    setFetchingImage(false);
    if (url) {
      onUpdate({
        ...slide,
        hasBackgroundImage: true,
        backgroundImage: {
          ...(slide.backgroundImage || { opacity: 40, blur: 8, displayMode: 'blurred' }),
          url,
        } as BackgroundImage,
        style: {
          ...slide.style,
          background: slide.style.background === 'split' ? 'split' : 'image',
          textColor: 'white',
        },
      });
      setShowImageSearch(false);
      setImageSearchQuery('');
      toast.success('Image loaded!');
    } else {
      toast.error('No images found for that search. Try different keywords.');
    }
  };

  const handleSaveAndNext = () => {
    onSave(applyToAll);
  };

  const words = slide.fullScriptText.split(/\s+/);
  const currentPreset = (() => {
    if (slide.headshot) return 'headshot-bio';
    if (slide.style.background === 'dark') return 'black-background';
    if (slide.style.background === 'split') return 'image-text';
    if (slide.style.background === 'gradient') return 'infographic';
    if (slide.style.background === 'image') return 'image-backdrop';
    return 'white-background';
  })();

  const currentDisplayMode = slide.backgroundImage?.displayMode || 'blurred';

  return (
    <>
      {/* Project Overview Sidebar (Left Side - Fixed) */}
      {showPreviewAll && allSlides && (
        <div className="fixed left-0 top-14 bottom-0 w-[320px] bg-white border-r border-gray-200 shadow-xl z-50 flex flex-col animate-in slide-in-from-left duration-300">
          {/* Sidebar Header */}
          <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 bg-white">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-black" />
              <span className="font-bold text-sm text-black uppercase tracking-wide">Overview</span>
              <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold text-gray-500">{allSlides.length}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowPreviewAll(false)}>
              <X className="w-4 h-4 text-gray-500 hover:text-black" />
            </Button>
          </div>

          {/* Slides Grid */}
          <div className="flex-1 overflow-y-auto p-4 thin-scrollbar bg-gray-50/30">
            <div className="grid grid-cols-1 gap-4">
              {allSlides
                .filter((s: Slide) => {
                  const isAbsorbed = allSlides.some(ps => ps.absorbedSlideIds?.includes(s.id));
                  return !isAbsorbed;
                })
                .map((s: Slide, idx: number) => {
                  const originalIndex = allSlides.findIndex(as => as.id === s.id);
                  const previewSlide = (applyToAll && originalIndex > currentIndex) 
                    ? { 
                        ...s, 
                        style: { ...slide.style }, 
                        hasBackgroundImage: slide.hasBackgroundImage,
                        backgroundImage: slide.backgroundImage,
                        headshot: slide.headshot,
                        isInfographic: slide.isInfographic,
                        infographicVisual: slide.infographicVisual,
                        infographicCaptions: s.infographicCaptions || [s.fullScriptText]
                      } 
                    : (originalIndex === currentIndex ? slide : s);

                  return (
                    <button 
                      key={`${s.id}-${idx}`} 
                      type="button"
                      onClick={() => onJumpToSlide?.(originalIndex)}
                      className={`relative aspect-video w-full rounded-lg border overflow-hidden bg-white group cursor-pointer transition-all hover:ring-2 hover:ring-black/20 ${
                        originalIndex === currentIndex ? 'ring-2 ring-black shadow-md' : 'border-gray-200 shadow-sm'
                      }`}
                    >
                      <div className="absolute inset-0 scale-[0.25] origin-top-left w-[400%] h-[400%] pointer-events-none select-none">
                        <div
                          className="w-full h-full relative"
                          style={{
                            background: previewSlide.style.background === 'gradient' && previewSlide.style.gradient
                              ? previewSlide.style.gradient
                              : previewSlide.style.background === 'dark' ? '#1a1a1a' : '#ffffff',
                          }}
                        >
                          {previewSlide.hasBackgroundImage && previewSlide.backgroundImage?.url && (
                            <div 
                              className="absolute inset-0 bg-cover bg-center"
                              style={{ backgroundImage: `url(${previewSlide.backgroundImage.url})`, opacity: 0.6 }}
                            />
                          )}
                          {previewSlide.style.background === 'split' && previewSlide.backgroundImage?.url && (
                             <div 
                              className="absolute top-0 left-0 right-0 bg-cover bg-center"
                              style={{ 
                                height: `${previewSlide.style.splitRatio || 50}%`,
                                backgroundImage: `url(${previewSlide.backgroundImage.url})` 
                              }}
                            />
                          )}
                          
                          <div className="absolute inset-0 flex items-center justify-center p-12">
                            <div className="text-[60px] font-bold text-center leading-tight truncate-3-lines px-8" style={{ color: previewSlide.style.textColor === 'white' ? 'white' : 'black' }}>
                              {previewSlide.fullScriptText.length > 60 ? previewSlide.fullScriptText.slice(0, 60) + '...' : previewSlide.fullScriptText}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm backdrop-blur-sm">
                        {originalIndex + 1}
                      </div>
                      {originalIndex === currentIndex && (
                        <div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-none border-2 border-black rounded-lg">
                          {/* Active Indicator */}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
            <p className="mt-4 text-[10px] text-gray-400 text-center leading-relaxed px-4">
              Click any slide to jump to it. Styling changes applied to all remaining slides will be previewed here.
            </p>
          </div>
        </div>
      )}

      {/* Main Editor Card - Shifted when sidebar is open */}
      <div className={`bg-white rounded-xl border border-gray-200 p-6 space-y-6 transition-all duration-300 ease-in-out ${showPreviewAll ? 'ml-[330px]' : ''}`}>
        {/* Save/Cancel + Navigation — top of panel */}
        <div className="space-y-3 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                &#x2318;+Enter to save &bull; Esc to cancel
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreviewAll(!showPreviewAll)}
                className={`gap-1.5 h-7 text-[10px] px-2 uppercase tracking-wider font-bold ${showPreviewAll ? 'bg-black text-white hover:bg-black/90' : 'border-gray-200 text-gray-500'}`}
              >
                <BarChart3 className="w-3 h-3" />
                {showPreviewAll ? 'Hide Preview' : 'Preview project'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onCancel} className="gap-1 h-8 text-xs">
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
              <Button
              type="button"
              variant="outline"
              onClick={onPrevious}
              disabled={!canGoPrevious}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              type="button"
              onClick={handleSaveAndNext}
              className="bg-black text-white hover:bg-gray-800 gap-1"
            >
              &#x2713; Save &amp; Next &rarr;
            </Button>
          </div>
        </div>
      </div>


      {/* Main Layout: Editor (Right) */}
      <div className={`transition-all duration-300 ease-in-out ${showPreviewAll ? 'pl-[340px]' : ''}`}>
        {/* Editor Controls */}
        <div className="flex-1 space-y-6">
          {/* Text Content */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">&#x1F4DD;</span>
              <span className="font-semibold text-sm">Text Content</span>
              <span className="text-xs text-gray-400">(click words to style)</span>
            </div>

        {editingText ? (
          <div className="space-y-2">
            <Textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleTextSave}>
                Save Text
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingText(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="p-3 rounded-lg border border-gray-100 text-sm leading-relaxed cursor-text"
            onClick={() => setEditingText(true)}
          >
            {words.map((word, i) => {
              const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
              const isBold = slide.boldWords?.includes(cleanWord);
              const isUnderlined = slide.underlineWords?.includes(cleanWord);
              const isRed = slide.redWords?.includes(cleanWord);
              const isCircled = slide.circleWords?.includes(cleanWord);

              return (
                <span
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWordClick(word);
                  }}
                  className={`cursor-pointer hover:bg-gray-100 rounded px-0.5 ${
                    isBold ? 'font-bold' : ''
                  } ${isUnderlined ? 'underline' : ''} ${
                    isRed ? 'text-red-600 underline' : ''
                  } ${isCircled ? 'text-red-600' : ''}`}
                  title={getEmphasisLabel(cleanWord, slide)}
                >
                  {word}{' '}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Word Styling Controls */}
      <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleAiStyleWords}
          disabled={aiStylingWords}
        >
          {aiStylingWords ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          AI Style
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleBoldAll}
        >
          <Bold className="w-3.5 h-3.5" />
          Bold All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-gray-400 hover:text-gray-600"
          onClick={handleClearEmphasis}
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </Button>
        <span className="text-xs">Click words to style manually</span>
      </div>

      {/* Slide Styling */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span>&#x1F3A8;</span>
          <span className="font-semibold text-sm">Slide Styling</span>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-500">Quick Presets:</span>
          <Select
            value={currentPreset}
            onValueChange={(v) => handlePresetChange(v as PresetType)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Background / Text Color / Text Size */}
        <div className="grid grid-cols-3 gap-4">
          {/* Background */}
          <div>
            <span className="text-xs text-gray-500 mb-2 block">Background</span>
            <div className="flex gap-1">
              {(['white', 'dark', 'image'] as const).map((bg) => (
                <button
                  key={bg}
                  onClick={() => {
                    if (bg === 'image') {
                      handlePresetChange('image-backdrop');
                    } else {
                      onUpdate({
                        ...slide,
                        headshot: null,
                        style: {
                          ...slide.style,
                          background: bg,
                          textColor: bg === 'dark' ? 'white' : 'black',
                        },
                      });
                    }
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md border capitalize ${
                    slide.style.background === bg ||
                    (bg === 'image' && (slide.style.background === 'image' || slide.style.background === 'split'))
                      ? 'bg-black text-white border-black'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {bg === 'dark' ? 'Dark' : bg === 'image' ? 'Image' : 'White'}
                </button>
              ))}
            </div>
          </div>

          {/* Text Color */}
          <div>
            <span className="text-xs text-gray-500 mb-2 block">Text Color</span>
            <div className="flex gap-1">
              {(['white', 'black'] as const).map((color) => (
                <button
                  key={color}
                  onClick={() =>
                    onUpdate({
                      ...slide,
                      style: { ...slide.style, textColor: color },
                    })
                  }
                  className={`px-4 py-1.5 text-xs rounded-md border capitalize ${
                    slide.style.textColor === color
                      ? color === 'black'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black border-black'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Text Size */}
          <div>
            <span className="text-xs text-gray-500 mb-2 block">Text Size</span>
            <Select
              value={String(slide.style.textSize)}
              onValueChange={(v) =>
                onUpdate({
                  ...slide,
                  style: { ...slide.style, textSize: Number(v) },
                })
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}px
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

      </div>

      {/* Emotional Context */}
      {(slide.emotionalBeat || slide.visualPrompt) && (
        <div className="space-y-3 pt-4 border-t border-gray-100">
           <div className="flex items-center gap-2 mb-2">
             <span className="text-lg">❤️</span>
             <span className="font-semibold text-sm">Emotional Context</span>
           </div>
           
           <div className="bg-purple-50 rounded-lg p-3 space-y-2 border border-purple-100">
             {slide.emotionalBeat && (
                <div className="flex justify-between items-center mb-1">
                   <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                     {slide.emotionalBeat}
                   </span>
                   {slide.emotion && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-white rounded-full border border-purple-200 text-purple-600 font-medium">
                        {slide.emotion}
                      </span>
                   )}
                </div>
             )}
             
             {slide.visualPrompt && (
               <div className="pt-1">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">Visual Prompt</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-snug italic bg-white/50 p-2 rounded border border-purple-100/50">
                    "{slide.visualPrompt}"
                  </p>
               </div>
             )}

             {slide.videoPrompt && (
               <div className="pt-1">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">Video Prompt</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-snug italic bg-white/50 p-2 rounded border border-purple-100/50">
                    "{slide.videoPrompt}"
                  </p>
               </div>
             )}
           </div>
        </div>
      )}

      {/* Background Image Controls */}
      {slide.hasBackgroundImage && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span>&#x1F5BC;</span>
              <span className="font-semibold text-sm">Background Image</span>
              {fetchingImage && (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 gap-1"
              onClick={() =>
                onUpdate({
                  ...slide,
                  hasBackgroundImage: false,
                  backgroundImage: undefined,
                  style: {
                    ...slide.style,
                    background: 'white',
                    textColor: 'black',
                  },
                })
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </Button>
          </div>

          {/* 3 Display Mode buttons */}
          <div className="mb-3">
            <span className="text-xs text-gray-500 mb-2 block">Image Style</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleDisplayMode('blurred')}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border-2 transition-all ${
                  currentDisplayMode === 'blurred'
                    ? 'border-black bg-gray-50 font-medium'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium mb-0.5">Blurred</div>
                <div className="text-gray-400">Soft image behind text</div>
              </button>
              <button
                onClick={() => handleDisplayMode('crisp')}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border-2 transition-all ${
                  currentDisplayMode === 'crisp'
                    ? 'border-black bg-gray-50 font-medium'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium mb-0.5">Crisp</div>
                <div className="text-gray-400">Clear image, text on top</div>
              </button>
              <button
                onClick={() => handleDisplayMode('split')}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border-2 transition-all ${
                  currentDisplayMode === 'split'
                    ? 'border-black bg-gray-50 font-medium'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium mb-0.5">Split</div>
                <div className="text-gray-400">Image top, text bottom</div>
              </button>
            </div>
          </div>

          {/* Crispness slider (blurred mode) / Transparency slider (crisp mode) */}
          {slide.backgroundImage && currentDisplayMode !== 'split' && (
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{currentDisplayMode === 'blurred' ? 'Crispness:' : 'Transparency:'}</span>
                <span>{slide.backgroundImage.opacity}%</span>
              </div>
              <Slider
                value={[slide.backgroundImage.opacity]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) =>
                  onUpdate({
                    ...slide,
                    backgroundImage: {
                      ...slide.backgroundImage!,
                      opacity: v,
                    },
                  })
                }
              />
            </div>
          )}

          {/* Image search */}
          {showImageSearch ? (
            <div className="flex gap-2 mb-3">
              <Input
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImageSearch()}
                placeholder="Search for images..."
                className="text-sm"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleImageSearch}
                disabled={fetchingImage || !imageSearchQuery.trim()}
              >
                {fetchingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowImageSearch(false);
                  setImageSearchQuery('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowImageSearch(true)}
              >
                <Search className="w-3.5 h-3.5" />
                Search Image
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setAiImageOpen(true)}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate AI Image
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => bgImageUploadRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload
              </Button>
              <Button
                variant={showAiPrompt ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 ml-auto"
                onClick={() => setShowAiPrompt(!showAiPrompt)}
              >
                <Pencil className="w-3.5 h-3.5" />
                AI Prompt
              </Button>
            </div>

            {/* AI Search Prompt */}
            {showAiPrompt && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">
                    Smart Pexels Search
                  </span>
                  {aiPrompt && (
                    <button
                      onClick={() => setAiPrompt('')}
                      className="text-[10px] text-red-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want (e.g. 'young people, no suits, bright colors')..."
                  className="min-h-[60px] text-sm bg-white"
                />
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => autoFetchImage(slide, slide, {})}
                  disabled={fetchingImage || !aiPrompt.trim()}
                >
                  {fetchingImage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Update Image with Prompt
                </Button>
                <p className="text-[10px] text-gray-400">
                  Refines the search term using AI to find better Pexels matches.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate AI Image (when no background image) */}
      {!slide.hasBackgroundImage && (
        <div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAiImageOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate AI Image
          </Button>
        </div>
      )}

      {/* Hidden headshot file input */}
      <input
        ref={headshotRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleHeadshotUpload}
      />

      {/* Hidden background image file input */}
      <input
        ref={bgImageUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBgImageUpload}
      />

      {/* Headshot controls (when headshot preset is active) */}
      {slide.headshot && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span>&#x1F464;</span>
            <span className="font-semibold text-sm">Headshot</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => headshotRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              {slide.headshot.imageUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {slide.headshot.imageUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 gap-1"
                onClick={() =>
                  onUpdate({
                    ...slide,
                    headshot: { ...(slide.headshot || {}), imageUrl: undefined },
                  })
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Infographic Controls */}
      {slide.isInfographic && (
        <div>
          {/* Visual Preview */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-4xl">
                {slide.infographicVisual ? (
                  slide.infographicVisual.type === 'emoji' ? (
                    slide.infographicVisual.value
                  ) : slide.infographicVisual.type === 'svg' ? (
                    <div
                      className="w-16 h-16"
                      dangerouslySetInnerHTML={{ __html: slide.infographicVisual.value }}
                    />
                  ) : (
                    slide.infographicVisual.value
                  )
                ) : null}
              </div>
            </div>

          {/* Remove infographic mode */}
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 gap-1"
              onClick={() =>
                onUpdate({
                  ...slide,
                  isInfographic: false,
                  infographicCaptions: undefined,
                  infographicVisual: undefined,
                  absorbedSlideIds: undefined,
                })
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Infographic Mode
            </Button>
          </div>
        </div>
      )}

      {/* Apply to all Toggle */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
        <button
          onClick={() => setApplyToAll(!applyToAll)}
          className="flex items-center gap-3 group px-1 cursor-pointer"
          type="button"
        >
          <div 
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
              applyToAll ? 'bg-black' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                applyToAll ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </div>
          <span className="text-sm font-semibold text-gray-700 group-hover:text-black transition-colors">
            Apply style to all remaining slides
          </span>
        </button>
      </div>

      {/* AI Image Generation Dialog */}
      <AiImageDialog
        open={aiImageOpen}
        onClose={() => setAiImageOpen(false)}
        slideText={slide.fullScriptText}
        imageKeyword={slide.imageKeyword}
        sceneTitle={slide.sceneTitle}
        emotion={slide.emotion}
        onImageGenerated={handleAiImageGenerated}
      />
        </div>
      </div>
      </div>
    </>
  );
}
