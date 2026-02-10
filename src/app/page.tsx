import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8 px-4">
        {/* VSL Slide Preview */}
        <div className="w-full aspect-video rounded-xl border border-gray-200 flex items-center justify-center bg-white shadow-sm">
          <h1 className="text-7xl font-black tracking-tight text-black">VSL</h1>
        </div>

        {/* CTA */}
        <Link href="/auth/login">
          <Button size="lg" className="text-lg px-8 py-6 rounded-xl bg-black text-white hover:bg-gray-800">
            Enter Script
          </Button>
        </Link>
      </div>
    </div>
  );
}
