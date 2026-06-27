'use client';

import React from 'react';
import { Share2, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { copySharePack, filmShareUrl, openPlatformShare } from '@/lib/social-share';

type SharePanelProps = {
  title: string;
  logline: string;
  feedItemId?: string;
  projectType?: string;
};

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', hint: 'Copy caption → paste in app' },
  { id: 'reels', label: 'Reels', hint: 'Copy caption → paste in app' },
  { id: 'shorts', label: 'Shorts', hint: 'Copy caption → paste in app' },
  { id: 'x', label: 'X', hint: 'Opens share window' },
  { id: 'linkedin', label: 'LinkedIn', hint: 'Opens share window' },
  { id: 'yt', label: 'YouTube', hint: 'Copy full pack' },
];

function buildCaption(title: string, logline: string, platform: string) {
  const hook = logline.slice(0, 100);
  const lines: Record<string, string> = {
    tiktok: `New episode drop: "${title}" — ${hook} Full series on MovieDirector.ai`,
    reels: `"${title}" — my latest personal brand film. ${hook}`,
    shorts: `I made a film with AI: "${title}". ${hook}`,
    x: `Just dropped "${title}" — ${hook}`,
    linkedin: `Personal brand cinema: "${title}". ${hook}`,
    yt: `"${title}" — Full AI film. ${hook}`,
  };
  return lines[platform] || `"${title}" — ${hook}`;
}

export default function SharePanel({ title, logline, feedItemId, projectType }: SharePanelProps) {
  const shareUrl = feedItemId ? filmShareUrl(feedItemId) : typeof window !== 'undefined' ? window.location.href : '';

  async function handleShare(platform: string) {
    const caption = buildCaption(title, logline, platform);
    if (platform === 'x' || platform === 'linkedin') {
      openPlatformShare(platform, { title, caption, url: shareUrl });
      toast.success(`Opening ${platform === 'x' ? 'X' : 'LinkedIn'} share`);
      return;
    }
    await copySharePack(caption, shareUrl);
    toast.success(`${PLATFORMS.find(p => p.id === platform)?.label} pack copied — paste in the app`);
  }

  async function handleNativeShare() {
    const caption = buildCaption(title, logline, 'x');
    if (navigator.share) {
      try {
        await navigator.share({ title, text: caption, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }
    await copySharePack(caption, shareUrl);
    toast.success('Share pack copied to clipboard');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/50">
        <Share2 className="w-3.5 h-3.5" /> Share your series
        {projectType && <span className="text-[var(--gold)]">• {projectType}</span>}
      </div>

      <button
        onClick={handleNativeShare}
        className="btn-gold w-full py-3 rounded-2xl text-sm text-black flex items-center justify-center gap-2"
      >
        <Share2 className="w-4 h-4" /> Share to social media
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => handleShare(p.id)}
            className="btn-outline py-2.5 px-3 rounded-xl text-xs text-left hover:border-[var(--gold)]"
          >
            <div className="font-semibold">{p.label}</div>
            <div className="text-white/40 mt-0.5">{p.hint}</div>
          </button>
        ))}
      </div>

      <button
        onClick={async () => {
          await navigator.clipboard.writeText(shareUrl);
          toast.success('Link copied');
        }}
        className="flex items-center gap-2 text-xs text-white/50 hover:text-white"
      >
        <Copy className="w-3 h-3" /> Copy film link
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
}