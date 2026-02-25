'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Heart,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Video,
  Image as ImageIcon,
  Sparkles,
  Eye,
  Send,
  Target,
  Palette,
  Camera,
  BarChart3,
  Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useUpdateProject } from '@/hooks/use-project';
import type { Slide, ImageGenerationTheme } from '@/types';

interface EmotionalBeat {
  name: string;
  emotion: string;
  visualPrompt: string;
  videoPrompt: string;
  slideIds: string[];
  scriptExcerpt?: string;
  imageUrl?: string;
  videoUrl?: string;
}

interface EmotionalBeatsSidebarProps {
  projectId: string;
  emotionalBeats: EmotionalBeat[];
  originalScript: string;
  slides: Slide[];
  currentSlideIndex: number;
  onApplyToSlide: (url: string, type: 'image' | 'video', slideIds: string[]) => void;
  onGoToSlide: (slideId: string) => void;
}

export function EmotionalBeatsSidebar({
  projectId,
  emotionalBeats,
  originalScript,
  slides,
  currentSlideIndex,
  onApplyToSlide,
  onGoToSlide,
}: EmotionalBeatsSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<Record<number, boolean>>({});
  const [generatingVideo, setGeneratingVideo] = useState<Record<number, boolean>>({});
  const [manualInputs, setManualInputs] = useState<Record<number, string>>({});
  const [selectedTheme, setSelectedTheme] = useState<ImageGenerationTheme>('realism');
  const [apiKey, setApiKey] = useState('');
  const updateProject = useUpdateProject();

  useEffect(() => {
    setApiKey(localStorage.getItem('vsl123-webhook-api-key') || '');
  }, []);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    if (val) {
      localStorage.setItem('vsl123-webhook-api-key', val);
    } else {
      localStorage.removeItem('vsl123-webhook-api-key');
    }
  };

  // Analyze the script for emotional beats
  const handleAnalyzeScript = useCallback(async () => {
    if (!originalScript || originalScript.trim().length === 0) {
      toast.error('No script found. Please add a script first.');
      return;
    }

    setIsAnalyzing(true);
    toast.info('Analyzing script for emotional beats...');

    try {
      const beatCount = Math.min(slides.length, 8);
      const res = await fetch('/api/analyze-script-beats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: originalScript,
          slides: slides.map((s) => ({ id: s.id, fullScriptText: s.fullScriptText })),
          beatCount
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to analyze script');
      }

      const data = await res.json();

      if (!data.beats || !Array.isArray(data.beats)) {
        throw new Error('Invalid response from analysis');
      }

      // Save beats to project
      await updateProject.mutateAsync({
        projectId,
        updates: { emotional_beats: data.beats },
      });

      toast.success(`Found ${data.beats.length} emotional beats!`);
    } catch (error: any) {
      console.error('Analyze script error:', error);
      toast.error(error.message || 'Failed to analyze script');
    } finally {
      setIsAnalyzing(false);
    }
  }, [originalScript, slides, projectId, updateProject]);

  // Generate image for a specific beat
  const handleGenerateImage = useCallback(
    async (index: number) => {
      const beat = emotionalBeats[index];
      if (!beat) return;

      setGeneratingImage((prev) => ({ ...prev, [index]: true }));
      toast.info(`Generating image for "${beat.name}"...`);

      try {
        const res = await fetch('/api/generate-beat-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: beat.visualPrompt, theme: selectedTheme }),
        });

        if (!res.ok) throw new Error('Image generation failed');
        const data = await res.json();
        if (!data.imageUrl) throw new Error('No image returned');

        const updatedBeats = emotionalBeats.map((b, i) =>
          i === index ? { ...b, imageUrl: data.imageUrl } : b
        );

        await updateProject.mutateAsync({
          projectId,
          updates: { emotional_beats: updatedBeats },
        });

        toast.success(`Image generated for "${beat.name}"`);
      } catch (error: any) {
        toast.error('Failed to generate image');
      } finally {
        setGeneratingImage((prev) => ({ ...prev, [index]: false }));
      }
    },
    [emotionalBeats, projectId, updateProject, selectedTheme]
  );

  // Generate video for a specific beat
  const handleGenerateVideo = useCallback(
    async (index: number) => {
      const beat = emotionalBeats[index];
      if (!beat || !beat.imageUrl) return;

      setGeneratingVideo((prev) => ({ ...prev, [index]: true }));
      toast.info(`Generating video for "${beat.name}"...`);

      try {
        const currentApiKey = apiKey || localStorage.getItem('vsl123-webhook-api-key') || '';
        const res = await fetch('/api/image-to-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: beat.imageUrl,
            prompt: beat.videoPrompt,
            theme: selectedTheme,
            apiKey: currentApiKey,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Video generation failed');
        }
        const data = await res.json();
        const videoUrl = data.videoUri;
        if (!videoUrl) throw new Error('No video returned');

        const updatedBeats = emotionalBeats.map((b, i) =>
          i === index ? { ...b, videoUrl } : b
        );

        await updateProject.mutateAsync({
          projectId,
          updates: { emotional_beats: updatedBeats },
        });

        toast.success(`Video generated for "${beat.name}"`);
      } catch (error: any) {
        toast.error(error.message || 'Failed to generate video');
      } finally {
        setGeneratingVideo((prev) => ({ ...prev, [index]: false }));
      }
    },
    [emotionalBeats, projectId, updateProject, selectedTheme, apiKey]
  );

  const handleManualApply = useCallback((url: string, type: 'image' | 'video', beatIndex: number) => {
    const input = manualInputs[beatIndex];
    if (!input) {
      toast.error('Please enter a slide number');
      return;
    }

    const slideNum = parseInt(input);
    if (isNaN(slideNum) || slideNum < 1 || slideNum > slides.length) {
      toast.error(`Invalid slide number (1-${slides.length})`);
      return;
    }

    const targetSlide = slides[slideNum - 1];
    onApplyToSlide(url, type, [targetSlide.id]);
    toast.success(`Applied to slide ${slideNum}`);
  }, [manualInputs, slides, onApplyToSlide]);

  if (!isOpen) {
    return (
      <div className="fixed right-0 top-14 w-12 border-l border-gray-200 bg-white flex flex-col items-center py-4 gap-4 h-[calc(100vh-3.5rem)] z-40">
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="text-black">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col items-center gap-2">
          <Heart className="w-4 h-4 text-black" />
          <span className="text-[10px] font-medium text-gray-500 rotate-90 whitespace-nowrap mt-8">
            Emotional Beats
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-14 w-[450px] border-l border-gray-200 bg-white flex flex-col h-[calc(100vh-3.5rem)] z-40 shadow-xl overflow-hidden">
      <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 bg-white">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-black" />
          <span className="font-semibold text-black">Emotional Beats</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3">
        <Button
          onClick={handleAnalyzeScript}
          disabled={isAnalyzing || !originalScript}
          className="w-full bg-black hover:bg-gray-800 text-white text-sm h-9 gap-2"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Re-Analyze Script
        </Button>

        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
          <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 mb-1">
            <Key className="w-3 h-3" /> Pi API Key
          </div>
          <p className="text-[9px] text-gray-500 mb-2 leading-tight">
            No key?{" "}
            <a 
              href="https://piapi.ai/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-black hover:underline font-bold"
            >
              Click here to top up
            </a>
          </p>
          <Input 
            type="password"
            placeholder="Enter Pi API key..."
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            className="h-7 text-[11px] bg-white focus-visible:ring-black"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 thin-scrollbar">
        {emotionalBeats.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No beats analyzed yet.</p>
          </div>
        ) : (
          emotionalBeats.map((beat, index) => (
            <div key={index} className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {index + 1}
                  </span>
                  <h3 className="text-xs font-bold text-gray-800 truncate">{beat.name}</h3>
                </div>
                <Button
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-black gap-1"
                  onClick={() => onGoToSlide(beat.slideIds[0])}
                >
                  <Eye className="w-3 h-3" />
                  View Start
                </Button>
              </div>

              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border">
                    {beat.imageUrl ? (
                      <img 
                        src={`${beat.imageUrl}${beat.imageUrl.includes('?') ? '&' : '?'}v=${Date.now()}`} 
                        className="w-full h-full object-cover" 
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : generatingImage[index] ? (
                      <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300"><ImageIcon /></div>
                    )}
                  </div>
                  <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border">
                    {beat.videoUrl ? (
                      <video src={beat.videoUrl} className="w-full h-full object-cover" muted autoPlay loop />
                    ) : generatingVideo[index] ? (
                      <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300"><Video /></div>
                    )}
                  </div>
                </div>

                {/* Theme Selector */}
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedTheme('realism')}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                      selectedTheme === 'realism'
                        ? 'bg-white shadow-sm text-black ring-1 ring-black'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Camera className="w-3 h-3" />
                    Realism
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTheme('infographic')}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                      selectedTheme === 'infographic'
                        ? 'bg-white shadow-sm text-black ring-1 ring-black'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3" />
                    Infographic
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-7 text-[10px] gap-1"
                    onClick={() => handleGenerateImage(index)}
                    disabled={generatingImage[index]}
                  >
                    <ImageIcon className="w-3 h-3" />
                    {beat.imageUrl ? 'Regen' : 'Gen'} Image
                  </Button>
                  <Button
                    variant="outline"
                    className="h-7 text-[10px] gap-1"
                    onClick={() => handleGenerateVideo(index)}
                    disabled={generatingVideo[index] || !beat.imageUrl}
                  >
                    <Video className="w-3 h-3" />
                    {beat.videoUrl ? 'Regen' : 'Gen'} Video
                  </Button>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Apply Visuals</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-[10px] bg-black hover:bg-gray-800"
                      onClick={() => onApplyToSlide(beat.videoUrl || beat.imageUrl || '', beat.videoUrl ? 'video' : 'image', [beat.slideIds[0]])}
                      disabled={!beat.imageUrl && !beat.videoUrl}
                    >
                      Apply: First Slide
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[10px] bg-white border border-gray-200 hover:bg-gray-100 text-black"
                      onClick={() => onApplyToSlide(beat.videoUrl || beat.imageUrl || '', beat.videoUrl ? 'video' : 'image', [slides[currentSlideIndex].id])}
                      disabled={!beat.imageUrl && !beat.videoUrl}
                    >
                      Apply: Current
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Slide #"
                        className="h-7 text-[10px] pr-8 focus-visible:ring-black"
                        value={manualInputs[index] || ''}
                        onChange={(e) => setManualInputs(prev => ({ ...prev, [index]: e.target.value }))}
                      />
                      <Target className="absolute right-2 top-1.5 w-3.5 h-3.5 text-gray-300" />
                    </div>
                    <Button
                      size="sm"
                      className="h-7 px-2 bg-black hover:bg-gray-800"
                      onClick={() => handleManualApply(beat.videoUrl || beat.imageUrl || '', beat.videoUrl ? 'video' : 'image', index)}
                      disabled={!beat.imageUrl && !beat.videoUrl}
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
