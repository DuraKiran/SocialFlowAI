export interface ExtractedMeta {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  thumbnailDataUrl: string | null;
}

export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

export function validateVideoFile(file: File): string | null {
  if (!ACCEPTED_VIDEO_TYPES.includes(file.type) && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
    return 'Unsupported format. Use MP4, MOV or WebM.';
  }
  if (file.size > 2 * 1024 * 1024 * 1024) {
    return 'File is larger than the 2 GB limit.';
  }
  if (file.size === 0) {
    return 'File is empty.';
  }
  return null;
}

export async function extractVideoMeta(file: File): Promise<ExtractedMeta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const finish = (meta: ExtractedMeta) => {
      URL.revokeObjectURL(url);
      resolve(meta);
    };

    const timeout = setTimeout(() => finish({ durationSeconds: null, width: null, height: null, thumbnailDataUrl: null }), 15000);

    video.onloadedmetadata = () => {
      const meta: ExtractedMeta = {
        durationSeconds: Math.round(video.duration) || null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        thumbnailDataUrl: null,
      };
      video.currentTime = Math.min(1, (video.duration || 2) / 3);
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const w = 320;
          const scale = video.videoWidth ? w / video.videoWidth : 1;
          canvas.width = w;
          canvas.height = Math.round((video.videoHeight || 180) * scale);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            meta.thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          }
        } catch {
          // thumbnail is optional
        }
        clearTimeout(timeout);
        finish(meta);
      };
      setTimeout(() => {
        clearTimeout(timeout);
        finish(meta);
      }, 8000);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      finish({ durationSeconds: null, width: null, height: null, thumbnailDataUrl: null });
    };

    video.src = url;
  });
}

export function formatDuration(seconds: number | null): string {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
