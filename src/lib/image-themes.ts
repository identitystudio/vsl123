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
    description: 'Clean, modern, illustrative, diagram-style visuals',
    promptPrefix: 'Modern infographic style, clean vector illustration, flat design, minimalist, professional diagram, bold colors, simple shapes, educational visual, icon-based, geometric, contemporary graphic design.',
    promptSuffix: 'Clean infographic style, flat design, minimalist, professional.',
    openAIStyle: 'vivid',
    videoPromptModifier: 'Animated infographic elements, smooth transitions, icon movements.',
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
