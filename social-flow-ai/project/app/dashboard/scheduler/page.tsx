'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getMediaFiles, getSocialAccounts, getGenerationsForMedia, savePost, notify, saveGeneration } from '@/lib/store';
import { generateContent } from '@/lib/ai';
import { distributeSlots, formatSlot } from '@/lib/scheduling';
import { PLATFORM_LIST, PLATFORMS, platformName } from '@/lib/platforms';
import type { MediaFile, Platform, Post, SocialAccount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, CalendarRange, Sparkles, AlertCircle, CalendarClock, ArrowLeft, Check } from 'lucide-react';

interface PlanRow {
  mediaId: string;
  title: string;
  thumbnail?: string;
  platforms: Platform[];
  when: Date;
}

export default function SchedulerPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [media, setMedia] = useState<MediaFile[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set());
  const [perDay, setPerDay] = useState(2);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [time1, setTime1] = useState('10:00');
  const [time2, setTime2] = useState('17:00');
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [mode, setMode] = useState<'daily' | 'smart'>('daily');
  const [autoAi, setAutoAi] = useState(true);
  const [step, setStep] = useState<'setup' | 'review'>('setup');
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      const [m, a] = await Promise.all([getMediaFiles(session.workspaceId), getSocialAccounts(session.workspaceId)]);
      setMedia(m);
      setAccounts(a);
      // preselect the 12 most recent
      setSelected(new Set(m.slice(0, 12).map((x) => x.id)));
    })();
  }, [session]);

  const selectedMedia = useMemo(() => media.filter((m) => selected.has(m.id)), [media, selected]);
  const totalJobs = selectedMedia.length * Math.max(platforms.size, 0);

  function buildPlan(): PlanRow[] {
    const times = mode === 'smart' ? [time1, time2] : [time1];
    const slots = distributeSlots({
      videoCount: selectedMedia.length,
      startDate: new Date(`${startDate}T00:00:00`),
      perDay: mode === 'smart' ? 2 : perDay,
      timeSlots: times,
      weekdaysOnly,
      mode,
    });
    const rows: PlanRow[] = [];
    selectedMedia.forEach((m, i) => {
      const slot = slots[i] ?? slots[slots.length - 1];
      rows.push({
        mediaId: m.id,
        title: m.title,
        thumbnail: m.thumbnailDataUrl,
        platforms: Array.from(platforms),
        when: slot?.date ?? new Date(),
      });
    });
    return rows.sort((a, b) => a.when.getTime() - b.when.getTime());
  }

  async function confirm() {
    if (!session) return;
    setBusy(true);
    try {
      for (const row of plan) {
        for (const p of row.platforms) {
          const acct = accounts.find((a) => a.platform === p);
          let caption = '';
          let title = '';
          let hashtags = '';
          if (autoAi) {
            const existing = await getGenerationsForMedia(row.mediaId);
            const gen = existing.find((g) => g.platform === p);
            if (gen?.variations[0]) {
              caption = gen.variations[0].caption;
              title = gen.variations[0].hook;
              hashtags = gen.variations[0].hashtags.join(' ');
            } else {
              const m = media.find((x) => x.id === row.mediaId);
              const v = generateContent({
                videoTitle: m?.title ?? row.title,
                platform: p,
                tone: 'casual',
                length: 'medium',
                language: 'English',
                hashtagCount: 6,
                variationCount: 1,
              })[0];
              caption = v.caption;
              title = v.hook;
              hashtags = v.hashtags.join(' ');
              await saveGeneration({
                id: crypto.randomUUID(),
                workspaceId: session.workspaceId,
                mediaFileId: row.mediaId,
                platform: p,
                tone: 'casual',
                lengthPref: 'medium',
                language: 'English',
                variations: [v],
                isTemplate: false,
                createdAt: new Date().toISOString(),
              });
            }
          }
          const post: Post = {
            id: crypto.randomUUID(),
            workspaceId: session.workspaceId,
            mediaFileId: row.mediaId,
            socialAccountId: acct?.id ?? null,
            platform: p,
            caption,
            title,
            description: '',
            hashtags,
            privacy: 'public',
            status: 'pending',
            publishMode: 'scheduled',
            scheduledAt: row.when.toISOString(),
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
      await notify(
        session.workspaceId,
        session.userId,
        'bulk_scheduled',
        'Bulk schedule confirmed',
        `${plan.length} video(s) scheduled across ${plan.reduce((a, r) => a + r.platforms.length, 0)} platform job(s).`
      );
      toast({ title: 'Schedule confirmed', description: `${plan.length} videos scheduled. View them on the calendar.` });
      router.push('/dashboard/calendar');
    } finally {
      setBusy(false);
    }
  }

  const previewPlan = step === 'setup' && selectedMedia.length > 0 && platforms.size > 0 ? buildPlan() : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bulk Scheduler</h1>
          <p className="text-sm text-slate-400">Distribute dozens of videos across platforms and time slots automatically.</p>
        </div>
        {step === 'review' && (
          <Button variant="outline" className="border-slate-700 hover:bg-slate-800" onClick={() => setStep('setup')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to setup
          </Button>
        )}
      </div>

      {step === 'setup' ? (
        <>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm text-slate-400">1 · Select videos ({selected.size})</CardTitle></CardHeader>
            <CardContent>
              {media.length === 0 ? (
                <p className="py-4 text-sm text-slate-400">No videos yet — <Link href="/dashboard/bulk-upload" className="text-cyan-400">upload some first</Link>.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-72 overflow-y-auto">
                  {media.map((m) => (
                    <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors ${selected.has(m.id) ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-700'}`}>
                      <Checkbox
                        checked={selected.has(m.id)}
                        onCheckedChange={(c) => {
                          const next = new Set(selected);
                          if (c) next.add(m.id);
                          else next.delete(m.id);
                          setSelected(next);
                        }}
                      />
                      <div className="h-8 w-12 shrink-0 overflow-hidden rounded bg-slate-800">
                        {m.thumbnailDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <span className="truncate text-xs">{m.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm text-slate-400">2 · Platforms</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {PLATFORM_LIST.map((p) => (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${platforms.has(p.id) ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-700'}`}>
                    <Checkbox
                      checked={platforms.has(p.id)}
                      onCheckedChange={(c) => {
                        const next = new Set(platforms);
                        if (c) next.add(p.id);
                        else next.delete(p.id);
                        setPlatforms(next);
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {accounts.some((a) => a.platform === p.id) ? 'Account ready' : 'Will need account setup'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm text-slate-400">3 · Schedule shape</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-950 border-slate-800" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Method</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as 'daily' | 'smart')}>
                  <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily — {perDay} per day, one time slot</SelectItem>
                    <SelectItem value="smart">Smart slots — two publishing windows per day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{mode === 'smart' ? 'Morning slot' : 'Posting time'}</Label>
                <Input type="time" value={time1} onChange={(e) => setTime1(e.target.value)} className="bg-slate-950 border-slate-800" />
              </div>
              {mode === 'smart' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Evening slot</Label>
                  <Input type="time" value={time2} onChange={(e) => setTime2(e.target.value)} className="bg-slate-950 border-slate-800" />
                </div>
              )}
              {mode === 'daily' && (
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs">Videos per day: <span className="text-cyan-300 font-medium">{perDay}</span></Label>
                  <Slider value={[perDay]} min={1} max={10} step={1} onValueChange={(v) => setPerDay(v[0])} className="max-w-xs" />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={weekdaysOnly} onCheckedChange={(c) => setWeekdaysOnly(!!c)} />
                Weekdays only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={autoAi} onCheckedChange={(c) => setAutoAi(!!c)} />
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Auto-generate AI captions for videos missing them
              </label>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {selectedMedia.length} video(s) × {platforms.size} platform(s) = <span className="font-semibold text-cyan-300">{totalJobs} publishing jobs</span>
              {previewPlan.length > 0 && <> · first slot {formatSlot(previewPlan[0].when)}</>}
            </p>
            <Button
              size="lg"
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              disabled={selectedMedia.length === 0 || platforms.size === 0}
              onClick={() => { setPlan(buildPlan()); setStep('review'); }}
            >
              <CalendarRange className="mr-2 h-4 w-4" /> Review schedule
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400">Review · {plan.length} videos, scheduled in order</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead>Video</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead>Publication time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.map((row, i) => (
                    <TableRow key={row.mediaId} className="border-slate-800">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-5">#{i + 1}</span>
                          <div className="h-8 w-12 shrink-0 overflow-hidden rounded bg-slate-800">
                            {row.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={row.thumbnail} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <span className="text-sm">{row.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.platforms.map((p) => (
                            <Badge key={p} variant="outline" className="border-slate-700 text-xs">
                              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: PLATFORMS[p].color }} />
                              {platformName(p)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-300">
                        <CalendarClock className="mr-1.5 inline h-3.5 w-3.5 text-cyan-400" />
                        {formatSlot(row.when)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Jobs run independently per platform — one failure never blocks the batch. Accounts without live credentials will show &quot;Requires manual action&quot;.
            </p>
            <Button size="lg" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400" onClick={() => void confirm()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Confirm schedule ({plan.length * plan[0]?.platforms.length ?? 0} jobs)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
