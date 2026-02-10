'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SlidePreview } from './slide-preview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { Slide } from '@/types';
import { toast } from 'sonner';

interface PreviewExportProps {
  projectId: string;
  projectName: string;
  slides: Slide[];
}

export function PreviewExport({
  projectId,
  projectName,
  slides,
}: PreviewExportProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSlide = slides[currentIndex];

  const playNextSlide = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setPlaying(false);
    }
  }, [currentIndex, slides.length]);

  // Handle auto-play
  useEffect(() => {
    if (!playing) return;

    const slide = slides[currentIndex];

    if (slide.audioUrl) {
      // Play audio, advance when done
      const audio = new Audio(slide.audioUrl);
      audioRef.current = audio;
      audio.onended = playNextSlide;
      audio.play().catch(() => {
        // If audio fails, advance after default time
        timerRef.current = setTimeout(playNextSlide, 2000);
      });
    } else {
      // No audio — show for estimated time based on word count
      const wordCount = slide.fullScriptText.split(/\s+/).length;
      const displayTime = Math.max(2000, wordCount * 400);
      timerRef.current = setTimeout(playNextSlide, displayTime);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, currentIndex, slides, playNextSlide]);

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);

    try {
      // Dynamic imports for export libraries
      const domtoimage = (await import('dom-to-image-more')).default;
      const JSZip = (await import('jszip')).default;

      const zip = new JSZip();

      for (let i = 0; i < slides.length; i++) {
        // Create off-screen render div with explicit hex colors
        const container = document.createElement('div');
        container.style.cssText = `
          width: 1920px;
          height: 1080px;
          position: fixed;
          left: -9999px;
          top: 0;
          background-color: ${slides[i].style.background === 'dark' ? '#1a1a1a' : '#ffffff'};
          color: ${slides[i].style.textColor === 'white' ? '#ffffff' : '#1a1a1a'};
          border: none;
          font-family: system-ui, -apple-system, sans-serif;
        `;

        // Background image - use img element with proper loading
        if (slides[i].backgroundImage?.url && slides[i].style.background === 'image') {
          const bgImg = document.createElement('img');
          bgImg.crossOrigin = 'anonymous';
          bgImg.src = slides[i].backgroundImage!.url;
          bgImg.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: ${(slides[i].backgroundImage!.opacity || 40) / 100};
            filter: blur(${slides[i].backgroundImage!.blur || 8}px);
          `;
          
          // Wait for image to load before proceeding
          await new Promise((resolve, reject) => {
            bgImg.onload = resolve;
            bgImg.onerror = () => {
              console.warn('Failed to load background image:', slides[i].backgroundImage!.url);
              resolve(null); // Continue even if image fails
            };
            // Timeout after 5 seconds
            setTimeout(() => resolve(null), 5000);
          });
          
          container.appendChild(bgImg);
        }

        // Text
        const textDiv = document.createElement('div');
        textDiv.style.cssText = `
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 80px;
          color: ${slides[i].style.textColor === 'white' ? '#ffffff' : '#1a1a1a'};
          border-color: transparent;
        `;

        const p = document.createElement('p');
        p.style.cssText = `
          font-size: ${slides[i].style.textSize || 72}px;
          font-weight: 700;
          text-align: center;
          line-height: 1.15;
          color: ${slides[i].style.textColor === 'white' ? '#ffffff' : '#1a1a1a'};
          background-color: transparent;
          border-color: transparent;
          margin: 0;
          padding: 0;
        `;
        p.textContent = slides[i].fullScriptText;

        textDiv.appendChild(p);
        container.appendChild(textDiv);
        document.body.appendChild(container);

        try {
          const blob = await domtoimage.toBlob(container, {
            width: 1920,
            height: 1080,
            cacheBust: true,
          });

          const paddedNum = String(i + 1).padStart(3, '0');
          zip.file(
            `${projectName.replace(/\s+/g, '_')}_${paddedNum}.png`,
            blob
          );
        } finally {
          document.body.removeChild(container);
        }

        setExportProgress(Math.round(((i + 1) / slides.length) * 100));
      }

      // Add audio files if they exist
      const audioSlides = slides.filter((s) => s.audioUrl);
      for (let i = 0; i < audioSlides.length; i++) {
        const slideIndex = slides.indexOf(audioSlides[i]);
        const paddedNum = String(slideIndex + 1).padStart(3, '0');

        // Convert base64 to blob
        const base64Data = audioSlides[i].audioUrl!.split(',')[1];
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j);
        }
        zip.file(
          `audio/${projectName.replace(/\s+/g, '_')}_${paddedNum}.mp3`,
          bytes
        );
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '_')}_VSL.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('VSL exported successfully!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col items-center gap-6">
        {/* Slide preview */}
        <div className="relative">
          <SlidePreview slide={currentSlide} scale={1} />
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {currentIndex + 1} / {slides.length}
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentIndex(0)}
            disabled={currentIndex === 0}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setCurrentIndex(Math.max(0, currentIndex - 1))
            }
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            className="w-12 h-12 rounded-full bg-black text-white hover:bg-gray-800"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setCurrentIndex(
                Math.min(slides.length - 1, currentIndex + 1)
              )
            }
            disabled={currentIndex === slides.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentIndex(slides.length - 1)}
            disabled={currentIndex === slides.length - 1}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Timeline */}
        <div className="w-full">
          <Progress
            value={((currentIndex + 1) / slides.length) * 100}
            className="h-1.5"
          />
        </div>

        {/* Export */}
        {exporting ? (
          <div className="w-full max-w-sm space-y-3">
            <Progress value={exportProgress} className="h-2" />
            <p className="text-sm text-center text-gray-500">
              Exporting slides... {exportProgress}%
            </p>
          </div>
        ) : (
          <Button
            onClick={handleExport}
            size="lg"
            className="bg-black text-white hover:bg-gray-800 gap-2 text-lg px-8 py-6"
          >
            <Download className="w-5 h-5" />
            Export as ZIP
          </Button>
        )}

        <p className="text-xs text-gray-400">
          1920&times;1080 @ 2x scale &bull; PNG slides + MP3 audio
        </p>
      </div>
    </div>
  );
}
