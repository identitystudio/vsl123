'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { SvgUnderline } from './svg-underline';
import { SvgCircle } from './svg-circle';
import type { Slide, UnderlineStyle, CircleStyle } from '@/types';

// Component for cycling infographic captions
function InfographicCaptions({
  captions,
  scale,
  textColor,
}: {
  captions: string[];
  scale: number;
  textColor: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (captions.length <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % captions.length);
        setIsAnimating(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [captions.length]);

  const currentCaption = captions[currentIndex] || '';

  return (
    <div className="relative w-full px-4">
      <p
        className={`text-center font-semibold transition-all duration-300 ${
          isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
        style={{
          fontSize: `${24 * scale}px`,
          color: textColor,
          lineHeight: 1.3,
        }}
      >
        {currentCaption}
      </p>
      {/* Caption indicator dots */}
      {captions.length > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          {captions.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex ? 'bg-white/80' : 'bg-white/30'
              }`}
              style={{
                width: `${6 * scale}px`,
                height: `${6 * scale}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SlidePreviewProps {
  slide: Slide;
  scale?: number;
  onHeadshotClick?: () => void;
  onSplitImageDrag?: (newPositionY: number) => void;
  onImageDoubleClick?: () => void;
  onWordClick?: (word: string) => void;
}

function WordSpan({
  word,
  isBold,
  isUnderlined,
  isCircled,
  isRed,
  underlineStyle,
  circleStyle,
  textColor,
  onClick,
}: {
  word: string;
  isBold: boolean;
  isUnderlined: boolean;
  isCircled: boolean;
  isRed: boolean;
  underlineStyle?: UnderlineStyle;
  circleStyle?: CircleStyle;
  textColor: string;
  onClick?: (word: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (ref.current) {
      setDims({
        width: ref.current.offsetWidth,
        height: ref.current.offsetHeight,
      });
    }
  }, [word]);

  return (
    <span
      ref={ref}
      onClick={() => onClick?.(word)}
      className={`relative inline-block ${onClick ? 'cursor-pointer hover:bg-black/5 rounded' : ''}`}
      style={{
        fontWeight: isBold ? 900 : undefined,
        color: isRed ? '#dc2626' : textColor,
        fontStyle: isBold ? 'italic' : undefined,
      }}
    >
      {word}
      {isUnderlined && dims.width > 0 && (
        <SvgUnderline
          width={dims.width}
          style={underlineStyle || 'brush-red'}
        />
      )}
      {isCircled && dims.width > 0 && (
        <SvgCircle
          width={dims.width}
          height={dims.height}
          style={circleStyle || 'red-solid'}
        />
      )}
    </span>
  );
}

function getHeadshotStyle(position: string | undefined, scale: number): React.CSSProperties {
  if (!position || position === 'inline') {
    return { position: 'relative' };
  }
  
  const baseStyle: React.CSSProperties = { position: 'absolute' };
  const margin = 24 * scale;

  switch (position) {
    case 'top-left':
      return { ...baseStyle, top: margin, left: margin };
    case 'top-right':
      return { ...baseStyle, top: margin, right: margin };
    case 'bottom-left':
      return { ...baseStyle, bottom: margin, left: margin };
    case 'bottom-right':
      return { ...baseStyle, bottom: margin, right: margin };
    default:
      return { position: 'relative' };
  }
}

export function SlidePreview({ slide, scale = 1, onHeadshotClick, onSplitImageDrag, onImageDoubleClick, onWordClick }: SlidePreviewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartPos = useRef(50);

  const handleSplitDragStart = (e: React.MouseEvent) => {
    if (!onSplitImageDrag) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartPos.current = slide.backgroundImage?.imagePositionY ?? 50;

    const handleMove = (ev: MouseEvent) => {
      const delta = ev.clientY - dragStartY.current;
      const sensitivity = 0.3 / scale; // adjust for preview scale
      const newPos = Math.max(0, Math.min(100, dragStartPos.current + delta * sensitivity));
      onSplitImageDrag(Math.round(newPos));
    };

    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };
  const bgColor =
    slide.style.background === 'dark'
      ? '#1a1a1a'
      : slide.style.background === 'gradient'
        ? undefined
        : slide.style.background === 'video'
          ? 'transparent'
          : '#ffffff';

  const textColor =
    slide.style.textColor === 'white'
      ? '#ffffff'
      : slide.style.textColor === 'black'
        ? '#1a1a1a'
        : '#1a1a1a';

  const words = slide.fullScriptText.split(/\s+/);

  const hasImageUrl = !!slide.backgroundImage?.url;
  const displayMode = slide.backgroundImage?.displayMode || 'blurred';
  const isSplit = slide.style.background === 'split' || displayMode === 'split';
  const isImageBg = slide.style.background === 'image' && hasImageUrl;

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        width: `${640 * scale}px`,
        height: `${360 * scale}px`,
        backgroundColor: bgColor,
        background:
          slide.style.background === 'gradient' && slide.style.gradient
            ? slide.style.gradient
            : bgColor,
      }}
    >
      {/* Background image — blurred mode */}
      {/* Slider = crispness: 0 = max blur, 100 = fully crisp */}
      {/* Always has an overlay: dark for white text, light for black text */}
      {isImageBg && displayMode === 'blurred' && (() => {
        const crispness = slide.backgroundImage!.opacity ?? 40;
        const blurPx = ((100 - crispness) / 100) * 12; // 0% → 12px blur, 100% → 0px
        const overlayColor = slide.style.textColor === 'black'
          ? `rgba(255,255,255,${0.45 + (crispness / 100) * 0.15})` // white overlay for black text
          : `rgba(0,0,0,${0.35 + (crispness / 100) * 0.15})`; // dark overlay for white text
        return (
          <>
            <div
              className={`absolute inset-0 bg-cover bg-center ${onImageDoubleClick ? 'cursor-pointer' : ''}`}
              style={{
                backgroundImage: `url(${slide.backgroundImage!.url})`,
                filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
              }}
              onDoubleClick={onImageDoubleClick}
            />
            {/* Readability overlay — adapts to text color */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: overlayColor }}
            />
          </>
        );
      })()}

      {/* Background image — crisp mode (clear, no blur) */}
      {isImageBg && displayMode === 'crisp' && (() => {
        const overlayColor = slide.style.textColor === 'black'
          ? 'rgba(255,255,255,0.45)'
          : 'rgba(0,0,0,0.35)';
        return (
          <>
            <div
              className={`absolute inset-0 bg-cover bg-center ${onImageDoubleClick ? 'cursor-pointer' : ''}`}
              style={{
                backgroundImage: `url(${slide.backgroundImage!.url})`,
                opacity: (slide.backgroundImage!.opacity || 60) / 100,
              }}
              onDoubleClick={onImageDoubleClick}
            />
            {/* Readability overlay — adapts to text color */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: overlayColor }}
            />
          </>
        );
      })()}

      {/* Split layout — image top, text bottom */}
      {isSplit && hasImageUrl && (
        <div
          className={`absolute top-0 left-0 right-0 bg-cover ${onSplitImageDrag ? 'cursor-ns-resize' : ''}`}
          style={{
            height: `${slide.style.splitRatio || 50}%`,
            backgroundImage: `url(${slide.backgroundImage!.url})`,
            backgroundPosition: `center ${slide.backgroundImage!.imagePositionY ?? 50}%`,
          }}
          onMouseDown={onSplitImageDrag ? handleSplitDragStart : undefined}
          onDoubleClick={onImageDoubleClick}
        >
          {/* Drag hint */}
          {onSplitImageDrag && !isDragging && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10">
              <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                Drag to reposition
              </span>
            </div>
          )}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                Repositioning...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Background video */}
      {slide.backgroundVideoUrl && (
        <>
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={slide.backgroundVideoUrl}
            autoPlay
            loop
            muted
            playsInline
          />
          {/* Readability overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor:
                slide.style.textColor === 'black'
                  ? 'rgba(255,255,255,0.4)'
                  : 'rgba(0,0,0,0.35)',
            }}
          />
        </>
      )}

      {/* Infographic icon */}
      {slide.style.icon && (
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 text-4xl"
          style={{ fontSize: 36 * scale }}
        >
          {slide.style.icon}
        </div>
      )}

      {/* Text content (with optional headshot above) */}
      <div
        className="relative z-10 flex flex-col items-center justify-center px-8"
        style={
          isSplit && hasImageUrl
            ? {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                top: `${slide.style.splitRatio || 50}%`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }
            : { height: '100%' }
        }
      >
        {/* Infographic mode — visual + cycling captions */}
        {slide.isInfographic ? (
          <div className="flex flex-col items-center justify-center w-full h-full gap-4">
            {/* Infographic Visual (emoji/icon/SVG) */}
            {slide.infographicVisual && (
              <div className="flex items-center justify-center">
                {slide.infographicVisual.type === 'svg' ? (
                  <div
                    style={{
                      width: `${120 * scale}px`,
                      height: `${120 * scale}px`,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: slide.infographicVisual.value.replace(
                        /<svg/,
                        `<svg width="100%" height="100%" style="stroke: ${textColor}; fill: none; stroke-width: 2;"`
                      ),
                    }}
                  />
                ) : (
                  <span style={{ fontSize: `${80 * scale}px`, lineHeight: 1 }}>
                    {slide.infographicVisual.value}
                  </span>
                )}
              </div>
            )}
            {/* Captions removed per user request */}
          </div>
        ) : (
          <>
            {/* Headshot */}
            {slide.headshot && (
              <div 
                style={{ 
                  ...getHeadshotStyle(slide.headshot.position, scale),
                  zIndex: 20,
                  marginBottom: !slide.headshot.position || slide.headshot.position === 'inline' ? `${8 * scale}px` : 0 
                }}
              >
                {slide.headshot.videoUrl ? (
                  <video
                    src={slide.headshot.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className={`rounded-full object-cover border-2 border-gray-200 ${onHeadshotClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    style={{ width: 160 * scale, height: 160 * scale }}
                    onClick={onHeadshotClick}
                  />
                ) : slide.headshot.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.headshot.imageUrl}
                    alt=""
                    className={`rounded-full object-cover border-2 border-gray-200 ${onHeadshotClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    style={{ width: 160 * scale, height: 160 * scale }}
                    onClick={onHeadshotClick}
                  />
                ) : (
                  <div
                    className={`rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 ${onHeadshotClick ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                    style={{ width: 160 * scale, height: 160 * scale }}
                    onClick={onHeadshotClick}
                  >
                    <Upload className="text-gray-400" style={{ width: 24 * scale, height: 24 * scale }} />
                    <span className="text-gray-400 font-medium" style={{ fontSize: `${10 * scale}px`, marginTop: `${4 * scale}px` }}>Upload</span>
                  </div>
                )}
              </div>
            )}

            {/* Talking Head Video as Floating Headshot */}
            {slide.talkingHeadAsHeadshot && slide.talkingHeadVideoUrl && (
              <div 
                style={{ 
                  ...getHeadshotStyle(slide.talkingHeadPosition, scale),
                  zIndex: 25,
                  marginBottom: !slide.talkingHeadPosition || slide.talkingHeadPosition === 'inline' ? `${8 * scale}px` : 0 
                }}
              >
                <video
                  src={slide.talkingHeadVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="rounded-full object-cover border-2 border-indigo-400 shadow-lg"
                  style={{ width: (slide.talkingHeadSize || 160) * scale, height: (slide.talkingHeadSize || 160) * scale }}
                />
              </div>
            )}

            <p
              className="text-center leading-tight font-semibold"
              style={{
                fontSize: `${(slide.style.textSize || 72) * scale * 0.35}px`,
                color: textColor,
                fontWeight: slide.style.textWeight === 'extrabold' ? 800 : 700,
                lineHeight: 1.15,
                textShadow:
                  isImageBg && displayMode === 'crisp'
                    ? '0 2px 8px rgba(0,0,0,0.5)'
                    : undefined,
              }}
            >
              {words.map((word, i) => {
                const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
                const isBold = slide.boldWords?.includes(cleanWord) || false;
                const isUnderlined =
                  slide.underlineWords?.includes(cleanWord) || false;
                const isCircled = slide.circleWords?.includes(cleanWord) || false;
                const isRed = slide.redWords?.includes(cleanWord) || false;

                return (
                  <span key={i}>
                    <WordSpan
                      word={word}
                      isBold={isBold}
                      isUnderlined={isUnderlined}
                      isCircled={isCircled}
                      isRed={isRed}
                      underlineStyle={slide.underlineStyles?.[cleanWord]}
                      circleStyle={slide.circleStyles?.[cleanWord]}
                      textColor={textColor}
                      onClick={onWordClick}
                    />
                    {i < words.length - 1 ? ' ' : ''}
                  </span>
                );
              })}
            </p>
          </>
        )}
      </div>

      {/* Talking Head Avatar indicator */}
      {slide.talkingHeadVideoUrl && (
        <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg"
          style={{ fontSize: `${10 * scale}px` }}
        >
          <span style={{ fontSize: `${12 * scale}px` }}>🗣️</span>
          <span className="text-white font-bold uppercase tracking-wider" style={{ fontSize: `${8 * scale}px` }}>
            Avatar Video
          </span>
        </div>
      )}

      {/* Talking Head Avatar image indicator (uploaded but not yet generated) */}
      {slide.talkingHeadImage && !slide.talkingHeadVideoUrl && (
        <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/70 shadow-lg"
          style={{ fontSize: `${10 * scale}px` }}
        >
          <span style={{ fontSize: `${12 * scale}px` }}>🗣️</span>
          <span className="text-white font-bold uppercase tracking-wider opacity-80" style={{ fontSize: `${8 * scale}px` }}>
            Pending
          </span>
        </div>
      )}
    </div>
  );
}
