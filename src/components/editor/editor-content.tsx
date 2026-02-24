'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Zap, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProject, useUpdateProject, useUpdateSlides } from '@/hooks/use-project';
import { StepIndicator } from './step-indicator';
import { ScriptInput } from './script-input';
import { SlideReviewer } from './slide-reviewer';
import { AudioSetup } from './audio-setup';
import { PreviewExport } from './preview-export';
import { EmotionalBeatsSidebar } from './emotional-beats-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EditorStep, Slide } from '@/types';
import { toast } from 'sonner';

const MAGIC_QUOTES = [
  'Your vision is about to come to life...',
  'Scene by scene. Slide by slide. Your funnel is being born.',
  'Every word in your script is being turned into a conversion machine.',
  'Almost there... your future audience has no idea what\'s coming.',
  'Relax. We\'ve got your script—the hard part is already done.',
  'No design degree needed. Your words are doing the heavy lifting.',
  'Think of what you\'ll do with all that time you just got back...',
  'This is the part where you get your weekends back.',
  'Your message deserves to be seen. We\'re making sure it will be.',
  'While your competitors fumble with Canva, you\'re already launching.',
  'It was never about the tools. It was about finding the right one.',
  'You always knew there had to be a faster way. There is.',
  'No more $5K agency invoices for a simple slide deck.',
  'Freelancers who take 3 weeks? You\'re doing it in 3 minutes.',
  'After this? Maybe that guitar lesson. Or a walk with the kids.',
  'The painting, the traveling, the living—it starts after this click.',
  'This is really happening.',
  'Your VSL is being assembled right now.',
  'Every hour you spent struggling with other editors led you here.',
  'You were right—VSLs shouldn\'t take weeks to produce.'
];

interface EditorContentProps {
  projectId: string;
}

const AUTO_BEAT_IMAGE_DELAY_MS = 2500;
const AUTO_BEAT_VIDEO_DELAY_MS = 12000;

