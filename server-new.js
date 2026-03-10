const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '900mb' }));
app.use(cors());

const PORT = 3001;
const jobs = new Map();

app.use('/outputs', express.static(path.join(__dirname, 'outputs')));
fs.ensureDirSync(path.join(__dirname, 'outputs'));
fs.ensureDirSync(path.join(__dirname, 'temp'));

// -------------------------
// UTILITIES
// -------------------------

const runCmd = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve(stdout);
    });
});

const getAudioDuration = async (file) => {
    const out = await runCmd(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`
    );
    return parseFloat(out.trim());
};

const getVideoDuration = async (file) => {
    const out = await runCmd(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`
    );
    return parseFloat(out.trim());
};

// -------------------------
// DOWNLOAD BACKGROUND VIDEO FROM CLOUDINARY
// -------------------------

const downloadBackgroundVideo = async (urlOrPath, destPath) => {
    if (!urlOrPath) return null;
    
    try {
        if (urlOrPath.startsWith('http')) {
            // Download from Cloudinary URL
            await runCmd(`curl -s -L -o "${destPath}" "${urlOrPath}"`);
        } else if (urlOrPath.startsWith('data:')) {
            // Handle data URL if needed
            const base64 = urlOrPath.split(',')[1];
            await fs.writeFile(destPath, base64, 'base64');
        } else {
            // Copy local file
            await fs.copy(urlOrPath, destPath);
        }
        return destPath;
    } catch (error) {
        console.error(`Failed to download background video: ${error.message}`);
        return null;
    }
};

// -------------------------
// RENDER SLIDES + AUDIO + VIDEO BACKGROUND
// -------------------------

