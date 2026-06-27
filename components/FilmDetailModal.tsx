'use client';

import React, { useEffect, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import StarRating from './StarRating';
import SharePanel from './SharePanel';

export type FeedFilm = {
  id: string;
  title: string;
  logline: string;
  creator?: string;
  creatorUsername?: string;
  creatorId?: string;
  likeCount?: number;
  commentCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  publishedAt?: string;
  project?: { previewClip?: string; type?: string; clipCount?: number } | null;
};

type FilmDetailModalProps = {
  film: FeedFilm | null;
  token: string | null;
  currentUserId?: string;
  onClose: () => void;
  onAuthRequired: () => void;
  onMessageCreator: (userId: string, username: string) => void;
  onUpdate: (film: Partial<FeedFilm> & { id: string }) => void;
};

type Comment = {
  id: string;
  username: string;
  content: string;
  createdAt: string;
  replies?: Comment[];
};

export default function FilmDetailModal({
  film,
  token,
  currentUserId,
  onClose,
  onAuthRequired,
  onMessageCreator,
  onUpdate,
}: FilmDetailModalProps) {
  const [userRating, setUserRating] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (!film) return;
    setUserRating(null);
    setComments([]);
    setNewComment('');
    setReplyTo(null);

    if (token) {
      fetch(`/api/feed/rate?feedItemId=${film.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setUserRating(d.score))
        .catch(() => {});
    }

    loadComments();
  }, [film?.id, token]);

  async function loadComments() {
    if (!film) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/feed/comments?feedItemId=${film.id}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.items || []);
      }
    } finally {
      setLoadingComments(false);
    }
  }

  async function submitRating(score: number) {
    if (!token) { onAuthRequired(); return; }
    const res = await fetch('/api/feed/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ feedItemId: film!.id, score }),
    });
    if (!res.ok) {
      toast.error('Could not save rating');
      return;
    }
    const data = await res.json();
    setUserRating(score);
    onUpdate({ id: film!.id, ratingAvg: data.ratingAvg, ratingCount: data.ratingCount });
    toast.success('Rating saved');
  }

  async function submitComment(parentId?: string) {
    if (!token) { onAuthRequired(); return; }
    if (!newComment.trim()) return;

    const res = await fetch('/api/feed/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ feedItemId: film!.id, content: newComment.trim(), parentId }),
    });
    if (!res.ok) {
      toast.error('Could not post comment');
      return;
    }
    setNewComment('');
    setReplyTo(null);
    await loadComments();
    if (!parentId) {
      onUpdate({ id: film!.id, commentCount: (film!.commentCount || 0) + 1 });
    }
    toast.success(parentId ? 'Reply posted' : 'Comment posted');
  }

  if (!film) return null;

  const creator = film.creator || film.creatorUsername || 'creator';

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-6">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-6 py-4">
          <div>
            <div className="text-xs text-white/50">@{creator}</div>
            <div className="font-display text-2xl tracking-tight">{film.title}</div>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {film.project?.previewClip && (
            <video src={film.project.previewClip} controls className="w-full rounded-2xl aspect-video bg-black" />
          )}

          <p className="text-white/80 leading-relaxed">{film.logline}</p>

          <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-[#111] border border-white/10">
            <div>
              <div className="text-xs text-white/50 mb-1">COMMUNITY RATING</div>
              <StarRating
                value={userRating ?? film.ratingAvg ?? 0}
                onChange={submitRating}
                readonly={!token}
              />
              <div className="text-xs text-white/40 mt-1">
                {film.ratingCount ? `${film.ratingCount} ratings` : 'Be the first to rate'}
              </div>
            </div>
            {film.creatorId && currentUserId && film.creatorId !== currentUserId && (
              <button
                onClick={() => onMessageCreator(film.creatorId!, creator)}
                className="btn-outline px-4 py-2 rounded-xl text-sm flex items-center gap-2 ml-auto"
              >
                <MessageCircle className="w-4 h-4" /> Message @{creator}
              </button>
            )}
          </div>

          <SharePanel
            title={film.title}
            logline={film.logline}
            feedItemId={film.id}
            projectType={film.project?.type}
          />

          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-3">
              Discussion {film.commentCount ? `(${film.commentCount})` : ''}
            </div>

            {token ? (
              <div className="mb-4 flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitComment(replyTo || undefined)}
                  placeholder={replyTo ? 'Write a reply…' : 'Join the discussion…'}
                  className="director-input flex-1 px-4 py-3 rounded-xl text-sm"
                />
                <button onClick={() => submitComment(replyTo || undefined)} className="btn-gold px-5 rounded-xl text-sm text-black">
                  Post
                </button>
                {replyTo && (
                  <button onClick={() => setReplyTo(null)} className="text-xs text-white/50">Cancel reply</button>
                )}
              </div>
            ) : (
              <button onClick={onAuthRequired} className="btn-outline w-full py-3 rounded-xl text-sm mb-4">
                Sign in to join the discussion
              </button>
            )}

            {loadingComments ? (
              <div className="text-white/50 text-sm">Loading comments…</div>
            ) : comments.length === 0 ? (
              <div className="text-white/50 text-sm py-4 text-center border border-dashed border-white/10 rounded-xl">
                No comments yet. Start the conversation.
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-black/40 border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-[var(--gold)]">@{c.username}</span>
                      <span className="text-[10px] text-white/40">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-white/80">{c.content}</p>
                    {token && (
                      <button onClick={() => setReplyTo(c.id)} className="text-xs text-white/40 mt-2 hover:text-white">
                        Reply
                      </button>
                    )}
                    {c.replies?.map((r) => (
                      <div key={r.id} className="mt-3 ml-4 pl-3 border-l border-white/10">
                        <span className="text-xs font-semibold text-white/70">@{r.username}</span>
                        <p className="text-sm text-white/70">{r.content}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}