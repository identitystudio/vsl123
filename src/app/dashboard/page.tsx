import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

export default async function DashboardPage() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Dashboard auth error:', error);
    }

    if (!user) {
      redirect('/auth/login');
    }

    return <DashboardContent email={user.email || ''} userId={user.id} />;
  } catch (err: unknown) {
    console.error('Dashboard render failed:', err);
    throw err;
  }
}
