import domtoimage from 'dom-to-image-more';
import JSZip from 'jszip';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SlidePreview } from '@/components/editor/slide-preview';
import type { Slide } from '@/types';
import { toast } from 'sonner';

export async function exportSlidesToZipHtml2Canvas(
  slides: Slide[],
  projectName: string,
  onProgress: (progress: number) => void
) {
  const zip = new JSZip();
  const folderName = projectName.replace(/\s+/g, '_');

  try {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const paddedNum = String(i + 1).padStart(3, '0');

      // Create a temporary container for rendering
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '1920px';
      container.style.height = '1080px';
      // Important for dom-to-image to work correctly in hidden containers
      container.style.overflow = 'hidden'; 
      document.body.appendChild(container);

      const root = ReactDOM.createRoot(container);
      
      // Render slide at 3x scale (1920x1080)
      await new Promise<void>((resolve) => {
        root.render(
          React.createElement(SlidePreview, { 
            slide, 
            scale: 3 
          })
        );
        // Give it some time to render images/SVGs
        setTimeout(resolve, 2000);
      });

      // Use dom-to-image-more which supports modern CSS (lab, oklch, etc.)
      const blob = await domtoimage.toBlob(container, {
        width: 1920,
        height: 1080,
        copyStyles: true,
      });

      if (blob) {
        zip.file(`${folderName}_${paddedNum}.png`, blob);
      }

      // Add audio if available
      if (slide.audioUrl) {
        try {
          const audioResponse = await fetch(slide.audioUrl);
          const audioBlob = await audioResponse.blob();
          zip.file(`audio/${folderName}_${paddedNum}.mp3`, audioBlob);
        } catch (audioErr) {
          console.error(`Failed to fetch audio for slide ${i + 1}:`, audioErr);
        }
      }

      // Cleanup
      root.unmount();
      document.body.removeChild(container);

      // Update progress
      onProgress(Math.round(((i + 1) / slides.length) * 100));
    }

    // Generate ZIP
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    // Download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folderName}_ZIP.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('ZIP Export complete!');
  } catch (error) {
    console.error('ZIP export error:', error);
    toast.error('Export failed. Check console for details.');
    throw error;
  }
}
