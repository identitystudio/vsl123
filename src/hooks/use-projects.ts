'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { VslProject } from '@/types';
import type { User } from '@supabase/supabase-js';

const supabase = createClient();

export function useProjects() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Get initial user session
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsReady(true);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return useQuery({
    queryKey: ['projects'],
    enabled: isReady && !!user, // Only run when user is confirmed
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vsl_projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as VslProject[];
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
