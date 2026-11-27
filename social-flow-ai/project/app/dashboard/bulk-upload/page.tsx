'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getMediaFiles, saveMediaFile, notify } from '@/lib/store';
import { extractVideoMeta, validateVideoFile, formatDuration, formatBytes } from '@/lib/media';
import type { MediaFile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { blobUrlCache, persistBlob } from '@/app/dashboard/library/page';
import { Loader2, UploadCloud, Trash2, CheckCircle2, AlertCircle, X, FolderOpen } from 'lucide-react';

interface QueueItem {
  file: File;
  progress: number;
  status: 'queued' | 'working' | 'done' | 'error' | 'cancelled';
  error?: string;
  mediaId?: string;
}

export default function BulkUploadPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [library, setLibrary] = useState<MediaFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!session) return;
    const items = await getMediaFiles(session.workspaceId);
    setLibrary(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const items: QueueItem[] = [];
    for (const file of Array.from(list)) {
      const invalid = validateVideoFile(file);
      if (invalid) {
        items.push({ file, progress: 0, status: 'error', error: invalid });
        continue;
      }
      const dup = queue.some((q) => q.file.name === file.name && q.file.size === file.size) ||
        library.some((m) => m.title === file.name.replace(/\.[^.]+$/, '') && m.sizeBytes === file.size);
      if (dup) {
        items.push({ file, progress: 0, status: 'error', error: 'Duplicate — already uploaded' });
        continue;
      }
      items.push({ file, progress: 0, status: 'queued' });
    }
    setQueue((prev) => [...prev, ...items]);
  }

  async function startUpload() {
    if (!session) return;
    setRunning(true);
    const pending = queue.filter((q) => q.status === 'queued');
    try {
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        setQueue((prev) => prev.map((q) => (q.file === item.file ? { ...q, status: 'working', progress: 5 } : q)));

        const meta = await extractVideoMeta(item.file);
        setQueue((prev) => prev.map((q) => (q.file === item.file ? { ...q, progress: 50 } : q)));

        const media: MediaFile = {
          id: crypto.randomUUID(),
          workspaceId: session.workspaceId,
          title: item.file.name.replace(/\.[^.]+$/, ''),
          storagePath: `local://${item.file.name}`,
          thumbnailDataUrl: meta.thumbnailDataUrl ?? undefined,
          sizeBytes: item.file.size,
          durationSeconds: meta.durationSeconds,
          width: meta.width,
          height: meta.height,
          mimeType: item.file.type || 'video/mp4',
          status: 'ready',
          tags: [],
          createdAt: new Date().toISOString(),
        };

        try {
          await persistBlob(media.id, item.file);
        } catch {
          // playback blob optional
        }

        await saveMediaFile(media);
        setQueue((prev) => prev.map((q) => (q.file === item.file ? { ...q, progress: 100, status: 'done', mediaId: media.id } : q)));
      }
      await notify(session.workspaceId, session.userId, 'bulk_upload', 'Bulk upload complete', `${pending.length} video(s) added to the library.`);
      toast({ title: 'Bulk upload complete', description: `${pending.length} video(s) uploaded.` });
      await refresh();
    } finally {
      setRunning(false);
    }
  }

  const done = queue.filter((q) => q.status === 'done').length;
  const errored = queue.filter((q) => q.status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bulk Upload</h1>
          <p className="text-sm text-slate-400">Drop up to 50 videos. Duration, resolution, and thumbnails are detected automatically.</p>
        </div>
        {queue.some((q) => q.status === 'queued') && (
          <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => void startUpload()} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Upload {queue.filter((q) => q.status === 'queued').length} video(s)
          </Button>
        )}
      </div>

      <div
        className="rounded-xl border-2 border-dashed border-slate-800 py-14 text-center transition-colors hover:border-cyan-500/40"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud className="mx-auto h-10 w-10 text-slate-600" />
        <p className="mt-3 font-medium text-slate-300">Drag and drop videos here</p>
        <p className="text-sm text-slate-500">or</p>
        <Button variant="outline" className="mt-2 border-slate-700 hover:bg-slate-800" onClick={() => fileRef.current?.click()}>
          Choose files
        </Button>
        <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <p className="mt-3 text-xs text-slate-600">MP4, MOV, WebM · up to 2 GB each</p>
      </div>

      {queue.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="space-y-2 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>{done} done{errored ? ` · ${errored} skipped` : ''} · {queue.length} total</span>
              {queue.every((q) => q.status === 'done' || q.status === 'error') && (
                <Button variant="ghost" size="sm" onClick={() => setQueue([])}>Clear list</Button>
              )}
            </div>
            {queue.map((q, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm">{q.file.name}</span>
                    {q.status === 'done' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                    {q.status === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />}
                    {q.status === 'working' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-400" />}
                  </div>
                  {q.status === 'error' ? (
                    <p className="text-xs text-red-400">{q.error}</p>
                  ) : (
                    <Progress value={q.progress} className="mt-1.5 h-1" />
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-500">{formatBytes(q.file.size)}</span>
                {q.status === 'queued' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQueue((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {library.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium"><FolderOpen className="h-4 w-4 text-cyan-400" /> Library ({library.length})</span>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="border-slate-700 text-xs">
                  <Link href="/dashboard/scheduler">Schedule selected ({selected.size})</Link>
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {library.slice(0, 15).map((m) => (
                <label key={m.id} className={`cursor-pointer overflow-hidden rounded-lg border transition-colors ${selected.has(m.id) ? 'border-cyan-500/60' : 'border-slate-800 hover:border-slate-700'}`}>
                  <div className="relative aspect-video bg-slate-950">
                    {m.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbnailDataUrl} alt={m.title} className="h-full w-full object-cover" />
                    ) : null}
                    <div className="absolute right-1.5 top-1.5">
                      <Checkbox
                        checked={selected.has(m.id)}
                        onCheckedChange={(c) => {
                          const next = new Set(selected);
                          if (c) next.add(m.id);
                          else next.delete(m.id);
                          setSelected(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {m.durationSeconds != null && (
                      <Badge className="absolute bottom-1.5 right-1.5 bg-slate-950/80 border-slate-700 text-[10px]">{formatDuration(m.durationSeconds)}</Badge>
                    )}
                  </div>
                  <div className="p-2 text-xs truncate text-slate-300">{m.title}</div>
                </label>
              ))}
            </div>
            {selected.size > 0 && (
              <p className="mt-3 text-xs text-slate-500">{selected.size} video(s) selected — continue to the Bulk Scheduler to assign platforms and time slots.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
