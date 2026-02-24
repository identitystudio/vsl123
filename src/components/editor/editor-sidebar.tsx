'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Loader2,
  Download,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ImagePlus,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface InfographicImage {
  asset_id: string;
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  created_at: string;
  display_name: string;
}

interface InfographicsPanelProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onApplyToSlide?: (imageUrl: string) => void;
  onApplyVideoToSlide?: (videoUrl: string) => void;
  savedImages?: InfographicImage[];
  savedPrompt?: string;
  savedVideos?: Record<string, { uri: string; data?: string }>;
}

export function InfographicsPanel({
  projectId,
  open,
  onClose,
  onApplyToSlide,
  onApplyVideoToSlide,
  savedImages,
  savedPrompt,
  savedVideos,
}: InfographicsPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<InfographicImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [showVideoPrompt, setShowVideoPrompt] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState<Record<string, boolean>>({});
  const [generatedVideos, setGeneratedVideos] = useState<Record<string, { uri: string; data?: string }>>({});
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [hasLoadedSaved, setHasLoadedSaved] = useState(false);

  // Load saved data on mount
  useEffect(() => {
    if (!hasLoadedSaved) {
      if (savedImages && savedImages.length > 0) {
        setImages(savedImages);
      }
      if (savedPrompt) {
        setPrompt(savedPrompt);
      }
      if (savedVideos && Object.keys(savedVideos).length > 0) {
        setGeneratedVideos(savedVideos);
      }
      setHasLoadedSaved(true);
    }
  }, [savedImages, savedPrompt, savedVideos, hasLoadedSaved]);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use n8n Webhook for generation
      const response = await fetch('https://themacularprogram.app.n8n.cloud/webhook/generate-infographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) throw new Error('Failed to generate infographics');

      const data = await response.json();
      const imageArray = Array.isArray(data) ? data : data.images || [];

      if (imageArray.length === 0) {
        setError('No images generated. Try a different prompt.');
        toast.error('No images generated');
        return;
      }

      setImages(imageArray);
      toast.success(`Generated ${imageArray.length} infographic(s)`);

      if (projectId) {
        await saveInfographics(prompt.trim(), imageArray);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate infographics';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const saveInfographics = async (promptText: string, imageArray: InfographicImage[], videos?: Record<string, { uri: string; data?: string }>) => {
    setSaving(true);
    try {
      const response = await fetch('/api/save-infographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt: promptText,
          images: imageArray,
          videos: videos || generatedVideos,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'Failed to save');
      }
      toast.success('Infographics saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (image: InfographicImage) => {
    try {
      const fileName = `${image.display_name}.${image.format}`;
      const downloadUrl = `/api/download-image?url=${encodeURIComponent(image.secure_url)}&filename=${encodeURIComponent(fileName)}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download started');
    } catch {
      toast.error('Failed to download image');
    }
  };

  const handleGenerateVideo = async (image: InfographicImage) => {
    setGeneratingVideos((prev) => ({ ...prev, [image.asset_id]: true }));
    try {
      const effectivePrompt = (videoPrompt || prompt || 'Create a video based on this image').trim();
      const response = await fetch('/api/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: image.secure_url, prompt: effectivePrompt }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate video');

      const newVideos = {
        ...generatedVideos,
        [image.asset_id]: { uri: data.videoUri, data: data.videoData },
      };
      setGeneratedVideos(newVideos);
      toast.success('Video generated!');

      // Save videos to DB so they persist on refresh
      if (projectId && images.length > 0) {
        await saveInfographics(prompt.trim() || 'infographic', images, newVideos);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate video';
      toast.error(message);
    } finally {
      setGeneratingVideos((prev) => ({ ...prev, [image.asset_id]: false }));
    }
  };

  const handleDownloadVideo = async (image: InfographicImage) => {
    const videoInfo = generatedVideos[image.asset_id];
    if (!videoInfo) return;

    try {
      const fileName = `${image.display_name}_video.mp4`;
      if (videoInfo.data) {
        const binaryString = atob(videoInfo.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const downloadUrl = `/api/download-image?url=${encodeURIComponent(videoInfo.uri)}&filename=${encodeURIComponent(fileName)}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast.success('Video download started');
    } catch {
      toast.error('Failed to download video');
    }
  };

  return (
    <div className="w-72 shrink-0 self-start sticky top-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-800">Infographics</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/80 transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto thin-scrollbar">
          {/* Prompt Section */}
          <div className="p-3 space-y-2.5">
            <div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the infographic you want to create..."
                className="min-h-[68px] resize-none text-xs border-gray-200 focus:border-purple-400 focus:ring-purple-400/20"
                disabled={loading}
              />
            </div>

            {/* Video Prompt toggle */}
            <button
              onClick={() => setShowVideoPrompt(!showVideoPrompt)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showVideoPrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Video prompt
            </button>
            {showVideoPrompt && (
              <Textarea
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="Animation, pacing, camera..."
                className="min-h-[50px] resize-none text-xs border-gray-200"
                disabled={loading}
              />
            )}

            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 h-8 text-xs font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Generate
                </>
              )}
            </Button>

            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-[11px] text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Results */}
          {images.length > 0 && (
            <div className="border-t border-gray-100">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Results ({images.length})
                </span>
                {saving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
              </div>

              <div className="px-3 pb-3 space-y-2.5">
                {images.map((image, index) => {
                  const isExpanded = expandedImage === image.asset_id;
                  const hasVideo = !!generatedVideos[image.asset_id];
                  const isGeneratingVideo = generatingVideos[image.asset_id];

                  return (
                    <div
                      key={image.asset_id}
                      className="rounded-lg border border-gray-200 overflow-hidden bg-white hover:shadow-sm transition-all"
                    >
                      {/* Image */}
                      <button
                        onClick={() => setExpandedImage(isExpanded ? null : image.asset_id)}
                        className="w-full relative cursor-pointer"
                      >
                        <img
                          src={image.secure_url}
                          alt={image.display_name}
                          className={`w-full object-cover transition-all ${isExpanded ? 'max-h-64' : 'max-h-28'}`}
                        />
                        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-bold px-1 py-0.5 rounded backdrop-blur-sm">
                          #{index + 1}
                        </div>
                      </button>

                      {/* Info & Actions */}
                      <div className="p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-gray-400">Dim: {image.width}×{image.height}</span>
                        </div>

                        {hasVideo && (
                          <>
                            <div className="rounded border border-gray-200 overflow-hidden">
                              <video
                                className="w-full"
                                controls
                                src={
                                  generatedVideos[image.asset_id].data
                                    ? `data:video/mp4;base64,${generatedVideos[image.asset_id].data}`
                                    : generatedVideos[image.asset_id].uri
                                }
                              />
                            </div>
                            <div className="flex gap-1">
                              <Button
                                onClick={() => {
                                  const videoInfo = generatedVideos[image.asset_id];
                                  if (videoInfo) {
                                    const videoSrc = videoInfo.data
                                      ? `data:video/mp4;base64,${videoInfo.data}`
                                      : videoInfo.uri;
                                    onApplyVideoToSlide?.(videoSrc);
                                  }
                                }}
                                size="sm"
                                className="w-full h-6 text-[10px] gap-0.5 px-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                <Film className="w-2.5 h-2.5" />
                                Use Video on Slide
                              </Button>
                            </div>
                          </>
                        )}

                        <div className="flex gap-1">
                          <Button
                            onClick={() => onApplyToSlide?.(image.secure_url)}
                            size="sm"
                            className="w-full h-6 text-[10px] gap-0.5 px-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <ImagePlus className="w-2.5 h-2.5" />
                            Use on Slide
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            onClick={() => handleDownload(image)}
                            variant="outline"
                            size="sm"
                            className="flex-1 h-6 text-[10px] gap-0.5 px-1.5"
                          >
                            <Download className="w-2.5 h-2.5" />
                            Image
                          </Button>
                          {hasVideo ? (
                            <Button
                              onClick={() => handleDownloadVideo(image)}
                              size="sm"
                              className="flex-1 h-6 text-[10px] gap-0.5 px-1.5 bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Download className="w-2.5 h-2.5" />
                              Video
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleGenerateVideo(image)}
                              disabled={isGeneratingVideo}
                              size="sm"
                              className="flex-1 h-6 text-[10px] gap-0.5 px-1.5 bg-purple-600 text-white hover:bg-purple-700"
                            >
                              {isGeneratingVideo ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <Play className="w-2.5 h-2.5" />
                              )}
                              Video
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && images.length === 0 && !error && (
            <div className="px-3 pb-3">
              <div className="text-center py-6 rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
                <ImageIcon className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                <p className="text-[11px] text-gray-400 leading-relaxed px-4">
                  Enter a prompt above to generate infographics with AI
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && images.length === 0 && (
            <div className="px-3 pb-3">
              <div className="text-center py-6 rounded-lg border border-dashed border-purple-200 bg-purple-50/30">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin mx-auto mb-2" />
                <p className="text-[11px] text-purple-500 font-medium">Generating...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
