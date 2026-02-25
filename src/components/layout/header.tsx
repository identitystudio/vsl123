'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Zap, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  email?: string;
}

export function Header({ email }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const isDashboard = pathname === '/dashboard';

  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">VSL Vibes</span>
          </button>

          {email && (
            <nav className="flex items-center gap-1">
              <Button
                variant={isDashboard ? 'default' : 'ghost'}
                size="sm"
                onClick={() => router.push('/dashboard')}
                className={isDashboard ? 'bg-black text-white hover:bg-gray-800' : 'text-gray-600 hover:text-black'}
              >
                Projects
              </Button>
            </nav>
          )}
        </div>

        {email && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{email}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
