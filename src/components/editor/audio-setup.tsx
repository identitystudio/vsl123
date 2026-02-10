'use client';

import { useState, useEffect } from 'react';
import { Mic, ExternalLink, Eye, EyeOff, SkipForward } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useUpdateSlides, useUpdateSettings } from '@/hooks/use-project';
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

  const updateSlides = useUpdateSlides();
  const updateSettings = useUpdateSettings();

  // Celebration confetti on entering audio step
  useEffect(() => {
    const burst = () => {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => {
        confetti({ particleCount: 50, spread: 100, origin: { y: 0.5, x: 0.3 } });
      }, 200);
      setTimeout(() => {
        confetti({ particleCount: 50, spread: 100, origin: { y: 0.5, x: 0.7 } });
      }, 400);
    };
    burst();
  }, []);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your ElevenLabs API key');
      return;
    }

    setLoadingVoices(true);
    try {
      const response = await fetch('/api/elevenlabs-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        throw new Error('Invalid API key');
      }

      const data = await response.json();
      setVoices(data.voices || []);
      setConnected(true);

      // Save API key to settings
      await updateSettings.mutateAsync({
        projectId,
        settings: {
          ...settings,
          audio: {
            ...settings.audio,
            elevenLabsApiKey: apiKey,
            voiceId: settings.audio?.voiceId || '',
            stability: settings.audio?.stability || 0.5,
            similarityBoost: settings.audio?.similarityBoost || 0.75,
            speed: settings.audio?.speed || 1.0,
          },
        },
      });

      toast.success('Connected to ElevenLabs!');
    } catch {
      toast.error('Failed to connect. Check your API key.');
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!selectedVoice) {
      toast.error('Please select a voice first');
      return;
    }

    setGenerating(true);
    setGeneratingProgress(0);

    const updatedSlides = [...slides];
    let completed = 0;

    for (let i = 0; i < slides.length; i++) {
      try {
        const response = await fetch('/api/elevenlabs-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: slides[i].fullScriptText,
            voiceId: selectedVoice,
            apiKey,
            stability: 0.5,
            similarityBoost: 0.75,
            speed: 1.0,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          updatedSlides[i] = {
            ...updatedSlides[i],
            audioUrl: data.audioContent,
            audioDuration: data.duration,
            audioGenerated: true,
          };
        }
      } catch {
        // Continue even if one slide fails
      }

      completed++;
      setGeneratingProgress(Math.round((completed / slides.length) * 100));
    }

    await updateSlides.mutateAsync({ projectId, slides: updatedSlides });

    setGenerating(false);
    toast.success('Audio generated for all slides!');
    onComplete();
  };

  // Connected — show voice selector and generate
  if (connected) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="flex flex-col items-center gap-6">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Mic className="w-7 h-7 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold">Select Voice</h2>

          <div className="w-full space-y-3 max-h-64 overflow-auto">
            {voices.map((voice) => (
              <button
                key={voice.voice_id}
                onClick={() => setSelectedVoice(voice.voice_id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedVoice === voice.voice_id
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {voice.category === 'cloned' && (
                    <span className="text-yellow-500">&#x2B50;</span>
                  )}
                  <span className="font-medium text-sm">{voice.name}</span>
                  {voice.category && (
                    <span className="text-xs text-gray-400">{voice.category}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {generating ? (
            <div className="w-full space-y-3">
              <Progress value={generatingProgress} className="h-2" />
              <p className="text-sm text-center text-gray-500">
                Generating audio... {generatingProgress}%
              </p>
            </div>
          ) : (
            <Button
              onClick={handleGenerateAll}
              size="lg"
              className="w-full bg-black text-white hover:bg-gray-800 text-lg py-6"
              disabled={!selectedVoice}
            >
              Generate All Audio
            </Button>
          )}
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

        <a
          href="https://elevenlabs.io/app/developers/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full p-4 rounded-xl border border-gray-200 flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Get ElevenLabs API Key
          <ExternalLink className="w-4 h-4" />
        </a>

        <div className="w-full relative">
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="pr-20"
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

        <Button
          onClick={handleConnect}
          size="lg"
          className="w-full bg-gray-400 text-white hover:bg-gray-600 text-lg py-6"
          disabled={!apiKey.trim() || loadingVoices}
        >
          {loadingVoices ? 'Connecting...' : 'Connect & Continue'}
        </Button>

        <button
          onClick={onSkip}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Skip audio for now &rarr;
        </button>
      </div>
    </div>
  );
}
