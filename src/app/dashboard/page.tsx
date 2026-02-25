import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

export default async function DashboardPage() {
  console.log('🏁 [DashboardPage] Starting render...');
  const start = Date.now();
  
  const supabase = await createClient();
  console.log(`⏱️ [DashboardPage] Client created in ${Date.now() - start}ms`);
  
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();
    
    console.log(`⏱️ [DashboardPage] getUser finished in ${Date.now() - start}ms (User: ${user?.id || 'none'})`);

    if (error) {
      console.error('❌ [DashboardPage] Auth error:', error);
    }

    if (!user) {
      console.log('➡️ [DashboardPage] No user, redirecting to login');
      redirect('/auth/login');
    }

    return <DashboardContent email={user.email || ''} userId={user.id} />;
  } catch (err: any) {
    console.error('🔥 [DashboardPage] CRITICAL HANG OR ERROR:', err.message);
    // Fallback for debugging - check if returning something makes it faster
    // return <div>Auth Failed: {err.message}</div>;
    throw err;
  }
}
