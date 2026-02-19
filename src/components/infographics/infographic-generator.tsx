'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Download, Play } from 'lucide-react';
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

interface GeneratedVideo {
  imageId: string;
  videoUri: string;
  generatingAt: number;
}

interface InfographicGeneratorProps {
  projectId?: string;
  initialPrompt?: string;
  initialImages?: InfographicImage[];
}

export function InfographicGenerator({
  projectId,
  initialPrompt = '',
  initialImages = [],
}: InfographicGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<InfographicImage[]>(initialImages);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState<Record<string, boolean>>({});
  const [generatedVideos, setGeneratedVideos] = useState<Record<string, { uri: string; data?: string }>>({});

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-infographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate infographics');
      }

      const data = await response.json();

      // Handle both array and object responses
      const imageArray = Array.isArray(data) ? data : data.images || [];

      if (imageArray.length === 0) {
        setError('No images generated. Please try a different prompt.');
        toast.error('No images generated');
        return;
      }

      setImages(imageArray);
      toast.success(`Generated ${imageArray.length} infographic(s)`);

      // Auto-save if projectId is provided
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

  const saveInfographics = async (promptText: string, imageArray: InfographicImage[]) => {
    if (!projectId) {
      console.warn('No projectId provided, skipping save');
      return;
    }

    setSaving(true);
    try {
      console.log('Saving infographics:', { projectId, promptText, imageCount: imageArray.length });
      
      const response = await fetch('/api/save-infographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt: promptText,
          images: imageArray,
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        const errorMsg = responseData?.error || 'Failed to save infographics';
        throw new Error(errorMsg);
      }

      console.log('Save successful:', responseData);
      toast.success('Infographics saved to project');
      return responseData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save infographics';
      console.error('Save error:', message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProject = async () => {
    if (!projectId || images.length === 0) {
      toast.error('Nothing to save');
      return;
    }
    await saveInfographics(prompt, images);
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
    } catch (err) {
      toast.error('Failed to download image');
    }
  };

  const handleGenerateVideo = async (image: InfographicImage) => {
    setGeneratingVideos((prev) => ({ ...prev, [image.asset_id]: true }));
    try {
      console.log('Starting video generation for:', image.display_name);
      
      const response = await fetch('/api/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image.secure_url,
          prompt: prompt || 'Create a video based on this image',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate video');
      }

      setGeneratedVideos((prev) => ({
        ...prev,
        [image.asset_id]: {
          uri: data.videoUri,
          data: data.videoData,
        },
      }));
      toast.success('Video generated! Ready to download');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate video';
      console.error('Video generation error:', message);
      toast.error(message);
    } finally {
      setGeneratingVideos((prev) => ({ ...prev, [image.asset_id]: false }));
    }
  };

  const handleDownloadVideo = async (image: InfographicImage) => {
    const videoInfo = generatedVideos[image.asset_id];
    if (!videoInfo) {
      toast.error('No video available');
      return;
    }

    try {
      const fileName = `${image.display_name}_video.mp4`;
      
      // If we have video data, download directly from base64
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
        // Fall back to download-image proxy
        const downloadUrl = `/api/download-image?url=${encodeURIComponent(videoInfo.uri)}&filename=${encodeURIComponent(fileName)}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast.success('Video download started');
    } catch (err) {
      toast.error('Failed to download video');
    }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Panel */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 h-fit lg:sticky lg:top-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Infographic Generator
            </h2>
            <p className="text-sm text-gray-500">
              Enter a detailed prompt to generate custom infographics powered by AI
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the infographic you want to create. Be specific about data, style, and layout..."
                className="min-h-32 resize-none"
                disabled={loading}
              />
              <p className="text-xs text-gray-400 mt-1">
                Tip: Include specific data, numbers, topics, and visual style preferences for best results
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full bg-black text-white hover:bg-gray-800 h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Infographics
                </>
              )}
            </Button>

            {images.length > 0 && projectId && (
              <Button
                onClick={handleSaveProject}
                disabled={saving || loading}
                variant="outline"
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save to Project'
                )}
              </Button>
            )}
          </div>

          {/* Error state */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Right: Results Panel */}
        <div className="min-h-screen lg:min-h-fit">
          {images.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Generated Infographics ({images.length})
              </h3>
              <div className="grid grid-cols-1 gap-6">
                {images.map((image, index) => (
                  <div
                    key={image.asset_id}
                    className="group rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow bg-gray-50"
                  >
                    <div className="relative bg-gray-100 flex items-center justify-center overflow-hidden max-h-96">
                      <img
                        src={image.secure_url}
                        alt={image.display_name}
                        className="w-full h-auto object-contain group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="p-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {image.display_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {image.width} × {image.height}px
                          </p>
                        </div>
                        <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Button
                          onClick={() => handleDownload(image)}
                          variant="outline"
                          className="w-full text-sm"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download Image
                        </Button>
                        
                        {generatedVideos[image.asset_id] ? (
                          <Button
                            onClick={() => handleDownloadVideo(image)}
                            className="w-full bg-blue-600 text-white hover:bg-blue-700 text-sm"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Download Video
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleGenerateVideo(image)}
                            disabled={generatingVideos[image.asset_id]}
                            className="w-full bg-purple-600 text-white hover:bg-purple-700 text-sm"
                          >
                            {generatingVideos[image.asset_id] ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                Generating Video...
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 mr-1" />
                                Generate Video
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && images.length === 0 && !error && (
            <div className="text-center py-12 px-6 rounded-xl border border-dashed border-gray-300 bg-gray-50">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gray-100 mb-4">
                <Sparkles className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">
                Enter a prompt on the left and click "Generate Infographics" to create custom visualizations
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center py-12 px-6 rounded-xl border border-dashed border-gray-300 bg-gray-50">
              <div className="inline-flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
              <p className="text-gray-500 text-sm mt-4">Generating your infographics...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
