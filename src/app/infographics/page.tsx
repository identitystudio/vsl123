import { Header } from '@/components/layout/header';
import { InfographicGenerator } from '@/components/infographics/infographic-generator';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Infographic Generator',
  description: 'Generate custom infographics with AI',
};

export default async function InfographicsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header email={user.email || ''} />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Infographics</h1>
          <p className="text-gray-600">Create stunning infographics by describing what you want to visualize</p>
        </div>

        <InfographicGenerator />
      </main>
    </div>
  );
}
