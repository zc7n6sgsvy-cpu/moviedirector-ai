'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import UserProfile from '@/components/UserProfile';
import FilmDetailModal, { type FeedFilm } from '@/components/FilmDetailModal';
import AuthModal from '@/components/AuthModal';

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [selectedFilm, setSelectedFilm] = useState<FeedFilm | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    params.then((p) => setUsername(p.username));
    const savedToken = localStorage.getItem('moviedirector_token');
    const savedUser = localStorage.getItem('moviedirector_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setCurrentUser(JSON.parse(savedUser)); } catch {}
    }
  }, [params]);

  if (!username) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="MovieDirector.ai" className="h-8 w-auto" />
          <span className="font-display text-lg tracking-tight">MovieDirector.ai</span>
        </Link>
        {currentUser ? (
          <Link href="/" className="text-sm text-white/60 hover:text-white">@{currentUser.username}</Link>
        ) : (
          <button onClick={() => setShowAuth(true)} className="btn-gold px-5 py-1.5 rounded-full text-sm text-black">Join free</button>
        )}
      </header>

      <UserProfile
        username={username}
        token={token}
        currentUserId={currentUser?.id}
        onOpenFilm={(film) => setSelectedFilm(film)}
        onMessage={() => { window.location.href = '/'; }}
        onAuthRequired={() => setShowAuth(true)}
      />

      <FilmDetailModal
        film={selectedFilm}
        token={token}
        currentUserId={currentUser?.id}
        onClose={() => setSelectedFilm(null)}
        onAuthRequired={() => setShowAuth(true)}
        onMessageCreator={() => setShowAuth(true)}
        onUpdate={() => {}}
      />

      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={(data) => {
          setToken(data.token);
          setCurrentUser(data.user);
          localStorage.setItem('moviedirector_token', data.token);
          localStorage.setItem('moviedirector_user', JSON.stringify(data.user));
        }}
      />
    </div>
  );
}