export function EditorContent({ projectId }: EditorContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: project, isLoading, refetch } = useProject(projectId);
  const updateProject = useUpdateProject();
  const updateSlides = useUpdateSlides();


  const [step, setStep] = useState<EditorStep>(1);
  const [hasSetInitialStep, setHasSetInitialStep] = useState(false);
  const [forceSlideView, setForceSlideView] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [initialSlideIndex, setInitialSlideIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isEditingSlide, setIsEditingSlide] = useState(false);
  const [autoEdit, setAutoEdit] = useState(false);
  const [autoPipelineLoading, setAutoPipelineLoading] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<'analyzing' | 'imaging' | 'motion' | 'finishing'>('analyzing');
  const [quoteIndex, setQuoteIndex] = useState(0);
  const autoPipelineRunningRef = useRef(false);

  useEffect(() => {
    if (!autoPipelineLoading) return;
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % MAGIC_QUOTES.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [autoPipelineLoading]);

  // Prefetch dashboard to speed up "Back" navigation
  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  const isNewProject = searchParams.get('new') === '1';

  // Auto-set the step based on project state or query param
  useEffect(() => {
    if (!project || hasSetInitialStep) return;

    const queryStep = searchParams.get('step');
    if (queryStep) {
      setStep(parseInt(queryStep) as EditorStep);
    } else if (project.slides && project.slides.length > 0) {
      setStep(2);
    }
    setHasSetInitialStep(true);
  }, [project, searchParams, hasSetInitialStep]);

  useEffect(() => {
    if (!isNewProject || project) return;
    const interval = setInterval(() => {
      refetch();
    }, 750);
    return () => clearInterval(interval);
  }, [isNewProject, project, refetch]);

  useEffect(() => {
    if (isNewProject && project) {
      router.replace(`/editor/${projectId}`);
    }
  }, [isNewProject, project, projectId, router]);

  const currentStep = (() => {
    if (!project) return step;
    if (project.slides.length === 0) return 1 as EditorStep;
    return step;
  })();

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else if (currentStep === 2 && !forceSlideView && project?.slides.every(s => s.reviewed)) {
      setForceSlideView(true);
    } else {
      setStep((s) => Math.max(1, s - 1) as EditorStep);
      setForceSlideView(false);
    }
  };

  const handleSkipAudio = useCallback(() => {
    setStep(4);
    router.push(`/editor/${projectId}?step=4`);
  }, [projectId, router]);

  const handleNameSave = async () => {
    if (projectName.trim() && project) {
      await updateProject.mutateAsync({
        projectId,
        updates: { name: projectName.trim() },
      });
    }
    setEditingName(false);
  };



  const queryClient = useQueryClient();

  const handleApplyToSlide = useCallback(
    async (
      url: string,
      type: 'image' | 'video',
      slideIds: string[],
      slidesOverride?: Slide[]
    ) => {
      const slidesSource = slidesOverride || project?.slides;
      if (!slidesSource) return;

      // Optimistic Update: Update UI immediately
      const previousProject = queryClient.getQueryData(['project', projectId]);

      queryClient.setQueryData(['project', projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          slides: old.slides.map((slide: Slide) => {
            if (slideIds.includes(slide.id)) {
              const newSlide = { ...slide };
              if (type === 'image') {
                newSlide.hasBackgroundImage = true;
                newSlide.backgroundVideoUrl = undefined;
                newSlide.backgroundImage = {
                  url,
                  opacity: 60,
                  blur: 0,
                  displayMode: 'crisp' as const,
                };
                newSlide.style = { ...newSlide.style, background: 'image' };
              } else {
                newSlide.backgroundVideoUrl = url;
                newSlide.hasBackgroundImage = false;
                newSlide.backgroundImage = undefined;
                newSlide.style = { ...newSlide.style, background: 'video' };
              }
              return newSlide;
            }
            return slide;
          }),
        };
      });

      // Show success immediately
      toast.success(`Applied ${type} to ${slideIds.length} slides`);

      // Save to DB in the background using direct Supabase calls (no React Query mutation)
      // This avoids per-slide query invalidation that causes a refetch storm
      const saveInBackground = async () => {
        try {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();

          const updatePromises = slidesSource
            .filter((slide) => slideIds.includes(slide.id))
            .map((slide) => {
              const updates: Record<string, any> = {};
              if (type === 'image') {
                updates.hasBackgroundImage = true;
                updates.backgroundVideoUrl = undefined;
                updates.backgroundImage = {
                  url,
                  opacity: 60,
                  blur: 0,
                  displayMode: 'crisp',
                };
                updates.style = { ...slide.style, background: 'image' };
              } else {
                updates.backgroundVideoUrl = url;
                updates.hasBackgroundImage = false;
                updates.backgroundImage = undefined;
                updates.style = { ...slide.style, background: 'video' };
              }
              // Use RPC for efficient JSONB merge (avoids reading/writing full data blob)
              return supabase.rpc('merge_slide_data', {
                p_slide_id: slide.id,
                p_updates: updates,
              });
            });
          await Promise.all(updatePromises);

          // Single refetch after ALL slides are updated to ensure consistency
          refetch();
        } catch (err) {
          console.error('Background slide save failed:', err);
          toast.error('Failed to save slide changes');

          // Rollback on error
          if (previousProject) {
            queryClient.setQueryData(['project', projectId], previousProject);
          }
        }
      };

      // Fire and forget
      saveInBackground();
    },
    [project?.slides, projectId, queryClient, refetch]
  );

  const runAutoPipeline = useCallback(
      async ({ slides, originalScript }: { slides: Slide[]; originalScript: string }) => {
        if (autoPipelineRunningRef.current) return;
        if (!originalScript.trim()) {
          toast.error('Script is missing. Skipping emotional beats automation.');
          return;
        }

        autoPipelineRunningRef.current = true;
        setAutoPipelineLoading(true);

        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        try {
          setPipelineStage('analyzing');
          toast.info('Auto pipeline started: analyzing emotional beats...');

          // Cap at 8 beats if 8+ slides, otherwise match slide count
          const beatCount = Math.min(slides.length, 8);

          const analyzeResponse = await fetch('/api/analyze-script-beats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              script: originalScript,
              slides: slides.map((s) => ({ id: s.id, fullScriptText: s.fullScriptText })),
              beatCount,
            }),
          });

          if (!analyzeResponse.ok) {
            const err = await analyzeResponse.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to analyze script beats');
          }

          const analyzeData = await analyzeResponse.json();
          if (!analyzeData.beats || !Array.isArray(analyzeData.beats)) {
            throw new Error('Analyze beats response invalid');
          }

          let beats = analyzeData.beats as Array<any>;
          await updateProject.mutateAsync({
            projectId,
            updates: { emotional_beats: beats },
          });

          toast.info('Generating images for emotional beats...');
          setPipelineStage('imaging');

          const beatsWithImages = beats.map((b) => ({ ...b }));
          for (let i = 0; i < beatsWithImages.length; i += 1) {
            const beat = beatsWithImages[i];
            if (!beat?.visualPrompt) continue;

            await sleep(AUTO_BEAT_IMAGE_DELAY_MS);

            try {
              const imageResponse = await fetch('/api/generate-beat-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: beat.visualPrompt }),
              });

              if (!imageResponse.ok) {
                const text = await imageResponse.text();
                console.warn('Beat image generation failed:', text);
                continue;
              }

              const imageData = await imageResponse.json();
              if (imageData?.imageUrl) {
                beat.imageUrl = imageData.imageUrl;
                // Apply image to the first slide of the beat immediately for visual feedback
                if (Array.isArray(beat.slideIds) && beat.slideIds.length > 0) {
                  await handleApplyToSlide(beat.imageUrl, 'image', [beat.slideIds[0]], slides);
                }
              }
            } catch (err) {
              console.warn('Beat image error:', err);
            }
          }

          beats = beatsWithImages;
          await updateProject.mutateAsync({
            projectId,
            updates: { emotional_beats: beats },
          });

          toast.info('Generating videos for emotional beats...');
          setPipelineStage('motion');

          const beatsWithVideos = beats.map((b) => ({ ...b }));
          for (let i = 0; i < beatsWithVideos.length; i += 1) {
            const beat = beatsWithVideos[i];
            if (!beat?.imageUrl) continue;

            await sleep(AUTO_BEAT_VIDEO_DELAY_MS);

            try {
              const videoResponse = await fetch('/api/image-to-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrl: beat.imageUrl,
                  prompt: beat.videoPrompt || 'Cinematic slow camera movement with subtle motion',
                }),
              });

              const videoData = await videoResponse.json().catch(() => ({}));
              if (!videoResponse.ok) {
                console.warn('Beat video generation failed:', videoData?.error || videoResponse.status);
                continue;
              }

              const videoUrl = videoData.videoData
                ? `data:video/mp4;base64,${videoData.videoData}`
                : videoData.videoUri;

              if (!videoUrl) continue;
              beat.videoUrl = videoUrl;

              if (Array.isArray(beat.slideIds) && beat.slideIds.length > 0) {
                // User requested only the first slide of each beat get the video/image
                await handleApplyToSlide(videoUrl, 'video', [beat.slideIds[0]], slides);
              }
            } catch (err) {
              console.warn('Beat video error:', err);
            }
          }

          setPipelineStage('finishing');
          beats = beatsWithVideos;
          await updateProject.mutateAsync({
            projectId,
            updates: { emotional_beats: beats },
          });

          toast.success('Auto pipeline complete: beats, images, videos applied.');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Auto pipeline failed';
          console.error('Auto pipeline error:', err);
          toast.error(message);
        } finally {
          autoPipelineRunningRef.current = false;
          setAutoPipelineLoading(false);
        }
      },
      [handleApplyToSlide, projectId, updateProject]
    );

  const handleSlidesGenerated = useCallback(
    async (
      slides: Slide[],
      options?: { autoPipeline?: boolean; originalScript?: string }
    ) => {
      try {
        await updateSlides.mutateAsync({ projectId, slides });

        queryClient.setQueryData(['project', projectId], (old: any) => {
          if (!old) return old;
          return { ...old, slides };
        });

        if (options?.autoPipeline) {
          await runAutoPipeline({
            slides,
            originalScript: options.originalScript || project?.original_script || '',
          });
        }

        setStep(2);
      } catch {
        toast.error('Failed to save slides');
      }
    },
    [project?.original_script, projectId, queryClient, runAutoPipeline, updateSlides]
  );

  if (isLoading || (isNewProject && !project) || autoPipelineLoading) {
    const stages = [
      { id: 'analyzing', label: 'Story Brain', desc: 'Analyzing emotional arc...', icon: '🧠' },
      { id: 'imaging', label: 'Visual Soul', desc: 'Generating cinematic stills...', icon: '✨' },
      { id: 'motion', label: 'Motion Magic', desc: 'Creating cinematic motion...', icon: '🎬' },
      { id: 'finishing', label: 'Polishing', desc: 'Finalizing your experience...', icon: '💎' },
    ];

    const currentStageIdx = stages.findIndex(s => s.id === pipelineStage);
    const progressPercent = ((currentStageIdx + 1) / stages.length) * 100;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020203] text-white">
        {/* Cinematic Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[100px] animate-blob-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-pink-600/5 rounded-full blur-[100px] animate-blob-float-reverse" />
          {/* Grain Overlay */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        </div>

        <div className="relative z-10 w-full max-w-2xl px-8 flex flex-col items-center">
          {/* Logo/Icon Area */}
          <div className="mb-12 relative">
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl group">
              <Zap className="w-10 h-10 text-white fill-white/10 group-hover:scale-110 transition-transform duration-500" />
              {/* Spinning Orbital */}
              <div className="absolute inset-0 border-2 border-dashed border-white/20 rounded-2xl animate-spin-veryslow" />
            </div>
            {/* Pulsing Dot */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-ping" />
          </div>

          {/* Status Text */}
          <div className="text-center mb-12 space-y-3">
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
              {stages[currentStageIdx]?.label}
            </h1>
            <p className="text-gray-400 text-lg font-light tracking-wide italic">
              &quot;{MAGIC_QUOTES[quoteIndex]}&quot;
            </p>
          </div>

          {/* Main Progress Container */}
          <div className="w-full space-y-10">
            {/* Stages Grid */}
            <div className="grid grid-cols-4 gap-4">
              {stages.map((s, idx) => {
                const isPassed = idx < currentStageIdx;
                const isCurrent = idx === currentSlideIndex; // Wait, currentSlideIndex is for slides, stage is different
                const isActive = idx === currentStageIdx;
                
                return (
                  <div key={s.id} className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 ${
                      isActive 
                        ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-110' 
                        : isPassed 
                          ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' 
                          : 'bg-white/5 text-white/20 border-white/10 font-grayscale'
                    }`}>
                      <span className="text-lg">{isPassed ? '✓' : s.icon}</span>
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${
                      isActive ? 'text-white' : 'text-white/20'
                    }`}>
                      {s.id}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-white to-blue-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            
            {/* Detail Status */}
            <div className="flex items-center justify-between text-xs tracking-widest uppercase font-semibold">
              <span className="text-purple-400 animate-pulse">{stages[currentStageIdx]?.desc}</span>
              <span className="text-white/40">{Math.round(progressPercent)}% COMPLETE</span>
            </div>
          </div>

          {/* Footer Warning */}
          <div className="mt-20 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="text-[11px] text-gray-500 tracking-[0.2em] font-medium uppercase">
              Keep this tab open &middot; Powering up your VSL
            </span>
          </div>
        </div>

        <style jsx>{`
          .animate-pulse-slow {
            animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          .animate-spin-veryslow {
            animation: spin 8s linear infinite;
          }
          .animate-blob-float {
            animation: blob 15s infinite;
          }
          .animate-blob-float-reverse {
            animation: blob 15s infinite reverse;
          }
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.1; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.15; transform: translate(-50%, -50%) scale(1.1); }
          }
          .font-grayscale {
            filter: grayscale(100%);
          }
        `}</style>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Project not found</div>
      </div>
    );
  }

  const audioSlides = project.slides.filter((s) => s.audioGenerated);
  const exportSlides = audioSlides.length > 0 ? audioSlides : project.slides;
  const emotionalBeats = project.emotional_beats || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Editor Header */}
      <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-black transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {currentStep === 1 ? 'Exit' : 'Back'}
        </button>

        <StepIndicator currentStep={currentStep} />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-md flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          {editingName ? (
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              className="h-7 w-40 text-sm"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setProjectName(project.name);
                setEditingName(true);
              }}
              className="text-sm font-medium hover:underline cursor-pointer"
            >
              {project.name}
              <span className="ml-1 text-gray-400">&#9998;</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Step Content */}
        <main className="flex-1 overflow-auto">
          {currentStep === 1 && (
            <ScriptInput
              projectId={projectId}
              initialScript={project.original_script || ''}
              onSlidesGenerated={handleSlidesGenerated}
            />
          )}
          {currentStep === 2 && (
            <SlideReviewer
              projectId={projectId}
              slides={project.slides}
              onComplete={() => {
                setStep(3);
                setAutoEdit(false);
              }}
              forceShowSlides={forceSlideView}
              initialIndex={initialSlideIndex}
              onIndexChange={setCurrentSlideIndex}
              onEditingChange={setIsEditingSlide}
              autoEdit={autoEdit}
              savedInfographicImages={project.infographic_images}
              savedInfographicPrompt={project.infographic_prompt}
              savedInfographicVideos={project.infographic_videos}
            />
          )}
          {currentStep === 3 && (
            <AudioSetup
              projectId={projectId}
              slides={project.slides}
              settings={project.settings}
              onComplete={() => setStep(4)}
              onSkip={handleSkipAudio}
            />
          )}
          {currentStep === 4 && (
            <PreviewExport
              projectId={projectId}
              projectName={project.name}
              slides={exportSlides}
              onSlideClick={(filteredIndex) => {
                const targetSlide = exportSlides[filteredIndex];
                const originalIndex = project.slides.findIndex((s) => s.id === targetSlide.id);
                if (originalIndex !== -1) {
                  setInitialSlideIndex(originalIndex);
                  setAutoEdit(true);
                  setStep(2);
                }
              }}
            />
          )}
        </main>
        
        {/* Right Sidebar - Emotional Beats */}
        {isEditingSlide && (
          <EmotionalBeatsSidebar
              projectId={projectId}
              emotionalBeats={emotionalBeats}
              originalScript={project.original_script || ''}
              slides={project.slides}
              currentSlideIndex={currentSlideIndex}
              onApplyToSlide={handleApplyToSlide}
              onGoToSlide={(slideId) => {
                const slideIndex = project.slides.findIndex(s => s.id === slideId);
                if (slideIndex !== -1) {
                  setInitialSlideIndex(slideIndex);
                  setAutoEdit(false);
                  setStep(2);
                  setForceSlideView(true);
                }
              }}
          />
        )}
      </div>
    </div>
  );
}
