'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Zap, Loader2 } from 'lucide-react';
import { useProject, useUpdateProject, useUpdateSlides } from '@/hooks/use-project';
import { StepIndicator } from './step-indicator';
import { ScriptInput } from './script-input';
import { SlideReviewer } from './slide-reviewer';
import { AudioSetup } from './audio-setup';
import { PreviewExport } from './preview-export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EditorStep, Slide } from '@/types';
import { toast } from 'sonner';
interface EditorContentProps {
  projectId: string;
}

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
  const [autoEdit, setAutoEdit] = useState(false);

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
      // If slides exist, resume at the review/design step
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

  // Determine step based on project state
  const currentStep = (() => {
    if (!project) return step;
    if (project.slides.length === 0) return 1 as EditorStep;
    return step;
  })();

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else if (currentStep === 2 && !forceSlideView && project?.slides.every(s => s.reviewed)) {
      // If we're on the review step and everything is already reviewed,
      // the first "Back" should just show the slides again.
      setForceSlideView(true);
    } else {
      setStep((s) => Math.max(1, s - 1) as EditorStep);
      setForceSlideView(false);
    }
  };

  const handleSlidesGenerated = useCallback(
    async (slides: Slide[]) => {
      try {
        await updateSlides.mutateAsync({ projectId, slides });
        setStep(2);
      } catch {
        toast.error('Failed to save slides');
      }
    },
    [projectId, updateSlides]
  );

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

  if (isLoading || (isNewProject && !project)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="absolute inset-0 bg-black/5 rounded-full blur-2xl animate-pulse" />
            <div className="relative w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-black animate-spin" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">
              {isNewProject ? 'Creating your project...' : 'Loading project...'}
            </h2>
            <p className="text-sm text-gray-500">
              {isNewProject ? 'Setting up your workspace' : 'Please wait'}
            </p>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
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
            autoEdit={autoEdit}
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
    </div>
  );
}
