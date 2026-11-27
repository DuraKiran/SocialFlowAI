import type { Platform } from './types';

export interface PlatformMeta {
  id: Platform;
  name: string;
  color: string;
  requiresOAuth: boolean;
  approvalNote?: string;
  supports: {
    video: boolean;
    title: boolean;
    description: boolean;
    hashtags: boolean;
    privacy: boolean;
    schedule: boolean;
    analytics: string[];
  };
}

export const PLATFORMS: Record<Platform, PlatformMeta> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    color: '#FF0000',
    requiresOAuth: true,
    supports: {
      video: true,
      title: true,
      description: true,
      hashtags: true,
      privacy: true,
      schedule: true,
      analytics: ['views', 'likes', 'comments', 'shares', 'impressions', 'watchTime'],
    },
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    requiresOAuth: true,
    supports: {
      video: true,
      title: false,
      description: true,
      hashtags: true,
      privacy: true,
      schedule: true,
      analytics: ['views', 'likes', 'comments', 'shares', 'reach'],
    },
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    color: '#E4405F',
    requiresOAuth: true,
    supports: {
      video: true,
      title: false,
      description: true,
      hashtags: true,
      privacy: false,
      schedule: false,
      analytics: ['views', 'likes', 'comments', 'shares', 'reach', 'saves'],
    },
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    color: '#000000',
    requiresOAuth: true,
    approvalNote:
      'Direct publishing requires TikTok developer approval. Without it, posts land as drafts in the TikTok inbox and require manual action.',
    supports: {
      video: true,
      title: false,
      description: true,
      hashtags: true,
      privacy: true,
      schedule: false,
      analytics: ['views', 'likes', 'comments', 'shares'],
    },
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    color: '#0A66C2',
    requiresOAuth: true,
    supports: {
      video: true,
      title: false,
      description: true,
      hashtags: true,
      privacy: true,
      schedule: false,
      analytics: ['views', 'likes', 'comments', 'shares'],
    },
  },
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    color: '#1D9BF0',
    requiresOAuth: true,
    supports: {
      video: true,
      title: false,
      description: true,
      hashtags: true,
      privacy: false,
      schedule: false,
      analytics: ['views', 'likes', 'comments', 'shares', 'impressions'],
    },
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    color: '#BD081C',
    requiresOAuth: true,
    supports: {
      video: true,
      title: true,
      description: true,
      hashtags: true,
      privacy: false,
      schedule: false,
      analytics: ['views', 'likes', 'comments', 'impressions'],
    },
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

export function platformName(id: Platform): string {
  return PLATFORMS[id]?.name ?? id;
}

export function platformColor(id: Platform): string {
  return PLATFORMS[id]?.color ?? '#666666';
}
