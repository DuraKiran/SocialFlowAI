'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPosts, getMediaFiles, retryPost, removePost, statusLabel } from '@/lib/store';
import { platformName, PLATFORMS } from '@/lib/platforms';
import type { MediaFile, Post } from '@/lib/types';
import { PostStatusBadge } from '@/app/dashboard/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RotateCcw, Trash2, Send, ExternalLink, AlertCircle } from 'lucide-react';

export default function PublishedPostsPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    const [p, m] = await Promise.all([getPosts(session.workspaceId), getMediaFiles(session.workspaceId)]);
    setPosts(p.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setMedia(m);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function doRetry(post: Post) {
    setRetrying(post.id);
    try {
      await retryPost(post);
      await refresh();
      const updated = await getPosts(session!.workspaceId);
      const after = updated.find((u) => u.id === post.id);
      if (after?.status === 'published') {
        toast({ title: 'Published', description: `${platformName(post.platform)} job completed.` });
      } else {
        toast({
          title: 'Retry attempted',
          description: after?.lastError ?? 'The job could not complete — see its status for details.',
          variant: 'destructive',
        });
      }
    } finally {
      setRetrying(null);
    }
  }

  const filtered = posts.filter((p) => {
    if (filter !== 'all') {
      if (filter === 'attention' && !(p.status === 'failed' || p.status === 'requires_manual_action')) return false;
      if (filter === 'published' && p.status !== 'published') return false;
      if (filter === 'scheduled' && !(p.status === 'pending' && p.publishMode === 'scheduled')) return false;
      if (filter === 'processing' && !['pending', 'preparing', 'uploading', 'processing'].includes(p.status)) return false;
    }
    if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
    if (query) {
      const m = media.find((mf) => mf.id === p.mediaFileId);
      if (!(m?.title ?? '').toLowerCase().includes(query.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Published Posts</h1>
        <p className="text-sm text-slate-400">Every publishing job, tracked individually per platform.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="processing">In progress</SelectItem>
            <SelectItem value="attention">Needs attention</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {Object.values(PLATFORMS).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Search by video title" value={query} onChange={(e) => setQuery(e.target.value)} className="w-56 bg-slate-900 border-slate-800" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Send className="h-10 w-10 text-slate-600" />
            <p className="text-slate-300">No publishing jobs match.</p>
            <Button asChild variant="outline" className="border-slate-700 hover:bg-slate-800">
              <Link href="/dashboard/publish">Create a post</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-800 bg-slate-900/50">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Video</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const m = media.find((mf) => mf.id === p.mediaFileId);
                const canRetry = p.status === 'failed' || p.status === 'requires_manual_action';
                return (
                  <TableRow key={p.id} className="border-slate-800">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-14 shrink-0 overflow-hidden rounded bg-slate-800">
                          {m?.thumbnailDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 max-w-[220px]">
                          <div className="truncate text-sm font-medium">{m?.title ?? 'Video'}</div>
                          {p.lastError && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-400">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span className="truncate">{p.lastError}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-700" >
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: PLATFORMS[p.platform].color }} />
                        {platformName(p.platform)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PostStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {p.publishedAt
                        ? `Published ${new Date(p.publishedAt).toLocaleString()}`
                        : p.scheduledAt
                          ? `Scheduled ${new Date(p.scheduledAt).toLocaleString()}`
                          : `Created ${new Date(p.createdAt).toLocaleString()}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.status === 'published' && p.externalUrl && (
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                            <a href={p.externalUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {canRetry && (
                          <Button variant="outline" size="sm" className="h-8 border-slate-700 text-xs" disabled={retrying === p.id} onClick={() => void doRetry(p)}>
                            {retrying === p.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                            Retry
                          </Button>
                        )}
                        {(p.status === 'pending' || p.status === 'draft') && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={async () => { await removePost(p.id); await refresh(); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
