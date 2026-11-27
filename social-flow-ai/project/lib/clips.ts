export interface ClipSegment {
  start: number;
  end: number;
  score: number; // 0-100 relative energy score
}

/**
 * Finds high-energy (likely engaging) moments in a video's audio track.
 * Decodes the audio in the browser and scores sliding windows by loudness.
 * Falls back to evenly spaced segments if the audio cannot be decoded.
 */
export async function findHighlights(
  file: Blob,
  duration: number,
  clipLength: number,
  count: number
): Promise<ClipSegment[]> {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const buffer = await withTimeout(ctx.decodeAudioData(await file.arrayBuffer()), 30000);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    const windowSize = Math.floor(sampleRate * 0.5); // energy per 0.5s
    const windows: number[] = [];
    for (let i = 0; i + windowSize < data.length; i += windowSize) {
      let sum = 0;
      for (let j = i; j < i + windowSize; j += 16) {
        // stride for speed
        sum += data[j] * data[j];
      }
      windows.push(Math.sqrt(sum / (windowSize / 16)));
    }

    if (windows.length === 0) throw new Error('empty audio');

    const segWindows = Math.max(1, Math.round(clipLength / 0.5));
    const scored: ClipSegment[] = [];
    for (let w = 0; w + segWindows <= windows.length; w += 2) {
      // stride 1s
      let mean = 0;
      let peak = 0;
      for (let k = w; k < w + segWindows; k++) {
        mean += windows[k];
        peak = Math.max(peak, windows[k]);
      }
      mean /= segWindows;
      const actualStart = (w * 0.5) / 1; // window index * 0.5s
      scored.push({
        start: actualStart,
        end: actualStart + clipLength,
        score: mean * 0.7 + peak * 0.3,
      });
    }

    if (scored.length === 0) throw new Error('video too short');

    const max = Math.max(...scored.map((s) => s.score));
    const min = Math.min(...scored.map((s) => s.score));
    for (const s of scored) {
      s.score = max > min ? Math.round(((s.score - min) / (max - min)) * 100) : 50;
    }

    // greedy: pick highest scoring, non-overlapping segments
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const picked: ClipSegment[] = [];
    for (const cand of sorted) {
      if (picked.length >= count) break;
      if (cand.end > duration) continue;
      const overlap = picked.some((p) => cand.start < p.end && cand.end > p.start);
      if (!overlap) picked.push(cand);
    }
    picked.sort((a, b) => a.start - b.start);
    await ctx.close();
    return picked;
  } catch {
    return fallbackSegments(duration, clipLength, count);
  }
}

function fallbackSegments(duration: number, clipLength: number, count: number): ClipSegment[] {
  const usable = Math.max(duration - clipLength, 0);
  const out: ClipSegment[] = [];
  for (let i = 0; i < count; i++) {
    const start = (usable / count) * i + Math.min(2, usable / count / 2);
    if (start + clipLength > duration) break;
    out.push({ start, end: start + clipLength, score: 50 });
  }
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

export const CAPTION_PRESETS = {
  bold: { name: 'Bold Yellow', className: 'text-yellow-300 text-3xl font-black uppercase drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]', position: 'bottom' },
  clean: { name: 'Clean White', className: 'text-white text-2xl font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]', position: 'bottom' },
  karaoke: { name: 'Karaoke Green', className: 'text-emerald-300 text-3xl font-extrabold uppercase drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]', position: 'center' },
} as const;

export type CaptionPresetId = keyof typeof CAPTION_PRESETS;

export const TRANSITIONS = ['Hard Cut', 'Zoom Punch', 'Whip Pan', 'Glitch', 'Flash'] as const;
export const SFX_PACKS = ['Rizz Airhorn', 'Whoosh', 'Vine Boom', 'Ding', 'None'] as const;
export const MUSIC_MOODS = ['Energetic', 'Chill Lo-Fi', 'Epic Orchestral', 'Trap Beat', 'Emotional Piano', 'None'] as const;
export const BROLL_STYLES = ['Stock B-Roll', 'AI Image Inserts', 'Screen Recording', 'None'] as const;
