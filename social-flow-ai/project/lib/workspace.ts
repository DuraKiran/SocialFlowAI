'use client';

import { useEffect, useState } from 'react';
import { getAll, getRecord, getByIndex } from './db';
import type { MediaFile, Post, Workspace } from './types';

export async function loadWorkspace(workspaceId: string): Promise<Workspace | undefined> {
  return getRecord<Workspace>('workspaces', workspaceId);
}

export async function workspaceName(workspaceId: string): Promise<string> {
  const ws = await loadWorkspace(workspaceId);
  return ws?.name ?? 'Workspace';
}

export async function workspaceStats(workspaceId: string) {
  const [media, posts] = await Promise.all([
    getByIndex<MediaFile>('media_files', 'workspaceId', workspaceId),
    getByIndex<Post>('posts', 'workspaceId', workspaceId),
  ]);
  return {
    mediaCount: media.length,
    postCount: posts.length,
    published: posts.filter((p) => p.status === 'published').length,
    scheduled: posts.filter((p) => p.status === 'pending' && p.publishMode === 'scheduled').length,
    failed: posts.filter((p) => p.status === 'failed' || p.status === 'requires_manual_action').length,
  };
}

export { getAll };
