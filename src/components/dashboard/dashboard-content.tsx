'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/use-projects';
import { useUpdateProject } from '@/hooks/use-project';
import { toast } from 'sonner';

interface DashboardContentProps {
  email: string;
  userId: string;
}

export function DashboardContent({ email, userId }: DashboardContentProps) {
  const router = useRouter();
  const { data: projects, isInitialLoading } = useProjects(userId);
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNewProject = () => {
    setCreatingProject(true);
    const newId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    router.push(`/editor/${newId}?new=1`);
    createProject.mutateAsync({ id: newId }).catch(() => {
      toast.error('Failed to create project');
      setCreatingProject(false);
    });
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/editor/${projectId}`);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDeletingProjectId(projectId);
  };

  const confirmDelete = async () => {
    if (!deletingProjectId) return;
    setIsDeleting(true);
    try {
      await deleteProject.mutateAsync(deletingProjectId);
      toast.success('Project deleted');
      setDeletingProjectId(null);
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeletingProjectId(null);
  };

  const startEditing = (e: React.MouseEvent, project: { id: string; name: string }) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const saveEditing = async () => {
    if (!editingId) return;
    if (editingName.trim()) {
      try {
    await updateProject.mutateAsync({
      projectId: editingId,
      updates: { name: editingName.trim() },
    });
    toast.success('Project name updated');
      } catch {
    toast.error('Failed to update project name');
      }
    }
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header email={email} />

      {/* Delete Confirmation Modal */}
      {deletingProjectId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in zoom-in duration-200">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Project?</h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone. All slides and settings will be permanently deleted.
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <Button
                  variant="outline"
                  onClick={cancelDelete}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Your Projects</h1>
          <Button
            onClick={handleNewProject}
            className="bg-black text-white hover:bg-gray-800 gap-2"
            disabled={creatingProject}
          >
            {creatingProject ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {creatingProject ? 'Creating...' : 'New Project'}
          </Button>
        </div>

        {isInitialLoading ? (
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

                {editingId === project.id ? (
                  <div className="relative z-20 mb-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={saveEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="font-bold text-xl h-9 px-2 -ml-2 w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1 relative z-10">
                    <h3 className="font-bold text-xl truncate pr-2">{project.name}</h3>
                    <button
                      onClick={(e) => startEditing(e, project)}
                      className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-black cursor-pointer"
                      title="Rename project"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                
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
                  className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : projects && projects.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No projects yet</p>
            <Button
              onClick={handleNewProject}
              className="bg-black text-white hover:bg-gray-800 gap-2"
              disabled={creatingProject}
            >
              {creatingProject ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {creatingProject ? 'Creating...' : 'Create your first VSL'}
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
