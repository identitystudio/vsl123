'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { VslProject, Slide, ProjectSettings } from '@/types';

const supabase = createClient();

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vsl_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data as VslProject;
    },
    enabled: !!projectId,
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      updates,
    }: {
      projectId: string;
      updates: Partial<Pick<VslProject, 'name' | 'original_script' | 'slides' | 'settings'>>;
    }) => {
      const { data, error } = await supabase
        .from('vsl_projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;
      return data as VslProject;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['project', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateSlides() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      slides,
    }: {
      projectId: string;
      slides: Slide[];
    }) => {
      const { data, error } = await supabase
        .from('vsl_projects')
        .update({ slides, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;
      return data as VslProject;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['project', data.id], data);
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      settings,
    }: {
      projectId: string;
      settings: ProjectSettings;
    }) => {
      const { data, error } = await supabase
        .from('vsl_projects')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;
      return data as VslProject;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['project', data.id], data);
    },
  });
}
