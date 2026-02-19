'use client';

import { useState } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateProject } from '@/hooks/use-project';
import { toast } from 'sonner';

interface InfographicProjectHeaderProps {
  projectId: string;
  initialName: string;
}

export function InfographicProjectHeader({
  projectId,
  initialName,
}: InfographicProjectHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const updateProject = useUpdateProject();

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }

    try {
      await updateProject.mutateAsync({
        projectId,
        updates: { name: name.trim() },
      });
      toast.success('Project name updated');
      setIsEditing(false);
    } catch {
      toast.error('Failed to update project name');
    }
  };

  const handleCancel = () => {
    setName(initialName);
    setIsEditing(false);
  };

  return (
    <div className="mb-8">
      {isEditing ? (
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            className="text-4xl font-bold h-12 px-3"
            autoFocus
          />
          <Button
            onClick={handleSave}
            disabled={updateProject.isPending}
            size="sm"
            className="bg-black text-white hover:bg-gray-800"
          >
            {updateProject.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Save'
            )}
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-4xl font-bold text-gray-900">{name}</h1>
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-black"
            title="Rename project"
          >
            <Pencil className="w-5 h-5" />
          </button>
        </div>
      )}
      <p className="text-gray-600">Generate and manage infographics for this project</p>
    </div>
  );
}
