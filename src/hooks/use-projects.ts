'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { VslProject } from '@/types';
import type { User } from '@supabase/supabase-js';

const supabase = createClient();

export function useProjects(initialUserId?: string) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(initialUserId || null);
  const [isAuthLoading, setIsAuthLoading] = useState(!initialUserId);

  useEffect(() => {
    // 1. Get current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentId = session?.user?.id ?? null;
      // Only update if different or initial was missing
      if (currentId !== userId) {
        setUserId(currentId);
      }
      setIsAuthLoading(false);
    });

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      setUserId(newUserId);
      setIsAuthLoading(false);

      // Invalidate projects on any auth change to be safe
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, userId]); // Include userId in dep array to check against updates

  const query = useQuery({
    queryKey: ['projects', userId],
    enabled: !!userId,
    queryFn: async () => {
      // Security Check: ensure client SDK has the session ready
      const { data: { session } } = await supabase.auth.getSession();
      
      // If session isn't ready or doesn't match the requested user, 
      // throw to trigger retry instead of returning empty list (RLS failure)
      if (!session || (userId && session.user.id !== userId)) {
        throw new Error('Session not synchronized yet');
      }

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

  return {
    ...query,
    // Loading if auth is still resolving OR query is pending
    isInitialLoading: isAuthLoading || (!!userId && query.isPending && !query.data),
  };
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload?: { id?: string; name?: string }) => {
      const name = payload?.name;
      const id = payload?.id;
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
