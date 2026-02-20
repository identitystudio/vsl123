'use client';

import { useState, useCallback } from 'react';
import {
  Heart,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Video,
  Image as ImageIcon,
  Sparkles,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useUpdateProject } from '@/hooks/use-project';
import type { Slide } from '@/types';

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
  onApplyToSlide: (url: string, type: 'image' | 'video', slideIds: string[]) => void;
  onGoToSlide: (slideId: string) => void;
}

export function EmotionalBeatsSidebar({
  projectId,
  emotionalBeats,
  originalScript,
  slides,
  onApplyToSlide,
  onGoToSlide,
}: EmotionalBeatsSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<Record<number, boolean>>({});
  const [generatingVideo, setGeneratingVideo] = useState<Record<number, boolean>>({});
  const updateProject = useUpdateProject();

  // Analyze the script for 8 emotional beats
  const handleAnalyzeScript = useCallback(async () => {
    if (!originalScript || originalScript.trim().length === 0) {
      toast.error('No script found. Please add a script first.');
      return;
    }

    setIsAnalyzing(true);
    toast.info('Analyzing script for emotional beats...');

    try {
      const res = await fetch('/api/analyze-script-beats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: originalScript,
          slides: slides.map((s) => ({ id: s.id, fullScriptText: s.fullScriptText })),
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

      if (!beat.visualPrompt) {
        toast.error('No visual prompt available for this beat');
        setGeneratingImage((prev) => ({ ...prev, [index]: false }));
        return;
      }

      setGeneratingImage((prev) => ({ ...prev, [index]: true }));
      toast.info(`Generating image for "${beat.name}"...`);

      try {
        console.log(`Sending prompt for beat ${index}:`, beat.visualPrompt);
        const res = await fetch('/api/generate-beat-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: beat.visualPrompt }),
        });

        if (!res.ok) {
          const text = await res.text();
          let errMessage = 'Image generation failed';
          try {
             const json = JSON.parse(text);
             errMessage = json.error || errMessage;
          } catch (e) {
             errMessage = `Request failed (${res.status}): ${text.substring(0, 100)}`;
          }
          throw new Error(errMessage);
        }

        const data = await res.json();

        if (!data.imageUrl) {
          throw new Error('No image returned from API');
        }

        // Update the beat with the image URL
        const updatedBeats = emotionalBeats.map((b, i) =>
          i === index ? { ...b, imageUrl: data.imageUrl } : b
        );

        await updateProject.mutateAsync({
          projectId,
          updates: { emotional_beats: updatedBeats },
        });

        toast.success(`Image generated for "${beat.name}"`);
      } catch (error: any) {
        console.error('Generate image error:', error.message || error);
        toast.error(error.message || 'Failed to generate image');
      } finally {
        setGeneratingImage((prev) => ({ ...prev, [index]: false }));
      }
    },
    [emotionalBeats, projectId, updateProject, onApplyToSlide]
  );

  // Generate video for a specific beat (requires image first)
  const handleGenerateVideo = useCallback(
    async (index: number) => {
      const beat = emotionalBeats[index];
      if (!beat) return;

      if (!beat.imageUrl) {
        toast.error('Generate an image first before creating a video.');
        return;
      }

      setGeneratingVideo((prev) => ({ ...prev, [index]: true }));
      toast.info(`Generating video for "${beat.name}"... This may take a few minutes.`);

      try {
        const res = await fetch('/api/image-to-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: beat.imageUrl,
            prompt: beat.videoPrompt,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Video generation failed');
        }

        const data = await res.json();
        const videoUrl = data.videoData
          ? `data:video/mp4;base64,${data.videoData}`
          : data.videoUri;

        if (!videoUrl) {
          throw new Error('No video returned');
        }

        // Update the beat with the video URL
        const updatedBeats = emotionalBeats.map((b, i) =>
          i === index ? { ...b, videoUrl } : b
        );

        await updateProject.mutateAsync({
          projectId,
          updates: { emotional_beats: updatedBeats },
        });

        toast.success(`Video generated for "${beat.name}"`);
      } catch (error: any) {
        console.error('Generate video error:', error);
        toast.error(error.message || 'Failed to generate video');
      } finally {
        setGeneratingVideo((prev) => ({ ...prev, [index]: false }));
      }
    },
    [emotionalBeats, projectId, updateProject, onApplyToSlide]
  );

  // Collapsed state
  if (!isOpen) {
    return (
      <div className="fixed right-0 top-14 w-12 border-l border-gray-200 bg-white flex flex-col items-center py-4 gap-4 h-[calc(100vh-3.5rem)] z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="hover:bg-purple-50 text-purple-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <Heart className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-[10px] font-medium text-gray-500 rotate-90 whitespace-nowrap mt-8">
            Emotional Beats
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-14 w-80 border-l border-gray-200 bg-white flex flex-col h-[calc(100vh-3.5rem)] z-40 shadow-xl">
      {/* Header */}
      <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-purple-100">
            <Heart className="w-4 h-4 text-purple-600 fill-purple-100" />
          </div>
          <span className="font-semibold text-gray-800">Emotional Beats</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="hover:bg-white/50"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </Button>
      </div>

      {/* Analyze Button — always visible */}
      <div className="px-4 py-3 border-b border-gray-100">
        <Button
          onClick={handleAnalyzeScript}
          disabled={isAnalyzing || !originalScript}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium text-sm h-9 gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing Script...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analyze Script for 8 Beats
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 thin-scrollbar">
        {emotionalBeats.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No emotional beats yet.</p>
            <p className="text-xs mt-1 text-gray-400">
              Click &quot;Analyze Script&quot; above to break your script into 8 emotional beats.
            </p>
          </div>
        ) : (
          emotionalBeats.map((beat, index) => {
            const isImgLoading = generatingImage[index] || false;
            const isVidLoading = generatingVideo[index] || false;

            return (
              <div
                key={index}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Beat Header */}
                <div className="px-3 py-2.5 bg-gradient-to-r from-purple-50/80 to-pink-50/80 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-800 truncate">{beat.name}</h3>
                      <span className="text-[10px] text-purple-600 font-medium px-1.5 py-0.5 bg-purple-100 rounded-full">
                        {beat.emotion}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    {beat.scriptExcerpt && (
                      <p className="text-[10px] text-gray-500 line-clamp-1 italic flex-1 mr-2">
                        {beat.scriptExcerpt}
                      </p>
                    )}
                    {beat.slideIds && beat.slideIds.length > 0 && (
                      <Button
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] text-purple-600 hover:bg-purple-100 gap-1 shrink-0"
                        onClick={() => onGoToSlide(beat.slideIds[0])}
                      >
                        <Eye className="w-3 h-3" />
                        {beat.slideIds.length} slides
                      </Button>
                    )}
                  </div>
                </div>

                {/* Media Preview */}
                <div className="p-3 space-y-2">
                  {/* Image/Video preview */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Image preview */}
                    <div className="space-y-1.5">
                      <div className="relative aspect-video bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                        {beat.imageUrl ? (
                          <img
                            src={beat.imageUrl}
                            alt={beat.name}
                            className="w-full h-full object-cover"
                          />
                        ) : isImgLoading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                            <span className="text-[9px] text-gray-400">Generating...</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Video preview */}
                    <div className="space-y-1.5">
                      <div className="relative aspect-video bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                      {beat.videoUrl ? (
                          <video
                            src={beat.videoUrl}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        ) : isVidLoading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <Loader2 className="w-5 h-5 text-pink-600 animate-spin" />
                            <span className="text-[9px] text-gray-400">Generating...</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300">
                            <Video className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-7 text-[11px] gap-1 font-medium border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                      onClick={() => handleGenerateImage(index)}
                      disabled={isImgLoading}
                    >
                      {isImgLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ImageIcon className="w-3 h-3" />
                      )}
                      {beat.imageUrl ? 'Regenerate' : 'Generate'} Image
                    </Button>

                    <Button
                      variant="outline"
                      className="h-7 text-[11px] gap-1 font-medium border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800"
                      onClick={() => handleGenerateVideo(index)}
                      disabled={isVidLoading || !beat.imageUrl}
                      title={!beat.imageUrl ? 'Generate an image first' : ''}
                    >
                      {isVidLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Video className="w-3 h-3" />
                      )}
                      {beat.videoUrl ? 'Regenerate' : 'Generate'} Video
                    </Button>
                  </div>

                  {/* Apply to slides buttons */}
                  {beat.slideIds && beat.slideIds.length > 0 && (beat.imageUrl || beat.videoUrl) && (
                    <div className="grid grid-cols-2 gap-2">
                      {beat.imageUrl && (
                        <Button
                          variant="default"
                          className="h-7 text-[11px] gap-1 font-medium bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => {
                            onApplyToSlide(beat.imageUrl!, 'image', beat.slideIds);
                            toast.success(`Image applied to ${beat.slideIds.length} slides`);
                          }}
                        >
                          <ImageIcon className="w-3 h-3" />
                          Apply to {beat.slideIds.length} Slides
                        </Button>
                      )}
                      {beat.videoUrl && (
                        <Button
                          variant="default"
                          className="h-7 text-[11px] gap-1 font-medium bg-pink-600 hover:bg-pink-700 text-white"
                          onClick={() => {
                            onApplyToSlide(beat.videoUrl!, 'video', beat.slideIds);
                            toast.success(`Video applied to ${beat.slideIds.length} slides`);
                          }}
                        >
                          <Video className="w-3 h-3" />
                          Apply to {beat.slideIds.length} Slides
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Prompt preview */}
                  <p
                    className="text-[9px] text-gray-400 line-clamp-2 italic leading-tight"
                    title={beat.visualPrompt}
                  >
                    &quot;{beat.visualPrompt}&quot;
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
