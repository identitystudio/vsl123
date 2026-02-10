// ============================================================
// VSL Vibes — Core Type Definitions
// ============================================================

export interface TextSegment {
  text: string;
  emphasis?: 'bold' | 'underline' | 'circle' | 'red' | 'none';
  underlineStyle?: UnderlineStyle;
  circleStyle?: CircleStyle;
}

export type UnderlineStyle = 'brush-red' | 'brush-black' | 'regular' | 'brush-stroke-red';
export type CircleStyle = 'red-solid' | 'red-dotted' | 'black-solid';

export interface HeadshotSettings {
  imageUrl?: string;
  name?: string;
  title?: string;
}

export interface BackgroundImage {
  url: string;
  opacity: number;       // 0-100
  blur: number;          // 0-20px
  displayMode: 'blurred' | 'crisp' | 'split';
  imagePositionY?: number; // 0-100% for vertical crop position in split mode
}

export interface SlideStyle {
  background: 'white' | 'dark' | 'image' | 'gradient' | 'split';
  textColor: 'white' | 'black' | 'custom';
  textSize: number;                // 48, 60, 72, 84, 96, 108, 120
  textWeight: 'regular' | 'bold' | 'extrabold';
  gradient?: string;
  gradientName?: 'blue' | 'purple' | 'teal' | 'orange';
  icon?: string;                   // Emoji for infographic
  splitRatio?: number;             // 50-70% for split layout
}

export interface InfographicVisual {
  type: 'svg' | 'icon' | 'emoji';
  value: string;  // SVG code, icon name, or emoji character
}

export interface Slide {
  id: string;
  fullScriptText: string;
  segments: TextSegment[];
  style: SlideStyle;

  // Text emphasis
  boldWords: string[];
  underlineWords: string[];
  circleWords: string[];
  redWords: string[];
  underlineStyles: Record<string, UnderlineStyle>;
  circleStyles: Record<string, CircleStyle>;

  // Background image
  hasBackgroundImage: boolean;
  backgroundImage?: BackgroundImage;

  // Audio
  audioUrl?: string;
  audioDuration?: number;
  audioGenerated?: boolean;

  // Headshot
  headshot?: HeadshotSettings;

  // Infographic mode
  isInfographic?: boolean;
  infographicCaptions?: string[];        // Lines that cycle as captions
  infographicVisual?: InfographicVisual; // The visual element (SVG/icon/emoji)
  absorbedSlideIds?: string[];           // IDs of slides bundled into this one

  // Metadata
  sceneNumber?: number;
  sceneTitle?: string;
  emotion?: string;
  imageKeyword?: string;
  reviewed?: boolean;
}

export interface AudioSettings {
  elevenLabsApiKey?: string;
  voiceId: string;
  voiceName?: string;
  stability: number;        // 0-1
  similarityBoost: number;  // 0-1
  speed: number;            // 0.7-1.2
}

export interface ProjectSettings {
  theme: 'light' | 'dark';
  textSize: number;
  textAlignment: 'center' | 'left' | 'right';
  audio?: AudioSettings;
  selectedSlideIndex?: number;
}

export interface VslProject {
  id: string;
  user_id: string;
  name: string;
  original_script?: string;
  slides: Slide[];
  settings: ProjectSettings;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  sceneNumber: number;
  title: string;
  emotion: string;
  slides: {
    fullScriptText: string;
    hasImage: boolean;
    imageKeyword?: string;
  }[];
}

export interface SplitScriptResponse {
  scenes: Scene[];
  stats: {
    totalSlides: number;
    imageSlides: number;
  };
}

export type EditorStep = 1 | 2 | 3 | 4;

export type PresetType =
  | 'black-background'
  | 'white-background'
  | 'headshot-bio'
  | 'image-backdrop'
  | 'image-text'
  | 'infographic';
