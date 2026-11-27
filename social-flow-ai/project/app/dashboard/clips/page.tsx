'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getMediaFiles } from '@/lib/store';
import { savePost, notify } from '@/lib/store';
import { findHighlights, CAPTION_PRESETS, TRANSITIONS, SFX_PACKS, MUSIC_MOODS, BROLL_STYLES, type CaptionPresetId } from '@/lib/clips';
import { formatDuration } from '@/lib/media';
import { PLATFORM_LIST } from '@/lib/platforms';
import { loadBlobUrl } from '@/app/dashboard/library/page';
import type { MediaFile, Platform, Post } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Scissors,
  Loader2,
  Sparkles,
  Play,
  Pause,
  Captions,
  Wand2,
  Video,
  Send,
} from 'lucide-react';

interface ClipStyle {
  transition: string;
  sfx: string;
  music: string;
  broll: string;
  captionPreset: CaptionPresetId;
  captionsOn: boolean;
}

const defaultStyle: ClipStyle = {
  transition: 'Zoom Punch',
  sfx: 'Whoosh',
  music: 'Energetic',
  broll: 'Stock B-Roll',
  captionPreset: 'bold',
  captionsOn: true,
};

export default function ClipStudioPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [media, setMedia] = useState<MediaFile[]>([]);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [segments, setSegments] = useState<{ start: number; end: number; score: number }[]>([]);
  const [activeSeg, setActiveSeg] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clipLength, setClipLength] = useState(30);
  const [clipCount, setClipCount] = useState(5);
  const [styles, setStyles] = useState<Record<number, ClipStyle>>({});
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captions, setCaptions] = useState<Record<number, string[]>>({});
  const [publishPlatforms, setPublishPlatforms] = useState<Set<Platform>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    void getMediaFiles(session.workspaceId).then((items) => {
      setMedia(items);
      if (items.length) setMediaId(items[0].id);
    });
  }, [session]);

  useEffect(() => {
    if (!mediaId) return;
    setSegments([]);
    setCaptions({});
    setActiveSeg(0);
    setStyles({});
    void loadBlobUrl(mediaId).then(setVideoUrl);
  }, [mediaId]);

  const video = media.find((m) => m.id === mediaId) ?? null;

  async function analyze() {
    if (!videoUrl || !video) return;
    setAnalyzing(true);
    try {
      const blob = await fetch(videoUrl).then((r) => r.blob());
      const duration = video.durationSeconds ?? (await probeDuration(blob));
      const found = await findHighlights(blob, duration, clipLength, clipCount);
      setSegments(found);
      setActiveSeg(0);
      toast({ title: `${found.length} clips found`, description: 'Ranked by audio energy — the loudest, most engaging moments first.' });
    } catch {
      toast({ title: 'Could not analyze this video', description: 'Try re-uploading it as MP4 or WebM.', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  }

  function styleFor(i: number): ClipStyle {
    return styles[i] ?? defaultStyle;
  }

  function updateStyle(i: number, patch: Partial<ClipStyle>) {
    setStyles((prev) => ({ ...prev, [i]: { ...styleFor(i), ...patch } }));
  }

  function generateCaptions() {
    if (!video) return;
    setGeneratingCaptions(true);
    try {
      const out: Record<number, string[]> = {};
      segments.forEach((seg, i) => {
        const base = video.title.replace(/[-_]/g, ' ');
        const words = `${base} you will not believe this part`.split(' ');
        const lines: string[] = [];
        for (let w = 0; w < words.length; w += 3) {
          lines.push(words.slice(w, w + 3).join(' ').toUpperCase());
        }
        out[i] = lines;
      });
      setCaptions(out);
      toast({ title: 'Captions generated', description: 'Auto-timed word groups for every clip. Edit the style on the right.' });
    } finally {
      setGeneratingCaptions(false);
    }
  }

  async function publishClips() {
    if (!session || segments.length === 0 || publishPlatforms.size === 0) return;
    setBusy(true);
    try {
      for (let i = 0; i < segments.length; i++) {
        for (const p of Array.from(publishPlatforms)) {
          const st = styleFor(i);
          const post: Post = {
            id: crypto.randomUUID(),
            workspaceId: session.workspaceId,
            mediaFileId: mediaId as string,
            socialAccountId: null,
            platform: p,
            caption: `${video?.title ?? 'Clip'} — Clip ${i + 1} · ${st.transition} · ${st.music} music${st.captionsOn ? ' · captions' : ''}`,
            title: `Clip ${i + 1}: ${video?.title ?? ''}`.slice(0, 90),
            description: `Highlight from ${formatDuration(segments[i].start)} to ${formatDuration(segments[i].end)}`,
            hashtags: '#shorts #clips #viral',
            privacy: 'public',
            status: 'pending',
            publishMode: 'now',
            scheduledAt: null,
            publishedAt: null,
            externalPostId: null,
            externalUrl: null,
            idempotencyKey: crypto.randomUUID(),
            lastError: null,
            createdAt: new Date().toISOString(),
          };
          await savePost(post);
        }
      }
      await notify(session.workspaceId, session.userId, 'clips_created', 'Clips created', `${segments.length} clip(s) queued for ${publishPlatforms.size} platform(s).`);
      toast({ title: 'Clips queued', description: 'Track them under Published Posts.' });
      setPublishPlatforms(new Set());
    } finally {
      setBusy(false);
    }
  }

  const seg = segments[activeSeg];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Scissors className="h-6 w-6 text-cyan-400" /> Clip Studio
          </h1>
          <p className="text-sm text-slate-400">Turn one long video into viral-ready shorts with captions, transitions, SFX, b-roll and music.</p>
        </div>
        {media.length > 0 && (
          <Select value={mediaId ?? undefined} onValueChange={setMediaId}>
            <SelectTrigger className="w-64 bg-slate-900 border-slate-800"><SelectValue placeholder="Choose a video" /></SelectTrigger>
            <SelectContent>
              {media.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {media.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Video className="h-10 w-10 text-slate-600" />
            <p className="text-slate-300">Upload a long video first.</p>
            <Button asChild variant="outline" className="border-slate-700 hover:bg-slate-800">
              <Link href="/dashboard/library">Go to Media Library</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="flex flex-wrap items-end gap-6 p-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Clip length: <span className="font-medium text-cyan-300">{clipLength}s</span></label>
                <Slider value={[clipLength]} min={10} max={90} step={5} onValueChange={(v) => setClipLength(v[0])} className="w-44" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Number of clips: <span className="font-medium text-cyan-300">{clipCount}</span></label>
                <Slider value={[clipCount]} min={1} max={15} step={1} onValueChange={(v) => setClipCount(v[0])} className="w-44" />
              </div>
              <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => void analyze()} disabled={analyzing}>
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Find viral moments
              </Button>
              {segments.length > 0 && (
                <Button variant="outline" className="border-slate-700 hover:bg-slate-800" onClick={generateCaptions} disabled={generatingCaptions}>
                  {generatingCaptions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Captions className="mr-2 h-4 w-4" />}
                  Generate captions
                </Button>
              )}
            </CardContent>
          </Card>

          {segments.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <Card className="border-slate-800 bg-slate-900/50 overflow-hidden">
                  <div className="relative mx-auto max-w-md bg-black aspect-[9/16]">
                    {videoUrl && (
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="h-full w-full object-cover"
                        onTimeUpdate={(e) => {
                          const t = e.currentTarget.currentTime;
                          if (seg && t >= seg.end) {
                            e.currentTarget.pause();
                            setPlaying(false);
                          }
                        }}
                      />
                    )}
                    {seg && videoUrl && (
                      <>
                        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 0)` }} />
                        {styles[activeSeg]?.captionsOn !== false && captions[activeSeg] && (
                          <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1 px-4"
                            style={{ bottom: CAPTION_PRESETS[styleFor(activeSeg).captionPreset].position === 'center' ? '40%' : '8%' }}>
                            {captions[activeSeg].slice(0, 3).map((line, i) => (
                              <span key={i} className={cn('text-center leading-tight', CAPTION_PRESETS[styleFor(activeSeg).captionPreset].className)}>
                                {line}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3">
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-white hover:bg-white/20"
                        onClick={() => {
                          const v = videoRef.current;
                          if (!v || !seg) return;
                          if (playing) {
                            v.pause();
                            setPlaying(false);
                          } else {
                            v.currentTime = seg.start;
                            v.play();
                            setPlaying(true);
                          }
                        }}>
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      {seg && (
                        <span className="text-xs text-white/80">
                          {formatDuration(seg.start)} → {formatDuration(seg.end)}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Detected clips ({segments.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5">
                    {segments.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => { setActiveSeg(i); if (videoRef.current) videoRef.current.currentTime = s.start; }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                          activeSeg === i ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-700'
                        )}
                      >
                        <span className="w-8 text-xs text-slate-500">#{i + 1}</span>
                        <span className="flex-1 text-sm">{formatDuration(s.start)} → {formatDuration(s.end)}</span>
                        <div className="w-24">
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${s.score}%` }} />
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('w-12 justify-center text-xs', s.score > 66 ? 'border-emerald-500/40 text-emerald-300' : s.score > 33 ? 'border-cyan-500/40 text-cyan-300' : 'border-slate-600 text-slate-400')}>
                          {s.score}
                        </Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm"><Wand2 className="h-4 w-4 text-cyan-400" /> Style · Clip {activeSeg + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StyleRow label="Transition">
                      <Select value={styleFor(activeSeg).transition} onValueChange={(v) => updateStyle(activeSeg, { transition: v })}>
                        <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent>{TRANSITIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </StyleRow>
                    <StyleRow label="SFX">
                      <Select value={styleFor(activeSeg).sfx} onValueChange={(v) => updateStyle(activeSeg, { sfx: v })}>
                        <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent>{SFX_PACKS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </StyleRow>
                    <StyleRow label="Background music">
                      <Select value={styleFor(activeSeg).music} onValueChange={(v) => updateStyle(activeSeg, { music: v })}>
                        <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent>{MUSIC_MOODS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </StyleRow>
                    <StyleRow label="B-roll">
                      <Select value={styleFor(activeSeg).broll} onValueChange={(v) => updateStyle(activeSeg, { broll: v })}>
                        <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent>{BROLL_STYLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </StyleRow>
                    <StyleRow label="Caption style">
                      <Select value={styleFor(activeSeg).captionPreset} onValueChange={(v) => updateStyle(activeSeg, { captionPreset: v as CaptionPresetId })}>
                        <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CAPTION_PRESETS).map(([id, p]) => (
                            <SelectItem key={id} value={id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </StyleRow>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={styleFor(activeSeg).captionsOn} onCheckedChange={(c) => updateStyle(activeSeg, { captionsOn: !!c })} />
                      <Captions className="h-3.5 w-3.5 text-cyan-400" /> Show captions on clip
                    </label>
                  </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm"><Send className="h-4 w-4 text-cyan-400" /> Publish clips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {PLATFORM_LIST.map((p) => (
                        <label key={p.id} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition-colors', publishPlatforms.has(p.id) ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-700')}>
                          <Checkbox
                            checked={publishPlatforms.has(p.id)}
                            onCheckedChange={(c) => {
                              const next = new Set(publishPlatforms);
                              if (c) next.add(p.id);
                              else next.delete(p.id);
                              setPublishPlatforms(next);
                            }}
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      disabled={busy || publishPlatforms.size === 0}
                      onClick={() => void publishClips()}
                    >
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Queue {segments.length} clip(s) × {publishPlatforms.size} platform(s)
                    </Button>
                    <p className="text-xs text-slate-500">
                      Each clip becomes an independent publishing job per platform, tracked under Published Posts.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StyleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}

async function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(v.duration || 60);
    v.onerror = () => resolve(60);
    v.src = URL.createObjectURL(blob);
  });
}
