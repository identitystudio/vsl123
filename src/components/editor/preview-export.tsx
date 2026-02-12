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
  Settings,
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
  onSlideClick?: (index: number) => void;
}

// Magical rotating messages — tailored for Export phase
const EXPORT_MESSAGES = [
  { text: 'Finalizing your conversion machine...', emoji: '⚙️' },
  { text: 'Turning pixels into profits. Almost there.', emoji: '💸' },
  { text: 'Quality check: Making sure every transition is perfect.', emoji: '✨' },
  { text: 'Readying the "Beast" for the final render.', emoji: '🚀' },
  { text: 'Your message is being carved into the final frames.', emoji: '💎' },
  { text: 'Final exports are where the magic truly sets in.', emoji: '🪄' },
  { text: 'Imagine the impact this will have on your audience...', emoji: '🎯' },
  { text: 'The wait is almost over. Your funnel is about to go live.', emoji: '🏁' },
  { text: 'Your competitors are still fumbling. You\'re about to launch.', emoji: '🔥' },
  { text: 'Encoding at hyper-speed. Hang tight.', emoji: '⚡' },
  { text: 'A work of art takes time, but we\'re making it record speed.', emoji: '🎨' },
  { text: 'Your words, now perfectly synced with cinematic slides.', emoji: '🎬' },
];

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  size: number;
  angle: number;
  dx: number;
  dy: number;
  opacity: number;
  shape: 'circle' | 'square' | 'star';
}

let confettiIdCounter = 0;

