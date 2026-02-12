import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EditorContent } from '@/components/editor/editor-content';

interface EditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditorContent projectId={projectId} />
    </Suspense>
  );
}
