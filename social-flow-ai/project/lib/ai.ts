import type { ContentVariation, Platform } from './types';

export interface AiRequest {
  videoTitle: string;
  videoTopic?: string;
  platform: Platform;
  tone: string;
  length: 'short' | 'medium' | 'long';
  language: string;
  audience?: string;
  niche?: string;
  hashtagCount: number;
  variationCount: number;
}

const TONE_OPENERS: Record<string, string[]> = {
  professional: ['Here is what matters about', 'A clear look at', 'Breaking down'],
  casual: ['Okay so', 'You have to see', 'Quick one —'],
  funny: ['Nobody asked for this but', 'Plot twist:', 'This went sideways when'],
  educational: ['How this actually works:', 'In 60 seconds:', 'Learn why'],
  entertaining: ['Wait for it —', 'You are not ready for', 'Best minute of your day:'],
  dramatic: ['Everything changed when', 'This is not what it looks like.', 'The moment it happened:'],
};

const PLATFORM_CTAS: Record<Platform, string[]> = {
  youtube: ['Subscribe for the full breakdown.', 'Watch until the end — it pays off.', 'Full video on the channel.'],
  facebook: ['What do you think? Tell us in the comments.', 'Tag someone who needs to see this.', 'Share your take below.'],
  instagram: ['Save this for later.', 'Which one are you? Comment below.', 'Double tap if you agree.'],
  tiktok: ['Follow for part two.', 'Duet this with your version.', 'Comment your take.'],
  linkedin: ['What has your experience been?', 'Would love your perspective in the comments.', 'Repost if this resonates.'],
  twitter: ['Thoughts?', 'Retweet if you have felt this.', 'Thread incoming — follow.'],
  pinterest: ['Pin this to your board.', 'Save it for your next project.', 'Find more on the board.'],
};

const PLATFORM_HASHTAGS: Record<Platform, string[]> = {
  youtube: ['#youtube', '#tutorial', '#howto'],
  facebook: ['#facebook', '#community', '#viral'],
  instagram: ['#reels', '#instadaily', '#explore', '#viral'],
  tiktok: ['#fyp', '#foryou', '#tiktok', '#viral'],
  linkedin: ['#professional', '#industry', '#growth', '#leadership'],
  twitter: ['#trending', '#nowplaying'],
  pinterest: ['#pinterest', '#inspo', '#diy'],
};

const NICHE_TAGS: Record<string, string[]> = {
  fitness: ['#fitness', '#workout', '#health'],
  food: ['#foodie', '#recipe', '#cooking'],
  tech: ['#tech', '#gadgets', '#ai'],
  travel: ['#travel', '#wanderlust', '#destination'],
  business: ['#business', '#entrepreneur', '#marketing'],
  fashion: ['#fashion', '#style', '#outfit'],
  education: ['#learning', '#knowledge', '#tips'],
  entertainment: ['#fun', '#entertainment', '#creator'],
};

function topicWords(req: AiRequest): string[] {
  const source = `${req.videoTopic || ''} ${req.videoTitle}`.toLowerCase();
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'my', 'this', 'that', 'is', 'it']);
  return source
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w))
    .slice(0, 6);
}

function buildHashtags(req: AiRequest): string[] {
  const base = [...PLATFORM_HASHTAGS[req.platform]];
  if (req.niche && NICHE_TAGS[req.niche]) base.unshift(...NICHE_TAGS[req.niche]);
  const words = topicWords(req).map((w) => `#${w.replace(/[^a-z0-9]/g, '')}`);
  const pool = [...new Set([...words, ...base])];
  return pool.slice(0, Math.max(1, req.hashtagCount));
}

function lengthProfile(length: 'short' | 'medium' | 'long'): number {
  return length === 'short' ? 1 : length === 'long' ? 3 : 2;
}

export function generateVariation(req: AiRequest, index: number): ContentVariation {
  const openers = TONE_OPENERS[req.tone] ?? TONE_OPENERS.professional;
  const opener = openers[index % openers.length];
  const topic = req.videoTopic?.trim() || topicWords(req).slice(0, 4).join(' ') || 'this';
  const hashtags = buildHashtags(req);
  const cta = PLATFORM_CTAS[req.platform][index % PLATFORM_CTAS[req.platform].length];
  const n = lengthProfile(req.length);

  const hooks = [
    `The one thing nobody tells you about ${topic}`,
    `${topic.charAt(0).toUpperCase()}${topic.slice(1)} — but not how you expect`,
    `I tried ${topic} so you do not have to`,
  ];
  const hook = hooks[index % hooks.length];

  let caption = `${opener} ${topic}.`;
  if (n >= 2) caption += ` ${hook}.`;
  if (n >= 3) caption += ` Full story in the video — no shortcuts, just what worked and what did not.`;

  const description =
    req.platform === 'youtube' || req.platform === 'pinterest'
      ? `A closer look at ${topic}. In this video we cover the essentials of ${topic}, what to watch out for, and the key takeaways. ${cta}`
      : caption;

  return { hook, caption, description, hashtags, cta };
}

export function generateContent(req: AiRequest): ContentVariation[] {
  const out: ContentVariation[] = [];
  for (let i = 0; i < Math.max(1, req.variationCount); i++) {
    out.push(generateVariation(req, i));
  }
  return out;
}

export function toYouTubeTags(variation: ContentVariation): string {
  return [...variation.hashtags.map((h) => h.replace('#', '')), ...topicWords({ ...({ videoTitle: variation.caption } as AiRequest) })].slice(0, 10).join(', ');
}
