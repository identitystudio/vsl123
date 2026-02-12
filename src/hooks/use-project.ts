'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { VslProject, Slide, ProjectSettings } from '@/types';

const supabase = createClient();

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      // 1. Fetch project meta
      const { data: project, error: projectError } = await supabase
        .from('vsl_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // 2. Fetch slides from the separate table
      const { data: slides, error: slidesError } = await supabase
        .from('slides')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (slidesError) throw slidesError;

      // Map DB slides to the format the UI expects
      const formattedSlides = (slides || []).map((s) => ({
        ...s.data,
        id: s.id, // Use the DB UUID as the slide ID
      }));

      return {
        ...project,
        slides: formattedSlides,
      } as unknown as VslProject;
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
      updates: Partial<Pick<VslProject, 'name' | 'original_script' | 'settings'>>;
    }) => {
      const { data, error } = await supabase
        .from('vsl_projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Updates or creates all slides for a project. 
 * Use this when initially generating slides or doing a full reset.
 */
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
      // 1. Delete existing slides (simpler for full regeneration)
      await supabase.from('slides').delete().eq('project_id', projectId);

      // 2. Insert new slides
      if (slides.length > 0) {
        const { error: insertError } = await supabase.from('slides').insert(
          slides.map((s, index) => ({
            project_id: projectId,
            order_index: index,
            data: s,
          }))
        );
        if (insertError) throw insertError;
      }

      // Update project timestamp
      await supabase
        .from('vsl_projects')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', projectId);

      return { projectId };
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Updates a single slide by its DB ID. 
 * This is much more efficient than saving all slides.
 */
export function useUpdateSingleSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slideId,
      updates,
    }: {
      slideId: string;
      updates: Partial<Slide>;
    }) => {
      // 1. Get current slide data to merge
      const { data: current, error: getError } = await supabase
        .from('slides')
        .select('data')
        .eq('id', slideId)
        .single();
      
      if (getError) throw getError;

      const updatedData = { ...current.data, ...updates };

      // 2. Update the DB
      const { data, error } = await supabase
        .from('slides')
        .update({ 
          data: updatedData, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', slideId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
    },
  });
}
