'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { VslProject } from '@/types';

const supabase = createClient();
const PAGE_SIZE = 9;

export function useProjects(initialUserId?: string) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(initialUserId || null);
  const [isAuthLoading, setIsAuthLoading] = useState(!initialUserId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentId = session?.user?.id ?? null;
      if (currentId !== userId) setUserId(currentId);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      setUserId(newUserId);
      setIsAuthLoading(false);

      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, userId]);

  const query = useInfiniteQuery({
    queryKey: ['projects', userId],
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      // 1. Session check to avoid RLS race conditions
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || (userId && session.user.id !== userId)) {
        throw new Error('Session not synchronized yet');
      }

      // 2. Optimized Fetch: Only select what's needed for the dashboard cards.
      // We skip 'original_script', 'emotional_beats', and the full 'slides' jsonb blob.
      const { data, error } = await supabase
        .from('vsl_projects')
        .select(`
          id, 
          name, 
          updated_at, 
          settings, 
          infographic_images,
          slide_count:slides(count)
        `)
        .order('updated_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;
      
      const projects = (data || []).map(p => ({
        ...p,
        // Map the count from the join
        slides: { length: p.slide_count?.[0]?.count || 0 }
      }));

      return projects as unknown as VslProject[];
    },
    getNextPageParam: (lastPage, allPages) => {
      // If the last page was smaller than the page size, there are no more projects
      return lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Flatten the pages for easy UI consumption, matching the old signature
  const projects = query.data?.pages.flat() || [];

  return {
    ...query,
    data: projects,
    // Maintain old loading prop name for compatibility
    isInitialLoading: isAuthLoading || (!!userId && query.isPending && !query.data),
  };
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload?: { id?: string; name?: string; projectType?: 'vsl' | 'infographic' }) => {
      const name = payload?.name;
      const id = payload?.id;
      const projectType = payload?.projectType || 'vsl';
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('vsl_projects')
        .insert({
          ...(id ? { id } : {}),
          user_id: user.id,
          name: name || 'Untitled Project',
          slides: [],
          settings: {
            theme: 'dark',
            textSize: 72,
            textAlignment: 'center',
            projectType,
          },
        })
        .select()
        .single();

      if (error) throw error;
      return data as VslProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('vsl_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: (_, projectId) => {
      // Optimistically remove from cache (InfiniteData structure: { pages: VslProject[][], pageParams: any[] })
      queryClient.setQueriesData({ queryKey: ['projects'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: VslProject[]) =>
            page.filter((p) => p.id !== projectId)
          ),
        };
      });
      // Trigger refetch to be sure
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
