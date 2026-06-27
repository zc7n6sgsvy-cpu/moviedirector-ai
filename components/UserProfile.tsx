'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle, Share2, Film, Users } from 'lucide-react';
import { toast } from 'sonner';
import StarRating from './StarRating';
import SharePanel from './SharePanel';
import type { FeedFilm } from './FilmDetailModal';

export type ProfileData = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  isOwnProfile?: boolean;
  stats: { films: number; avgRating: number; totalSubscribers: number };
  films: FeedFilm[];
  channels: {
    id: string;
    name: string;
    description: string;
    price: number;
    subscriberCount: number;
    isSubscribed: boolean;
    episodes: { id: string; title: string; type: string; logline: string }[];
  }[];
};

type UserProfileProps = {
  username: string;
  token: string | null;
  currentUserId?: string;
  onBack?: () => void;
  onOpenFilm: (film: FeedFilm) => void;
  onMessage: (userId: string, username: string) => void;
  onAuthRequired: () => void;
  onEditProfile?: () => void;
};

export default function UserProfile({
  username,
  token,
  currentUserId,
  onBack,
  onOpenFilm,
  onMessage,
  onAuthRequired,
  onEditProfile,
}: UserProfileProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editBio, setEditBio] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${username}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProfile(data);
        setEditBio(data.bio || '');
        setEditDisplayName(data.displayName || data.username);
      })
      .catch(() => toast.error('Profile not found'))
      .finally(() => setLoading(false));
  }, [username, token]);

  async function toggleSubscribe(channelId: string) {
    if (!token) { onAuthRequired(); return; }
    const res = await fetch('/api/channels/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channelId }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setProfile((prev) => prev ? {
      ...prev,
      channels: prev.channels.map((c) =>
        c.id === channelId
          ? { ...c, isSubscribed: data.subscribed, subscriberCount: data.subscriberCount }
          : c
      ),
      stats: {
        ...prev.stats,
        totalSubscribers: prev.channels.reduce((a, c) =>
          a + (c.id === channelId ? data.subscriberCount : c.subscriberCount), 0
        ),
      },
    } : prev);
    toast.success(data.subscribed ? 'Subscribed!' : 'Unsubscribed');
  }

  async function saveProfile() {
    if (!token) return;
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ displayName: editDisplayName, bio: editBio }),
    });
    if (res.ok) {
      const data = await res.json();
      setProfile((prev) => prev ? { ...prev, displayName: data.displayName, bio: data.bio } : prev);
      setEditing(false);
      toast.success('Profile updated');
    }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-8 py-20 text-center text-white/50">Loading profile…</div>;
  }
  if (!profile) {
    return <div className="max-w-4xl mx-auto px-8 py-20 text-center text-white/50">User not found</div>;
  }

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/u/${profile.username}` : '';

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      {onBack && (
        <button onClick={onBack} className="text-sm text-white/50 hover:text-white mb-6">← Back</button>
      )}

      <div className="director-card p-8 rounded-3xl mb-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-20 h-20 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/40 flex items-center justify-center text-3xl font-display text-[var(--gold)]">
            {(profile.displayName || profile.username)[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3 mb-4">
                <input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="director-input w-full px-4 py-2 rounded-xl text-xl" placeholder="Display name" />
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="director-input w-full px-4 py-3 rounded-xl text-sm" rows={3} placeholder="Bio — tell viewers about your series…" />
                <div className="flex gap-2">
                  <button onClick={saveProfile} className="btn-gold px-5 py-2 rounded-xl text-sm text-black">Save</button>
                  <button onClick={() => setEditing(false)} className="btn-outline px-5 py-2 rounded-xl text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="font-display text-4xl tracking-tight">{profile.displayName}</h1>
                <div className="text-[var(--gold)] text-sm">@{profile.username}</div>
                {profile.bio && <p className="text-white/70 mt-3 max-w-xl">{profile.bio}</p>}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.isOwnProfile ? (
              <button onClick={() => setEditing(true)} className="btn-outline px-5 py-2 rounded-xl text-sm">Edit profile</button>
            ) : currentUserId && (
              <button onClick={() => onMessage(profile.id, profile.username)} className="btn-gold px-5 py-2 rounded-xl text-sm text-black flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            )}
            <button
              onClick={() => { navigator.clipboard.writeText(profileUrl); toast.success('Profile link copied'); }}
              className="btn-outline px-5 py-2 rounded-xl text-sm flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Share profile
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-8 mt-6 pt-6 border-t border-white/10 text-sm">
          <div><span className="font-mono text-xl text-[var(--gold)]">{profile.stats.films}</span><div className="text-white/50 text-xs">Films</div></div>
          <div><span className="font-mono text-xl">{profile.stats.avgRating || '—'}</span><div className="text-white/50 text-xs">Avg rating</div></div>
          <div><span className="font-mono text-xl">{profile.stats.totalSubscribers}</span><div className="text-white/50 text-xs">Subscribers</div></div>
        </div>
      </div>

      {profile.channels.length > 0 && (
        <div className="mb-10">
          <div className="uppercase tracking-widest text-xs text-[var(--gold)] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Production series
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {profile.channels.map((ch) => (
              <div key={ch.id} className="director-card p-6 rounded-3xl">
                <div className="font-display text-2xl tracking-tight">{ch.name}</div>
                <div className="text-sm text-white/50 mt-1">Beta — free • {ch.subscriberCount} subscribers • {ch.episodes.length} episodes</div>
                <p className="text-white/70 text-sm mt-3">{ch.description}</p>
                {ch.episodes.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {ch.episodes.map((ep) => (
                      <div key={ep.id} className="text-xs text-white/60 py-1 border-b border-white/5">
                        {ep.title} <span className="text-white/30">• {ep.type}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!profile.isOwnProfile && (
                  <button
                    onClick={() => toggleSubscribe(ch.id)}
                    className={`mt-4 w-full py-2.5 rounded-xl text-sm ${ch.isSubscribed ? 'btn-outline' : 'btn-gold text-black'}`}
                  >
                    {ch.isSubscribed ? 'Subscribed ✓' : 'Subscribe — Beta, free'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="uppercase tracking-widest text-xs text-white/50 mb-4 flex items-center gap-2">
          <Film className="w-4 h-4" /> Published films
        </div>
        {profile.films.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl text-white/50">
            {profile.isOwnProfile ? 'Publish your first film to the Feed' : 'No published films yet'}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {profile.films.map((film) => (
              <button
                key={film.id}
                onClick={() => onOpenFilm(film)}
                className="director-card p-5 rounded-2xl text-left hover:border-[var(--gold)]/40 transition-colors"
              >
                <div className="font-display text-xl tracking-tight">{film.title}</div>
                <p className="text-sm text-white/60 mt-1 line-clamp-2">{film.logline}</p>
                <div className="mt-2">
                  <StarRating value={film.ratingAvg || 0} readonly size="sm" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {profile.isOwnProfile && profile.films[0] && (
        <div className="mt-10 director-card p-6 rounded-3xl">
          <SharePanel title={profile.films[0].title} logline={profile.films[0].logline} feedItemId={profile.films[0].id} />
        </div>
      )}
    </div>
  );
}