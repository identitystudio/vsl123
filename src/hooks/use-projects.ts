'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { VslProject } from '@/types';
import type { User } from '@supabase/supabase-js';

const supabase = createClient();

export function useProjects() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Get initial user session
    supabase.auth.getUser().then(({ data }) => {
      const newUserId = data.user?.id ?? null;
      setUserId(newUserId);
      prevUserIdRef.current = newUserId;
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      
      // If user changed, invalidate and refetch
      if (prevUserIdRef.current !== newUserId) {
        queryClient.resetQueries({ queryKey: ['projects'] });
        prevUserIdRef.current = newUserId;
      }
      
      setUserId(newUserId);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['projects', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('vsl_projects')
        .select(`
          *,
          slide_count:slides(count)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      const projects = (data || []).map(p => ({
        ...p,
        slides: { length: p.slide_count?.[0]?.count || 0 }
      }));

      return projects as unknown as VslProject[];
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name?: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('vsl_projects')
        .insert({
          user_id: user.id,
          name: name || 'Untitled Project',
          slides: [],
          settings: { theme: 'dark', textSize: 72, textAlignment: 'center' },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
