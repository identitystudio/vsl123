'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Eye,
  Check,
  Loader2,
  Key,
  ImageIcon,
  Pencil,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface AiImageDialogProps {
  open: boolean;
  onClose: () => void;
  slideText: string;
  imageKeyword?: string;
  sceneTitle?: string;
  emotion?: string;
  onImageGenerated: (imageUrl: string) => void;
}

type Step = 'generating-prompt' | 'review-prompt' | 'choose-provider' | 'generating-image' | 'done';
type Provider = 'openai' | 'gemini';

const OPENAI_KEY_STORAGE = 'vsl-vibes-openai-key';
const GEMINI_KEY_STORAGE = 'vsl-vibes-gemini-key';

export function AiImageDialog({
  open,
  onClose,
  slideText,
  imageKeyword,
  sceneTitle,
  emotion,
  onImageGenerated,
}: AiImageDialogProps) {
  const [step, setStep] = useState<Step>('generating-prompt');
  const [prompt, setPrompt] = useState('');
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');

  // Load saved API key when provider is selected
  useEffect(() => {
    if (selectedProvider) {
      const storageKey = selectedProvider === 'openai' ? OPENAI_KEY_STORAGE : GEMINI_KEY_STORAGE;
      const saved = localStorage.getItem(storageKey) || '';
      setApiKeyInput(saved);
      setShowApiKeyInput(!saved);
    }
  }, [selectedProvider]);

  // Generate prompt when dialog opens
  useEffect(() => {
    if (open) {
      setStep('generating-prompt');
      setPrompt('');
      setEditingPrompt(false);
      setSelectedProvider(null);
      setShowApiKeyInput(false);
      setGeneratingImage(false);
      setGeneratedImageUrl('');
      generatePrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generatePrompt = async () => {
    try {
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideText,
          imageKeyword: imageKeyword || '',
          sceneTitle: sceneTitle || '',
          emotion: emotion || '',
        }),
      });

      const data = await response.json();

      if (data.error) {
        // Fallback prompt
        const fallback = `Ultra realistic, professional photograph. ${slideText}. ${imageKeyword ? `Subject: ${imageKeyword}.` : ''} High quality, 4K resolution, cinematic lighting.`;
        setPrompt(fallback);
      } else {
        setPrompt(data.prompt);
      }
      setStep('review-prompt');
    } catch {
      // Fallback prompt on error
      const fallback = `Ultra realistic, professional photograph. ${slideText}. ${imageKeyword ? `Subject: ${imageKeyword}.` : ''} High quality, 4K resolution, cinematic lighting.`;
      setPrompt(fallback);
      setStep('review-prompt');
    }
  };

  const handleApprovePrompt = () => {
    setStep('choose-provider');
  };

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    const storageKey = provider === 'openai' ? OPENAI_KEY_STORAGE : GEMINI_KEY_STORAGE;
    const savedKey = localStorage.getItem(storageKey);
    if (savedKey) {
      setApiKeyInput(savedKey);
      setShowApiKeyInput(false);
    } else {
      setApiKeyInput('');
      setShowApiKeyInput(true);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim() || !selectedProvider) return;
    const storageKey = selectedProvider === 'openai' ? OPENAI_KEY_STORAGE : GEMINI_KEY_STORAGE;
    localStorage.setItem(storageKey, apiKeyInput.trim());
    setShowApiKeyInput(false);
    toast.success(`${selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key saved`);
  };

  const handleGenerateImage = async () => {
    if (!selectedProvider) return;

    const storageKey = selectedProvider === 'openai' ? OPENAI_KEY_STORAGE : GEMINI_KEY_STORAGE;
    const key = localStorage.getItem(storageKey);

    if (!key) {
      setShowApiKeyInput(true);
      toast.error('Please enter your API key first');
      return;
    }

    setGeneratingImage(true);
    setStep('generating-image');

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          provider: selectedProvider,
          apiKey: key,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedImageUrl(data.imageUrl);
      setStep('done');
      toast.success('Image generated successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate image';
      toast.error(msg);
      setStep('choose-provider');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleUseImage = () => {
    onImageGenerated(generatedImageUrl);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Generate AI Image
          </DialogTitle>
          <DialogDescription>
            Create a custom image for this slide using AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Step 1: Generating prompt */}
          {step === 'generating-prompt' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Generating image prompt...</p>
            </div>
          )}

          {/* Step 2: Review prompt */}
          {step === 'review-prompt' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    Recommended Prompt
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(prompt);
                        toast.success('Prompt copied to clipboard!');
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => setEditingPrompt(!editingPrompt)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {editingPrompt ? 'Done Editing' : 'Edit'}
                    </Button>
                  </div>
                </div>

                {editingPrompt ? (
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[120px] text-sm"
                    placeholder="Describe the image you want..."
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed border">
                    {prompt}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleApprovePrompt}
                  className="bg-black text-white hover:bg-gray-800 gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Approve Prompt
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Choose provider */}
          {step === 'choose-provider' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Choose an AI provider to generate your image:
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* OpenAI */}
                <button
                  onClick={() => handleSelectProvider('openai')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedProvider === 'openai'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">OpenAI</div>
                  <div className="text-xs text-gray-500">DALL-E 3 &bull; HD Quality</div>
                  <div className="text-xs text-gray-400 mt-1">Uses your ChatGPT API key</div>
                </button>

                {/* Gemini */}
                <button
                  onClick={() => handleSelectProvider('gemini')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedProvider === 'gemini'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">Gemini</div>
                  <div className="text-xs text-gray-500">Imagen 3 &bull; Ultra Realistic</div>
                  <div className="text-xs text-gray-400 mt-1">Uses your Google AI API key</div>
                </button>
              </div>

              {/* API Key Input */}
              {selectedProvider && showApiKeyInput && (
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Key className="w-4 h-4" />
                    Enter your {selectedProvider === 'openai' ? 'OpenAI' : 'Google AI'} API Key
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={
                        selectedProvider === 'openai'
                          ? 'sk-...'
                          : 'AIza...'
                      }
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveApiKey}
                      disabled={!apiKeyInput.trim()}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Your key is stored locally in your browser and never sent to our servers.
                  </p>
                  <a
                    href={
                      selectedProvider === 'openai'
                        ? 'https://platform.openai.com/api-keys'
                        : 'https://aistudio.google.com/apikey'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    {selectedProvider === 'openai'
                      ? "Don't have a key? Get your OpenAI API key here →"
                      : "Don't have a key? Get your Google AI API key here →"}
                  </a>
                </div>
              )}

              {/* Saved key indicator */}
              {selectedProvider && !showApiKeyInput && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-1.5 text-sm text-green-700">
                    <Check className="w-4 h-4" />
                    {selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key saved
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowApiKeyInput(true)}
                  >
                    Change Key
                  </Button>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep('review-prompt')}>
                  Back
                </Button>
                <Button
                  onClick={handleGenerateImage}
                  disabled={!selectedProvider || showApiKeyInput}
                  className="bg-black text-white hover:bg-gray-800 gap-1.5"
                >
                  <ImageIcon className="w-4 h-4" />
                  Generate Image
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Generating image */}
          {step === 'generating-image' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">
                Generating image with {selectedProvider === 'openai' ? 'DALL-E 3' : 'Imagen 3'}...
              </p>
              <p className="text-xs text-gray-400">This may take 10-30 seconds</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && generatedImageUrl && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedImageUrl}
                  alt="Generated AI image"
                  className="w-full h-auto"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep('choose-provider')}>
                  Regenerate
                </Button>
                <Button
                  onClick={handleUseImage}
                  className="bg-black text-white hover:bg-gray-800 gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Use This Image
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
