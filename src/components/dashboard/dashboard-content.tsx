'use client';

import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/use-projects';
import { toast } from 'sonner';

interface DashboardContentProps {
  email: string;
}

export function DashboardContent({ email }: DashboardContentProps) {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const handleNewProject = async () => {
    try {
      const project = await createProject.mutateAsync(undefined);
      router.push(`/editor/${project.id}`);
    } catch (err) {
      toast.error('Failed to create project');
    }
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/editor/${projectId}`);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    try {
      await deleteProject.mutateAsync(projectId);
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header email={email} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Your Projects</h1>
          <Button
            onClick={handleNewProject}
            className="bg-black text-white hover:bg-gray-800 gap-2"
            disabled={createProject.isPending}
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl border border-gray-200 animate-pulse bg-gray-50"
              />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative flex flex-col p-6 rounded-2xl border border-gray-200 hover:border-black/10 hover:shadow-xl hover:shadow-gray-200/50 transition-all bg-white overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-gray-50 rounded-full group-hover:bg-black/5 transition-colors" />

                <h3 className="font-bold text-xl mb-1 relative z-10">{project.name}</h3>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <span className="text-sm px-2 py-0.5 bg-gray-100 rounded text-gray-600 font-medium">
                    {project.slides?.length || 0} slides
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(project.updated_at), 'MMM d')}
                  </span>
                </div>

                <div className="mt-auto flex flex-col gap-2 relative z-10">
                  {project.slides?.length > 0 ? (
                    <>
                      <Button
                        onClick={() => router.push(`/editor/${project.id}?step=2`)}
                        className="w-full bg-black text-white hover:bg-gray-800 h-10 rounded-lg text-sm font-semibold"
                      >
                        Design Slides &rarr;
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => router.push(`/editor/${project.id}?step=1`)}
                        className="w-full text-gray-500 hover:text-black hover:bg-gray-50 h-9 transition-all text-xs"
                      >
                        Edit Script
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleOpenProject(project.id)}
                      className="w-full bg-black text-white hover:bg-gray-800 h-10 rounded-lg"
                    >
                      Start Designing
                    </Button>
                  )}
                </div>

                {/* Delete button (hidden by default, shown on hover) */}
                <button
                  onClick={(e) => handleDeleteProject(e, project.id)}
                  className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No projects yet</p>
            <Button
              onClick={handleNewProject}
              className="bg-black text-white hover:bg-gray-800"
            >
              Create your first VSL
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
