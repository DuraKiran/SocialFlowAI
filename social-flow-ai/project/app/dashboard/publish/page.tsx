'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getMediaFiles, getSocialAccounts, getGenerationsForMedia, savePost, notify } from '@/lib/store';
import { PLATFORM_LIST, PLATFORMS, platformName } from '@/lib/platforms';
import type { AiGeneration, MediaFile, Platform, Post, SocialAccount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { statusLabel } from '@/lib/store';
import { Loader2, Sparkles, Send, CalendarClock, Save, Video, AlertCircle, Clock } from 'lucide-react';

interface DraftPost {
  platform: Platform;
  accountId: string | null;
  caption: string;
  title: string;
  description: string;
  hashtags: string;
  privacy: string;
  mode: 'now' | 'scheduled';
  scheduledAt: string;
}

export default function PublishPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [gens, setGens] = useState<AiGeneration[]>([]);
  const [selected, setSelected] = useState<Set<Platform>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, DraftPost>>({});
  const [busy, setBusy] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      const [m, a] = await Promise.all([
        getMediaFiles(session.workspaceId),
        getSocialAccounts(session.workspaceId),
      ]);
      setMedia(m);
      setAccounts(a);
      if (m.length) setMediaId(m[0].id);
    })();
  }, [session]);

  useEffect(() => {
    if (!mediaId) return;
    void getGenerationsForMedia(mediaId).then(setGens);
  }, [mediaId]);

  function togglePlatform(p: Platform) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  }

  function applyAiContent(platform: Platform) {
    if (!mediaId) return;
    const gen = gens.find((g) => g.platform === platform && g.mediaFileId === mediaId);
    const variation = gen?.variations[0];
    setDrafts((prev) => ({
      ...prev,
      [platform]: {
        ...(prev[platform] ?? emptyDraft(platform)),
        caption: variation?.caption ?? prev[platform]?.caption ?? '',
        title: variation?.hook ?? prev[platform]?.title ?? '',
        description: variation?.description ?? prev[platform]?.description ?? '',
        hashtags: variation?.hashtags.join(' ') ?? prev[platform]?.hashtags ?? '',
      },
    }));
  }

  function applyAiAll() {
    Array.from(selected).forEach(applyAiContent);
    toast({ title: 'AI content applied', description: 'Each platform got its own generated copy. Review before publishing.' });
  }

  function updateDraft(platform: Platform, patch: Partial<DraftPost>) {
    setDrafts((prev) => ({ ...prev, [platform]: { ...(prev[platform] ?? emptyDraft(platform)), ...patch } }));
  }

  const connectedFor = (p: Platform) => accounts.filter((a) => a.platform === p);

  async function submit() {
    if (!session || !mediaId) return;
    setBusy(true);
    try {
      const created: Post[] = [];
      for (const p of Array.from(selected)) {
        const d = drafts[p] ?? emptyDraft(p);
        const acct = connectedFor(p)[0];
        const post: Post = {
          id: crypto.randomUUID(),
          workspaceId: session.workspaceId,
          mediaFileId: mediaId,
          socialAccountId: acct?.id ?? null,
          platform: p,
          caption: d.caption,
          title: d.title,
          description: d.description,
          hashtags: d.hashtags,
          privacy: d.privacy,
          status: 'pending',
          publishMode: d.mode,
          scheduledAt: d.mode === 'scheduled' && d.scheduledAt ? new Date(d.scheduledAt).toISOString() : null,
          publishedAt: null,
          externalPostId: null,
          externalUrl: null,
          idempotencyKey: crypto.randomUUID(),
          lastError: null,
          createdAt: new Date().toISOString(),
        };
        await savePost(post);
        created.push(post);
      }
      await notify(
        session.workspaceId,
        session.userId,
        'publish_submitted',
        'Publishing jobs created',
        `${created.length} job(s) created. Each platform is tracked individually.`
      );
      toast({
        title: 'Jobs created',
        description: `${created.length} publishing job(s) submitted. Track them under Published Posts.`,
      });
      router.push('/dashboard/posts');
    } finally {
      setBusy(false);
    }
  }

  const selectedArr = useMemo(() => Array.from(selected), [selected]);

  if (media.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Video className="h-10 w-10 text-slate-600" />
          <p className="text-slate-300">Upload a video first.</p>
          <Button asChild variant="outline" className="border-slate-700 hover:bg-slate-800">
            <a href="/dashboard/library">Go to Media Library</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Publish Video</h1>
        <p className="text-sm text-slate-400">One video, every platform — each with its own caption, settings, and tracking.</p>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-400">1 · Choose your video</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={mediaId ?? undefined} onValueChange={(v) => setMediaId(v)}>
            <SelectTrigger className="bg-slate-950 border-slate-800 md:w-96">
              <SelectValue placeholder="Select a video" />
            </SelectTrigger>
            <SelectContent>
              {media.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-400">2 · Select platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_LIST.map((p) => {
              const accts = connectedFor(p.id);
              const checked = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    checked ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => togglePlatform(p.id)} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: checked ? PLATFORMS[p.id].color : undefined }}>
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {accts.length > 0
                        ? `${accts.length} account${accts.length > 1 ? 's' : ''}`
                        : 'Not connected — setup required'}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          {selectedArr.length > 0 && (
            <Button variant="outline" size="sm" className="mt-3 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10" onClick={applyAiAll}>
              <Sparkles className="mr-2 h-4 w-4" /> Apply AI content to all selected
            </Button>
          )}
        </CardContent>
      </Card>

      {selectedArr.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400">3 · Platform-specific content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={previewPlatform ?? selectedArr[0]} onValueChange={(v) => setPreviewPlatform(v as Platform)}>
              <TabsList className="flex-wrap h-auto">
                {selectedArr.map((p) => (
                  <TabsTrigger key={p} value={p}>{PLATFORMS[p].name}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {selectedArr.map((p) => {
              const d = drafts[p] ?? emptyDraft(p);
              const meta = PLATFORMS[p];
              const gen = gens.find((g) => g.platform === p);
              return (
                <div key={p} className={`rounded-lg border p-4 ${previewPlatform === p || selectedArr.length === 1 ? '' : 'hidden'}`} data-platform={p}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.name}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700" onClick={() => applyAiContent(p)}>
                        <Sparkles className="mr-1 h-3 w-3" /> {gen ? 'Apply AI' : 'Generate'}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {meta.supports.title && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Title</Label>
                        <Input value={d.title} onChange={(e) => updateDraft(p, { title: e.target.value })} className="bg-slate-950 border-slate-800" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Caption</Label>
                      <Textarea value={d.caption} onChange={(e) => updateDraft(p, { caption: e.target.value })} className="bg-slate-950 border-slate-800 min-h-[70px]" />
                    </div>
                    {meta.supports.description && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Textarea value={d.description} onChange={(e) => updateDraft(p, { description: e.target.value })} className="bg-slate-950 border-slate-800 min-h-[70px]" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hashtags</Label>
                      <Input value={d.hashtags} onChange={(e) => updateDraft(p, { hashtags: e.target.value })} className="bg-slate-950 border-slate-800" />
                    </div>
                    {meta.supports.privacy && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Privacy</Label>
                        <Select value={d.privacy} onValueChange={(v) => updateDraft(p, { privacy: v })}>
                          <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="unlisted">Unlisted</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">When</Label>
                      <Tabs value={d.mode} onValueChange={(v) => updateDraft(p, { mode: v as 'now' | 'scheduled' })}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="now"><Send className="mr-1 h-3 w-3" /> Now</TabsTrigger>
                          <TabsTrigger value="scheduled"><CalendarClock className="mr-1 h-3 w-3" /> Schedule</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      {d.mode === 'scheduled' && (
                        <Input type="datetime-local" value={d.scheduledAt} onChange={(e) => updateDraft(p, { scheduledAt: e.target.value })} className="bg-slate-950 border-slate-800" />
                      )}
                    </div>
                  </div>
                  {!meta.approvalNote ? null : (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-300">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {meta.approvalNote}
                    </div>
                  )}
                  {!connectedFor(p).length && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-300">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> No connected {meta.name} account — the job will be marked &quot;Requires manual action&quot; until the account is connected.
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button size="lg" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => void submit()} disabled={busy || selectedArr.length === 0}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Create {selectedArr.length} publishing job{selectedArr.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}

function emptyDraft(platform: Platform): DraftPost {
  return {
    platform,
    accountId: null,
    caption: '',
    title: '',
    description: '',
    hashtags: '',
    privacy: 'public',
    mode: 'now',
    scheduledAt: '',
  };
}
