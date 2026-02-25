// ============================================================
// Image Theme Configuration
// ============================================================

// Single source of truth lives in @/types — re-exported here as ImageTheme
// so API routes can import from this module without a circular dependency.
import type { ImageGenerationTheme } from '@/types';
export type ImageTheme = ImageGenerationTheme;

export interface ThemeConfig {
  name: string;
  description: string;
  promptPrefix: string;
  promptSuffix: string;
  openAIStyle: 'natural' | 'vivid';
  videoPromptModifier: string;
}

export const IMAGE_THEMES: Record<ImageTheme, ThemeConfig> = {
  realism: {
    name: 'Realism',
    description: 'Photorealistic, professional, cinematic images',
    promptPrefix: 'Ultra realistic, professional photograph, high quality, 4K resolution, cinematic lighting, clean composition, photorealistic, natural colors, professional photography.',
    promptSuffix: 'High quality, 4K, cinematic lighting, photorealistic.',
    openAIStyle: 'natural',
    videoPromptModifier: 'Smooth camera movement, realistic motion, natural transitions.',
  },
  infographic: {
    name: 'Infographic',
    description: 'Immersive, cinematic, advanced graphic design',
    promptPrefix: 'Cinematic infographic design, immersive visual storytelling, advanced graphic design with depth and dimension, sophisticated color grading, premium quality illustration, modern 3D isometric elements, dynamic lighting and shadows, professional gradient overlays, sleek contemporary aesthetic, award-winning composition, strategic visual hierarchy, refined typography, balanced layout, engaging data visualization, polished studio-quality graphics, cutting-edge design trends, captivating visual narrative, professional color palette.',
    promptSuffix: 'Premium quality, immersive design, cinematic infographic, professional graphics.',
    openAIStyle: 'vivid',
    videoPromptModifier: 'Cinematic infographic animation, smooth parallax effects, dynamic element transitions, sophisticated motion graphics, professional easing curves, layered depth animation, engaging visual flow, polished motion design, studio-quality animation.',
  },
};

export function getThemeConfig(theme: ImageTheme): ThemeConfig {
  return IMAGE_THEMES[theme];
}

export function buildPromptWithTheme(
  theme: ImageTheme,
  slideText: string,
  imageKeyword?: string
): string {
  const config = getThemeConfig(theme);
  const parts = [
    config.promptPrefix,
    slideText,
    imageKeyword ? `Subject: ${imageKeyword}.` : '',
    config.promptSuffix,
  ];
  return parts.filter(Boolean).join(' ');
}
