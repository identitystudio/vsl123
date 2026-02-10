import { NextRequest, NextResponse } from 'next/server';

interface ImageOptimization {
  slideId: string;
  imagePositionY: number; // 0-100, vertical crop position
  needsReplace: boolean;
  suggestedKeyword?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { slides } = await request.json();

    if (!slides || !Array.isArray(slides)) {
      return NextResponse.json(
        { error: 'Slides array is required' },
        { status: 400 }
      );
    }

    // For now, return sensible defaults
    // In the future, this could use Claude Vision to analyze images
    const optimizations: ImageOptimization[] = slides
      .filter((s: { hasBackgroundImage?: boolean; backgroundImage?: { url?: string } }) =>
        s.hasBackgroundImage && s.backgroundImage?.url
      )
      .map((s: { id: string; style?: { background?: string } }) => ({
        slideId: s.id,
        // Default to center (50%), which works well for most stock photos
        // People photos often have subjects in upper portion
        imagePositionY: s.style?.background === 'split' ? 35 : 50,
        needsReplace: false,
      }));

    return NextResponse.json({ optimizations });
  } catch (error: unknown) {
    console.error('Optimize images error:', error);
    const message = error instanceof Error ? error.message : 'Failed to optimize images';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
