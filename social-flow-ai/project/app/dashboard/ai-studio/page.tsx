'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getMediaFiles, getGenerationsForMedia, saveGeneration, saveVariation, notify } from '@/lib/store';
import { generateContent, generateVariation as makeVariation } from '@/lib/ai';
import { PLATFORM_LIST, platformName, PLATFORMS } from '@/lib/platforms';
import type { AiGeneration, ContentVariation, MediaFile, Platform } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Copy, Plus, Save, Check, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TONES = ['professional', 'casual', 'funny', 'educational', 'entertaining', 'dramatic'];

export default function AiStudioPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gens, setGens] = useState<AiGeneration[]>([]);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [tone, setTone] = useState('casual');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [niche, setNiche] = useState('');
  const [hashtagCount, setHashtagCount] = useState(6);
  const [varCount, setVarCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ varIndex: number; field: 'caption' | 'hook'; value: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    void getMediaFiles(session.workspaceId).then((items) => {
      setMedia(items);
      if (items.length && !selectedId) setSelectedId(items[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const selected = useMemo(() => media.find((m) => m.id === selectedId) ?? null, [media, selectedId]);

  const loadGens = useCallback(async () => {
    if (!selectedId) return;
    setGens(await getGenerationsForMedia(selectedId));
  }, [selectedId]);

  useEffect(() => {
    void loadGens();
  }, [loadGens]);

  async function generate(forAllPlatforms: boolean) {
    if (!session || !selected) return;
    setBusy(true);
    try {
      const targets = forAllPlatforms ? PLATFORM_LIST.map((p) => p.id) : [platform];
      for (const p of targets) {
        const variations = generateContent({
          videoTitle: selected.title,
          platform: p,
          tone,
          length,
          language: 'English',
          niche: niche || undefined,
          hashtagCount,
          variationCount: varCount,
        });
        const existing = gens.find((g) => g.platform === p && g.mediaFileId === selected.id);
        if (existing) {
          existing.variations = variations;
          existing.tone = tone;
          await saveGeneration(existing);
        } else {
          await saveGeneration({
            id: crypto.randomUUID(),
            workspaceId: session.workspaceId,
            mediaFileId: selected.id,
            platform: p,
            tone,
            lengthPref: length,
            language: 'English',
            variations,
            isTemplate: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
      await loadGens();
      await notify(session.workspaceId, session.userId, 'ai_done', 'AI generation complete', `Content generated for ${targets.length} platform(s).`);
      toast({ title: 'Content generated', description: `${targets.length} platform${targets.length > 1 ? 's' : ''} ready. Edit anything before publishing.` });
    } finally {
      setBusy(false);
    }
  }

  async function addVariation(gen: AiGeneration) {
    if (!selected) return;
    const v = makeVariation(
      { videoTitle: selected.title, platform: gen.platform, tone: gen.tone, length: length, language: 'English', hashtagCount, variationCount: 1 },
      gen.variations.length
    );
    gen.variations = [...gen.variations, v];
    await saveGeneration(gen);
    await loadGens();
  }

  async function saveEdit(gen: AiGeneration, varIndex: number, field: 'caption' | 'hook' | 'description', value: string) {
    gen.variations[varIndex] = { ...gen.variations[varIndex], [field]: value };
    await saveGeneration(gen);
    await loadGens();
    toast({ title: 'Saved' });
  }

  const activeGen = gens.find((g) => g.platform === platform && g.mediaFileId === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Content Studio</h1>
          <p className="text-sm text-slate-400">Generate platform-native captions, hooks, and hashtags — then edit anything.</p>
        </div>
      </div>

      {media.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Video className="h-10 w-10 text-slate-600" />
            <p className="text-slate-300">Upload a video first to generate content.</p>
            <Button asChild variant="outline" className="border-slate-700 hover:bg-slate-800">
              <a href="/dashboard/library">Go to Media Library</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="border-slate-800 bg-slate-900/50 self-start">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Select a video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[70vh] overflow-y-auto">
              {media.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                    selectedId === m.id ? 'bg-cyan-500/10 border border-cyan-500/40' : 'border border-transparent hover:bg-slate-800/60'
                  }`}
                >
                  <div className="h-9 w-14 shrink-0 overflow-hidden rounded bg-slate-800">
                    {m.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <span className="truncate text-sm">{m.title}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Platform</label>
                  <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                    <SelectTrigger className="bg-slate-950 border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_LIST.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Tone</label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="bg-slate-950 border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Length</label>
                  <Tabs value={length} onValueChange={(v) => setLength(v as 'short' | 'medium' | 'long')}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="short">Short</TabsTrigger>
                      <TabsTrigger value="medium">Med</TabsTrigger>
                      <TabsTrigger value="long">Long</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Niche (optional)</label>
                  <Input placeholder="fitness, tech, food…" value={niche} onChange={(e) => setNiche(e.target.value)} className="bg-slate-950 border-slate-800" />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => void generate(false)} disabled={busy || !selected}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate for {platformName(platform)}
              </Button>
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800" onClick={() => void generate(true)} disabled={busy || !selected}>
                <Sparkles className="mr-2 h-4 w-4" /> Generate for all platforms
              </Button>
              {activeGen && (
                <Button variant="outline" className="border-slate-700 hover:bg-slate-800" onClick={() => void addVariation(activeGen)} disabled={busy}>
                  <Plus className="mr-2 h-4 w-4" /> More variations
                </Button>
              )}
            </div>

            {!selected ? null : !activeGen ? (
              <Card className="border-dashed border-slate-800 bg-transparent">
                <CardContent className="py-12 text-center text-sm text-slate-500">
                  No generated content for {platformName(platform)} yet. Click Generate above.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeGen.variations.map((v, i) => (
                  <VariationCard
                    key={i}
                    index={i}
                    variation={v}
                    editing={editing}
                    setEditing={setEditing}
                    onSave={(field, value) => void saveEdit(activeGen, i, field as 'caption' | 'hook' | 'description', value)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VariationCard({
  index,
  variation,
  editing,
  setEditing,
  onSave,
}: {
  index: number;
  variation: ContentVariation;
  editing: { varIndex: number; field: 'caption' | 'hook'; value: string } | null;
  setEditing: (e: { varIndex: number; field: 'caption' | 'hook'; value: string } | null) => void;
  onSave: (field: string, value: string) => void;
}) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const isEditing = editing?.varIndex === index;

  const fullText = `${variation.hook}\n\n${variation.caption}\n\n${variation.hashtags.join(' ')}`;

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Variation {index + 1}</CardTitle>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(fullText);
              toast({ title: 'Copied to clipboard' });
            }}
          >
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Hook</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-cyan-400" onClick={() => setEditing(isEditing && editing.field === 'hook' ? null : { varIndex: index, field: 'hook', value: variation.hook })}>
              {isEditing && editing.field === 'hook' ? 'Cancel' : 'Edit'}
            </Button>
          </div>
          {isEditing && editing.field === 'hook' ? (
            <div className="flex gap-2">
              <Textarea
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                className="bg-slate-950 border-slate-800 min-h-[60px]"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                onClick={() => {
                  onSave('hook', editing.value);
                  setEditing(null);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1500);
                }}
              >
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-200">{variation.hook}</p>
          )}
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Caption</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-cyan-400" onClick={() => setEditing(isEditing && editing.field === 'caption' ? null : { varIndex: index, field: 'caption', value: variation.caption })}>
              {isEditing && editing.field === 'caption' ? 'Cancel' : 'Edit'}
            </Button>
          </div>
          {isEditing && editing.field === 'caption' ? (
            <div className="flex gap-2">
              <Textarea
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                className="bg-slate-950 border-slate-800 min-h-[80px]"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                onClick={() => {
                  onSave('caption', editing.value);
                  setEditing(null);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1500);
                }}
              >
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{variation.caption}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {variation.hashtags.map((h) => (
            <Badge key={h} variant="outline" className="border-cyan-500/30 text-cyan-300 text-xs">
              {h}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-slate-500">CTA: {variation.cta}</div>
      </CardContent>
    </Card>
  );
}
