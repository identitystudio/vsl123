'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, ExternalLink, Eye, EyeOff, SkipForward } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useUpdateSlides, useUpdateSettings, useUpdateSingleSlide } from '@/hooks/use-project';
import type { Slide, ProjectSettings } from '@/types';
import { toast } from 'sonner';

interface AudioSetupProps {
  projectId: string;
  slides: Slide[];
  settings: ProjectSettings;
  onComplete: () => void;
  onSkip: () => void;
}

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
}

export function AudioSetup({
  projectId,
  slides,
  settings,
  onComplete,
  onSkip,
}: AudioSetupProps) {
  const [apiKey, setApiKey] = useState(settings.audio?.elevenLabsApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [connected, setConnected] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(
    settings.audio?.voiceId || ''
  );
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('10');
  const [subInfo, setSubInfo] = useState<{ remaining_characters: number; character_limit: number } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateSlides = useUpdateSlides();
  const updateSettings = useUpdateSettings();
  const updateSingleSlide = useUpdateSingleSlide();

  // Celebration confetti on entering audio step
  useEffect(() => {
    const burst = () => {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    };
    burst();
  }, []);

  // Track keys that have failed to prevent auto-connect loops across re-renders
  const failedKeysRef = useRef<Set<string>>(new Set());
  const activeConnectionRef = useRef<string | null>(null);

  // Auto-connect if key exists in settings (runs on mount)
  useEffect(() => {
    const savedKey = settings.audio?.elevenLabsApiKey;
    if (savedKey && !connected && !loadingVoices && activeConnectionRef.current !== savedKey && !failedKeysRef.current.has(savedKey)) {
      handleConnect(savedKey);
    }
  }, [settings.audio?.elevenLabsApiKey, connected]);

  const handleConnect = async (targetKey?: string) => {
    const rawKey = targetKey || apiKey;
    const keyToUse = rawKey?.trim();
    
    if (!keyToUse || keyToUse.length < 10) return;
    if (activeConnectionRef.current === keyToUse && connected) return;

    activeConnectionRef.current = keyToUse;
    setLoadingVoices(true);
    
    try {
      // 1. Fetch Voices (This is the critical part for functionality)
      const voiceRes = await fetch('/api/elevenlabs-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToUse }),
      });

      if (!voiceRes.ok) {
        const errorData = await voiceRes.json().catch(() => ({ error: 'Connection failed' }));
        const errorMessage = errorData.error || `Error ${voiceRes.status}`;
        
        console.error(`ElevenLabs Voice Error [${voiceRes.status}]:`, errorMessage);
        
        if (voiceRes.status === 401) {
          failedKeysRef.current.add(keyToUse);
        }
        throw new Error(errorMessage);
      }

      const voiceData = await voiceRes.json();
      setVoices(voiceData.voices || []);
      setConnected(true);

      // 2. Fetch Subscription Info (Non-blocking, helpful but not mandatory)
      try {
        const userRes = await fetch('/api/elevenlabs-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: keyToUse }),
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setSubInfo(userData);
        }
      } catch (userErr) {
        console.warn('Could not fetch ElevenLabs subscription info:', userErr);
      }

      // Only save to DB if this was a MANUAL keyboard entry from the user
      if (!targetKey && keyToUse !== settings.audio?.elevenLabsApiKey) {
        // ... mutation logic unchanged ...
        await updateSettings.mutateAsync({
          projectId,
          settings: {
            ...settings,
            audio: {
              ...settings.audio,
              elevenLabsApiKey: keyToUse,
              voiceId: settings.audio?.voiceId || '',
              stability: settings.audio?.stability || 0.5,
              similarityBoost: settings.audio?.similarityBoost || 0.75,
              speed: settings.audio?.speed || 1.0,
            },
          },
        });
        toast.success('Connected to ElevenLabs!');
      }
    } catch (err: any) {
      console.error('handleConnect failed:', err);
      activeConnectionRef.current = null;
      setConnected(false);
      
      if (!targetKey) {
        toast.error(err.message || 'Check your API key and connection');
      }
    } finally {
      setLoadingVoices(false);
    }
  };

  const processBatch = async (slidesToProcess: any[], label: string) => {
    setGenerating(true);
    setGeneratingProgress(0);
    let completed = 0;
    let failed = 0;
    const batchSize = 2; // Safe concurrency for all ElevenLabs tiers
    const total = slidesToProcess.length;

    for (let i = 0; i < total; i += batchSize) {
      const batch = slidesToProcess.slice(i, i + batchSize);
      await Promise.all(batch.map(async (slide) => {
        let retries = 0;
        const maxRetries = 2;
        while (retries <= maxRetries) {
          try {
            const response = await fetch('/api/elevenlabs-tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: slide.fullScriptText,
                voiceId: selectedVoice,
                apiKey,
                stability: 0.5,
                similarityBoost: 0.75,
                speed: 1.0,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              await updateSingleSlide.mutateAsync({
                slideId: slide.id,
                updates: {
                  audioUrl: data.audioContent,
                  audioDuration: data.duration,
                  audioGenerated: true,
                },
              });
              break;
            } else {
              const err = await response.json().catch(() => ({}));
              if (response.status === 429 || (err.error && err.error.toLowerCase().includes('concurrent'))) {
                const wait = (retries + 1) * 2000;
                await new Promise(r => setTimeout(r, wait));
                retries++;
                continue;
              }
              console.warn(`TTS failed for ${slide.id}:`, err.error || response.statusText);
              failed++;
              break;
            }
          } catch (err) {
            if (retries === maxRetries) failed++;
            retries++;
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        completed++;
        setGeneratingProgress(Math.round((completed / total) * 100));
      }));
    }
    setGenerating(false);
    if (failed > 0) {
      toast.error(`${label} complete with ${failed} failures.`);
    } else {
      toast.success(`${label} successful!`);
    }
  };

  const generateSingleSlideAudio = async (index: number) => {
    if (!selectedVoice) {
      toast.error('Please select a voice first');
      return;
    }
    const slide = slides[index];
    await processBatch([slide], `Audio for slide ${index + 1}`);
  };

  const handleGenerateRemaining = async () => {
    if (!selectedVoice) {
      toast.error('Please select a voice first');
      return;
    }
    const slidesNeedingAudio = slides.filter(s => !s.audioGenerated);
    if (slidesNeedingAudio.length === 0) {
      toast.info('All slides already have audio!');
      return;
    }
    await processBatch(slidesNeedingAudio, 'Remaining audio generation');
  };

  const handleGenerateRange = async () => {
    if (!selectedVoice) {
      toast.error('Please select a voice first');
      return;
    }
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end) || start < 1 || end > slides.length || start > end) {
      toast.error('Invalid range. Please check slide numbers.');
      return;
    }
    const rangeSlides = slides.slice(start - 1, end);
    await processBatch(rangeSlides, `Audio for slides ${start} to ${end}`);
  };

  const handleRegenerateAll = async () => {
    if (!selectedVoice) {
      toast.error('Please select a voice first');
      return;
    }
    if (!confirm('This will regenerate audio for ALL slides. Continue?')) return;
    await processBatch(slides, 'Full audio regeneration');
  };

  const [voiceSearch, setVoiceSearch] = useState('');

  const filteredVoices = voices.filter(v => 
    v.name.toLowerCase().includes(voiceSearch.toLowerCase()) || 
    v.category?.toLowerCase().includes(voiceSearch.toLowerCase())
  );

  // Connected — show voice selector and generate
  if (connected) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Left/Middle: Voice Selection & Generation Controls */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col gap-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">1. Choose Voice</h2>
                    <p className="text-xs text-gray-400">Showing {filteredVoices.length} of {voices.length} voices</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {subInfo && (
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Remaining Characters</p>
                      <p className="text-sm font-black">
                        {subInfo.remaining_characters.toLocaleString()} 
                        <span className="text-gray-300 font-normal ml-1">/ {subInfo.character_limit.toLocaleString()}</span>
                      </p>
                    </div>
                  )}
                  <div className="w-48">
                    <Input 
                      placeholder="Search..." 
                      value={voiceSearch}
                      onChange={(e) => setVoiceSearch(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[500px] overflow-auto pr-2 thin-scrollbar p-1">
                {filteredVoices.map((voice) => (
                  <button
                    key={voice.voice_id}
                    onClick={() => setSelectedVoice(voice.voice_id)}
                    className={`text-left p-3 rounded-xl border transition-all relative ${
                      selectedVoice === voice.voice_id
                        ? 'border-black bg-black text-white shadow-md z-10'
                        : 'border-gray-100 hover:border-gray-300 bg-white hover:shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{voice.name}</span>
                        {voice.category === 'cloned' && (
                          <span className="text-yellow-400 text-xs">★</span>
                        )}
                      </div>
                      <span className={`text-[10px] uppercase tracking-tighter font-semibold ${
                        selectedVoice === voice.voice_id ? 'text-white/60' : 'text-gray-400'
                      }`}>
                        {voice.category || 'Standard'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {generating ? (
                <div className="w-full space-y-3 pt-4 border-t border-gray-100">
                  <Progress value={generatingProgress} className="h-2" />
                  <p className="text-sm text-center text-gray-500">
                    Generating... {generatingProgress}%
                  </p>
                </div>
              ) : (
                <div className="w-full space-y-4 pt-4 border-t border-gray-100">
                  {showAdvanced && (
                    <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                        Generate specific range
                      </p>
                      <div className="flex gap-2 items-center">
                        <Input 
                          type="number" 
                          value={rangeStart} 
                          onChange={(e) => setRangeStart(e.target.value)}
                          className="h-9 text-center text-sm bg-white"
                          placeholder="Start"
                          min={1}
                          max={slides.length}
                        />
                        <span className="text-gray-300 font-medium">to</span>
                        <Input 
                          type="number" 
                          value={rangeEnd} 
                          onChange={(e) => setRangeEnd(e.target.value)}
                          className="h-9 text-center text-sm bg-white"
                          placeholder="End"
                          min={1}
                          max={slides.length}
                        />
                      </div>
                      <Button
                        onClick={handleGenerateRange}
                        className="w-full h-10 text-[11px] font-black uppercase tracking-widest bg-black text-white hover:bg-gray-800 transition-colors shadow-lg shadow-black/5"
                        disabled={!selectedVoice}
                      >
                        Generate Range
                      </Button>
                      
                      <div className="pt-2 border-t border-gray-200 mt-2">
                        <Button
                          onClick={handleRegenerateAll}
                          variant="destructive"
                          className="w-full h-10 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-red-500/10"
                          disabled={!selectedVoice}
                        >
                          Regenerate ALL Slides
                        </Button>
                        <p className="text-[9px] text-gray-400 text-center mt-1">
                          Warning: This will use credits for every slide.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Button
                      onClick={handleGenerateRemaining}
                      size="lg"
                      className="w-full bg-black text-white hover:bg-gray-800 h-12 text-base font-bold shadow-lg shadow-black/5"
                      disabled={!selectedVoice}
                    >
                      Generate Audio
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex-1 border-gray-200 h-10 text-xs uppercase font-black tracking-widest text-gray-500"
                      >
                        {showAdvanced ? 'Hide Advanced' : 'Advanced Settings'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={onComplete}
                        className="flex-1 border-gray-200 h-10 text-xs uppercase font-black tracking-widest bg-gray-50/50"
                      >
                        Done &rarr;
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Slide List for Per-Slide Generation */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Slide Audio Status ({slides.filter(s => s.audioGenerated).length}/{slides.length})
            </h3>
            
            <div className="space-y-2 max-h-[600px] overflow-auto pr-2 thin-scrollbar">
              {slides.map((slide, index) => (
                <div 
                  key={slide.id}
                  className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between gap-4 group hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 text-xs font-bold text-gray-400">
                      {index + 1}
                    </div>
                    <p className="text-xs text-gray-600 truncate italic">
                      "{slide.fullScriptText}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {slide.audioGenerated ? (
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-green-500" />
                         <span className="text-[10px] font-bold text-green-600 uppercase">Ready</span>
                         <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateSingleSlideAudio(index)}
                          className="h-8 px-2 text-gray-400 hover:text-black"
                          disabled={generatingSlideId === slide.id}
                        >
                          {generatingSlideId === slide.id ? '...' : (
                            <span className="text-[10px]">REGEN</span>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateSingleSlideAudio(index)}
                        className="h-8 px-3 text-[10px] font-bold uppercase border-gray-200 hover:border-black"
                        disabled={generatingSlideId === slide.id || !selectedVoice}
                      >
                        {generatingSlideId === slide.id ? 'Generating...' : 'Generate'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Initial — API key input
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="flex flex-col items-center gap-6">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Mic className="w-7 h-7 text-gray-600" />
        </div>

        <h2 className="text-2xl font-bold">Add Voiceover</h2>

        <div className="w-full relative">
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="pr-20 h-12"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex justify-start w-full -mt-2">
          <a
            href="https://elevenlabs.io/app/developers/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-black flex items-center gap-1 transition-colors"
          >
            Find your API key here
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <Button
          onClick={() => {
            if (!apiKey.trim()) {
              toast.error('Please enter your ElevenLabs API key');
              return;
            }
            handleConnect();
          }}
          size="lg"
          className="w-full bg-black text-white hover:bg-gray-800 text-lg py-6 shadow-lg transition-all"
          disabled={loadingVoices}
        >
          {loadingVoices ? 'Connecting...' : 'Connect & Continue'}
        </Button>

        <button
          onClick={onSkip}
          className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          Skip audio for now &rarr;
        </button>
      </div>
    </div>
  );
}
