'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
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
              <button
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className="text-left p-6 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all bg-white group"
              >
                <h3 className="font-semibold text-lg mb-1">{project.name}</h3>
                <p className="text-sm text-gray-500">
                  {project.slides?.length || 0} slides
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Updated {format(new Date(project.updated_at), 'MMM d, yyyy')}
                </p>
              </button>
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
