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
        .maybeSingle();

      if (projectError) throw projectError;

      if (!project) {
        return null;
      }

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
    // Performance optimizations: keep data in cache and avoid redundant refetches
    staleTime: 5 * 60 * 1000,           // 5 minutes - data is fresh for this duration
    gcTime: 30 * 60 * 1000,             // 30 minutes - keep in memory for faster re-access
    refetchOnWindowFocus: false,        // Don't refetch when user switches tabs
    refetchOnReconnect: false,          // Don't refetch on network reconnect (optimistic updates handle this)
    retry: 1,                           // Only retry once on failure
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
      updates: Partial<Pick<VslProject, 'name' | 'original_script' | 'settings' | 'emotional_beats'>>;
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
    // Optimistic Update
    onMutate: async ({ projectId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['project', projectId] });
      await queryClient.cancelQueries({ queryKey: ['projects'] });

      // Snapshot previous value
      const previousProject = queryClient.getQueryData(['project', projectId]);

      // Optimistically update to new value
      queryClient.setQueryData(['project', projectId], (old: VslProject | undefined) => {
        if (!old) return old;
        return { ...old, ...updates };
      });
      
      // Also update the list if possible
      queryClient.setQueryData(['projects'], (old: VslProject[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === projectId ? { ...p, ...updates } : p);
      });

      return { previousProject };
    },
    onError: (err, newTodo, context) => {
      // Rollback on error
      if (context?.previousProject) {
        queryClient.setQueryData(['project', newTodo.projectId], context.previousProject);
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success to ensure server sync
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Updates or creates all slides for a project. 
 * Use ONLY when initially generating slides. Do NOT use for updating existing slides after audio/edits.
 * This function deletes and recreates slides, which can lose data if called at the wrong time.
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
      // SAFETY CHECK: Only allow this function to be used for initial generation
      // (when slides array has required properties for a new generation)
      if (!slides || slides.length === 0) {
        throw new Error('Cannot update slides with empty array. This would delete all slides.');
      }

      // 1. Delete existing slides (only for full regeneration - slide generation step)
      await supabase.from('slides').delete().eq('project_id', projectId);

      // 2. Insert new slides
      const { error: insertError } = await supabase.from('slides').insert(
        slides.map((s, index) => ({
          id: s.id, // Preserve ID
          project_id: projectId,
          order_index: index,
          data: s,
        }))
      );
      if (insertError) throw insertError;

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
      // Use jsonb concatenation (||) to merge updates into existing data
      // This avoids fetching the entire data blob (which may contain multi-MB video base64)
      const { data, error } = await supabase.rpc('merge_slide_data', {
        p_slide_id: slideId,
        p_updates: updates,
      });

      if (error) {
        // Fallback: if RPC doesn't exist yet, use the old fetch-merge-save approach
        if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('merge_slide_data RPC not found, using fallback');
          const { data: current, error: getError } = await supabase
            .from('slides')
            .select('data, project_id')
            .eq('id', slideId)
            .maybeSingle();
          
          if (getError) throw getError;
          if (!current) {
            console.warn(`Slide ${slideId} not found, skipping update`);
            return null;
          }

          const updatedData = { ...current.data, ...updates };
          const { data: updated, error: updateError } = await supabase
            .from('slides')
            .update({ data: updatedData, updated_at: new Date().toISOString() })
            .eq('id', slideId)
            .select()
            .maybeSingle();

          if (updateError) throw updateError;
          return updated;
        }
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      if (data) {
        const projectId = data.project_id;
        if (projectId) {
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }
      }
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
