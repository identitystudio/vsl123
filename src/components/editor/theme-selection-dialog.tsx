'use client';

import { useState, useEffect } from 'react';
import { Palette, Camera, BarChart3, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { ImageGenerationTheme } from '@/types';

interface ThemeSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onThemeSelected: (theme: ImageGenerationTheme) => void;
  defaultTheme?: ImageGenerationTheme;
}

export function ThemeSelectionDialog({
  open,
  onClose,
  onThemeSelected,
  defaultTheme = 'realism',
}: ThemeSelectionDialogProps) {
  const [selectedTheme, setSelectedTheme] = useState<ImageGenerationTheme>(defaultTheme);

  // Sync to the last-used theme whenever the dialog is opened
  useEffect(() => {
    if (open) {
      setSelectedTheme(defaultTheme);
    }
  }, [open, defaultTheme]);

  const handleContinue = () => {
    onThemeSelected(selectedTheme);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Choose Your Image Style
          </DialogTitle>
          <DialogDescription>
            Select the visual style for AI-generated images and videos in your VSL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Realism Theme */}
            <button
              onClick={() => setSelectedTheme('realism')}
              className={`p-6 rounded-xl border-2 text-left transition-all relative ${
                selectedTheme === 'realism'
                  ? 'border-black bg-gray-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {selectedTheme === 'realism' && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Camera className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-lg">Realism</div>
                  <div className="text-xs text-gray-500">Photorealistic</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Professional photographs with cinematic lighting. Perfect for
                authentic, trustworthy, and high-end presentations.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                  4K Quality
                </span>
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                  Natural
                </span>
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                  Professional
                </span>
              </div>
            </button>

            {/* Infographic Theme */}
            <button
              onClick={() => setSelectedTheme('infographic')}
              className={`p-6 rounded-xl border-2 text-left transition-all relative ${
                selectedTheme === 'infographic'
                  ? 'border-black bg-gray-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {selectedTheme === 'infographic' && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="font-bold text-lg">Infographic</div>
                  <div className="text-xs text-gray-500">Illustrative</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Clean vector illustrations and diagrams. Ideal for educational
                content, data visualization, and modern tech presentations.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">
                  Flat Design
                </span>
                <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">
                  Bold Colors
                </span>
                <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">
                  Modern
                </span>
              </div>
            </button>
          </div>

          {/* Preview Description */}
          <div className="p-4 bg-gray-50 rounded-lg border">
            <div className="text-sm font-medium mb-2">
              {selectedTheme === 'realism' ? '📸 Realism' : '📊 Infographic'} Style
            </div>
            <p className="text-xs text-gray-600">
              {selectedTheme === 'realism'
                ? 'Your images will look like professional photographs with natural lighting, realistic textures, and cinematic composition. Videos will feature smooth, realistic camera movements.'
                : 'Your images will feature clean vector graphics, flat design elements, bold colors, and modern minimalist aesthetics. Videos will have animated infographic elements and smooth transitions.'}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleContinue}
              className="bg-black text-white hover:bg-gray-800 gap-2"
            >
              Continue with {selectedTheme === 'realism' ? 'Realism' : 'Infographic'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
