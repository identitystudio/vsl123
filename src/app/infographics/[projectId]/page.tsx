import { Header } from '@/components/layout/header';
import { InfographicGenerator } from '@/components/infographics/infographic-generator';
import { InfographicProjectHeader } from '@/components/infographics/infographic-project-header';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Infographic Project',
  description: 'View and edit infographic project',
};

interface InfographicsProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function InfographicsProjectPage({
  params,
}: InfographicsProjectPageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch project data
  const { data: project } = await supabase
    .from('vsl_projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  // If project doesn't exist yet (just created), pass null and let client handle it
  const projectName = project?.name || 'Untitled Project';
  const initialPrompt = project?.infographic_prompt || '';
  const initialImages = project?.infographic_images || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header email={user.email || ''} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <InfographicProjectHeader 
          projectId={projectId} 
          initialName={projectName}
        />

        <InfographicGenerator
          projectId={projectId}
          initialPrompt={initialPrompt}
          initialImages={initialImages}
        />
      </main>
    </div>
  );
}