async function renderSlides(slides, framesDir, audioDir, videoDir, updateJob) {
    const AUDIO_CONCURRENCY = 12;
    const VIDEO_CONCURRENCY = 3;
    const TAB_CONCURRENCY = 4;

    updateJob({ status: 'downloading_assets', progress: 5 });

    // DOWNLOAD AUDIO & BACKGROUND VIDEOS IN PARALLEL
    for (let i = 0; i < slides.length; i += Math.max(AUDIO_CONCURRENCY, VIDEO_CONCURRENCY)) {
        const batch = slides.slice(i, i + Math.max(AUDIO_CONCURRENCY, VIDEO_CONCURRENCY));
        
        await Promise.all(batch.map(async (slide, idx) => {
            const id = i + idx;
            const idStr = String(id).padStart(3, '0');

            // Download audio
            if (slide.audioUrl) {
                const dest = path.join(audioDir, `audio_${idStr}.mp3`);
                try {
                    if (slide.audioUrl.startsWith('data:')) {
                        await fs.writeFile(dest, slide.audioUrl.split(',')[1], 'base64');
                    } else {
                        await runCmd(`curl -s -L -o "${dest}" "${slide.audioUrl}"`);
                    }
                } catch (e) {
                    console.error(`Audio ${idStr} failed:`, e.message);
                }
            }

            // Download background video from Cloudinary
            if (slide.backgroundVideoUrl) {
                const dest = path.join(videoDir, `bg_video_${idStr}.mp4`);
                try {
                    const result = await downloadBackgroundVideo(slide.backgroundVideoUrl, dest);
                    if (result) {
                        console.log(`? Downloaded background video for slide ${idStr}`);
                    }
                } catch (e) {
                    console.error(`Background video ${idStr} failed:`, e.message);
                }
            }

            // Download talking head video
            if (slide.talkingHeadVideoUrl) {
                const dest = path.join(videoDir, `th_video_${idStr}.mp4`);
                try {
                    const result = await downloadBackgroundVideo(slide.talkingHeadVideoUrl, dest);
                    if (result) {
                        console.log(`? Downloaded talking head video for slide ${idStr}`);
                    }
                } catch (e) {
                    console.error(`Talking head video ${idStr} failed:`, e.message);
                }
            }
        }));
    }

    updateJob({ status: 'rendering_slides', progress: 15 });

    const BROWSER_BATCH = 20;

    for (let i = 0; i < slides.length; i += BROWSER_BATCH) {
        const chunk = slides.slice(i, i + BROWSER_BATCH);

        const browser = await puppeteer.launch({
            protocolTimeout: 300000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--window-size=1920,1080'
            ]
        });

        try {
            for (let j = 0; j < chunk.length; j += TAB_CONCURRENCY) {
                const tabs = chunk.slice(j, j + TAB_CONCURRENCY);

                await Promise.all(tabs.map(async (slide, tIdx) => {
                    const globalIdx = i + j + tIdx;
                    const id = String(globalIdx).padStart(3, '0');
                    const filePath = path.join(framesDir, `slide_${id}.png`);
                    // Check BOTH field names for video background
                    const hasVideoBackground = (slide.backgroundVideoUrl && slide.backgroundVideoUrl.trim()) || (slide.backgroundVideo && slide.backgroundVideo.trim());

                    for (let attempt = 1; attempt <= 3; attempt++) {
                        const page = await browser.newPage();
                        try {
                            await page.setViewport({ width: 1920, height: 1080 });

                            // When slide has video background, force ALL elements to be transparent except text
                            const transparentBgCSS = hasVideoBackground ? `
                                *, *::before, *::after { background: transparent !important; background-color: transparent !important; background-image: none !important; }
                                html, body, div, section, article, main, header, footer, aside, nav { background: transparent !important; background-color: transparent !important; }
                                [class*="bg-"] { background: transparent !important; background-color: transparent !important; }
                                [style] { background: transparent !important; background-color: transparent !important; background-image: none !important; }
                            ` : '';
                            
                            console.log(`[${id}] Rendering slide with hasVideoBackground=${hasVideoBackground}`);
                            
                            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;padding:0;overflow:hidden;background:transparent;}${transparentBgCSS}</style></head><body>${slide.htmlContent}</body></html>`;

                            try {
                                // networkidle2 allows up to 2 background connections (like CDNs) to remain open
                                await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });
                            } catch (timeoutErr) {
                                // If it still times out, don't crash the server. Just warn and proceed.
                                console.warn(`[${id}] Page load timeout, proceeding to screenshot anyway...`);
                            }
                            await new Promise(r => setTimeout(r, 800)); // Give Tailwind extra time to compile and apply
                            
                            // For video background slides, use JavaScript to forcefully remove ALL backgrounds
                            if (hasVideoBackground) {
                                await page.evaluate(() => {
                                    const allElements = document.querySelectorAll('*');
                                    allElements.forEach(el => {
                                        if (el instanceof HTMLElement) {
                                            el.style.setProperty('background', 'transparent', 'important');
                                            el.style.setProperty('background-color', 'transparent', 'important');
                                            el.style.setProperty('background-image', 'none', 'important');
                                        }
                                    });
                                });
                                console.log(`[${id}] Forcefully removed all backgrounds via JS`);
                            }

                            // Screenshot with transparent background for proper overlay
                            await page.screenshot({ path: filePath, timeout: 30000, omitBackground: true });

                            if (await fs.pathExists(filePath)) {
                                // For video background slides, detect & remove the actual background color
                                if (hasVideoBackground) {
                                    try {
                                        const idStr = String(globalIdx).padStart(3, '0');
                                        // Step 1: Get the color from top-left corner (likely the background)
                                        const bgColorResult = await runCmd(`/usr/bin/convert "${filePath}" -format "%[pixel:p{0,0}]" info:`);
                                        const bgColorDetected = bgColorResult.trim();
                                        console.log(`[${idStr}] Detected background color: ${bgColorDetected}`);
                                        
                                        // Step 2: Make that specific color transparent with fuzz for similar colors
                                        await runCmd(`/usr/bin/convert "${filePath}" -alpha activate -fuzz 15% -transparent "${bgColorDetected}" "${filePath}"`);
                                        console.log(`? Made ${bgColorDetected} transparent for slide ${idStr}`);
                                    } catch (imgErr) {
                                        console.warn(`ImageMagick conversion error for slide: ${imgErr.message}`);
                                    }
                                }
                                break;
                            }
                        } catch (e) {
                            if (attempt === 3) throw e;
                        } finally {
                            await page.close();
                        }
                    }
                }));

                updateJob({ progress: 15 + Math.floor(((i + j) / slides.length) * 55) });
            }
        } finally {
            await browser.close();
        }
    }
}

// -------------------------
// CREATE VIDEO SEGMENT WITH BACKGROUND VIDEO & FOREGROUND SLIDE
// -------------------------

const createSegmentWithBackgroundVideo = async (slide, idx, framesDir, audioDir, videoDir, segDir) => {
    const id = String(idx).padStart(3, '0');
    const img = path.join(framesDir, `slide_${id}.png`);
    const bgVideo = path.join(videoDir, `bg_video_${id}.mp4`);
    const thVideo = path.join(videoDir, `th_video_${id}.mp4`);
    const mp3 = path.join(audioDir, `audio_${id}.mp3`);
    const out = path.join(segDir, `seg_${id}.mp4`);

    try {
        const hasBgVideo = await fs.pathExists(bgVideo);
        const hasThVideo = await fs.pathExists(thVideo) && slide.talkingHeadAsHeadshot;
        const hasAudio = await fs.pathExists(mp3);

        let duration = 3; // Default duration
        if (hasAudio) {
            duration = await getAudioDuration(mp3);
        } else if (hasBgVideo) {
            duration = await getVideoDuration(bgVideo);
        }

        console.log(`Processing segment ${id}: hasBgVideo=${hasBgVideo}, hasThVideo=${hasThVideo}, hasAudio=${hasAudio}, duration=${duration}s`);

        // Force exactly 48kHz stereo to prevent concat stream mismatched errors
        const audioFilter = `aresample=async=1:osr=48000,aformat=channel_layouts=stereo`;

        // Function to build command
        const buildCommand = (includeTh) => {
            let inputs = [];
            let filterComplex = [];
            
            // 1. Background Layer (Video or Color)
            if (hasBgVideo) {
                inputs.push(`-stream_loop -1 -i "${bgVideo}"`);
                filterComplex.push(`[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[bg]`);
            }

            // 2. Slide Image Layer
            inputs.push(`-loop 1 -framerate 30 -i "${img}"`);
            const slideIdx = inputs.length - 1;
            
            if (hasBgVideo) {
                filterComplex.push(`[${slideIdx}:v]scale=1920:1080,setpts=PTS-STARTPTS[fg]`);
                filterComplex.push(`[bg][fg]overlay=0:0[base]`);
            } else {
                filterComplex.push(`[${slideIdx}:v]scale=1920:1080,setpts=PTS-STARTPTS[base]`);
            }

            // 3. Talking Head Overlay (Optional)
            if (includeTh) {
                inputs.push(`-i "${thVideo}"`);
                const thIdx = inputs.length - 1;

                // Calculate Position & Size (Server 1920x1080 is 3x Preview 640x360)
                const scale = 3;
                const rawSize = (slide.talkingHeadSize || 160) * scale;
                const size = Math.round(rawSize);
                const margin = Math.round(24 * scale);

                // Use frontend-measured DOM positions when available (most accurate)
                let x, y;
                if (typeof slide.talkingHeadX === 'number' && typeof slide.talkingHeadY === 'number' &&
                    (slide.talkingHeadX > 0 || slide.talkingHeadY > 0)) {
                    x = Math.round(slide.talkingHeadX);
                    y = Math.round(slide.talkingHeadY);
                    console.log(`[${id}] Using frontend-measured TH position: x=${x}, y=${y}, size=${size}`);
                } else {
                    // Fallback: calculate position manually
                    switch (slide.talkingHeadPosition) {
                        case 'top-left':
                        case 'headshot-bio':
                            x = margin;
                            y = margin;
                            break;
                        case 'top-right':
                            x = 1920 - size - margin;
                            y = margin;
                            break;
                        case 'bottom-left':
                            x = margin;
                            y = 1080 - size - margin;
                            break;
                        case 'bottom-right':
                        default:
                            x = 1920 - size - margin;
                            y = 1080 - size - margin;
                            break;
                    }
                    console.log(`[${id}] Using calculated TH position: x=${x}, y=${y}, size=${size}`);
                }

                // FIX: Use alphamerge properly with a grayscale mask and yuva420p format
                // 1. Prepare Video: Scale & Crop to square, and format to yuva420p so it supports alpha
                filterComplex.push(`[${thIdx}:v]scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size},format=yuva420p[th_vid]`);
                
                // 2. Prepare Mask: Create a black canvas, draw a white circle using grayscale (lum).
                // MUST use uppercase X, Y, W, H for geq equations to evaluate properly!
                filterComplex.push(`color=c=black:s=${size}x${size},format=gray,geq=lum='255*lte(pow(X-(W/2),2)+pow(Y-(H/2),2),pow((W/2)-2,2))'[mask]`);
                
                // 3. Merge: alphamerge uses the grayscale value (white = opaque, black = transparent)
                filterComplex.push(`[th_vid][mask]alphamerge[th]`);
                
                // Overlay Talking Head on Base
                filterComplex.push(`[base][th]overlay=${x}:${y}[v]`);
            } else {
                filterComplex.push(`[base]null[v]`);
            }

            // 4. Audio Mixing
            if (hasAudio) {
                inputs.push(`-i "${mp3}"`);
                const audIdx = inputs.length - 1;
                filterComplex.push(`[${audIdx}:a]${audioFilter}[a]`);
            } else {
                inputs.push(`-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000`);
                const audIdx = inputs.length - 1;
                filterComplex.push(`[${audIdx}:a]${audioFilter}[a]`);
            }

            return `ffmpeg -y ${inputs.join(' ')} \
    -filter_complex "${filterComplex.join(';')}" \
    -map "[v]" -map "[a]" \
    -t ${duration} \
    -r 30 -vsync cfr \
    -video_track_timescale 90000 \
    -c:v libx264 -preset ultrafast \
    -c:a aac -ar 48000 -b:a 192k \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "${out}"`;
        };

        try {
            // Try with talking head first (if applicable)
            if (hasThVideo) {
                await runCmd(buildCommand(true));
                console.log(`? Segment ${id} created successfully with TH (${duration}s)`);
                return true;
            }
        } catch (err) {
            console.warn(`?? Segment ${id} failed with TH. Retrying without it...`, err.message);
        }

        // Fallback or Primary (if no TH)
        await runCmd(buildCommand(false));
        console.log(`? Segment ${id} created successfully (${duration}s)${hasThVideo ? ' (FALLBACK)' : ''}`);
        return true;

    } catch (error) {
        console.error(`? Failed to create segment ${id}:`, error.message);
        return false;
    }
};

// -------------------------
// CONCAT WITH TRANSITIONS (xfade)
// -------------------------

const concatWithTransitions = async (segDir, slides, finalPath) => {
    const segFiles = (await fs.readdir(segDir))
        .filter(f => f.endsWith('.mp4'))
        .sort();

    if (segFiles.length === 0) throw new Error('No segments found');
    if (segFiles.length === 1) {
        await fs.copy(path.join(segDir, segFiles[0]), finalPath);
        return;
    }

    // Get duration of each segment
    const durations = [];
    for (const f of segFiles) {
        const dur = await getVideoDuration(path.join(segDir, f));
        durations.push(dur);
    }

    // Check if any slide has a non-none transition
    const hasAnyTransition = slides.some((s, i) => i > 0 && s.transition && s.transition !== 'none');

    if (!hasAnyTransition) {
        // Fall back to simple concat (stream copy)
        const list = segFiles.map(f => `file '${f}'`).join('\n');
        await fs.writeFile(path.join(segDir, '..', 'list.txt'), list);
        await runCmd(`cd "${segDir}" && ffmpeg -y -f concat -safe 0 -i ../list.txt -c copy "${finalPath}"`);
        return;
    }

    // STRATEGY: xfade overlaps video, which shortens the total video duration.
    // But audio must play sequentially (no overlap, no cutting speech).
    // To keep them in sync, we PAD each segment's VIDEO with frozen frames (tpad)
    // by the transition duration. When xfade then "eats" those extra frames during
    // the overlap, the effective video duration = original audio duration. Perfect sync.

    const paddedDurations = [...durations];

    for (let i = 0; i < segFiles.length - 1; i++) {
        const nextSlide = slides[i + 1];
        const hasTransition = nextSlide && nextSlide.transition && nextSlide.transition !== 'none';
        if (!hasTransition) continue;

        const transDur = nextSlide.transitionDuration || 0.5;
        const segPath = path.join(segDir, segFiles[i]);
        const paddedPath = path.join(segDir, `_pad_${segFiles[i]}`);

        // tpad clones the last video frame for transDur extra seconds.
        // Audio stays at original length (-c:a copy). This creates a segment where
        // video is slightly longer than audio — the "extra" frozen frames are what
        // xfade will consume during the transition overlap.
        console.log(`Padding segment ${i} with ${transDur}s frozen frames for transition...`);
        await runCmd(`ffmpeg -y -i "${segPath}" -vf "tpad=stop_mode=clone:stop_duration=${transDur}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a copy "${paddedPath}"`);

        await fs.move(paddedPath, segPath, { overwrite: true });
        paddedDurations[i] = durations[i] + transDur;
    }

    // Build xfade filter chain using PADDED durations for video
    const inputs = segFiles.map(f => `-i "${path.join(segDir, f)}"`).join(' ');
    let videoFilter = '';
    let cumulativeOffset = 0;

    for (let i = 0; i < segFiles.length - 1; i++) {
        const nextSlide = slides[i + 1];
        const transition = (nextSlide && nextSlide.transition && nextSlide.transition !== 'none')
            ? nextSlide.transition : null;
        const transDur = (nextSlide && nextSlide.transitionDuration) || 0.5;

        const prevLabel = i === 0 ? `[0:v]` : `[v${i}]`;
        const nextLabel = `[${i + 1}:v]`;
        const outLabel = i === segFiles.length - 2 ? `[vout]` : `[v${i + 1}]`;

        if (transition) {
            // offset = where the transition starts on the output timeline
            // paddedDurations[i] - transDur = original duration (the transition eats the padded part)
            const offset = Math.max(0, cumulativeOffset + paddedDurations[i] - transDur);
            videoFilter += `${prevLabel}${nextLabel}xfade=transition=${transition}:duration=${transDur}:offset=${offset.toFixed(3)}${outLabel};`;
            cumulativeOffset = offset;
        } else {
            // Hard cut — no padding was added, use full duration
            const offset = cumulativeOffset + paddedDurations[i];
            videoFilter += `${prevLabel}${nextLabel}xfade=transition=fade:duration=0.001:offset=${offset.toFixed(3)}${outLabel};`;
            cumulativeOffset = offset;
        }
    }

    videoFilter = videoFilter.replace(/;$/, '');

    // Audio: simple sequential concat — each slide's voiceover plays fully, no overlap
    let audioFilter = '';
    for (let i = 0; i < segFiles.length; i++) {
        audioFilter += `[${i}:a]`;
    }
    audioFilter += `concat=n=${segFiles.length}:v=0:a=1[aout]`;

    const filterComplex = `${videoFilter};${audioFilter}`;
    const cmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[vout]" -map "[aout]" -r 30 -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -ar 48000 -b:a 192k -movflags +faststart "${finalPath}"`;

    console.log('Transition concat command:', cmd.substring(0, 500) + '...');
    await runCmd(cmd);
};

// -------------------------
// MAIN ROUTE
// -------------------------

app.post(['/render', '/render-zip'], async (req, res) => {
    const isZip = req.path.includes('zip');
    const { slides, projectName } = req.body;

    const jobId = `job_${Date.now()}`;
    res.json({ jobId });

    const updateJob = (upd) => jobs.set(jobId, { ...jobs.get(jobId), ...upd });
    updateJob({ status: 'starting', progress: 0 });

    const workDir = path.join(__dirname, 'temp', jobId);

    try {
        const framesDir = path.join(workDir, 'frames');
        const audioDir = path.join(workDir, 'audio');
        const videoDir = path.join(workDir, 'videos');
        const segDir = path.join(workDir, 'segments');

        await Promise.all([
            fs.ensureDir(framesDir),
            fs.ensureDir(audioDir),
            fs.ensureDir(videoDir),
            fs.ensureDir(segDir)
        ]);

        await renderSlides(slides, framesDir, audioDir, videoDir, updateJob);

        const safeProjectName = (projectName || 'export')
            .replace(/[^\w\s]/gi, '')
            .replace(/\s+/g, '_');

        const finalFilename = `${safeProjectName}_${jobId}.${isZip ? 'zip' : 'mp4'}`;
        const finalPath = path.join(__dirname, 'outputs', finalFilename);

        if (isZip) {
            updateJob({ status: 'zipping', progress: 95 });
            await runCmd(`cd "${workDir}" && zip -r -q "${finalPath}" frames audio videos`);
        } else {
            updateJob({ status: 'creating_video', progress: 75 });

            const FFMPEG_CONC = 2;

            for (let i = 0; i < slides.length; i += FFMPEG_CONC) {
                const batch = slides.slice(i, i + FFMPEG_CONC);

                await Promise.all(batch.map(async (slide, idx) => {
                    const globalIdx = i + idx;
                    await createSegmentWithBackgroundVideo(
                        slide,
                        globalIdx,
                        framesDir,
                        audioDir,
                        videoDir,
                        segDir
                    );
                }));

                updateJob({ progress: 75 + Math.floor((i / slides.length) * 20) });
            }

            // Concat segments — with xfade transitions if any slide has one
            await concatWithTransitions(segDir, slides, finalPath);
        }

        updateJob({ status: 'completed', progress: 100, downloadUrl: `/outputs/${finalFilename}` });

        setTimeout(() => fs.remove(workDir).catch(() => {}), 600000);

    } catch (err) {
        updateJob({ status: 'failed', error: err.message });
        fs.remove(workDir).catch(() => {});
    }
});

// -------------------------
// STATUS ROUTE
// -------------------------

app.get('/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

app.listen(PORT, '0.0.0.0', () =>
    console.log(`Perfect Sync Server running on ${PORT}`)
);