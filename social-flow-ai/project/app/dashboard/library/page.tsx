'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getMediaFiles,
  saveMediaFile,
  removeMediaFile,
  notify,
} from '@/lib/store';
import { getMediaFiles as fetchMedia } from '@/lib/store';
import { extractVideoMeta, validateVideoFile, formatDuration, formatBytes } from '@/lib/media';
import type { MediaFile } from '@/lib/types';
import type { MediaFile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  UploadCloud,
  Search,
  Trash2,
  Loader2,
  Video,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export { fetchMedia as getMediaFiles };

export default function LibraryPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const items = await getMediaFiles(session.workspaceId);
    setFiles(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleFiles(fileList: FileList | null) {
    if (!session || !fileList?.length) return;
    const incoming = Array.from(fileList);
    const existing = new Set(files.map((f) => `${f.title}:${f.sizeBytes}`));
    const queue: { file: File; progress: number }[] = [];

    for (const file of incoming) {
      const invalid = validateVideoFile(file);
      if (invalid) {
        toast({ title: 'Skipped file', description: `${file.name}: ${invalid}`, variant: 'destructive' });
        continue;
      }
      if (existing.has(`${file.name}:${file.size}`)) {
        toast({ title: 'Duplicate skipped', description: `${file.name} is already in your library.` });
        continue;
      }
      existing.add(`${file.name}:${file.size}`);
      queue.push({ file, progress: 0 });
    }

    setUploading(queue.map((q) => ({ name: q.file.name, progress: 0 })));

    for (let i = 0; i < queue.length; i++) {
      const { file } = queue[i];
      const setProgress = (p: number) =>
        setUploading((prev) => prev.map((u, idx) => (idx === i ? { ...u, progress: p } : u)));

      setProgress(10);
      const meta = await extractVideoMeta(file);
      setProgress(55);

      const media: MediaFile = {
        id: crypto.randomUUID(),
        workspaceId: session.workspaceId,
        title: file.name.replace(/\.[^.]+$/, ''),
        storagePath: `local://${file.name}`,
        thumbnailDataUrl: meta.thumbnailDataUrl ?? undefined,
        sizeBytes: file.size,
        durationSeconds: meta.durationSeconds,
        width: meta.width,
        height: meta.height,
        mimeType: file.type || 'video/mp4',
        status: 'ready',
        tags: [],
        createdAt: new Date().toISOString(),
      };

      // persist the playable blob so previews and reuse work after reload
      try {
        await persistBlob(media.id, file);
      } catch {
        // storage full or blocked; library entry still saved without playable blob
      }

      setProgress(85);
      await saveMediaFile(media);
      setProgress(100);
    }

    await notify(session.workspaceId, session.userId, 'bulk_upload', 'Upload complete', `${queue.length} video(s) added to the media library.`);
    setUploading([]);
    await refresh();
    toast({ title: 'Upload complete', description: `${queue.length} video(s) added to your library.` });
  }

  const filtered = files.filter((f) => f.title.toLowerCase().includes(query.toLowerCase()));
  const totalBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-slate-400">
            {files.length} video{files.length === 1 ? '' : 's'} · {formatBytes(totalBytes)} used
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input placeholder="Search videos" value={query} onChange={(e) => setQuery(e.target.value)} className="w-56 pl-8 bg-slate-900 border-slate-800" />
          </div>
          <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => fileRef.current?.click()}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload
          </Button>
          <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" multiple hidden onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      {uploading.length > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="space-y-3 p-4">
            {uploading.map((u, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Loader2 className="h-3 w-3 animate-spin text-cyan-400" /> {u.name}
                  </span>
                  <span className="text-slate-500">{u.progress}%</span>
                </div>
                <Progress value={u.progress} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-800 py-24 text-center transition-colors hover:border-cyan-500/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <Video className="h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-300">No videos yet</p>
          <p className="text-sm text-slate-500">Drag and drop videos here, or click Upload.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((f) => (
            <MediaCard
              key={f.id}
              media={f}
              onDelete={async () => {
                await removeMediaFile(f.id);
                await refresh();
                toast({ title: 'Video deleted' });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({ media, onDelete }: { media: MediaFile; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="group border-slate-800 bg-slate-900/50 overflow-hidden transition-colors hover:border-cyan-500/40">
      <div className="relative aspect-video bg-slate-950">
        {media.thumbnailDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.thumbnailDataUrl} alt={media.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Video className="h-8 w-8 text-slate-700" />
          </div>
        )}
        {media.durationSeconds != null && (
          <Badge className="absolute bottom-2 right-2 bg-slate-950/80 text-slate-200 border-slate-700">
            {formatDuration(media.durationSeconds)}
          </Badge>
        )}
        {open && media.id && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90" onClick={() => setOpen(false)}>
            <video src={blobUrlCache[media.id]} controls autoPlay className="max-h-full max-w-full" />
            <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{media.title}</div>
            <div className="text-xs text-slate-500">
              {formatBytes(media.sizeBytes)}
              {media.width && media.height ? ` · ${media.width}×${media.height}` : ''}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {media.id && blobUrlCache[media.id] && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(true)} title="Preview">
                <Video className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={onDelete} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {media.status === 'ready' ? (
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">
              <AlertCircle className="mr-1 h-3 w-3" /> {media.status}
            </Badge>
          )}
          <Badge variant="outline" className="border-slate-700 text-slate-400">
            {new Date(media.createdAt).toLocaleDateString()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// blob cache: id -> object URL for playback after reload (loaded lazily)
export const blobUrlCache: Record<string, string> = {};

export async function persistBlob(id: string, file: File) {
  const blob = file.slice(0, file.size, file.type || 'video/mp4');
  const url = URL.createObjectURL(blob);
  blobUrlCache[id] = url;
  // store in IndexedDB via a lightweight separate store through localStorage-free path
  const db = await openForBlobs();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put({ id, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function openForBlobs(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('socialflow-blobs', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('blobs')) {
        req.result.createObjectStore('blobs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadBlobUrl(id: string): Promise<string | null> {
  if (blobUrlCache[id]) return blobUrlCache[id];
  try {
    const db = await openForBlobs();
    const result = await new Promise<{ id: string; blob: Blob } | undefined>((resolve, reject) => {
      const tx = db.transaction('blobs');
      const req = tx.objectStore('blobs').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (result) {
      const url = URL.createObjectURL(result.blob);
      blobUrlCache[id] = url;
      return url;
    }
  } catch {
    return null;
  }
  return null;
}