function MagicProgress({ progress }: { progress: number }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const shuffledRef = useRef<typeof EXPORT_MESSAGES>([]);
  const [displayProgress, setDisplayProgress] = useState(progress);
  const targetRef = useRef(progress);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const prevProgressRef = useRef(progress);

  useEffect(() => {
    shuffledRef.current = [...EXPORT_MESSAGES].sort(() => Math.random() - 0.5);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % EXPORT_MESSAGES.length);
        setFade(true);
      }, 400);
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  const spawnConfetti = useCallback((atProgress: number, count: number) => {
    const colors = ['#6366f1', '#818cf8', '#4f46e5', '#4338ca', '#3730a3', '#F5D300', '#C0C0C0'];
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < count; i++) {
      pieces.push({
        id: ++confettiIdCounter,
        x: Math.max(5, Math.min(95, atProgress - 5 + Math.random() * 10)),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        angle: Math.random() * 360,
        dx: (Math.random() - 0.5) * 120,
        dy: -(40 + Math.random() * 80),
        opacity: 1,
        shape: (['circle', 'square', 'star'] as const)[Math.floor(Math.random() * 3)],
      });
    }
    setConfetti((prev) => [...prev, ...pieces]);
    setTimeout(() => {
      setConfetti((prev) => prev.filter((p) => !pieces.some((np) => np.id === p.id)));
    }, 1800);
  }, []);

  useEffect(() => {
    const jump = progress - prevProgressRef.current;
    targetRef.current = progress;
    prevProgressRef.current = progress;
    if (jump >= 5) {
      spawnConfetti(progress, Math.min(Math.floor(jump * 1.5), 30));
    }
  }, [progress, spawnConfetti]);

  useEffect(() => {
    const tick = setInterval(() => {
      setDisplayProgress((current) => {
        const target = targetRef.current;
        const gap = target - current;
        if (gap <= 0.1) {
          if (current < 99 && current > 0) return current + 0.01 + Math.random() * 0.02; // Keep it alive
          return current;
        }
        const step = Math.max(0.1, gap * 0.05 + Math.random() * 0.1);
        return Math.min(current + step, target);
      });
    }, 100);
    return () => clearInterval(tick);
  }, []);

  const msg = shuffledRef.current[msgIndex] || EXPORT_MESSAGES[msgIndex];

  return (
    <div className="w-full space-y-6 py-4">
      <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-visible border border-gray-200">
        <div className="relative w-full h-full rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${displayProgress}%`,
              background: 'linear-gradient(90deg, #4f46e5 0%, #818cf8 30%, #4f46e5 50%, #6366f1 70%, #4f46e5 100%)',
              backgroundSize: '200% 100%',
              animation: 'export-shimmer 2s linear infinite',
              boxShadow: '0 0 10px rgba(79, 70, 229, 0.4)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {confetti.map((piece) => (
          <div
            key={piece.id}
            className="absolute pointer-events-none"
            style={{
              left: `${piece.x}%`,
              top: '50%',
              animation: `confetti-fly 1.6s ease-out forwards`,
              '--dx': `${piece.dx}px`,
              '--dy': `${piece.dy}px`,
            } as any}
          >
            <div
              style={{
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: piece.shape === 'circle' ? '50%' : '2px',
                transform: `rotate(${piece.angle}deg)`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="text-center min-h-[80px] flex flex-col items-center justify-center gap-2">
        <div 
          className="flex items-center gap-3 transition-opacity duration-400"
          style={{ opacity: fade ? 1 : 0 }}
        >
          <span className="text-2xl">{msg.emoji}</span>
          <p className="text-lg text-gray-700 italic font-medium leading-tight">
            "{msg.text}"
          </p>
        </div>
        <p className="text-sm font-bold text-indigo-600 animate-pulse">
          {Math.floor(displayProgress)}% COMPLETE
        </p>
      </div>

      <style>{`
        @keyframes export-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes confetti-fly {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Helper to handle rate limiting with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    // If rate limited (429) or server error (5xx), retry
    if ((response.status === 429 || response.status >= 500) && retries > 0) {
      console.log(`Request failed with ${response.status}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`Network error. Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

export function PreviewExport({
  projectId,
  projectName,
  slides,
  onSlideClick,
}: PreviewExportProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [hctiUserId, setHctiUserId] = useState('');
  const [hctiApiKey, setHctiApiKey] = useState('');
  const [json2videoApiKey, setJson2videoApiKey] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved API credentials
  useEffect(() => {
    const savedUserId = localStorage.getItem('hcti_user_id');
    const savedApiKey = localStorage.getItem('hcti_api_key');
    const savedJson2videoKey = localStorage.getItem('json2video_api_key');
    if (savedUserId) setHctiUserId(savedUserId);
    if (savedApiKey) setHctiApiKey(savedApiKey);
    if (savedJson2videoKey) setJson2videoApiKey(savedJson2videoKey);
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('hcti_user_id', hctiUserId);
    localStorage.setItem('hcti_api_key', hctiApiKey);
    localStorage.setItem('json2video_api_key', json2videoApiKey);
    setShowSettings(false);
    toast.success('API credentials saved');
  };

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
    if (exporting) return;

    // Use default API keys if not configured
    const userId = localStorage.getItem('hcti_user_id') || '980c1ea4-9361-4496-ba24-9246925be09f';
    const apiKey = localStorage.getItem('hcti_api_key') || 'caa50ed6-9f01-4e12-8c57-28ce7cd51d14';

    setExporting(true);
    setExportProgress(0);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        // Create off-screen container to render SlidePreview
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
          position: fixed;
          left: -9999px;
          top: 0;
        `;
        
        const container = document.createElement('div');
        container.style.cssText = `
          width: 1920px;
          height: 1080px;
        `;
        
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);

        // Import React and ReactDOM dynamically
        const React = await import('react');
        const ReactDOM = await import('react-dom/client');
        
        // Create root and render SlidePreview
        const root = ReactDOM.createRoot(container);
        
        // Render the SlidePreview component at full size (scale=3 to match 1920x1080)
        await new Promise<void>((resolve) => {
          root.render(
            React.createElement(SlidePreview, {
              slide: slide,
              scale: 3, // 640*3 = 1920, 360*3 = 1080
            })
          );
          
          // Wait for render and images to load
          setTimeout(resolve, 2000);
        });

        // Extract the rendered HTML
        const renderedElement = container.firstElementChild as HTMLElement;
        if (!renderedElement) {
          throw new Error('Failed to render slide');
        }

        // Get the outer HTML (with Tailwind classes intact)
        const slideHtml = renderedElement.outerHTML;
        
        // Wrap in a complete HTML document with Tailwind CSS
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; width: 1920px; height: 1080px; overflow: hidden; }
  </style>
</head>
<body>
  ${slideHtml}
</body>
</html>
        `.trim();

        console.log('Sending HTML to htmlcsstoimage (first 1000 chars):', html.substring(0, 1000));

        // Add small delay to avoid rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 500));

        // Call htmlcsstoimage API
        const response = await fetchWithRetry('https://hcti.io/v1/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${userId}:${apiKey}`),
          },
          body: JSON.stringify({
            html,
            css: '',
            viewport_width: 1920,
            viewport_height: 1080,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('htmlcsstoimage error:', error);
          throw new Error(`API error: ${error}`);
        }

        const result = await response.json();
        console.log('htmlcsstoimage result:', result);
        
        
        // Download the image
        const imgResponse = await fetch(result.url);
        const imgBlob = await imgResponse.blob();

        const paddedNum = String(i + 1).padStart(3, '0');
        zip.file(
          `${projectName.replace(/\s+/g, '_')}_${paddedNum}.png`,
          imgBlob
        );

        // Cleanup
        root.unmount();
        document.body.removeChild(wrapper);

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

  const handleVideoExport = async () => {
    if (exporting) return;

    // Use default API keys if not configured
    const json2videoKey = localStorage.getItem('json2video_api_key') || '1PZg9oCh5usbk7QoDYQfZmPF1fdEJSUAFeUgfP6Z';
    const userId = localStorage.getItem('hcti_user_id') || '980c1ea4-9361-4496-ba24-9246925be09f';
    const apiKey = localStorage.getItem('hcti_api_key') || 'caa50ed6-9f01-4e12-8c57-28ce7cd51d14';

    setExporting(true);
    setExportProgress(0);

    try {
      const slideImageUrls: string[] = [];
      const slideAudioUrls: string[] = [];

      // Render all slides as images using htmlcsstoimage
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0;';
        const container = document.createElement('div');
        container.style.cssText = 'width: 1920px; height: 1080px;';
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);

        const React = await import('react');
        const ReactDOM = await import('react-dom/client');
        const root = ReactDOM.createRoot(container);
        
        await new Promise<void>((resolve) => {
          root.render(React.createElement(SlidePreview, { slide, scale: 3 }));
          setTimeout(resolve, 2000);
        });

        const renderedElement = container.firstElementChild as HTMLElement;
        if (!renderedElement) throw new Error('Failed to render slide');

        const slideHtml = renderedElement.outerHTML;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>*{margin:0;padding:0;}body{width:1920px;height:1080px;overflow:hidden;}</style></head><body>${slideHtml}</body></html>`;

        // Add small delay to avoid rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 500));
        
        const response = await fetchWithRetry('https://hcti.io/v1/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${userId}:${apiKey}`),
          },
          body: JSON.stringify({ html, viewport_width: 1920, viewport_height: 1080 }),
        });

        if (!response.ok) throw new Error('Failed to render slide image');
        const result = await response.json();
        slideImageUrls.push(result.url);
        
        // Store audio URL if exists
        if (slide.audioUrl) {
          slideAudioUrls.push(slide.audioUrl);
        } else {
          slideAudioUrls.push(''); // Empty for slides without audio
        }

        root.unmount();
        document.body.removeChild(wrapper);
        setExportProgress(Math.round(((i + 1) / slides.length) * 40));
      }

      console.log('Collected slide image URLs:', slideImageUrls);
      console.log('Collected slide audio URLs:', slideAudioUrls);

      // Create video with json2video using image URLs
      const scenes = slides.map((slide, i) => {
        const scene: any = {
          comment: `Slide ${i + 1}`,
          elements: [
            {
              type: 'image',
              src: slideImageUrls[i],
              settings: {
                width: '100%',
                height: '100%',
              },
            },
          ],
        };
        
        // Add audio if available
        if (slideAudioUrls[i]) {
          scene.audio = {
            src: slideAudioUrls[i],
          };
        } else {
          // If no audio, set duration to 3 seconds
          scene.duration = 3;
        }
        
        return scene;
      });

      console.log('Creating json2video project with scenes:', JSON.stringify(scenes, null, 2));

      // Send directly to json2video API (not through proxy) for debugging
      const json2videoPayload = {
        resolution: 'full-hd',
        quality: 'high',
        scenes,
      };

      console.log('json2video payload:', JSON.stringify(json2videoPayload, null, 2));

      const json2videoResponse = await fetch('https://api.json2video.com/v2/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': json2videoKey,
        },
        body: JSON.stringify(json2videoPayload),
      });

      console.log('json2video response status:', json2videoResponse.status);
      console.log('json2video response ok:', json2videoResponse.ok);
      
      const responseText = await json2videoResponse.text();
      console.log('json2video response text:', responseText);

      if (!json2videoResponse.ok) {
        let error;
        try {
          error = JSON.parse(responseText);
        } catch {
          error = { error: responseText };
        }
        throw new Error(`json2video API error: ${error.error || responseText}`);
      }
      
      const videoProject = JSON.parse(responseText);
      console.log('json2video project created:', videoProject);
      
      // Extract project ID
      const projectId = videoProject.project || videoProject.id || videoProject.project_id || videoProject.movie_id;
      
      if (!projectId) {
        console.error('Full response:', videoProject);
        throw new Error('No project ID in response. Check console for full response.');
      }

      setExportProgress(50);

      // Poll for completion
      let videoUrl = null;
      let attempts = 0;
      const maxAttempts = 60; // 3 minutes max
      
      while (!videoUrl && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
        
        const statusResponse = await fetch('/api/json2video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'status',
            apiKey: json2videoKey,
            projectId,
          }),
        });
        
        const status = await statusResponse.json();
        console.log('Video status:', status);
        
        if (status.status === 'error' || status.status === 'failed') {
          throw new Error(`Video rendering failed: ${status.error || 'Unknown error'}`);
        }
        
        if (status.status === 'done' || status.status === 'finished') {
          videoUrl = status.url || status.movie_url;
        }
        
        setExportProgress(50 + Math.min(45, (attempts / maxAttempts) * 45));
      }

      if (!videoUrl) {
        throw new Error('Video rendering timed out');
      }

      // Download video
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `${projectName.replace(/\s+/g, '_')}.mp4`;
      link.click();

      setExportProgress(100);
      toast.success('Video exported successfully!');
    } catch (error) {
      console.error('Video export error:', error);
      toast.error(error instanceof Error ? error.message : 'Video export failed');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleFFmpegExport = async () => {
    if (exporting) return;

    const userId = localStorage.getItem('hcti_user_id') || '980c1ea4-9361-4496-ba24-9246925be09f';
    const apiKey = localStorage.getItem('hcti_api_key') || 'caa50ed6-9f01-4e12-8c57-28ce7cd51d14';

    setExporting(true);
    setExportProgress(0);

    try {
      toast.info('Loading FFmpeg... This may take a moment');
      
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
      
      const ffmpeg = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setExportProgress(10);
      toast.info('Rendering slides...');

      const slideImages: Blob[] = [];
      const slideAudios: (Blob | null)[] = [];

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0;';
        const container = document.createElement('div');
        container.style.cssText = 'width: 1920px; height: 1080px;';
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);

        const React = await import('react');
        const ReactDOM = await import('react-dom/client');
        const root = ReactDOM.createRoot(container);
        
        await new Promise<void>((resolve) => {
          root.render(React.createElement(SlidePreview, { slide, scale: 3 }));
          setTimeout(resolve, 2000);
        });

        const renderedElement = container.firstElementChild as HTMLElement;
        if (!renderedElement) throw new Error('Failed to render slide');

        const slideHtml = renderedElement.outerHTML;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>*{margin:0;padding:0;}body{width:1920px;height:1080px;overflow:hidden;}</style></head><body>${slideHtml}</body></html>`;

        // Add small delay to avoid rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 500));
        
        const response = await fetchWithRetry('https://hcti.io/v1/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${userId}:${apiKey}`),
          },
          body: JSON.stringify({ html, viewport_width: 1920, viewport_height: 1080 }),
        });

        if (!response.ok) throw new Error('Failed to render slide image');
        const result = await response.json();
        
        const imgResponse = await fetch(result.url);
        const imgBlob = await imgResponse.blob();
        slideImages.push(imgBlob);
        
        // Collect audio if exists
        if (slide.audioUrl) {
          const audioResponse = await fetch(slide.audioUrl);
          const audioBlob = await audioResponse.blob();
          slideAudios.push(audioBlob);
        } else {
          slideAudios.push(null);
        }

        root.unmount();
        document.body.removeChild(wrapper);
        setExportProgress(10 + Math.round(((i + 1) / slides.length) * 50));
      }

      toast.info('Creating video...');
      setExportProgress(65);

      // Write images to FFmpeg
      for (let i = 0; i < slideImages.length; i++) {
        await ffmpeg.writeFile(`slide${i}.png`, await fetchFile(slideImages[i]));
      }

      // Write audio files and create filter for concatenation
      let hasAudio = false;
      let audioInputs: string[] = [];
      
      console.log('Processing audio files...');
      for (let i = 0; i < slideAudios.length; i++) {
        if (slideAudios[i]) {
          try {
            console.log(`Writing audio file ${i}...`);
            await ffmpeg.writeFile(`audio${i}.mp3`, await fetchFile(slideAudios[i]!));
            audioInputs.push(`audio${i}.mp3`);
            hasAudio = true;
            console.log(`Audio file ${i} written successfully`);
          } catch (err) {
            console.error(`Failed to write audio ${i}:`, err);
            // Skip this audio file if it fails
          }
        }
      }

      console.log(`Total audio files: ${audioInputs.length}, hasAudio: ${hasAudio}`);

      // Create concat file for images
      let concatContent = '';
      for (let i = 0; i < slideImages.length; i++) {
        concatContent += `file 'slide${i}.png'\n`;
        // Duration is based on audio length or default 3 seconds
        const duration = slideAudios[i] ? 5 : 3; // Approximate, will be synced with audio
        concatContent += `duration ${duration}\n`;
      }
      concatContent += `file 'slide${slideImages.length - 1}.png'\n`;
      
      await ffmpeg.writeFile('concat.txt', concatContent);

      setExportProgress(75);

      // Enable FFmpeg logging to see progress
      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg:', message);
      });

      ffmpeg.on('progress', ({ progress, time }) => {
        console.log(`FFmpeg progress: ${Math.round(progress * 100)}% (${time}s)`);
        setExportProgress(75 + Math.round(progress * 15));
      });

      toast.info('Creating video segments...');
      setExportProgress(70);

      // Create individual video segments for each slide
      const videoSegments: string[] = [];
      
      for (let i = 0; i < slideImages.length; i++) {
        console.log(`Creating segment ${i + 1}/${slideImages.length}...`);
        
        const segmentName = `segment${i}.mp4`;
        const imageName = `slide${i}.png`;
        const duration = slideAudios[i] ? 5 : 3; // Approximate duration
        
        if (slideAudios[i]) {
          // Slide has audio - create video with audio
          const audioName = `audio${i}.mp3`;
          
          await ffmpeg.exec([
            '-loop', '1',
            '-i', imageName,
            '-i', audioName,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'stillimage',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            '-fflags', '+shortest',
            '-max_interleave_delta', '100M',
            segmentName
          ]);
        } else {
          // Slide has no audio - create silent video
          await ffmpeg.exec([
            '-loop', '1',
            '-i', imageName,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'stillimage',
            '-t', duration.toString(),
            '-pix_fmt', 'yuv420p',
            segmentName
          ]);
        }
        
        videoSegments.push(segmentName);
        setExportProgress(70 + Math.round(((i + 1) / slideImages.length) * 15));
      }

      setExportProgress(85);
      toast.info('Combining video segments...');

      // Create concat file for video segments
      let segmentConcatContent = '';
      for (const segment of videoSegments) {
        segmentConcatContent += `file '${segment}'\n`;
      }
      await ffmpeg.writeFile('segments_concat.txt', segmentConcatContent);

      console.log('Concatenating video segments...');
      
      // Concatenate all video segments
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'segments_concat.txt',
        '-c', 'copy',
        'output.mp4'
      ]);

      setExportProgress(90);

      const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
      const videoBlob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });

      const url = URL.createObjectURL(videoBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName.replace(/\s+/g, '_')}.mp4`;
      link.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      toast.success('Video created with FFmpeg!');
    } catch (error) {
      console.error('FFmpeg export error:', error);
      toast.error(error instanceof Error ? error.message : 'FFmpeg export failed');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleFFmpegZipExport = async () => {
    if (exporting) return;

    const userId = localStorage.getItem('hcti_user_id') || '980c1ea4-9361-4496-ba24-9246925be09f';
    const apiKey = localStorage.getItem('hcti_api_key') || 'caa50ed6-9f01-4e12-8c57-28ce7cd51d14';

    setExporting(true);
    setExportProgress(0);

    try {
      toast.info('Starting ZIP export (FFmpeg pipeline)...');

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Collect assets
      const slideImages: { blob: Blob; name: string }[] = [];
      const slideAudios: { blob: Blob; name: string }[] = [];

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        // --- Render Slide (Same logic as FFmpeg export) ---
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0;';
        const container = document.createElement('div');
        container.style.cssText = 'width: 1920px; height: 1080px;';
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);

        const React = await import('react');
        const ReactDOM = await import('react-dom/client');
        const root = ReactDOM.createRoot(container);
        
        await new Promise<void>((resolve) => {
          root.render(React.createElement(SlidePreview, { slide, scale: 3 }));
          setTimeout(resolve, 2000); // Wait for images
        });

        const renderedElement = container.firstElementChild as HTMLElement;
        if (!renderedElement) throw new Error('Failed to render slide');

        const slideHtml = renderedElement.outerHTML;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>*{margin:0;padding:0;}body{width:1920px;height:1080px;overflow:hidden;}</style></head><body>${slideHtml}</body></html>`;

        // Add small delay to avoid rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 500));
        
        const response = await fetchWithRetry('https://hcti.io/v1/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${userId}:${apiKey}`),
          },
          body: JSON.stringify({ html, viewport_width: 1920, viewport_height: 1080 }),
        });

        if (!response.ok) throw new Error('Failed to render slide image');
        const result = await response.json();
        
        const imgResponse = await fetch(result.url);
        const imgBlob = await imgResponse.blob();
        
        const paddedNum = String(i + 1).padStart(3, '0');
        slideImages.push({ blob: imgBlob, name: `${projectName.replace(/\s+/g, '_')}_${paddedNum}.png` });
        
        // --- Collect Audio ---
        if (slide.audioUrl) {
          const audioResponse = await fetch(slide.audioUrl);
          const audioBlob = await audioResponse.blob();
          slideAudios.push({ blob: audioBlob, name: `audio/${projectName.replace(/\s+/g, '_')}_${paddedNum}.mp3` });
        }

        root.unmount();
        document.body.removeChild(wrapper);
        setExportProgress(Math.round(((i + 1) / slides.length) * 80));
      }

      // --- Zip files ---
      toast.info('Zipping files...');
      
      slideImages.forEach(img => {
        zip.file(img.name, img.blob);
      });
      
      slideAudios.forEach(audio => {
        zip.file(audio.name, audio.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '_')}_FFmpeg_Pipeline.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      toast.success('ZIP exported successfully!');

    } catch (error) {
      console.error('ZIP export error:', error);
      toast.error(error instanceof Error ? error.message : 'ZIP export failed');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col items-center gap-6">
        {/* Slide preview */}
        <div className="relative group cursor-pointer" onClick={() => onSlideClick?.(currentIndex)}>
          <SlidePreview slide={currentSlide} scale={1} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 bg-white/90 text-black px-3 py-1.5 rounded-full text-sm font-bold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
              Click to Edit Slide {currentIndex + 1}
            </div>
          </div>
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
          <div className="w-full max-w-lg bg-white/50 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-xl animate-in fade-in zoom-in duration-500">
            <MagicProgress progress={exportProgress} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* Settings Dialog */}
            {showSettings && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
                  <h3 className="text-lg font-semibold">htmlcsstoimage.com API Settings</h3>
                  <p className="text-sm text-gray-600">
                    Get your API credentials from{' '}
                    <a
                      href="https://htmlcsstoimage.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      htmlcsstoimage.com/dashboard
                    </a>
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">User ID</label>
                      <input
                        type="text"
                        value={hctiUserId}
                        onChange={(e) => setHctiUserId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Enter your User ID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">API Key</label>
                      <input
                        type="password"
                        value={hctiApiKey}
                        onChange={(e) => setHctiApiKey(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Enter your API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">json2video API Key</label>
                      <input
                        type="password"
                        value={json2videoApiKey}
                        onChange={(e) => setJson2videoApiKey(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Enter your json2video API Key"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Get from{' '}
                        <a
                          href="https://json2video.com/dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          json2video.com
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowSettings(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveSettings}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 w-full max-w-md">
              <Button
                onClick={async () => {
                  if (exporting) return;
                  setExporting(true);
                  setExportProgress(10);

                  try {
                    toast.info('Preparing slides for VPS render...');
                    const slidesWithHtml = [];
                    const React = await import('react');
                    const ReactDOM = await import('react-dom/client');

                    for (let i = 0; i < slides.length; i++) {
                      const slide = slides[i];
                      const wrapper = document.createElement('div');
                      wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0;';
                      const container = document.createElement('div');
                      container.style.cssText = 'width: 1920px; height: 1080px;';
                      wrapper.appendChild(container);
                      document.body.appendChild(wrapper);
                      const root = ReactDOM.createRoot(container);
                      await new Promise<void>((resolve) => {
                        root.render(React.createElement(SlidePreview, { slide, scale: 3 }));
                        setTimeout(resolve, 100); 
                      });
                      const renderedElement = container.firstElementChild as HTMLElement;
                      if (!renderedElement) throw new Error('Failed to render slide locally');
                      slidesWithHtml.push({
                        audioUrl: slide.audioUrl,
                        htmlContent: renderedElement.outerHTML
                      });
                      root.unmount();
                      document.body.removeChild(wrapper);
                    }

                    toast.info('Sending project to VPS...');
                    const startRes = await fetch(`/api/vps-render?mode=render`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ slides: slidesWithHtml, projectName }),
                    });

                    if (!startRes.ok) throw new Error(await startRes.text());
                    const { jobId } = await startRes.json();
                    
                    let completed = false;
                    while (!completed) {
                      await new Promise(r => setTimeout(r, 3000));
                      const statusRes = await fetch(`/api/vps-render?jobId=${jobId}`);
                      if (!statusRes.ok) throw new Error('Failed to check job status');
                      const job = await statusRes.json();
                      
                      if (job.status === 'completed') {
                        completed = true;
                        setExportProgress(100);
                        toast.success('Video Ready! Downloading...');
                        window.location.href = `/api/vps-render?jobId=${jobId}&download=${job.downloadUrl.split('/').pop()}`;
                      } else if (job.status === 'failed') {
                        throw new Error(`VPS Job Failed: ${job.error}`);
                      } else {
                        setExportProgress(job.progress || 50);
                        toast.info(`VPS: ${job.status.replace('_', ' ')} (${job.progress || 0}%)`, { id: 'vps-progress' });
                      }
                    }
                  } catch (error) {
                    console.error(error);
                    toast.error(`VPS Export Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  } finally {
                    setExporting(false);
                    setExportProgress(0);
                  }
                }}
                size="lg"
                className="bg-indigo-600 text-white hover:bg-indigo-700 gap-2 text-lg px-8 py-6 w-full"
              >
                <Download className="w-5 h-5" />
                Export Video (VPS / Fast)
              </Button>
              
              <Button
                onClick={async () => {
                  if (exporting) return;
                  setExporting(true);
                  setExportProgress(10);

                  try {
                    toast.info('Preparing slides for VPS ZIP...');
                    const slidesWithHtml = [];
                    const React = await import('react');
                    const ReactDOM = await import('react-dom/client');

                    for (let i = 0; i < slides.length; i++) {
                      const slide = slides[i];
                      const wrapper = document.createElement('div');
                      wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0;';
                      const container = document.createElement('div');
                      container.style.cssText = 'width: 1920px; height: 1080px;';
                      wrapper.appendChild(container);
                      document.body.appendChild(wrapper);
                      const root = ReactDOM.createRoot(container);
                      await new Promise<void>((resolve) => {
                        root.render(React.createElement(SlidePreview, { slide, scale: 3 }));
                        setTimeout(resolve, 100); 
                      });
                      const renderedElement = container.firstElementChild as HTMLElement;
                      if (!renderedElement) throw new Error('Failed to render slide locally');
                      slidesWithHtml.push({
                        audioUrl: slide.audioUrl,
                        htmlContent: renderedElement.outerHTML
                      });
                      root.unmount();
                      document.body.removeChild(wrapper);
                    }

                    toast.info('Sending project to VPS ZIP...');
                    const startRes = await fetch(`/api/vps-render?mode=render-zip`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ slides: slidesWithHtml, projectName }),
                    });

                    if (!startRes.ok) throw new Error(await startRes.text());
                    const { jobId } = await startRes.json();
                    
                    let completed = false;
                    while (!completed) {
                      await new Promise(r => setTimeout(r, 3000));
                      const statusRes = await fetch(`/api/vps-render?jobId=${jobId}`);
                      if (!statusRes.ok) throw new Error('Failed to check job status');
                      const job = await statusRes.json();
                      
                      if (job.status === 'completed') {
                        completed = true;
                        setExportProgress(100);
                        toast.success('ZIP Ready! Downloading...');
                        window.location.href = `/api/vps-render?jobId=${jobId}&download=${job.downloadUrl.split('/').pop()}`;
                      } else if (job.status === 'failed') {
                        throw new Error(`VPS Job Failed: ${job.error}`);
                      } else {
                        setExportProgress(job.progress || 50);
                        toast.info(`VPS: ${job.status.replace('_', ' ')} (${job.progress || 0}%)`, { id: 'vps-progress-zip' });
                      }
                    }
                  } catch (error) {
                    console.error(error);
                    toast.error(`VPS ZIP Export Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  } finally {
                    setExporting(false);
                    setExportProgress(0);
                  }
                }}
                size="lg"
                className="bg-gray-800 text-white hover:bg-gray-900 gap-2 text-lg px-8 py-6 w-full"
              >
                <Download className="w-5 h-5" />
                Export ZIP (VPS / Fast)
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          1920&times;1080 @ 2x scale &bull; PNG slides + MP3 audio
        </p>
      </div>
    </div>
  );
}
