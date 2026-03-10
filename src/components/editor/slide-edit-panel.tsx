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
  BarChart3,
  Check,
  Pencil,
  ChevronLeft,
  Heart,
  Video,
  User,
  Save,
  Mic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { SlidePreview } from './slide-preview';
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
  onToggleEmotionalBeats?: () => void;
  showEmotionalBeats?: boolean;
  onTogglePreview?: () => void;
  showPreviewAll?: boolean;
  isSaving?: boolean;
  onAsyncUpdate?: (slideId: string, updates: Partial<Slide>) => void;
}

const PRESETS: { label: string; value: PresetType }[] = [
  { label: 'Black Background', value: 'black-background' },
  { label: 'White Background', value: 'white-background' },
  { label: 'Headshot + Bio', value: 'headshot-bio' },
  { label: 'Image Backdrop', value: 'image-backdrop' },
  { label: 'Image + Text', value: 'image-text' },
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
  onToggleEmotionalBeats,
  showEmotionalBeats = false,
  onTogglePreview,
  showPreviewAll = false,
  isSaving = false,
  onAsyncUpdate,
}: SlideEditPanelProps) {
  const nextSlides = allSlides.slice(currentIndex + 1);
  const [editingText, setEditingText] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [aiImageOpen, setAiImageOpen] = useState(false);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiStylingWords, setAiStylingWords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'media' | 'avatar'>('text');
  const localHeadshotRef = useRef<HTMLInputElement>(null);

  // Talking Head Avatar state
  const [avatarGenerating, setAvatarGenerating] = useState(false);
  const [avatarElapsed, setAvatarElapsed] = useState(0);
  const [avatarAudioUrl, setAvatarAudioUrl] = useState(slide.talkingHeadAudioUrl || slide.audioUrl || '');
  const [avatarPrompt, setAvatarPrompt] = useState(slide.talkingHeadPrompt || '');
  const avatarApiKey = localStorage.getItem('vsl123-piapi-key') || '';
  const [avatarApiKeyLocal, setAvatarApiKey] = useState(avatarApiKey);
  const avatarImageInputRef = useRef<HTMLInputElement>(null);
  const avatarVideoInputRef = useRef<HTMLInputElement>(null);
  const avatarTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ElevenLabs Voice Generation state
  const [elVoices, setElVoices] = useState<{voice_id: string; name: string; category: string}[]>([]);
  const [elVoiceId, setElVoiceId] = useState(localStorage.getItem('vsl123-elevenlabs-voice') || '');
  const [elApiKey, setElApiKey] = useState(localStorage.getItem('vsl123-elevenlabs-key') || '');
  const [elConnected, setElConnected] = useState(false);
  const [elGenerating, setElGenerating] = useState(false);
  const [elVoiceSearch, setElVoiceSearch] = useState('');

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('vsl123-piapi-key');
    if (savedKey) setAvatarApiKey(savedKey);
  }, []);

  // Sync text value when slide changes
  useEffect(() => {
    setTextValue(slide.fullScriptText);
  }, [slide.fullScriptText]);

  // Sync avatar state when slide changes
  useEffect(() => {
    setAvatarAudioUrl(slide.talkingHeadAudioUrl || slide.audioUrl || '');
    setAvatarPrompt(slide.talkingHeadPrompt || '');
  }, [slide.id]);

  // Auto-load ElevenLabs voices on mount if API key exists
  useEffect(() => {
    if (!elApiKey) return;
    (async () => {
      try {
        const res = await fetch('/api/elevenlabs-voices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: elApiKey }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.voices?.length) {
          setElVoices(data.voices);
          setElConnected(true);
        }
      } catch { /* silent */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleElConnect = async () => {
    if (!elApiKey.trim()) {
      toast.error('Enter your ElevenLabs API key');
      return;
    }
    try {
      const res = await fetch('/api/elevenlabs-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: elApiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');
      setElVoices(data.voices || []);
      setElConnected(true);
      localStorage.setItem('vsl123-elevenlabs-key', elApiKey);
      toast.success(`Connected! ${data.voices?.length || 0} voices loaded`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect to ElevenLabs');
      setElConnected(false);
    }
  };

  const handleGenerateVoice = async () => {
    if (!elVoiceId || !elApiKey) return;
    setElGenerating(true);
    try {
      const res = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: slide.fullScriptText,
          voiceId: elVoiceId,
          apiKey: elApiKey,
          stability: 0.5,
          similarityBoost: 0.75,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Voice generation failed');
      }
      const data = await res.json();
      const audioUrl = data.audioContent || data.url;
      setAvatarAudioUrl(audioUrl);
      const updates = {
        talkingHeadAudioUrl: audioUrl,
        audioUrl: audioUrl,
        audioDuration: data.duration,
        audioGenerated: true,
      };
      onUpdate({ ...slide, ...updates });
      onAsyncUpdate?.(slide.id, updates);
      toast.success('Voice generated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Voice generation failed');
    } finally {
      setElGenerating(false);
    }
  };

  const headshotRef = headshotInputRef || localHeadshotRef;
  const headshotVideoInputRef = useRef<HTMLInputElement>(null);
  const bgImageUploadRef = useRef<HTMLInputElement>(null);

  const handleHeadshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const uploadToast = toast.loading('Uploading headshot...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'vsl123-headshots');

      const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      onUpdate({
        ...slide,
        headshot: {
          ...(slide.headshot || {}),
          imageUrl: data.url,
        },
      });
      toast.success('Headshot uploaded!', { id: uploadToast });
    } catch (err: any) {
      console.error('Headshot upload error:', err);
      toast.error(err.message || 'Headshot upload failed. Please check Cloudinary configuration.', { id: uploadToast });
    }
    e.target.value = '';
  };

  const handleHeadshotVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    const uploadToast = toast.loading('Uploading headshot video...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'vsl123-headshots-video');

      const res = await fetch('/api/upload-video', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      onUpdate({
        ...slide,
        headshot: {
          ...(slide.headshot || {}),
          videoUrl: data.url,
        },
      });
      toast.success('Headshot video uploaded!', { id: uploadToast });
    } catch (err: any) {
      console.error('Headshot video upload error:', err);
      toast.error(err.message || 'Headshot video upload failed. Please check Cloudinary configuration.', { id: uploadToast });
    }
    e.target.value = '';
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const uploadToast = toast.loading('Uploading background image...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'vsl123-backgrounds');

      const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      onUpdate({
        ...slide,
        hasBackgroundImage: true,
        backgroundImage: {
          ...(slide.backgroundImage || { opacity: 40, blur: 8, displayMode: 'blurred' }),
          url: data.url,
        } as BackgroundImage,
        style: {
          ...slide.style,
          background: slide.style.background === 'split' ? 'split' : 'image',
          textColor: 'white',
        },
      });
      toast.success('Background image uploaded!', { id: uploadToast });
    } catch (err: any) {
      console.error('Background image upload error:', err);
      toast.error(err.message || 'Background upload failed. Please check Cloudinary configuration.', { id: uploadToast });
    }
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
      console.error('AI word styling error:', error);
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
      console.error('Failed to fetch infographic content:', error);
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
    const newSlide = { ...slide };

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

  const handleSaveAndNext = async () => {
    setSaving(true);
    try {
      await onSave(applyToAll);
    } finally {
      setSaving(false);
    }
  };

  // Talking Head Avatar handlers
  const MIN_AVATAR_PX = 512;

  const handleAvatarImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Read the file to validate dimensions first
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      const img = new window.Image();
      img.onload = async () => {
        if (img.naturalWidth < MIN_AVATAR_PX || img.naturalHeight < MIN_AVATAR_PX) {
          toast.error(
            `Image too small (${img.naturalWidth}×${img.naturalHeight}px). ` +
            `Kling AI requires at least ${MIN_AVATAR_PX}×${MIN_AVATAR_PX}px for facial mapping.`
          );
          return;
        }

        // Upload to Cloudinary for permanent storage (avoid storing huge base64 in DB)
        const uploadToast = toast.loading('Uploading avatar image...');
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folder', 'vsl123-talking-heads');

          const res = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Upload failed');
          }

          const data = await res.json();

          const newSlide = {
            ...slide,
            talkingHeadImage: data.url, // Cloudinary URL, not base64!
          };
          onUpdate(newSlide);
          onAsyncUpdate?.(slide.id, { talkingHeadImage: data.url });
          toast.success(`Avatar image uploaded! (${img.naturalWidth}×${img.naturalHeight}px)`, { id: uploadToast });
        } catch (err: any) {
          console.error('Avatar image upload error:', err);
          toast.error(err.message || 'Avatar upload failed. Please check Cloudinary configuration.', { id: uploadToast });
        }
      };
      img.onerror = () => {
        toast.error('Failed to load image. Please try another file.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAvatarVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    const uploadToast = toast.loading('Uploading custom avatar video...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'vsl123-talking-heads');

      const res = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();

      const updates = {
        talkingHeadVideoUrl: data.url,
        talkingHeadImage: undefined, // ensure we know it's a custom uploaded video
        talkingHeadTaskId: undefined,
      };
      
      onUpdate({ ...slide, ...updates });
      onAsyncUpdate?.(slide.id, updates);
      toast.success('Custom avatar video uploaded!', { id: uploadToast });
    } catch (err: any) {
      console.error('Avatar video upload error:', err);
      toast.error(err.message || 'Video upload failed. Please check Cloudinary configuration.', { id: uploadToast });
    }
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    const updates = {
      talkingHeadImage: undefined,
      talkingHeadVideoUrl: undefined,
      talkingHeadPrompt: undefined,
      talkingHeadAudioUrl: undefined,
      talkingHeadTaskId: undefined,
    };
    onUpdate({ ...slide, ...updates });
    onAsyncUpdate?.(slide.id, updates);
    toast.success('Avatar removed');
  };

  const handleGenerateAvatar = async () => {
    if (!slide.talkingHeadImage) {
      toast.error('Upload an avatar face image first');
      return;
    }
    if (!avatarApiKey.trim()) {
      toast.error('Please enter your PiAPI key');
      return;
    }

    // Persist audio URL and prompt to slide immediately (survives refresh)
    const updates = {
      talkingHeadAudioUrl: avatarAudioUrl,
      talkingHeadPrompt: avatarPrompt,
    };
    onUpdate({ ...slide, ...updates });
    onAsyncUpdate?.(slide.id, updates);

    setAvatarGenerating(true);

    try {
      // Submit task to PiAPI — returns instantly with task_id
      const response = await fetch('/api/talking-head-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: slide.talkingHeadImage,
          local_dubbing_url: avatarAudioUrl,
          prompt: avatarPrompt || 'Person speaks naturally',
          apiKey: avatarApiKey,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Avatar generation failed');
      }

      const data = await response.json();

      if (!data.taskId) {
        throw new Error('No task ID returned from PiAPI');
      }

      // Save task ID to slide so polling can resume after refresh
      const updates = {
        talkingHeadTaskId: data.taskId,
        talkingHeadAudioUrl: avatarAudioUrl,
        talkingHeadPrompt: avatarPrompt,
      };
      onUpdate({ ...slide, ...updates });
      onAsyncUpdate?.(slide.id, updates);

      toast.info('🗣️ Avatar generation submitted! Polling for completion — you can continue editing.', {
        duration: 8000,
      });

      // Start polling
      startPolling(data.taskId);
    } catch (error: any) {
      console.error('Avatar generation error:', error);
      toast.error(error.message || 'Failed to generate avatar');
      setAvatarGenerating(false);
    }
  };

  // Poll PiAPI for task completion every 30 seconds
  const startPolling = (taskId: string) => {
    setAvatarGenerating(true);
    setAvatarElapsed(0);

    const startTime = Date.now();
    avatarTimerRef.current = setInterval(async () => {
      setAvatarElapsed(Math.floor((Date.now() - startTime) / 1000));

      try {
        const res = await fetch(
          `/api/talking-head-avatar-status?taskId=${encodeURIComponent(taskId)}&apiKey=${encodeURIComponent(avatarApiKey)}`
        );
        const data = await res.json();

        if (data.status === 'completed' && data.videoUrl) {
          // Success! Save video URL and clear task ID
          const updates = {
            talkingHeadVideoUrl: data.videoUrl,
            talkingHeadTaskId: undefined,
          };
          onUpdate({ ...slide, ...updates });
          onAsyncUpdate?.(slide.id, updates);
          toast.success('🎉 Talking head video generated!');
          stopPolling();
        } else if (data.status === 'failed' || data.error) {
          toast.error(data.error || 'Avatar generation failed');
          const updates = { talkingHeadTaskId: undefined };
          onUpdate({ ...slide, ...updates });
          onAsyncUpdate?.(slide.id, updates);
          stopPolling();
        }
        // else: still pending/processing — keep polling
      } catch (err) {
        console.error('Polling error:', err);
        // Don't stop polling on network errors — retry next interval
      }
    }, 30000); // Poll every 30 seconds
  };

  const stopPolling = () => {
    setAvatarGenerating(false);
    setAvatarElapsed(0);
    if (avatarTimerRef.current) {
      clearInterval(avatarTimerRef.current);
      avatarTimerRef.current = null;
    }
  };

  // Resume polling if slide has an active taskId (e.g. after page refresh)
  // Do an immediate status check first to avoid showing "Creating Magic..." for stale tasks
  useEffect(() => {
    if (!slide.talkingHeadTaskId || !avatarApiKey || avatarTimerRef.current) return;

    let cancelled = false;
    const taskId = slide.talkingHeadTaskId;

    (async () => {
      try {
        const res = await fetch(
          `/api/talking-head-avatar-status?taskId=${encodeURIComponent(taskId)}&apiKey=${encodeURIComponent(avatarApiKey)}`
        );
        const data = await res.json();

        if (cancelled) return;

        if (data.status === 'completed' && data.videoUrl) {
          const updates = { talkingHeadVideoUrl: data.videoUrl, talkingHeadTaskId: undefined };
          onUpdate({ ...slide, ...updates });
          onAsyncUpdate?.(slide.id, updates);
          toast.success('Talking head video is ready!');
          return;
        }
        if (data.status === 'failed' || data.error) {
          const updates = { talkingHeadTaskId: undefined };
          onUpdate({ ...slide, ...updates });
          onAsyncUpdate?.(slide.id, updates);
          return;
        }

        // Still pending — now start polling
        if (!cancelled) {
          startPolling(taskId);
        }
      } catch {
        // Network error on initial check — start polling as fallback
        if (!cancelled) {
          startPolling(taskId);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (avatarTimerRef.current) {
        clearInterval(avatarTimerRef.current);
        avatarTimerRef.current = null;
      }
      setAvatarGenerating(false);
    };
  }, [slide.talkingHeadTaskId, avatarApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Main Editor Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6 shadow-sm">

        {/* Save/Cancel + Navigation — top of panel */}
        <div className="pb-4 mb-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-full tabular-nums tracking-wide">
                {currentIndex + 1} / {totalSlides}
              </span>
              <span className="text-[10px] text-gray-300 font-medium hidden sm:inline">
                &#x2318;+Enter to save
              </span>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={onTogglePreview}
                className={`gap-1.5 h-7 text-[10px] px-2.5 uppercase tracking-wider font-bold rounded-full transition-all duration-200 ${showPreviewAll ? 'bg-black text-white hover:bg-black/90 shadow-sm' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
              >
                <BarChart3 className="w-3 h-3" />
                {showPreviewAll ? 'Hide Preview' : 'Preview'}
              </Button>
              {onToggleEmotionalBeats && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleEmotionalBeats}
                  className={`gap-1.5 h-7 text-[10px] px-2.5 uppercase tracking-wider font-bold rounded-full transition-all duration-200 ${showEmotionalBeats ? 'bg-black text-white hover:bg-black/90 shadow-sm' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
                >
                  <Heart className="w-3 h-3" />
                  Beats
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onCancel} className="gap-1 h-8 text-xs text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onPrevious}
                disabled={!canGoPrevious}
                className="gap-1 h-9 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                type="button"
                onClick={handleSaveAndNext}
                disabled={saving || isSaving}
                className="bg-black text-white hover:bg-gray-800 gap-1.5 h-9 px-5 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {(saving || isSaving) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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

        {/* Editor Controls with Tabs */}
        <div className="flex-1 space-y-6">
          
          {/* Custom Tabs Navigation */}
          <div className="flex p-1 bg-gray-50 rounded-2xl border border-gray-100 w-full mb-2 gap-1">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                activeTab === 'text'
                  ? 'bg-white text-black shadow-sm border border-gray-200/80'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Style & Text
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                activeTab === 'media'
                  ? 'bg-white text-black shadow-sm border border-gray-200/80'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Media
              {slide.hasBackgroundImage && activeTab !== 'media' && (
                <span className="absolute top-1.5 right-3 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('avatar')}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                activeTab === 'avatar'
                  ? 'bg-black text-white shadow-md'
                  : 'text-gray-400 hover:text-black hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Talking Head
              {slide.talkingHeadVideoUrl && activeTab !== 'avatar' && (
                <span className="absolute top-1.5 right-3 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>

          {/* TAB CONTENT: STYLE & TEXT */}
          <div className={activeTab === 'text' ? 'block space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'}>
          
          {/* Text Content */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">&#x1F4DD;</span>
              <span className="font-semibold text-sm">Text Content</span>
              <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">(click words to style)</span>
            </div>

            {editingText ? (
              <div className="space-y-3">
                <Textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  className="min-h-[100px] text-sm rounded-xl border-gray-200 focus:border-black focus:ring-1 focus:ring-black transition-all duration-200"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleTextSave} className="bg-black text-white hover:bg-gray-800 rounded-lg gap-1.5">
                    <Check className="w-3 h-3" />
                    Save Text
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingText(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="p-4 rounded-xl border border-gray-100 border-l-4 border-l-black text-sm leading-loose cursor-text bg-gray-50/30 hover:bg-gray-50 transition-colors duration-200 group/text"
                onClick={() => setEditingText(true)}
              >
                <div className="flex flex-wrap gap-y-1">
                  {words.map((word, i) => {
                    const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
                    const isBold = slide.boldWords?.includes(cleanWord);
                    const isUnderlined = slide.underlineWords?.includes(cleanWord);
                    const isRed = slide.redWords?.includes(cleanWord);
                    const isCircled = slide.circleWords?.includes(cleanWord);
                    const hasEmphasis = isBold || isUnderlined || isRed || isCircled;

                    return (
                      <span
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWordClick(word);
                        }}
                        className={`cursor-pointer inline-block px-1 py-0.5 rounded-md transition-all duration-150 hover:bg-gray-200/80 hover:-translate-y-0.5 hover:shadow-sm ${
                          isBold && !isUnderlined && !isRed && !isCircled ? 'font-bold bg-gray-100 rounded-md' : ''
                        } ${isUnderlined ? 'underline decoration-2 decoration-red-400 underline-offset-4 font-medium' : ''} ${
                          isRed ? 'text-red-600 bg-red-50 rounded-md font-medium' : ''
                        } ${isCircled ? 'text-red-600 ring-1 ring-red-300 rounded-full px-1.5' : ''} ${
                          !hasEmphasis ? 'text-gray-700' : ''
                        }`}
                        title={getEmphasisLabel(cleanWord, slide)}
                      >
                        {word}{' '}
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-100 opacity-0 group-hover/text:opacity-100 transition-opacity duration-200">
                  <Pencil className="w-3 h-3 text-gray-300" />
                  <span className="text-[10px] text-gray-300 font-medium">Click to edit text</span>
                </div>
              </div>
            )}
          </div>

          {/* Word Styling Controls */}
          <div className="flex items-center gap-2 bg-gray-50/80 rounded-xl p-2.5 border border-gray-100">
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-gray-900 to-black text-white hover:from-black hover:to-gray-800 rounded-lg shadow-sm transition-all duration-200"
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
            <div className="w-px h-5 bg-gray-200" />
            <Button
              variant="outline"
              size="sm"
              className="gap-1 rounded-lg border-gray-200 hover:border-gray-300 transition-all duration-200"
              onClick={handleBoldAll}
            >
              <Bold className="w-3.5 h-3.5" />
              Bold All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-gray-400 hover:text-red-500 rounded-lg transition-all duration-200"
              onClick={handleClearEmphasis}
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </Button>
            <div className="w-px h-5 bg-gray-200" />
            {(() => {
              const styledCount = (slide.boldWords?.length || 0) + (slide.underlineWords?.length || 0) + (slide.redWords?.length || 0) + (slide.circleWords?.length || 0);
              return styledCount > 0 ? (
                <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded-full">{styledCount} styled</span>
              ) : (
                <span className="text-[10px] text-gray-300 font-medium">No styles applied</span>
              );
            })()}
          </div>

          {/* Slide Styling */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span>&#x1F3A8;</span>
              <span className="font-semibold text-sm">Slide Styling</span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Presets</span>
              <Select
                value={currentPreset}
                onValueChange={(v) => handlePresetChange(v as PresetType)}
              >
                <SelectTrigger className="w-48 rounded-lg">
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

            {/* Gradient divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-5" />

            {/* Background / Text Color / Text Size */}
            <div className="grid grid-cols-3 gap-4">
              {/* Background */}
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 block">Background</span>
                <div className="flex gap-1.5">
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
                      className={`px-3 py-1.5 text-xs rounded-lg border-2 capitalize transition-all duration-200 ${
                        slide.style.background === bg ||
                        (bg === 'image' && (slide.style.background === 'image' || slide.style.background === 'split'))
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      {bg === 'dark' ? 'Dark' : bg === 'image' ? 'Image' : 'White'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Color */}
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 block">Text Color</span>
                <div className="flex gap-1.5">
                  {(['white', 'black'] as const).map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        onUpdate({
                          ...slide,
                          style: { ...slide.style, textColor: color },
                        })
                      }
                      className={`px-4 py-1.5 text-xs rounded-lg border-2 capitalize transition-all duration-200 ${
                        slide.style.textColor === color
                          ? color === 'black'
                            ? 'bg-black text-white border-black shadow-sm'
                            : 'bg-white text-black border-black shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Size */}
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 block">Text Size</span>
                <Select
                  value={String(slide.style.textSize)}
                  onValueChange={(v) =>
                    onUpdate({
                      ...slide,
                      style: { ...slide.style, textSize: Number(v) },
                    })
                  }
                >
                  <SelectTrigger className="w-24 rounded-lg">
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

          {/* Slide Transition */}
          <div>
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-5" />
            <div className="flex items-center gap-2 mb-4">
              <span>&#x1F3AC;</span>
              <span className="font-semibold text-sm">Slide Transition</span>
              <span className="text-[10px] text-gray-400 font-medium ml-auto">
                Transition into this slide
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 block">Effect</span>
                <Select
                  value={slide.transition || 'none'}
                  onValueChange={(v) =>
                    onUpdate({
                      ...slide,
                      transition: v as Slide['transition'],
                    })
                  }
                >
                  <SelectTrigger className="w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'none', label: 'None (Hard Cut)' },
                      { value: 'fade', label: 'Fade' },
                      { value: 'dissolve', label: 'Dissolve' },
                      { value: 'wipeleft', label: 'Wipe Left' },
                      { value: 'wiperight', label: 'Wipe Right' },
                      { value: 'slideleft', label: 'Slide Left' },
                      { value: 'slideright', label: 'Slide Right' },
                      { value: 'slideup', label: 'Slide Up' },
                      { value: 'slidedown', label: 'Slide Down' },
                    ].map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 block">
                  Duration: {(slide.transitionDuration || 0.5).toFixed(1)}s
                </span>
                <input
                  type="range"
                  min="0.3"
                  max="1.5"
                  step="0.1"
                  value={slide.transitionDuration || 0.5}
                  onChange={(e) =>
                    onUpdate({
                      ...slide,
                      transitionDuration: parseFloat(e.target.value),
                    })
                  }
                  disabled={!slide.transition || slide.transition === 'none'}
                  className="w-full accent-black"
                />
              </div>
            </div>
          </div>

          {/* Emotional Context */}
          {(slide.emotionalBeat || slide.visualPrompt) && (
            <div className="space-y-3 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
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
          </div> {/* END TEXT TAB */}

          {/* TAB CONTENT: MEDIA */}
          <div className={activeTab === 'media' ? 'block space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'}>

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
              <div className="mb-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 block">Image Style</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDisplayMode('blurred')}
                    className={`flex-1 px-3 py-3 text-xs rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 ${
                      currentDisplayMode === 'blurred'
                        ? 'border-black bg-gray-50 shadow-sm ring-1 ring-black/5'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="text-base mb-1">&#x1F32B;</div>
                    <div className="font-bold text-[11px] mb-0.5">Blurred</div>
                    <div className="text-gray-400 text-[10px]">Soft backdrop</div>
                  </button>
                  <button
                    onClick={() => handleDisplayMode('crisp')}
                    className={`flex-1 px-3 py-3 text-xs rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 ${
                      currentDisplayMode === 'crisp'
                        ? 'border-black bg-gray-50 shadow-sm ring-1 ring-black/5'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="text-base mb-1">&#x2728;</div>
                    <div className="font-bold text-[11px] mb-0.5">Crisp</div>
                    <div className="text-gray-400 text-[10px]">Full clarity</div>
                  </button>
                  <button
                    onClick={() => handleDisplayMode('split')}
                    className={`flex-1 px-3 py-3 text-xs rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 ${
                      currentDisplayMode === 'split'
                        ? 'border-black bg-gray-50 shadow-sm ring-1 ring-black/5'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="text-base mb-1">&#x25E8;</div>
                    <div className="font-bold text-[11px] mb-0.5">Split</div>
                    <div className="text-gray-400 text-[10px]">Image + text</div>
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
          
          {/* Hidden headshot video input */}
          <input
            ref={headshotVideoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleHeadshotVideoUpload}
          />

          {/* Hidden background image file input */}
          <input
            ref={bgImageUploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBgImageUpload}
          />

          {/* Hidden avatar image file input */}
          <input
            ref={avatarImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarImageUpload}
          />

          {/* Hidden avatar video file input */}
          <input
            ref={avatarVideoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleAvatarVideoUpload}
          />

          {/* Headshot controls (when headshot preset is active) */}
          {slide.headshot && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span>&#x1F464;</span>
                <span className="font-semibold text-sm">Headshot</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => headshotRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {slide.headshot.imageUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => headshotVideoInputRef.current?.click()}
                >
                  <Video className="w-3.5 h-3.5" />
                  {slide.headshot.videoUrl ? 'Change Video' : 'Upload Video'}
                </Button>
                {(slide.headshot.imageUrl || slide.headshot.videoUrl) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 gap-1"
                    onClick={() =>
                      onUpdate({
                        ...slide,
                        headshot: { ...(slide.headshot || {}), imageUrl: undefined, videoUrl: undefined },
                      })
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Media
                  </Button>
                )}
              </div>
              
              {/* Headshot Position Settings */}
              {(slide.headshot.imageUrl || slide.headshot.videoUrl) && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Position (Location)</label>
                  <Select
                    value={slide.headshot.position || 'inline'}
                    onValueChange={(val: any) =>
                      onUpdate({
                        ...slide,
                        headshot: {
                          ...(slide.headshot || {}),
                          position: val === 'inline' ? undefined : val,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inline">Inline Text (Default)</SelectItem>
                          <SelectItem value="headshot-bio">Headshot + Bio</SelectItem>
                          <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}


          </div> {/* END MEDIA TAB */}

          {/* TAB CONTENT: TALKING HEAD AVATAR */}
          <div className={activeTab === 'avatar' ? 'block space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'}>

          {/* 🗣️ Talking Head Avatar Section (Redesigned) */}
          <div className="space-y-6 pt-4 border-t-2 border-black">
            
            {/* Header / Intro */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  TH
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Talking Head Avatar</h3>
                  <p className="text-[10px] text-gray-500 font-medium">Create a synchronized video spokesperson</p>
                </div>
              </div>
              
              {/* API Key Inline (Subtle) */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">PiAPI Key</span>
                <Input
                  type="password"
                  value={avatarApiKeyLocal}
                  onChange={(e) => {
                    setAvatarApiKey(e.target.value);
                    localStorage.setItem('vsl123-piapi-key', e.target.value);
                  }}
                  placeholder="Paste Key"
                  className="h-7 w-24 text-[10px] font-mono border-gray-200 focus:border-black focus:ring-0 rounded bg-gray-50 text-center"
                />
              </div>
            </div>

            {/* Main Avatar Creation Area */}
            <div className="grid grid-cols-[100px_1fr] gap-6">
              
              {/* Left: Avatar Face Upload */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block text-center">Face</span>
                
                {slide.talkingHeadImage ? (
                  <div className="relative group w-full aspect-square">
                    <div className="w-full h-full rounded-xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white transition-transform group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                      <img
                        src={slide.talkingHeadImage}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay Action */}
                      <button
                        onClick={() => avatarImageInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1"
                      >
                        <Pencil className="w-4 h-4" />
                        <span className="text-[9px] font-bold uppercase">Change</span>
                      </button>
                    </div>
                    
                    <button
                      onClick={handleRemoveAvatar}
                      className="absolute -top-2 -right-2 bg-white border-2 border-black rounded-full p-1 shadow-sm hover:bg-gray-100 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove"
                    >
                      <X className="w-3 h-3 text-black" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => avatarImageInputRef.current?.click()}
                    className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-black hover:bg-gray-50 flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 group-hover:text-black uppercase">Upload</span>
                  </button>
                )}
              </div>

              {/* Right: Configuration */}
              <div className="space-y-4">
                
                {/* Inputs Group */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-black uppercase tracking-wider mb-1.5 flex justify-between">
                      <span>Script / Prompt</span>
                      <span className="text-gray-400 font-normal normal-case">Describe how they speak</span>
                    </label>
                    <Input
                      value={avatarPrompt}
                      onChange={(e) => setAvatarPrompt(e.target.value)}
                      onBlur={() => {
                        if (avatarPrompt !== (slide.talkingHeadPrompt || '')) {
                          onUpdate({ ...slide, talkingHeadPrompt: avatarPrompt });
                        }
                      }}
                      placeholder="e.g. Speaks with confidence and energy..."
                      className="h-9 text-xs border-gray-300 focus:border-black focus:ring-1 focus:ring-black rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-black uppercase tracking-wider mb-1.5 flex justify-between">
                      <span>Audio Source</span>
                      {slide.audioUrl && <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-bold">AUTO-LINKED</span>}
                    </label>
                    <div className="relative">
                      <Input
                        value={avatarAudioUrl}
                        onChange={(e) => setAvatarAudioUrl(e.target.value)}
                        onBlur={() => {
                          if (avatarAudioUrl !== (slide.talkingHeadAudioUrl || slide.audioUrl || '')) {
                            onUpdate({ ...slide, talkingHeadAudioUrl: avatarAudioUrl });
                          }
                        }}
                        placeholder="https://... (Audio URL)"
                        className="h-9 text-xs border-gray-300 focus:border-black focus:ring-1 focus:ring-black rounded-lg pr-8 font-mono"
                      />
                      {avatarAudioUrl && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Audio linked" />
                      )}
                    </div>
                  </div>

                  {/* ElevenLabs Voice Generation */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <Mic className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-[10px] font-bold text-black uppercase tracking-wider">Generate Voice</span>
                      {elConnected && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">Connected</span>
                      )}
                    </div>

                    {/* API Key + Connect */}
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={elApiKey}
                        onChange={(e) => setElApiKey(e.target.value)}
                        placeholder="ElevenLabs API Key"
                        className="h-8 text-[10px] font-mono border-gray-200 focus:border-black focus:ring-0 rounded-lg flex-1"
                      />
                      <Button
                        size="sm"
                        variant={elConnected ? 'outline' : 'default'}
                        onClick={handleElConnect}
                        className={`h-8 text-[10px] font-bold uppercase tracking-wider rounded-lg px-3 ${elConnected ? 'border-green-300 text-green-700' : 'bg-black text-white hover:bg-gray-800'}`}
                      >
                        {elConnected ? <Check className="w-3 h-3" /> : 'Connect'}
                      </Button>
                    </div>

                    {/* Voice Selection */}
                    {elConnected && elVoices.length > 0 && (
                      <div className="space-y-2">
                        {/* Search Input */}
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                          <Input
                            value={elVoiceSearch}
                            onChange={(e) => setElVoiceSearch(e.target.value)}
                            placeholder="Search voices..."
                            className="h-8 text-[10px] border-gray-200 focus:border-black focus:ring-0 rounded-lg pl-7"
                          />
                        </div>

                        {/* Voice List */}
                        <div className="max-h-[160px] overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-50">
                          {elVoices
                            .filter((v) => {
                              if (!elVoiceSearch.trim()) return true;
                              const q = elVoiceSearch.toLowerCase();
                              return v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q);
                            })
                            .map((v) => (
                              <button
                                key={v.voice_id}
                                type="button"
                                onClick={() => {
                                  setElVoiceId(v.voice_id);
                                  localStorage.setItem('vsl123-elevenlabs-voice', v.voice_id);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-100 ${
                                  elVoiceId === v.voice_id
                                    ? 'bg-black text-white'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                {v.category === 'cloned' && (
                                  <span className={`text-[10px] ${elVoiceId === v.voice_id ? 'text-yellow-300' : 'text-yellow-500'}`}>★</span>
                                )}
                                <span className="text-xs font-medium flex-1 truncate">{v.name}</span>
                                <span className={`text-[9px] font-medium ${elVoiceId === v.voice_id ? 'text-gray-300' : 'text-gray-400'}`}>{v.category}</span>
                                {elVoiceId === v.voice_id && <Check className="w-3 h-3 flex-shrink-0" />}
                              </button>
                            ))}
                          {elVoices.filter((v) => {
                            if (!elVoiceSearch.trim()) return true;
                            const q = elVoiceSearch.toLowerCase();
                            return v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q);
                          }).length === 0 && (
                            <div className="px-3 py-4 text-center text-[10px] text-gray-400">No voices match your search</div>
                          )}
                        </div>

                        {/* Generate Voice Button */}
                        <Button
                          size="sm"
                          onClick={handleGenerateVoice}
                          disabled={!elVoiceId || elGenerating}
                          className="w-full h-9 bg-gradient-to-r from-gray-900 to-black text-white hover:from-black hover:to-gray-800 rounded-lg font-bold text-[10px] uppercase tracking-wider gap-2 disabled:opacity-50"
                        >
                          {elGenerating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5" />
                              Generate Voice for This Slide
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Audio Preview */}
                    {avatarAudioUrl && (
                      <audio src={avatarAudioUrl} controls className="w-full h-8 mt-1" />
                    )}
                  </div>
                </div>

                {/* Generate Action */}
                <div className="pt-1">
                  <Button
                    onClick={handleGenerateAvatar}
                    disabled={!slide.talkingHeadImage || avatarGenerating || !avatarApiKeyLocal.trim()}
                    className="w-full h-11 bg-black text-white hover:bg-gray-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(200,200,200,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(200,200,200,1)] hover:bg-black transition-all rounded-lg font-bold uppercase tracking-wider disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
                  >
                    {avatarGenerating ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Magic... {avatarElapsed > 0 && `(${avatarElapsed}s)`}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Video</span>
                      </div>
                    )}
                  </Button>
                  {!slide.talkingHeadImage && (
                    <p className="text-[10px] text-center text-gray-400 mt-2 font-medium">
                      Upload a face image first to enable generation
                    </p>
                  )}
                </div>

              </div>
            </div>


            {/* Separator */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400 font-bold tracking-widest">OR</span>
              </div>
            </div>


            {/* Custom Video / Result Area */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <Video className="w-3.5 h-3.5" />
                  Video Output
                </h4>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => avatarVideoInputRef.current?.click()}
                  className="h-7 text-[10px] font-bold border-gray-300 hover:border-black hover:bg-white uppercase tracking-wider"
                >
                  Upload Custom Video
                </Button>
              </div>

              {slide.talkingHeadVideoUrl ? (
                <div className="space-y-4">
                  {/* Video Player */}
                  <div className="relative rounded-lg overflow-hidden border-2 border-black shadow-md bg-black">
                    <video
                      src={slide.talkingHeadVideoUrl}
                      controls
                      className="w-full max-h-[240px]" 
                    />
                    {slide.talkingHeadTaskId && (
                      <div className="absolute top-2 right-2 bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm border border-white/20 uppercase tracking-wider">
                        AI Generated
                      </div>
                    )}
                  </div>

                  {/* Display Options */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-black transition-colors">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${slide.talkingHeadAsHeadshot ? 'border-black bg-black' : 'border-gray-300'}`}>
                        {slide.talkingHeadAsHeadshot && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={!!slide.talkingHeadAsHeadshot}
                        onChange={(e) => onUpdate({ ...slide, talkingHeadAsHeadshot: e.target.checked })}
                      />
                      <span className="text-xs font-bold text-gray-700">Floating Headshot</span>
                    </label>

                    {slide.talkingHeadAsHeadshot && (
                      <div className="space-y-2">
                         <Select
                          value={slide.talkingHeadPosition || 'bottom-right'}
                          onValueChange={(val: any) =>
                            onUpdate({
                              ...slide,
                              talkingHeadPosition: val,
                            })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs font-bold border-gray-200">
                            <SelectValue placeholder="Position" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inline">Inline Text (Default)</SelectItem>
                            <SelectItem value="headshot-bio">Headshot + Bio</SelectItem>
                            <SelectItem value="top-left">Top Left</SelectItem>
                            <SelectItem value="top-right">Top Right</SelectItem>
                            <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Size Slider (if floating) */}
                  {slide.talkingHeadAsHeadshot && (
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>Size</span>
                        <span>{slide.talkingHeadSize || 160}px</span>
                      </div>
                      <Slider
                        value={[slide.talkingHeadSize || 160]}
                        min={100}
                        max={400}
                        step={10}
                        onValueChange={([v]) =>
                          onUpdate({
                            ...slide,
                            talkingHeadSize: v,
                          })
                        }
                        className="py-1"
                      />
                    </div>
                  )}

                  {/* Border Color */}
                  {slide.talkingHeadAsHeadshot && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Frame Color</span>
                        <span className="text-[10px] text-gray-400 font-mono">{slide.talkingHeadBorderColor || '#818cf8'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {['#818cf8', '#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', 'transparent'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => onUpdate({ ...slide, talkingHeadBorderColor: color })}
                            className={`w-6 h-6 rounded-full border-2 transition-all duration-150 hover:scale-110 ${
                              (slide.talkingHeadBorderColor || '#818cf8') === color
                                ? 'ring-2 ring-black ring-offset-1 scale-110'
                                : 'border-gray-200'
                            } ${color === 'transparent' ? 'bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]' : ''}`}
                            style={color !== 'transparent' ? { backgroundColor: color } : undefined}
                            title={color === 'transparent' ? 'No border' : color}
                          />
                        ))}
                        <div className="w-px h-5 bg-gray-200 mx-1" />
                        <label className="relative cursor-pointer" title="Custom color">
                          <input
                            type="color"
                            value={slide.talkingHeadBorderColor || '#818cf8'}
                            onChange={(e) => onUpdate({ ...slide, talkingHeadBorderColor: e.target.value })}
                            className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer"
                          />
                          <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-black transition-colors">
                            <Pencil className="w-2.5 h-2.5 text-gray-400" />
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div 
                  onClick={() => avatarVideoInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-lg h-32 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-black hover:bg-white transition-all group"
                >
                  <Video className="w-6 h-6 text-gray-300 group-hover:text-black transition-colors" />
                  <p className="text-xs font-medium text-gray-400 group-hover:text-black">No video yet</p>
                </div>
              )}
            </div>

          </div>
          </div> {/* END TALKING HEAD TAB */}

          {/* Apply to all Toggle */}
          <div className="pt-4">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />
            <button
              onClick={() => setApplyToAll(!applyToAll)}
              className={`flex items-center gap-3 group px-4 py-3 cursor-pointer rounded-xl border-2 transition-all duration-200 w-full ${
                applyToAll ? 'border-black bg-gray-50 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
              }`}
              type="button"
            >
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out flex-shrink-0 ${
                  applyToAll ? 'bg-black' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                    applyToAll ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
              <span className={`text-sm font-semibold transition-colors ${applyToAll ? 'text-black' : 'text-gray-500 group-hover:text-gray-700'}`}>
                Apply style to all remaining slides
              </span>
            </button>
          </div>

        </div> {/* End of Editor Controls Wrapper */}

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
    </>
  );
}