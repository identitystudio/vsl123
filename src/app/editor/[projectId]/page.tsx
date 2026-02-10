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

  return <EditorContent projectId={projectId} />;
}
