'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
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
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const updateSlides = useUpdateSlides();

  const [step, setStep] = useState<EditorStep>(1);
  const [hasSetInitialStep, setHasSetInitialStep] = useState(false);
  const [forceSlideView, setForceSlideView] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [initialSlideIndex, setInitialSlideIndex] = useState(0);
  const [autoEdit, setAutoEdit] = useState(false);

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

  // Determine step based on project state
  const currentStep = (() => {
    if (!project) return step;
    if (project.slides.length === 0) return 1 as EditorStep;
    return step;
  })();

  const handleBack = () => {
    if (currentStep === 1) {
      router.push('/dashboard');
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading project...</div>
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
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-black transition-colors"
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
              className="text-sm font-medium hover:underline"
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
