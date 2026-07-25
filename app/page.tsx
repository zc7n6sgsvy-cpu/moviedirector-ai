"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Plus, Trash2, Edit3, Film, Wand2, 
  ArrowLeft, Copy, Download, Users, Zap, Globe, Share2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import AuthModal from '@/components/AuthModal';
import FilmDetailModal, { type FeedFilm } from '@/components/FilmDetailModal';
import SharePanel from '@/components/SharePanel';
import StarRating from '@/components/StarRating';
import UserProfile from '@/components/UserProfile';
import BillingPanel from '@/components/BillingPanel';
import FirstCutWalkthrough from '@/components/FirstCutWalkthrough';
import TrialOfferModal from '@/components/TrialOfferModal';
import ProductTour from '@/components/ProductTour';
import EnsembleStudio from '@/components/EnsembleStudio';
import ConceptLaboratory from '@/components/ConceptLaboratory';
import MarketingStudio from '@/components/MarketingStudio';
import CharacterConsistencyStudio from '@/components/CharacterConsistencyStudio';
import EnvironmentStudio from '@/components/EnvironmentStudio';
import BridgeScannerPanel from '@/components/BridgeScannerPanel';
import CreativeDiscoveryPanel from '@/components/CreativeDiscoveryPanel';
import { PRODUCT_TOUR_STEPS } from '@/lib/product-tour';
import { isValidObjectId } from '@/lib/ids';
import type { ProjectType, Shot, Character, StyleTemplate, Channel, Project } from '@/lib/types';
import { PROJECT_TYPES as SHARED_PROJECT_TYPES } from '@/lib/types';
import {
  DEFAULT_TREATMENTS,
  generateFramePrompt as generateFramePromptLib,
  generateVideoPrompt as generateVideoPromptLib,
  generateCharacterRefPrompt as generateCharacterRefPromptLib,
} from '@/lib/prompts';
import { estimateProjectCost } from '@/lib/cost';
import {
  mergeProjectsPreferMedia,
  extractAssetsFromProjects,
  type RecoveredAsset,
} from '@/lib/media-recovery';
import {
  imageCreditsFor,
  videoCreditsFor,
  type GenQuality,
} from '@/lib/gen-economy';
import {
  buildStrictContinuityEditPrompt,
  collectContinuityRefs,
  ensureShotContinuityBindings,
  promoteFrameToEnvPlate,
} from '@/lib/continuity-refs';
import {
  insertTransitionAfter,
  isTransitionShot,
  bridgeSeedImageUrl,
  bridgeReferenceImages,
  bridgeEditImageUrls,
  bridgeFrameReady,
  preferredBridgeCharacterIds,
} from '@/lib/transitions';
import {
  appendCharacterFact,
  insertCharacterOnAllShots,
  removeCharacterFromAllShots,
} from '@/lib/character-memory';
import { XAI_TTS_VOICES } from '@/lib/xai';
import { speechCredits } from '@/lib/plans';

const PROJECT_TYPES = SHARED_PROJECT_TYPES;

const TYPE_STYLES: Record<ProjectType, string> = {
  sitcom: 'type-sitcom',
  film: 'type-film',
  commercial: 'type-commercial',
  anime: 'type-anime',
  'brand-fusion': 'type-brand-fusion',
};

// Using centralized DEFAULT_TREATMENTS from lib/prompts.ts

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function normalizeProject(raw: Record<string, unknown>): Project {
  const id = (raw.id as string) || (raw._id as { toString?: () => string })?.toString?.() || generateId();
  return {
    ...(raw as unknown as Project),
    id,
    createdAt: (raw.createdAt as string) || new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) || new Date().toISOString(),
  };
}

function createShotsFromTreatment(rawShots: Omit<Shot, 'id'>[]): Shot[] {
  return rawShots.map((s, idx) => ({
    id: generateId(),
    ...s,
    number: idx + 1,
  }));
}

async function loadUserProjects(authToken: string) {
  try {
    const res = await fetch('/api/projects', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) return data.map((p: Record<string, unknown>) => normalizeProject(p));
    }
  } catch (e) {}
  return null;
}

async function loadChannels(authToken: string) {
  try {
    const res = await fetch('/api/channels', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

async function loadSubscriptions(authToken: string) {
  try {
    const res = await fetch('/api/channels/subscriptions', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

async function loadFeed(cursor?: string) {
  try {
    const url = cursor ? `/api/feed?cursor=${encodeURIComponent(cursor)}` : '/api/feed';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return { items: data.map((item: Record<string, unknown>) => ({
          ...item,
          id: item.id || (item._id as { toString?: () => string })?.toString?.(),
          creator: item.creator || item.creatorUsername,
        })), nextCursor: null, hasMore: false };
      }
      return {
        items: (data.items || []).map((item: Record<string, unknown>) => ({
          ...item,
          creator: item.creator || item.creatorUsername,
        })),
        nextCursor: data.nextCursor,
        hasMore: data.hasMore,
      };
    }
  } catch (e) {}
  return null;
}

async function loadConversations(authToken: string) {
  try {
    const res = await fetch('/api/messages', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
}

async function loadMessages(otherUserId: string, authToken: string) {
  try {
    const res = await fetch(`/api/messages?with=${otherUserId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? { messages: data, otherUser: { id: otherUserId, username: 'user' } } : data;
    }
  } catch (e) {}
  return { messages: [], otherUser: { id: otherUserId, username: 'user' } };
}

export default function MovieDirector() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [feed, setFeed] = useState<any[]>([]); // Public feed items
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'workspace' | 'channels' | 'ideas' | 'social' | 'feed' | 'messages' | 'profile' | 'billing'>('landing');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [showFirstCut, setShowFirstCut] = useState(false);
  const [showTrialOffer, setShowTrialOffer] = useState(false);
  const [firstCutFree, setFirstCutFree] = useState<{ images: number; videos: number } | null>(null);
  const [firstCutStatus, setFirstCutStatus] = useState<string>('not_started');
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [publicPlans, setPublicPlans] = useState<Array<{
    id: string; name: string; tagline: string; priceMonthlyUsd: number;
    monthlyCredits: number; signupCredits: number; features: string[]; highlighted?: boolean;
  }>>([]);
  const [subscribedChannels, setSubscribedChannels] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'treatment' | 'storyboard' | 'clips' | 'cast' | 'chars' | 'sets' | 'voice' | 'ads' | 'timeline' | 'publish' | 'api'>('treatment');

  // Channels modal / state
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', description: '', price: 9 });

  // New project modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    type: 'film' as ProjectType,
    concept: '',           // High-level project definition
    logline: '',
    styleHint: '',         // Quick style
    berserker: false,
  });

  // Workspace state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [showMovieRender, setShowMovieRender] = useState(false);
  const [movieRenderProgress, setMovieRenderProgress] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [activeGenJob, setActiveGenJob] = useState<{ id: string; progress: number; status: string } | null>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [likedFeedIds, setLikedFeedIds] = useState<Set<string>>(new Set());
  const [selectedFilm, setSelectedFilm] = useState<FeedFilm | null>(null);
  const [chatPartner, setChatPartner] = useState<{ id: string; username: string } | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; displayName: string }[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  /** Draft = cheap iteration; Final = publish-ready (default draft so mistakes cost less) */
  const [genQuality, setGenQuality] = useState<GenQuality>('draft');
  const genPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Public pricing catalog (no auth)
  useEffect(() => {
    fetch('/api/billing/plans')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.plans) setPublicPlans(data.plans);
      })
      .catch(() => {});
  }, []);

  // Stripe return deep-link + product tour
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (billing === 'success') {
      toast.success('Payment successful — credits / plan updated.');
      setCurrentView('billing');
      window.history.replaceState({}, '', '/');
    } else if (billing === 'canceled') {
      toast.message('Checkout canceled');
      window.history.replaceState({}, '', '/');
    } else if (billing === 'portal') {
      setCurrentView('billing');
      window.history.replaceState({}, '', '/');
    }
    if (params.get('tour') === '1' || params.get('tour') === 'true') {
      setTourOpen(true);
      setTourStep(0);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Drive app views from tour steps
  useEffect(() => {
    if (!tourOpen) return;
    const step = PRODUCT_TOUR_STEPS[tourStep];
    if (!step) return;

    if (step.view === 'workspace') {
      // Ensure a project is selected so workspace tabs render
      setProjects((prev) => {
        if (prev.length > 0) return prev;
        return [createDemoProject()];
      });
      setSelectedProjectId((id) => {
        // Will be set after projects update; also set in next tick via open
        return id;
      });
      setCurrentView('workspace');
      if (step.tab) setActiveTab(step.tab);
    } else {
      setCurrentView(step.view);
      setSelectedProjectId(null);
    }
  }, [tourOpen, tourStep]);

  // When entering workspace tour steps, force select first project
  useEffect(() => {
    if (!tourOpen) return;
    const step = PRODUCT_TOUR_STEPS[tourStep];
    if (step?.view === 'workspace' && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
      if (step.tab) setActiveTab(step.tab);
    }
    if (step?.view === 'workspace' && step.tab && selectedProjectId) {
      setActiveTab(step.tab);
    }
  }, [tourOpen, tourStep, projects, selectedProjectId]);

  function startProductTour() {
    setShowFirstCut(false);
    setShowAuthModal(false);
    setShowTrialOffer(false);
    setShowNewModal(false);
    // Ensure demo project exists for workspace tour stops
    setProjects((prev) => {
      if (prev.length > 0) return prev;
      return [createDemoProject()];
    });
    setTourStep(0);
    setTourOpen(true);
    toast.message('Product tour started', {
      description: '19 stops · Next/Back · chapter chips · Esc to exit',
    });
  }

  // Keyboard: arrow keys + Esc while tour is open
  useEffect(() => {
    if (!tourOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTourOpen(false);
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        setTourStep((i) => Math.min(PRODUCT_TOUR_STEPS.length - 1, i + 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setTourStep((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourOpen]);

  function goTourNext() {
    setTourStep((i) => Math.min(PRODUCT_TOUR_STEPS.length - 1, i + 1));
  }

  function goTourPrev() {
    setTourStep((i) => Math.max(0, i - 1));
  }

  async function refreshBilling(authToken: string) {
    try {
      const res = await fetch('/api/billing/account', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCreditBalance(data.creditBalance ?? 0);
      setUserPlan(data.plan || 'free');
      if (data.firstCut) {
        setFirstCutStatus(data.firstCut.status || 'not_started');
        setFirstCutFree({
          images: data.firstCut.freeImagesRemaining ?? 0,
          videos: data.firstCut.freeVideosRemaining ?? 0,
        });
      }
      if (data.trial) {
        setHasUsedTrial(!!data.trial.hasUsedTrial);
        setTrialActive(!!data.trial.active);
      }
    } catch {}
  }

  async function startTrial(mode: 'platform' | 'stripe') {
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    try {
      const res = await fetch('/api/billing/start-trial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'TRIAL_USED') {
          toast.error(data.error);
          setCurrentView('billing');
          return;
        }
        if (data.code === 'STRIPE_NOT_CONFIGURED' || data.code === 'PRICE_NOT_CONFIGURED') {
          // Fallback to platform trial
          if (mode === 'stripe') {
            toast.message('Stripe trial not configured — starting no-card trial');
            return startTrial('platform');
          }
        }
        throw new Error(data.error || 'Could not start trial');
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (typeof data.creditBalance === 'number') setCreditBalance(data.creditBalance);
      setUserPlan(data.plan || 'creator');
      setTrialActive(true);
      setHasUsedTrial(true);
      setShowTrialOffer(false);
      setShowFirstCut(false);
      toast.success(data.message || 'Creator free trial is active', {
        description: `${data.trialCredits || 500} credits · ${data.trialDays || 7} days`,
      });
      await refreshBilling(token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trial failed');
    }
  }

  function handleGenPaywall(data: {
    error?: string;
    code?: string;
    nextStep?: string;
  }) {
    toast.error(data.error || 'Generation locked', {
      description:
        data.nextStep === 'first_cut'
          ? 'Start your free First Cut walkthrough'
          : data.nextStep === 'start_trial'
            ? 'Start a 7-day free trial to keep creating'
            : 'Open Billing to upgrade or buy credits',
      action: {
        label:
          data.nextStep === 'first_cut'
            ? 'First Cut'
            : data.nextStep === 'start_trial'
              ? 'Free trial'
              : 'Billing',
        onClick: () => {
          if (data.nextStep === 'first_cut') setShowFirstCut(true);
          else if (data.nextStep === 'start_trial') setShowTrialOffer(true);
          else setCurrentView('billing');
        },
      },
    });
  }

  async function completeFirstCutIfReady() {
    if (!token || firstCutStatus === 'completed') return;
    try {
      const res = await fetch('/api/onboarding/first-cut', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'complete' }),
      });
      const data = await res.json();
      if (res.ok && data.firstCutStatus === 'completed') {
        setFirstCutStatus('completed');
        setShowTrialOffer(true);
        toast.success('First Cut sample complete', {
          description: 'Start a free trial to unlock full generation',
        });
      }
    } catch {}
  }

  // Load from localStorage + API if logged in
  useEffect(() => {
    const savedUser = localStorage.getItem('moviedirector_user');
    const savedToken = localStorage.getItem('moviedirector_token');
    if (savedUser && savedToken) {
      try {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        setToken(savedToken);
        // Load from DB — merge with localStorage so hard refresh never drops frames/clips
        (async () => {
          try {
            let localProjects: Project[] = [];
            try {
              const raw = localStorage.getItem('moviedirector_projects');
              if (raw) localProjects = JSON.parse(raw);
            } catch {}
            const data = await loadUserProjects(savedToken);
            if (data?.length) {
              const merged = mergeProjectsPreferMedia(data, localProjects);
              setProjects(merged);
              // If local still had media the API lost, push it back to Mongo immediately
              for (const p of merged) {
                if (!isValidObjectId(p.id)) continue;
                const api = data.find((d: Project) => d.id === p.id);
                const localMedia = (p.shots || []).filter((s: Shot) => s.imageUrl || s.videoUrl).length;
                const apiMedia = (api?.shots || []).filter((s: Shot) => s.imageUrl || s.videoUrl).length;
                if (localMedia > apiMedia) {
                  fetch(`/api/projects/${p.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${savedToken}`,
                    },
                    body: JSON.stringify({
                      shots: p.shots,
                      characters: p.characters,
                      environments: p.environments,
                      defaultEnvironmentId: p.defaultEnvironmentId,
                      script: p.script,
                      worldBible: p.worldBible,
                      continuity: p.continuity,
                      generationSettings: p.generationSettings,
                      concept: p.concept,
                      synopsis: p.synopsis,
                      style: p.style,
                    }),
                  }).catch(() => {});
                }
              }
            } else if (localProjects.length) {
              // API empty but local still has work (incl. media) — keep it
              setProjects(localProjects);
            }
          } catch {}
          try {
            const feedData = await loadFeed();
            if (feedData?.items?.length) {
              setFeed(feedData.items);
              setFeedCursor(feedData.nextCursor);
              setFeedHasMore(!!feedData.hasMore);
            }
          } catch {}
          try {
            const convos = await loadConversations(savedToken);
            setConversations(convos);
          } catch {}
          try {
            const chs = await loadChannels(savedToken);
            if (chs.length) setChannels(chs);
          } catch {}
          try {
            const subs = await loadSubscriptions(savedToken);
            setSubscribedChannels(subs);
          } catch {}
          try {
            await refreshBilling(savedToken);
          } catch {}
        })();
      } catch (e) {}
    } else {
      const savedProjects = localStorage.getItem('moviedirector_projects');
      if (savedProjects) {
        try { setProjects(JSON.parse(savedProjects)); } catch (e) {}
      }
      const savedChannels = localStorage.getItem('moviedirector_channels');
      if (savedChannels) {
        try { setChannels(JSON.parse(savedChannels)); } catch(e){}
      }
      const savedFeed = localStorage.getItem('moviedirector_feed');
      if (savedFeed) {
        try { setFeed(JSON.parse(savedFeed)); } catch(e){}
      }
    }

    // Demo project for guests only (local preview — sign up to save)
    if (!savedToken && !localStorage.getItem('moviedirector_projects')) {
      setTimeout(() => setProjects([createDemoProject()]), 100);
    }

    // Always load public feed from API
    loadFeed().then((feedData) => {
      if (feedData?.items?.length) {
        setFeed(feedData.items);
        setFeedCursor(feedData.nextCursor);
        setFeedHasMore(!!feedData.hasMore);
      }
    }).catch(() => {});

    // Handle password reset token from URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('reset');
      if (token) {
        setResetToken(token);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Persist projects + channels + user + feed
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem('moviedirector_projects', JSON.stringify(projects));
    }
  }, [projects]);

  useEffect(() => {
    if (!token) localStorage.setItem('moviedirector_channels', JSON.stringify(channels));
  }, [channels, token]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('moviedirector_user', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('moviedirector_feed', JSON.stringify(feed));
  }, [feed]);

  useEffect(() => {
    return () => {
      if (genPollRef.current) clearInterval(genPollRef.current);
    };
  }, []);

  // Load conversations when user signs in or views messages
  useEffect(() => {
    if (currentUser && token && currentView === 'messages') {
      loadConversations(token).then(setConversations);
    }
  }, [currentUser, token, currentView]);

  function requireAuth(action: string): boolean {
    if (currentUser && token) return true;
    toast.error(`Sign in to ${action}`);
    setShowAuthModal(true);
    return false;
  }

  async function sendMessage(toUserId: string) {
    if (!newMessage.trim() || !token || !currentUser) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId, content: newMessage.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setNewMessage('');
        const convos = await loadConversations(token);
        setConversations(convos);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Message failed');
      }
    } catch {
      toast.error('Could not send message');
    }
  }

  async function openFilmDetail(item: FeedFilm) {
    try {
      const res = await fetch(`/api/feed/${item.id}`);
      if (res.ok) {
        const detail = await res.json();
        setSelectedFilm(detail);
      } else {
        setSelectedFilm(item);
      }
    } catch {
      setSelectedFilm(item);
    }
  }

  async function searchUsers(q: string) {
    setUserSearch(q);
    if (!token || q.length < 2) { setSearchResults([]); return; }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setSearchResults(await res.json());
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  /** Immediate cloud save — used after generation so hard refresh cannot drop media. */
  async function forceSaveProject(project: Project): Promise<boolean> {
    if (!token || !project?.id || !isValidObjectId(project.id)) return false;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: project.title,
          type: project.type,
          logline: project.logline,
          concept: project.concept,
          synopsis: project.synopsis,
          style: project.style,
          berserker: project.berserker,
          shots: project.shots,
          characters: project.characters,
          script: project.script,
          worldBible: project.worldBible,
          continuity: project.continuity,
          generationSettings: project.generationSettings,
          brandKit: project.brandKit,
          adFormatId: project.adFormatId,
          environments: project.environments,
          defaultEnvironmentId: project.defaultEnvironmentId,
        }),
      });
      if (!res.ok) {
        setSaveStatus('error');
        return false;
      }
      setSaveStatus('idle');
      // Mirror media into a durable local vault (survives API overwrite races)
      try {
        const vaultKey = 'moviedirector_media_vault';
        const prev: RecoveredAsset[] = JSON.parse(localStorage.getItem(vaultKey) || '[]');
        const next = extractAssetsFromProjects([project], 'local');
        const map = new Map<string, RecoveredAsset>();
        for (const a of [...prev, ...next]) {
          const k = `${a.videoUrl || ''}|${a.imageUrl || ''}`;
          if (k !== '|') map.set(k, a);
        }
        localStorage.setItem(vaultKey, JSON.stringify([...map.values()].slice(-200)));
      } catch {}
      return true;
    } catch {
      setSaveStatus('error');
      return false;
    }
  }

  async function recoverLostMedia() {
    if (!token) {
      toast.error('Sign in to recover media into a cloud project');
      setShowAuthModal(true);
      return;
    }
    toast.loading('Scanning projects, jobs, blob store, and local vault…', { id: 'recover-media' });
    try {
      let localAssets: RecoveredAsset[] = [];
      try {
        const vault = JSON.parse(localStorage.getItem('moviedirector_media_vault') || '[]');
        const fromProjects = extractAssetsFromProjects(projects, 'local');
        localAssets = [...vault, ...fromProjects];
      } catch {}
      const res = await fetch('/api/projects/recover-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ localAssets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Recovery failed');
      if (!data.project || !data.recovered) {
        toast.message(data.message || 'Nothing to recover', { id: 'recover-media' });
        return;
      }
      const recovered = normalizeProject(data.project as Record<string, unknown>);
      setProjects((prev) => [recovered, ...prev.filter((p) => p.id !== recovered.id)]);
      setSelectedProjectId(recovered.id);
      setCurrentView('workspace');
      setActiveTab('clips');
      toast.success(data.message || `Recovered ${data.recovered} assets`, {
        id: 'recover-media',
        description: data.sources
          ? `local ${data.sources.local} · projects ${data.sources.project} · jobs ${data.sources.job} · blob ${data.sources.blob}`
          : undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recovery failed', { id: 'recover-media' });
    }
  }

  // Auto-save project edits to MongoDB
  useEffect(() => {
    if (!token || !selectedProject?.id || !isValidObjectId(selectedProject.id)) return;
    const timeout = setTimeout(async () => {
      await forceSaveProject(selectedProject);
    }, 1200);
    return () => clearTimeout(timeout);
  }, [selectedProject, token]);

  function createDemoProject(): Project {
    const treatment = DEFAULT_TREATMENTS.sitcom(
      "THE LAST PITCH", 
      "A failing ad agency tries to win the biggest client of their lives by pitching a campaign entirely made with AI — then falls in love with the humanity they were trying to fake.", 
      false
    );

    const demoShots = createShotsFromTreatment(treatment.shots);

    // Inject real Grok-generated cinematic stills into the demo
    // (Generated live via Grok Imagine for maximum impact)
    const realStills = [
      '/generated/2.jpg', // chaotic cold open
      '/generated/3.jpg', // night agency war room
      '/generated/1.jpg', // emotional close
      '/generated/4.jpg', // brand fusion energy
    ];

    demoShots.forEach((shot, i) => {
      if (realStills[i]) {
        shot.imageUrl = realStills[i];
      }
    });

    // Seed demo characters for consistency demo (sitcom cast)
    const demoCharacters: Character[] = [
      {
        id: generateId(),
        name: "Alex Rivera",
        role: "Lead Creative Director",
        description: "Mid-30s, sharp features, messy dark hair, always wears a worn leather jacket over a hoodie, expressive eyes, perpetual slight smirk. Cynical but secretly hopeful.",
        referenceImageUrl: '/generated/alex-ref.jpg'
      },
      {
        id: generateId(),
        name: "Jordan Hale",
        role: "Copywriter / Best Friend",
        description: "Early 30s, bright smile, curly hair, glasses, wears bright sneakers with everything. The optimistic heart of the office.",
        referenceImageUrl: '/generated/3.jpg'
      }
    ];

    // Inject real Grok-generated assets for demo (character consistency + video)
    if (demoShots[0]) {
      demoShots[0].videoUrl = '/generated/alex-clip.mp4';
      demoShots[0].characterIds = [demoCharacters[0].id];
    }
    if (demoShots[2]) demoShots[2].characterIds = [demoCharacters[0].id]; // emotional close up of Alex
    if (demoShots[5]) demoShots[5].characterIds = [demoCharacters[0].id, demoCharacters[1].id];

    return {
      id: 'demo-' + generateId(),
      title: "THE LAST PITCH",
      type: 'sitcom',
      logline: "A failing ad agency tries to win the biggest client of their lives by pitching a campaign entirely made with AI — then falls in love with the humanity they were trying to fake.",
      concept: "Cinematic office sitcom trailer in the style of 1970s-80s classic television with modern sharp wit. One consistent world, warm practical lighting, filmic.",
      style: { description: "35mm film, warm 1970s television aesthetic, slight film grain, rich color grading, horizontal 16:9" },
      synopsis: treatment.synopsis,
      berserker: false,
      shots: demoShots,
      characters: demoCharacters,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function createProject() {
    if (!requireAuth('create and save projects')) return;
    if (!newProject.title.trim() || !newProject.logline.trim()) {
      toast.error("Give it a title and a logline. Directors don't wing it.");
      return;
    }
    if (!token) {
      toast.error('Sign in to create a cloud project (required for generate + publish)');
      setShowAuthModal(true);
      return;
    }

    const treatment = DEFAULT_TREATMENTS[newProject.type](
      newProject.title.trim(),
      newProject.logline.trim(),
      newProject.berserker
    );

    const projectData: any = {
      title: newProject.title.trim(),
      type: newProject.type,
      logline: newProject.logline.trim(),
      concept: newProject.concept.trim() || undefined,
      style: newProject.styleHint ? { description: newProject.styleHint } : undefined,
      synopsis: treatment.synopsis,
      berserker: newProject.berserker,
      shots: createShotsFromTreatment(treatment.shots),
      characters: [],
      // New projects start in Auto (minimal). Switch to Lab in the LAB tab for full control.
      generationSettings: { workflowMode: 'auto' as const, defaultQuality: 'draft' as const },
    };

    toast.loading('Saving project to the cloud…', { id: 'create-project' });
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(projectData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            'Could not save project. Check MongoDB connection and try again.'
        );
      }

      const project = normalizeProject(data as Record<string, unknown>);
      if (!isValidObjectId(project.id)) {
        throw new Error('Server returned an invalid project id. Try again.');
      }

      setProjects((prev) => [project, ...prev.filter((p) => !String(p.id).startsWith('demo-'))]);
      setSelectedProjectId(project.id);
      setCurrentView('workspace');
      setActiveTab('treatment'); // LAB — Auto mode by default
      setShowNewModal(false);
      setNewProject({ title: '', type: 'film', concept: '', logline: '', styleHint: '', berserker: false });

      toast.success(`${project.title} is in pre-production.`, {
        id: 'create-project',
        description: newProject.berserker
          ? 'BERSERKER engaged. Generate frames, then publish to the Feed.'
          : 'Generate frames/clips, then Publish tab → public Feed.',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create project failed', { id: 'create-project' });
    }
  }

  function openProject(project: Project) {
    setSelectedProjectId(project.id);
    setCurrentView('workspace');
    setActiveTab('treatment');
    setIsPlaying(false);
    setCurrentShotIndex(0);
  }

  function updateProject(updater: (p: Project) => Project) {
    if (!selectedProjectId) return;
    setProjects(prev =>
      prev.map(p => p.id === selectedProjectId ? updater({ ...p, updatedAt: new Date().toISOString() }) : p)
    );
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project permanently? This cannot be undone.')) return;

    if (token && isValidObjectId(id)) {
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          toast.error('Failed to delete project');
          return;
        }
      } catch {
        toast.error('Failed to delete project');
        return;
      }
    }

    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
        setCurrentView(next.length > 0 ? 'dashboard' : 'landing');
      }
      return next;
    });
    toast.info('Project deleted from the vault.');
  }

  function signOut() {
    setToken(null);
    setCurrentUser(null);
    setCreditBalance(null);
    setUserPlan('free');
    setChannels([]);
    setSubscribedChannels([]);
    setConversations([]);
    setMessages([]);
    setSelectedConversation(null);
    setChatPartner(null);
    setSelectedProjectId(null);
    setCurrentView('landing');
    localStorage.removeItem('moviedirector_token');
    localStorage.removeItem('moviedirector_user');
    toast.success('Signed out');
  }

  /**
   * When rebuilding a shot list, keep frames/clips/dialogue/prompts from the old
   * list by shot order so "regenerate" never looks like a full project wipe.
   */
  function preserveMediaOntoNewShots(oldShots: Shot[], newShots: Shot[]): Shot[] {
    return newShots.map((ns, i) => {
      const old = oldShots[i];
      if (!old) return ns;
      return {
        ...ns,
        imageUrl: old.imageUrl,
        videoUrl: old.videoUrl,
        dialogue: ns.dialogue || old.dialogue,
        framePromptOverride: old.framePromptOverride,
        videoPromptOverride: old.videoPromptOverride,
        lockedFramePrompt: old.lockedFramePrompt,
        lockedVideoPrompt: old.lockedVideoPrompt,
        characterIds: ns.characterIds?.length ? ns.characterIds : old.characterIds,
        caption: old.caption,
        voiceoverScript: old.voiceoverScript,
      };
    });
  }

  function mediaShotCount(shots: Shot[] = []) {
    return shots.filter((s) => s.imageUrl || s.videoUrl).length;
  }

  /**
   * REGENERATE FULL TREATMENT
   * Rewrites synopsis + shot list from title/logline/type templates.
   * Does NOT delete: script, world bible, cast, style, prompts, or media (media re-attached by order).
   */
  function regenerateTreatment() {
    if (!selectedProject) return;
    const media = mediaShotCount(selectedProject.shots);
    const ok = confirm(
      media > 0
        ? `Regenerate Full Treatment replaces the SYNOPSIS and SHOT LIST with a fresh template for “${selectedProject.title}”.\n\n` +
            `Your ${media} existing frame/clip(s) will be re-attached to the new shots by order when possible.\n` +
            `Lab fields (script, world, cast, prompts) are kept.\n\nContinue?`
        : `Regenerate Full Treatment replaces the SYNOPSIS and SHOT LIST with a fresh template from your title + logline + format.\n\n` +
            `Lab fields (script, world, cast, prompts) are kept. Continue?`
    );
    if (!ok) return;

    const treatment = DEFAULT_TREATMENTS[selectedProject.type](
      selectedProject.title,
      selectedProject.logline,
      selectedProject.berserker
    );
    const fresh = createShotsFromTreatment(treatment.shots);
    const shots = preserveMediaOntoNewShots(selectedProject.shots, fresh);
    updateProject((p) => ({
      ...p,
      synopsis: treatment.synopsis,
      shots,
      // never clear lab / media vault fields
    }));
    setActiveTab('storyboard');
    toast.success('Treatment rebuilt', {
      description:
        media > 0
          ? `Synopsis + shot list refreshed. ${media} media item(s) re-attached by order.`
          : 'Synopsis + shot list refreshed from title & logline. Lab/cast unchanged.',
    });
  }

  // === STORYBOARD GENERATION ===
  function addNewShot() {
    if (!selectedProject) return;
    const newShot: Shot = {
      id: generateId(),
      number: selectedProject.shots.length + 1,
      description: selectedProject.berserker 
        ? "UNCHAINED SHOT — Invent the most insane, beautiful, or deranged thing that serves the story."
        : "New shot. Describe exactly what we need to see and feel.",
      camera: "To be directed",
      // Default 5s — sitcom economy: more shots, less pure-minute burn per beat
      duration: 5,
    };
    updateProject(p => ({ ...p, shots: [...p.shots, newShot] }));
    setEditingShotId(newShot.id);
    toast("New shot added (5s default — stretch the episode).");
  }

  /**
   * AI GENERATE SHOT LIST FROM LAB
   * Builds a structured shot list from concept (or logline). Replaces shot list only.
   * Keeps lab fields; re-attaches existing media by order.
   */
  function generateFullShotListFromConcept() {
    if (!selectedProject) return;
    const concept =
      selectedProject.concept?.trim() ||
      selectedProject.logline?.trim() ||
      selectedProject.script?.trim()?.slice(0, 200);
    if (!concept) {
      toast.error('Add a logline or concept first (Auto mode or World station).');
      return;
    }

    const media = mediaShotCount(selectedProject.shots);
    const ok = confirm(
      media > 0
        ? `AI Generate Shot List replaces your SHOT LIST using the lab concept/logline.\n\n` +
            `Your ${media} frame/clip(s) will be re-attached by shot order when possible.\n` +
            `Synopsis, script, cast, and world bible are NOT deleted.\n\nContinue?`
        : `AI Generate Shot List builds a new SHOT LIST from your concept/logline.\n\n` +
            `Does not delete script, cast, world bible, or synopsis. Continue?`
    );
    if (!ok) return;

    const numShots =
      selectedProject.type === 'commercial' ? 6 : selectedProject.type === 'sitcom' ? 8 : 12;

    const baseShots = Array.from({ length: numShots }, (_, i) => {
      const num = i + 1;
      return {
        description: `Shot ${num}: Key moment drawn from concept — ${concept.slice(0, 80)}${concept.length > 80 ? '…' : ''}`,
        camera: i % 3 === 0 ? 'Wide establishing' : i % 2 === 0 ? 'Medium tracking' : 'Intimate close-up',
        duration: 4 + (i % 4),
        emotion: 'Stoic intensity building to emotional release',
        actingCues: 'Subtle micro-expressions, controlled breathing',
        cameraDetailed: 'Slow push or measured pan with purpose',
      };
    });

    const newShots: Shot[] = baseShots.map((s, idx) => ({
      id: generateId(),
      number: idx + 1,
      description: s.description,
      camera: s.camera,
      duration: s.duration,
      emotion: s.emotion,
      actingCues: s.actingCues,
      cameraDetailed: s.cameraDetailed,
    }));

    const shots = preserveMediaOntoNewShots(selectedProject.shots, newShots);
    updateProject((p) => ({
      ...p,
      concept: p.concept || concept,
      shots,
    }));
    setActiveTab('storyboard');
    toast.success(`Shot list rebuilt (${numShots} shots)`, {
      description:
        media > 0
          ? 'Media re-attached by order. Script, cast, and lab fields kept.'
          : 'Refine dialogue and cues, then generate frames.',
    });
  }

  /**
   * Auto / minimal mode: one click treatment + shot list from title + logline.
   * Same safety as regenerate — never silent-wipe media.
   */
  function runAutoBuild() {
    if (!selectedProject) return;
    if (!selectedProject.logline?.trim() && !selectedProject.concept?.trim()) {
      toast.error('Add a logline (or concept) first — Auto needs at least one sentence.');
      return;
    }
    const media = mediaShotCount(selectedProject.shots);
    if (media > 0) {
      const ok = confirm(
        `Auto Build will refresh synopsis + shot list from title/logline.\n` +
          `Your ${media} frame/clip(s) stay attached by order. Script & cast stay.\n\nContinue?`
      );
      if (!ok) return;
    }

    const logline = selectedProject.logline?.trim() || selectedProject.concept || selectedProject.title;
    const treatment = DEFAULT_TREATMENTS[selectedProject.type](
      selectedProject.title,
      logline,
      selectedProject.berserker
    );
    const fresh = createShotsFromTreatment(treatment.shots);
    const shots = preserveMediaOntoNewShots(selectedProject.shots, fresh);
    updateProject((p) => ({
      ...p,
      logline: p.logline?.trim() || logline,
      concept:
        p.concept?.trim() ||
        `Auto-built ${p.type} from logline: ${logline}`,
      synopsis: treatment.synopsis,
      shots,
      generationSettings: { ...p.generationSettings, workflowMode: 'auto' },
    }));
    setActiveTab('storyboard');
    toast.success('Auto build complete', {
      description: 'Treatment + shot list ready. Open ENSEMBLE for cast look, then GENERATE.',
    });
  }

  function updateShot(shotId: string, updates: Partial<Shot>) {
    updateProject(p => ({
      ...p,
      shots: p.shots.map(s => s.id === shotId ? { ...s, ...updates } : s)
    }));
  }

  function updateAdvancedShot(shotId: string, field: keyof Shot, value: string) {
    updateShot(shotId, { [field]: value } as any);
  }

  function deleteShot(shotId: string) {
    updateProject(p => ({
      ...p,
      shots: p.shots.filter(s => s.id !== shotId).map((s, i) => ({ ...s, number: i + 1 }))
    }));
  }

  function generateFramePrompt(shot: Shot): string {
    if (!selectedProject) return '';
    return generateFramePromptLib(selectedProject, shot);
  }

  function frameCreditCost(shot: Shot): number {
    return imageCreditsFor(genQuality, !!shot.imageUrl);
  }

  function videoCreditCost(shot: Shot): number {
    return videoCreditsFor(shot.duration || 8, genQuality, !!shot.videoUrl);
  }

  function confirmSpend(kind: 'frame' | 'video' | 'speech', credits: number, detail: string): boolean {
    if (credits <= 0) return true;
    return confirm(
      `${kind === 'frame' ? 'Generate frame' : kind === 'video' ? 'Generate video' : 'Generate voice'}\n\n` +
        `Mode: ${genQuality.toUpperCase()}${kind !== 'speech' && credits < (kind === 'frame' ? 8 : 80) ? ' (cheaper / retake)' : ''}\n` +
        `Cost: ${credits} credits\n${detail}\n\nPlan free in LAB first — spend only when the shot is locked.\nContinue?`
    );
  }

  async function generateFrame(shotId: string) {
    const shot = selectedProject?.shots.find(s => s.id === shotId);
    if (!shot || !selectedProject) return;

    // Continuity bridge: must edit FROM neighbor frames — never pure text invention
    const fromShot = isTransitionShot(shot)
      ? selectedProject.shots.find((s) => s.id === shot.bridgeFromShotId)
      : undefined;
    const toShot = isTransitionShot(shot)
      ? selectedProject.shots.find((s) => s.id === shot.bridgeToShotId)
      : undefined;

    if (isTransitionShot(shot)) {
      const ready = bridgeFrameReady(fromShot, toShot);
      if (!ready.ok) {
        toast.error('Bridge needs neighbor frames', { description: ready.reason });
        return;
      }
      const lockIds = preferredBridgeCharacterIds(fromShot, toShot);
      if (lockIds.length && !(shot.characterIds || []).length) {
        updateShot(shotId, {
          characterIds: lockIds,
          environmentId:
            shot.environmentId ||
            fromShot?.environmentId ||
            toShot?.environmentId ||
            selectedProject.defaultEnvironmentId,
        });
      }
    }

    // Bind default SET only — never auto-select cast chips (user may want env-only)
    let shotForPrompt =
      isTransitionShot(shot)
        ? {
            ...shot,
            characterIds: shot.characterIds?.length
              ? shot.characterIds
              : preferredBridgeCharacterIds(fromShot, toShot),
            environmentId:
              shot.environmentId ||
              fromShot?.environmentId ||
              toShot?.environmentId ||
              selectedProject.defaultEnvironmentId,
          }
        : ensureShotContinuityBindings(selectedProject, shot);

    // Persist auto-bound set only — do not rewrite characterIds
    if (
      !isTransitionShot(shot) &&
      shotForPrompt.environmentId &&
      shotForPrompt.environmentId !== shot.environmentId
    ) {
      updateShot(shotId, { environmentId: shotForPrompt.environmentId });
    }

    const continuity = isTransitionShot(shot)
      ? null
      : collectContinuityRefs(selectedProject, shotForPrompt);

    // CRITICAL: continuity path uses SHORT surgical edit prompt only.
    // Full "masterpiece sitcom" prompts fight the plate and invent extras/props.
    const prompt = isTransitionShot(shot)
      ? generateFramePrompt(shotForPrompt)
      : continuity?.useEdit
        ? buildStrictContinuityEditPrompt(selectedProject, shotForPrompt, continuity)
        : generateFramePrompt(shotForPrompt);
    navigator.clipboard.writeText(prompt).catch(() => {});

    if (!token) {
      toast.error('Sign in to generate frames with Grok Imagine');
      setShowAuthModal(true);
      return;
    }

    if (!isValidObjectId(selectedProject.id)) {
      toast.error('Invalid project — not saved to the cloud', {
        description: 'Click New while signed in and create a fresh project. Demo/local IDs cannot generate or publish.',
      });
      setShowNewModal(true);
      return;
    }

    // Refuse free invent when user clearly has locks but no plate URL yet
    if (
      !isTransitionShot(shot) &&
      !continuity?.useEdit &&
      ((shotForPrompt.characterIds || []).length > 0 || shotForPrompt.environmentId) &&
      (selectedProject.environments || []).some((e) => e.id === shotForPrompt.environmentId && !e.referenceImageUrl)
    ) {
      // First frame of a text-only set is allowed (establishes plate). No block.
    }

    const cost = frameCreditCost(shot);
    const continuityNote =
      !isTransitionShot(shot) && continuity?.useEdit
        ? ` SURGICAL continuity edit from ${continuity.strategy} (${continuity.urls.length} plate${continuity.urls.length > 1 ? 's' : ''}). Exact cast count enforced.`
        : !isTransitionShot(shot) && shotForPrompt.environmentId
          ? ' Seed frame for this set (no prior plate) — next shot will edit THIS frame, not invent a new room.'
          : '';
    if (
      !confirmSpend(
        'frame',
        cost,
        isTransitionShot(shot)
          ? 'Bridge still: image-edit grounded in the previous (and next) frame — not a new scene.'
          : shot.imageUrl
            ? `Retake: half price because this shot already has a frame.${continuityNote}`
            : genQuality === 'draft'
              ? `Draft: cheap look test. Switch to Final when locked.${continuityNote}`
              : `Final quality still.${continuityNote}`
      )
    ) {
      return;
    }

    const referenceImageUrls = isTransitionShot(shot)
      ? bridgeEditImageUrls(selectedProject, shot, fromShot, toShot)
      : continuity?.urls || [];

    // Prefer single base plate for continuity (less invention than multi-ref remix)
    const continuityUrls =
      !isTransitionShot(shot) && continuity?.useEdit
        ? continuity.urls.slice(0, continuity.strategy === 'prior-frame' ? 1 : Math.min(2, continuity.urls.length))
        : referenceImageUrls;

    const genMode = isTransitionShot(shot)
      ? 'bridge'
      : continuityUrls.length
        ? 'continuity'
        : 'generate';

    toast.loading(
      isTransitionShot(shot)
        ? `Editing bridge from neighbor frames (−${cost} cr)…`
        : continuityUrls.length
          ? `Surgical continuity edit (−${cost} cr)…`
          : `Generating ${genQuality} frame (−${cost} cr)…`,
      { id: `gen-img-${shotId}` }
    );
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt,
          projectId: selectedProject.id,
          shotId,
          quality: genQuality,
          aspectRatio: selectedProject.generationSettings?.aspectRatio || '16:9',
          mode: genMode,
          referenceImageUrls: continuityUrls.length ? continuityUrls : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS' || data.code === 'FREE_SAMPLE_EXHAUSTED') {
          toast.dismiss(`gen-img-${shotId}`);
          handleGenPaywall(data);
          return;
        }
        throw new Error(data.error || 'Image generation failed');
      }
      if (!isTransitionShot(shot) && genMode === 'continuity' && !data.usedEdit) {
        toast.error('Continuity edit did not run — frame may invent. Retry.', {
          id: `gen-img-${shotId}`,
        });
      }
      const nextShots = selectedProject.shots.map((s) =>
        s.id === shotId
          ? {
              ...s,
              imageUrl: data.imageUrl as string,
              lastFrameQuality: genQuality,
              environmentId: shotForPrompt.environmentId || s.environmentId,
              // Keep user's cast selection as-is (including empty = set-only)
              characterIds: s.characterIds || [],
            }
          : s
      );
      let nextProject: Project = {
        ...selectedProject,
        shots: nextShots,
      };
      // First successful frame becomes durable set/cast plate
      if (!isTransitionShot(shotForPrompt) && data.imageUrl) {
        nextProject = promoteFrameToEnvPlate(
          nextProject,
          { ...shotForPrompt, imageUrl: data.imageUrl as string },
          data.imageUrl as string
        );
      }
      updateProject(() => nextProject);
      void forceSaveProject(nextProject);
      if (typeof data.creditBalance === 'number') setCreditBalance(data.creditBalance);
      if (data.firstCut) {
        setFirstCutFree({
          images: data.firstCut.freeImagesRemaining ?? 0,
          videos: data.firstCut.freeVideosRemaining ?? 0,
        });
      }
      toast.success(
        data.freeSample
          ? 'Free First Cut frame ready'
          : data.creditsCharged
            ? `Frame ready (−${data.creditsCharged} cr${data.isRetake ? ', retake' : ''}${data.usedEdit ? `, ${data.editMode || 'edit'}` : ''})`
            : 'Frame generated',
        {
          id: `gen-img-${shotId}`,
          description: data.usedEdit
            ? `Surgical edit (${data.editMode || 'plate'}). Exact cast; no free invent.`
            : shotForPrompt.environmentId
              ? 'Seed plate saved — next shot edits this frame.'
              : undefined,
        }
      );
      // After a free sample gen, gently offer completion/trial when budget low
      if (data.freeSample && data.firstCut?.freeImagesRemaining === 0 && data.firstCut?.freeVideosRemaining === 0) {
        completeFirstCutIfReady();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed', { id: `gen-img-${shotId}` });
    }
  }

  // === CLIP LAB: IMAGE -> VIDEO ===
  function generateVideoPrompt(shot: Shot): string {
    if (!selectedProject) return '';
    return generateVideoPromptLib(selectedProject, shot);
  }

  async function generateVideoClip(shotId: string) {
    const shot = selectedProject?.shots.find(s => s.id === shotId);
    if (!shot || !selectedProject) return;

    if (!shot.imageUrl && !shot.description) {
      toast.error('Generate the frame first or add a shot description.');
      return;
    }

    // Continuity bridge: lock cast + seed from neighbor frames (prevents random characters)
    const fromShot = isTransitionShot(shot)
      ? selectedProject.shots.find((s) => s.id === shot.bridgeFromShotId)
      : undefined;
    const toShot = isTransitionShot(shot)
      ? selectedProject.shots.find((s) => s.id === shot.bridgeToShotId)
      : undefined;

    if (isTransitionShot(shot)) {
      const lockIds = preferredBridgeCharacterIds(fromShot, toShot);
      if (lockIds.length && !(shot.characterIds || []).length) {
        updateShot(shotId, { characterIds: lockIds });
      }
    }

    const shotForVideo = isTransitionShot(shot)
      ? {
          ...shot,
          characterIds: shot.characterIds?.length
            ? shot.characterIds
            : preferredBridgeCharacterIds(fromShot, toShot),
          environmentId:
            shot.environmentId ||
            fromShot?.environmentId ||
            toShot?.environmentId ||
            selectedProject.defaultEnvironmentId,
        }
      : ensureShotContinuityBindings(selectedProject, shot);

    if (!isTransitionShot(shot) && shotForVideo.environmentId && !shot.environmentId) {
      updateShot(shotId, { environmentId: shotForVideo.environmentId });
    }

    const continuityVid = isTransitionShot(shot)
      ? { urls: [] as string[] }
      : collectContinuityRefs(selectedProject, shotForVideo);

    const prompt = generateVideoPrompt(shotForVideo);
    navigator.clipboard.writeText(prompt).catch(() => {});

    if (!token) {
      toast.error('Sign in to generate video clips');
      setShowAuthModal(true);
      return;
    }

    const prevShot = selectedProject.shots
      .filter(s => s.number < shot.number && s.videoUrl)
      .sort((a, b) => b.number - a.number)[0];

    const seedImage = isTransitionShot(shot)
      ? bridgeSeedImageUrl(shot, fromShot, toShot)
      : shot.imageUrl;

    const referenceImageUrls = isTransitionShot(shot)
      ? bridgeReferenceImages(selectedProject, shot, fromShot, toShot)
      : continuityVid.urls;

    // Bridges: prefer image-to-video from previous frame — never text-to-video cold start
    // Story shots: prefer i2v from this shot's frame (already continuity-locked still)
    const mode = isTransitionShot(shot)
      ? seedImage
        ? 'image-to-video'
        : referenceImageUrls.length
          ? 'reference-to-video'
          : 'text-to-video'
      : prevShot?.videoUrl && !shot.imageUrl
        ? 'extend-video'
        : shot.imageUrl
          ? 'image-to-video'
          : referenceImageUrls.length
            ? 'reference-to-video'
            : 'text-to-video';

    if (isTransitionShot(shot) && mode === 'text-to-video') {
      toast.error('Bridge needs a seed frame', {
        description: 'Generate frames on the shots before/after, or a bridge still first — stops random cast.',
      });
      return;
    }

    const cost = videoCreditCost(shot);
    if (
      !confirmSpend(
        'video',
        cost,
        isTransitionShot(shot)
          ? 'Continuity bridge: cast-locked, seeded from previous frame. No new characters.'
          : shot.videoUrl
            ? 'Retake: half price. Draft clips are shorter (max 5s) to save budget.'
            : genQuality === 'draft'
              ? 'Draft clip (max 5s). Final when the motion is locked.'
              : `Final ${shot.duration || 8}s clip.`
      )
    ) {
      return;
    }

    toast.loading(
      isTransitionShot(shot)
        ? `Generating continuity bridge (−${cost} cr)…`
        : `Generating ${genQuality} clip (−${cost} cr)…`,
      { id: `gen-vid-${shotId}` }
    );
    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt,
          imageUrl: seedImage || shot.imageUrl,
          videoUrl: isTransitionShot(shot) ? undefined : prevShot?.videoUrl,
          referenceImageUrls,
          duration: isTransitionShot(shot) ? Math.min(shot.duration || 4, 5) : shot.duration,
          mode,
          projectId: selectedProject.id,
          shotId,
          quality: genQuality,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS' || data.code === 'FREE_SAMPLE_EXHAUSTED') {
          toast.dismiss(`gen-vid-${shotId}`);
          handleGenPaywall(data);
          return;
        }
        throw new Error(data.error || 'Video generation failed');
      }
      const nextShots = selectedProject.shots.map((s) =>
        s.id === shotId
          ? { ...s, videoUrl: data.videoUrl as string, lastVideoQuality: genQuality }
          : s
      );
      updateShot(shotId, { videoUrl: data.videoUrl, lastVideoQuality: genQuality });
      void forceSaveProject({ ...selectedProject, shots: nextShots });
      if (typeof data.creditBalance === 'number') setCreditBalance(data.creditBalance);
      if (data.firstCut) {
        setFirstCutFree({
          images: data.firstCut.freeImagesRemaining ?? 0,
          videos: data.firstCut.freeVideosRemaining ?? 0,
        });
      }
      toast.success(
        data.freeSample
          ? 'Free First Cut clip ready'
          : data.creditsCharged
            ? `Clip ready (−${data.creditsCharged} cr${data.isRetake ? ', retake' : ''})`
            : 'Video clip ready',
        { id: `gen-vid-${shotId}` }
      );
      if (
        data.freeSample &&
        (data.firstCut?.freeVideosRemaining ?? 1) === 0
      ) {
        completeFirstCutIfReady();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed', { id: `gen-vid-${shotId}` });
    }
  }

  async function batchGenerateVideos() {
    if (!selectedProject || !token) {
      toast.error('Sign in to run batch generation');
      setShowAuthModal(true);
      return;
    }

    const pending = selectedProject.shots.filter(s => !s.videoUrl);
    if (!pending.length) {
      toast.info('All shots already have video clips');
      return;
    }

    const prompts = Object.fromEntries(
      pending.map(s => [s.id, generateVideoPrompt(s)])
    );

    toast.loading(`Queuing ${pending.length} clips…`, { id: 'batch-gen' });
    try {
      const res = await fetch('/api/generate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: selectedProject.id,
          shotIds: pending.map(s => s.id),
          mode: 'batch-video',
          prompts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS') {
          toast.error(data.error || 'Not enough credits for batch', {
            id: 'batch-gen',
            description: `Need ${data.required} credits. Open Billing to top up.`,
            action: { label: 'Billing', onClick: () => setCurrentView('billing') },
          });
          return;
        }
        throw new Error(data.error || 'Batch queue failed');
      }

      setActiveGenJob({ id: data.jobId, progress: 0, status: 'processing' });
      if (typeof data.creditBalance === 'number') setCreditBalance(data.creditBalance);
      toast.success(
        `Batch started — reserved ${data.creditsReserved ?? data.costEstimate?.credits ?? '?'} credits`,
        { id: 'batch-gen' }
      );

      if (genPollRef.current) clearInterval(genPollRef.current);
      genPollRef.current = setInterval(async () => {
        const jobRes = await fetch(`/api/generate/jobs/${data.jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!jobRes.ok) return;
        const job = await jobRes.json();
        setActiveGenJob({ id: job.id, progress: job.progress, status: job.status });

        for (const item of job.items || []) {
          if (item.status === 'done' && item.videoUrl) {
            updateShot(item.shotId, { videoUrl: item.videoUrl, imageUrl: item.imageUrl });
          }
        }

        if (job.status === 'done' || job.status === 'failed') {
          if (genPollRef.current) clearInterval(genPollRef.current);
          genPollRef.current = null;
          if (job.status === 'done') toast.success('Batch generation complete');
          else toast.error(job.error || 'Batch generation failed');
          setActiveGenJob(null);
          const refreshed = await loadUserProjects(token);
          if (refreshed?.length) setProjects(refreshed);
          if (token) refreshBilling(token);
        }
      }, 4000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Batch failed', { id: 'batch-gen' });
    }
  }

  // === CHARACTER CONSISTENCY (Full AI Movie Creation) ===
  function addCharacter() {
    if (!selectedProject) return;
    const newChar: Character = {
      id: generateId(),
      name: "New Character",
      role: "Supporting",
      description: selectedProject.berserker 
        ? "Unchained original character. Wild back story, unforgettable visual signature."
        : "Distinctive appearance and personality. Key visual traits for perfect consistency across shots.",
    };
    updateProject(p => ({
      ...p,
      characters: [...(p.characters || []), newChar]
    }));
    toast.success("Character added to cast. Generate a reference image for consistency.");
  }

  function updateCharacter(charId: string, updates: Partial<Character>) {
    updateProject(p => ({
      ...p,
      characters: (p.characters || []).map(c => c.id === charId ? { ...c, ...updates } : c)
    }));
  }

  function deleteCharacter(charId: string) {
    updateProject(p => ({
      ...p,
      characters: (p.characters || []).filter(c => c.id !== charId),
      shots: p.shots.map(s => ({
        ...s,
        characterIds: (s.characterIds || []).filter(id => id !== charId)
      }))
    }));
  }

  function generateCharacterPrompt(char: Character): string {
    if (!selectedProject) return '';
    return generateCharacterRefPromptLib(selectedProject, char);
  }

  async function generateCharacterRef(charId: string) {
    const project = selectedProject;
    if (!project) return;
    const char = (project.characters || []).find(c => c.id === charId);
    if (!char) return;

    const prompt = generateCharacterPrompt(char);
    navigator.clipboard.writeText(prompt).catch(() => {});

    if (!token) {
      toast.error('Sign in to generate character references with Grok');
      setShowAuthModal(true);
      return;
    }

    toast.loading(`Generating ref for ${char.name}…`, { id: `char-ref-${charId}` });
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt,
          projectId: project.id,
          shotId: `char-${charId}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS' || data.code === 'FREE_SAMPLE_EXHAUSTED') {
          toast.dismiss(`char-ref-${charId}`);
          handleGenPaywall(data);
          return;
        }
        throw new Error(data.error || 'Reference generation failed');
      }
      updateCharacter(charId, {
        referenceImageUrl: data.imageUrl,
        consistencyLock: {
          modelSheet: `${char.name} — ${char.description}`,
          doNotChange: char.faceNotes || char.wardrobe || 'Exact face, hair, wardrobe from this reference',
          referenceUrls: [data.imageUrl as string],
          locked: true,
          lockedAt: new Date().toISOString(),
        },
      });
      if (typeof data.creditBalance === 'number') setCreditBalance(data.creditBalance);
      toast.success(
        data.freeSample ? `Free ref ready for ${char.name}` : `Reference ready for ${char.name}`,
        { id: `char-ref-${charId}`, description: 'Character auto-locked to this reference.' }
      );
    } catch (err) {
      // Fallback placeholder so offline/demo still works
      const seed = charId.slice(0, 6);
      updateCharacter(charId, {
        referenceImageUrl: `https://picsum.photos/seed/char${seed}/600/600`,
      });
      toast.error(err instanceof Error ? err.message : 'Generation failed', {
        id: `char-ref-${charId}`,
        description: 'Prompt copied. Placeholder image set for layout.',
      });
    }
  }

  async function generateEnvironmentRef(envId: string) {
    const project = selectedProject;
    if (!project || !token) {
      toast.error('Sign in to generate set references');
      return;
    }
    if (!isValidObjectId(project.id)) {
      toast.error('Cloud project required');
      return;
    }
    const env = (project.environments || []).find((e) => e.id === envId);
    if (!env) return;
    const prompt = [
      `Environment reference plate for original series "${project.title}".`,
      `Location: ${env.name} (${env.placeType}).`,
      env.description,
      env.lighting && `Lighting: ${env.lighting}.`,
      env.architecture && `Architecture: ${env.architecture}.`,
      env.signatureProps && `Signature props: ${env.signatureProps}.`,
      env.consistencyLock?.doNotChange,
      project.style?.description && `Style: ${project.style.description}.`,
      'Empty of main cast — set plate only. Consistent for series reuse. No copyrighted locations.',
    ]
      .filter(Boolean)
      .join(' ');

    // If we already have a plate (e.g. from Discover), reinforce via edit instead of inventing a new room
    const existingPlate =
      env.referenceImageUrl || env.consistencyLock?.referenceUrls?.[0] || undefined;
    const platePrompt = existingPlate
      ? `CONTINUITY: Image 1 is the LOCKED SET plate for "${env.name}". Produce a clean empty set reference plate of THE SAME room — same architecture, furniture, colors. Remove or de-emphasize people if present. ${prompt}`
      : prompt;

    toast.loading(
      existingPlate ? `Reinforcing set plate: ${env.name}…` : `Generating set ref: ${env.name}…`,
      { id: `env-ref-${envId}` }
    );
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt: platePrompt,
          projectId: project.id,
          shotId: `env-${envId}`,
          mode: existingPlate ? 'edit' : 'generate',
          referenceImageUrls: existingPlate ? [existingPlate] : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Set ref failed');
      const next = {
        ...project,
        defaultEnvironmentId: project.defaultEnvironmentId || envId,
        environments: (project.environments || []).map((e) =>
          e.id === envId
            ? {
                ...e,
                referenceImageUrl: data.imageUrl as string,
                consistencyLock: {
                  modelSheet: `${e.name} — ${e.description}`,
                  doNotChange:
                    e.consistencyLock?.doNotChange ||
                    'Never redesign architecture, wall color, furniture layout, or signature props.',
                  referenceUrls: [
                    data.imageUrl as string,
                    ...(e.consistencyLock?.referenceUrls || []),
                    ...(e.referenceImageUrl ? [e.referenceImageUrl] : []),
                  ].filter((u, i, a) => a.indexOf(u) === i),
                  locked: true,
                  lockedAt: new Date().toISOString(),
                },
              }
            : e
        ),
      };
      updateProject(() => next);
      void forceSaveProject(next);
      if (typeof data.creditBalance === 'number') setCreditBalance(data.creditBalance);
      toast.success(`Set locked: ${env.name}`, {
        id: `env-ref-${envId}`,
        description: 'Insert on all shots from SETS. New frames image-edit from this plate.',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Set ref failed', { id: `env-ref-${envId}` });
    }
  }

  /** Plan a range edit on a clip (segment to regenerate / replace later). */
  function planRangeEdit(shotId: string, startSec: number, endSec: number, note?: string) {
    if (endSec <= startSec) {
      toast.error('End must be after start');
      return;
    }
    updateShot(shotId, {
      rangeEdit: { startSec, endSec, status: 'planned', note },
    });
    toast.success(`Range marked ${startSec}s–${endSec}s`, {
      description: 'Regen that beat with DRAFT/FINAL, then mark replaced when the new clip is attached.',
    });
  }

  function toggleCharacterOnShot(shotId: string, charId: string) {
    const shot = selectedProject?.shots.find(s => s.id === shotId);
    const current = shot?.characterIds || [];
    const next = current.includes(charId) 
      ? current.filter(id => id !== charId) 
      : [...current, charId];
    updateShot(shotId, { characterIds: next });
  }

  /** Insert a planning bridge still between this shot and the next (free until you gen). */
  function addTransitionAfter(shotId: string) {
    if (!selectedProject) return;
    const idx = selectedProject.shots.findIndex((s) => s.id === shotId);
    if (idx < 0 || idx >= selectedProject.shots.length - 1) {
      toast.error('Need a following shot to bridge into.');
      return;
    }
    const a = selectedProject.shots[idx];
    const b = selectedProject.shots[idx + 1];
    if (!(a.characterIds || []).length && !(b.characterIds || []).length) {
      toast.message('Tip: tag cast on both shots before bridging', {
        description: 'Bridges lock only tagged characters — empty tags risk random faces.',
      });
    }
    updateProject((p) => ({
      ...p,
      shots: insertTransitionAfter(p.shots, idx, p.defaultEnvironmentId),
    }));
    const needA = !a.imageUrl;
    const needB = !b.imageUrl;
    toast.success('Continuity bridge inserted', {
      description: needA || needB
        ? `Generate frames on ${needA ? 'the previous' : ''}${needA && needB ? ' and ' : ''}${needB ? 'the next' : ''} shot first — bridge is edited FROM those frames, not invented.`
        : '1) Tag cast on A & B  2) GENERATE FRAME on bridge (uses A+B as image edit)  3) Animate bridge  4) Assemble.',
    });
  }

  /** External Grok Imagine path — $0 MD credits: copy prompt, paste asset URL. */
  function attachExternalAsset(shotId: string, url: string) {
    const val = url.trim();
    if (!val) return;
    const isVid = /\.mp4($|\?)/i.test(val) || /\/video/i.test(val);
    if (isVid) {
      updateShot(shotId, { videoUrl: val });
      toast.success('External clip attached (0 MD credits)');
    } else {
      updateShot(shotId, { imageUrl: val });
      toast.success('External frame attached (0 MD credits)');
    }
  }

  function insertCharacterEverywhere(charId: string) {
    updateProject((p) => ({
      ...p,
      shots: insertCharacterOnAllShots(p.shots, charId),
    }));
    toast.success('Character tagged on all shots (memory + insertion).');
  }

  function removeCharacterEverywhere(charId: string) {
    updateProject((p) => ({
      ...p,
      shots: removeCharacterFromAllShots(p.shots, charId),
    }));
    toast.message('Character removed from all shots.');
  }

  function addCharacterMemoryFact(charId: string, fact: string) {
    updateProject((p) => ({
      ...p,
      characters: (p.characters || []).map((c) =>
        c.id === charId ? appendCharacterFact(c, fact) : c
      ),
    }));
  }

  async function generateTtsForShot(shotId: string) {
    const shot = selectedProject?.shots.find((s) => s.id === shotId);
    if (!shot || !selectedProject) return;
    const text = (shot.voiceoverScript || shot.dialogue || '').trim();
    if (!text) {
      toast.error('Write a VO line or dialogue first.');
      return;
    }
    if (!token || !isValidObjectId(selectedProject.id)) {
      toast.error('Sign in with a cloud project to generate studio voice.');
      setShowAuthModal(true);
      return;
    }
    const cost = speechCredits();
    if (!confirmSpend('speech', cost, 'xAI TTS line. Browser Speak stays free for previews.')) return;

    const cast = (selectedProject.characters || []).filter((c) =>
      shot.characterIds?.includes(c.id)
    );
    const voice =
      cast[0]?.ttsVoiceId ||
      cast[0]?.activeVoiceId ||
      'ara';
    // Map custom variant ids to nearest built-in TTS voice if needed
    const ttsVoice =
      XAI_TTS_VOICES.find((v) => v.id === voice)?.id ||
      XAI_TTS_VOICES[0].id;
    const styleHint = cast[0]
      ? `[as ${cast[0].name}] ${cast[0].directionNotes || cast[0].personality || ''}`.slice(0, 120)
      : undefined;

    toast.loading(`Generating voice (−${cost} cr)…`, { id: `tts-${shotId}` });
    try {
      const res = await fetch('/api/generate/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          text,
          voice: ttsVoice,
          styleHint,
          projectId: selectedProject.id,
          shotId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS') {
          toast.dismiss(`tts-${shotId}`);
          handleGenPaywall(data);
          return;
        }
        throw new Error(data.error || 'TTS failed');
      }
      const nextShots = selectedProject.shots.map((s) =>
        s.id === shotId ? { ...s, voiceAudioUrl: data.audioUrl as string } : s
      );
      updateShot(shotId, { voiceAudioUrl: data.audioUrl });
      void forceSaveProject({ ...selectedProject, shots: nextShots });
      if (typeof data.creditBalance === 'number') setCreditBalance(data.creditBalance);
      toast.success(`Voice ready (−${data.creditsCharged ?? cost} cr)`, { id: `tts-${shotId}` });
      if (data.audioUrl) {
        const a = new Audio(data.audioUrl);
        a.play().catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'TTS failed', { id: `tts-${shotId}` });
    }
  }

  function enhancePromptWithCharacters(basePrompt: string, shot: Shot): string {
    if (!selectedProject?.characters || !shot.characterIds?.length) return basePrompt;
    const chars = selectedProject.characters.filter(c => shot.characterIds?.includes(c.id));
    if (chars.length === 0) return basePrompt;

    const charDetails = chars.map(c => 
      `${c.name} (${c.role}): ${c.description}${c.referenceImageUrl ? ' [use exact visual reference]' : ''}`
    ).join(' | ');

    return `${basePrompt} IMPORTANT FOR CONSISTENCY — Cast: ${charDetails}. Maintain exact same faces, hair, clothing style, and presence across all shots.`;
  }

  // Override frame prompt to include cast consistency
  function getEnhancedFramePrompt(shot: Shot): string {
    const base = generateFramePrompt(shot);
    return enhancePromptWithCharacters(base, shot);
  }

  // === VOICEOVERS (Full AI pipeline) ===
  function updateVoiceover(shotId: string, script: string) {
    updateShot(shotId, { voiceoverScript: script });
  }

  function generateVoiceoverPrompt(shot: Shot): string {
    if (!selectedProject) return '';
    const cast = shot.characterIds?.length 
      ? ` Spoken by ${selectedProject.characters?.filter(c => shot.characterIds?.includes(c.id)).map(c => c.name).join(', ') || 'narrator'}.` 
      : '';
    return `Professional cinematic voiceover for shot in "${selectedProject.title}". Line: "${shot.description}". Tone: ${selectedProject.berserker ? 'intense, raw, emotional' : 'precise and cinematic'}.${cast} Natural delivery, subtle emotion.  ${shot.duration}s max.`;
  }

  function speakVoiceover(shot: Shot) {
    if (!shot.voiceoverScript && !shot.description) return;
    
    const text = shot.voiceoverScript || shot.description;
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = selectedProject?.type === 'anime' ? 1.1 : 1.0;
      window.speechSynthesis.speak(utterance);
      toast("Speaking line...");
    } else {
      toast.error("Browser speech not available.");
    }
  }

  function generateVoiceLine(shotId: string) {
    const shot = selectedProject?.shots.find(s => s.id === shotId);
    if (!shot) return;
    const prompt = generateVoiceoverPrompt(shot);
    const suggested = shot.description.length > 80 
      ? shot.description.slice(0, 80) + "..." 
      : shot.description;

    updateVoiceover(shotId, suggested);
    navigator.clipboard.writeText(prompt);
    toast.success("Voiceover script + prompt ready", { 
      description: "Browser voice is a quick preview. Studio VO audio will stay inside MovieDirector as we expand TTS." 
    });
  }

  // === SITCOM IDEA GENERATOR + FULL AI CREATION HELPERS ===
  function generateSitcomIdeas() {
    if (!selectedProject) return;
    const ideas = [
      `Episode idea: ${selectedProject.title} — The AI accidentally books the client a date with the "perfect" fictional character it invented.`,
      `Cold open: The team tries to use Grok to write the entire pitch in 4 minutes. It writes the perfect campaign… for the wrong product.`,
      `B-plot: Jordan starts role-playing as the brand mascot in real life and can't stop.`,
      `Heart turn: Alex realizes the most human idea came from a mistake the AI made.`,
      `Tag: The client loves the AI version so much they fire the agency and hire the AI directly.`
    ];
    const text = `SITCOM EPISODE IDEAS for "${selectedProject.title}"\n\n${ideas.join('\n\n')}\n\nSeason arc seed: The agency slowly realizes that the more they let the AI "help", the more they lose their own voice — until they use the AI as a collaborator instead of a replacement.`;

    // For now dump into synopsis or show alert + clipboard
    navigator.clipboard.writeText(text);
    toast.success("5 sitcom episode ideas generated", { description: "Ideas copied. Use them to expand the logline or start new episodes." });
    
    // Append to synopsis as well for persistence
    updateProject(p => ({
      ...p,
      synopsis: (p.synopsis || '') + '\n\n— AI GENERATED SITCOM IDEAS —\n' + ideas.join('\n')
    }));
  }

  function generateCommercialVariants() {
    if (!selectedProject) return;
    const variants = [
      "Hero version — emotional brand love story (60s)",
      "Disruptive cutdown — 15s shock + reveal",
      "User-generated style — shaky cam, real people reacting",
      "Animated brand fusion version"
    ];
    navigator.clipboard.writeText(variants.join('\n'));
    toast("Commercial variants generated", { description: "Copied. Create new projects from each angle." });
  }

  // === PRIVATE SUBSCRIPTION CHANNELS (MongoDB-backed) ===
  async function createChannel() {
    if (!requireAuth('create channels')) return;
    if (!newChannel.name.trim()) {
      toast.error('Channel needs a name');
      return;
    }
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newChannel),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels((prev) => [...prev, data]);
      setShowChannelModal(false);
      setNewChannel({ name: '', description: '', price: 9 });
      setCurrentView('channels');
      toast.success(`Channel "${data.name}" created — add episodes from your projects`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create channel');
    }
  }

  async function addProjectToChannel(channelId: string, projectId: string) {
    if (!token) return;
    try {
      const res = await fetch('/api/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channelId, projectId, action: 'add' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels((prev) => prev.map((ch) => (ch.id === channelId ? data : ch)));
      toast.success('Episode added to your series');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add episode');
    }
  }

  async function removeFromChannel(channelId: string, projectId: string) {
    if (!token) return;
    try {
      const res = await fetch('/api/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channelId, projectId, action: 'remove' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels((prev) => prev.map((ch) => (ch.id === channelId ? data : ch)));
      toast.info('Episode removed from channel');
    } catch {
      toast.error('Failed to remove episode');
    }
  }

  function openProfile(username: string) {
    setProfileUsername(username);
    setCurrentView('profile');
  }

  // Simple media asset collector
  const allGeneratedAssets = React.useMemo(() => {
    const assets: {url: string, type: 'image'|'video', projectTitle: string, shotId?: string}[] = [];
    projects.forEach(p => {
      p.shots.forEach(s => {
        if (s.imageUrl) assets.push({ url: s.imageUrl, type: 'image', projectTitle: p.title, shotId: s.id });
        if (s.videoUrl && s.videoUrl !== s.imageUrl) assets.push({ url: s.videoUrl, type: 'video', projectTitle: p.title, shotId: s.id });
      });
    });
    return assets;
  }, [projects]);

  // === SOCIAL MEDIA LAUNCH + PERSONAL BRAND TOOLS ===
  const PLATFORMS = [
    { id: 'tiktok', label: 'TikTok', ratio: '9:16', desc: '15-60s vertical hook' },
    { id: 'reels', label: 'IG Reels', ratio: '9:16', desc: '15-90s' },
    { id: 'shorts', label: 'YouTube Shorts', ratio: '9:16', desc: '15-60s' },
    { id: 'x', label: 'X / Twitter', ratio: '16:9 or 1:1', desc: 'Video or teaser' },
    { id: 'linkedin', label: 'LinkedIn', ratio: '16:9', desc: 'Professional brand film' },
    { id: 'yt', label: 'YouTube', ratio: '16:9', desc: 'Full episode / film' },
  ];

  function generateSocialCaptions(project: Project, platform: string) {
    const baseHook = project.logline.slice(0, 80) + "...";
    const ctas = {
      tiktok: "Full episode in my private channel → link in bio",
      reels: "The full story drops in my channel. Link in bio.",
      shorts: "Watch the full series on my channel 👀",
      x: "I turned my idea into a real film using Grok. Full thing here:",
      linkedin: "Personal brand film: How I built this with AI. Full project + behind the scenes in the link.",
      yt: "Full film + making-of in description."
    };
    const hashtags = ["#PersonalBrand", "#AIFilm", "#MovieDirector", "#IndieFilm", "#CreatorEconomy"];
    const platformSpecific = {
      tiktok: `POV: You launch your own movie as your personal brand. ${baseHook}`,
      reels: `This is what happens when your personal brand becomes cinema. ${baseHook}`,
    };

    const main = platformSpecific[platform as keyof typeof platformSpecific] || `${project.title}: ${baseHook}`;
    return `${main}\n\n${ctas[platform as keyof typeof ctas] || "Full version + more episodes in my channel."}\n\n${hashtags.join(' ')}`;
  }

  function generateThumbnailPrompt(project: Project) {
    return `Cinematic vertical thumbnail for social media. Title treatment "${project.title}". Dramatic key visual from the film, bold typography, film grain, high contrast, scroll-stopping. Personal brand energy. Ultra shareable.`;
  }

  function generateSocialCuts(project: Project) {
    // Suggest ways to chop the project for social
    return [
      { platform: 'TikTok / Reels', length: '15s Hook', desc: 'Cold open or biggest twist moment', prompt: 'Re-cut the first shot + strongest visual into a vertical 15s hook with big text overlay.' },
      { platform: 'Shorts', length: '45-60s', desc: 'Emotional peak or funny beat', prompt: 'Take the heart moment + climax, make fast-cut vertical version.' },
      { platform: 'Long-form teaser', length: '90s', desc: 'Trailer for the full film', prompt: 'Assemble best 3 shots into a 90s trailer optimized for YouTube.' },
    ];
  }

  function createSocialRelease(projectId: string, note?: string) {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const releaseText = `Just dropped my new ${proj.type} "${proj.title}" as part of my personal brand. Made with Grok. Watch the full thing + more in my channel.`;
    navigator.clipboard.writeText(releaseText + "\n\n" + proj.logline);
    toast.success(`Social drop prepared for "${proj.title}"`, { description: "Caption copied. Use the Social Studio to export platform packs." });
    // Switch user to social view
    setCurrentView('social');
  }

  // === COST PLANNING & MOVIE RENDER SYSTEM ===
  const GENERATION_COST_PER_SECOND_720 = 0.14; // Grok Imagine 1.5 realistic
  const GENERATION_COST_PER_SECOND_480 = 0.08;
  const RETRY_FACTOR = 1.7; // variations, extensions, bad takes

  function estimateMovieCost(numShots: number, avgDuration: number = 10, quality: '480' | '720' = '720') {
    const seconds = numShots * avgDuration;
    const base = quality === '720' ? GENERATION_COST_PER_SECOND_720 : GENERATION_COST_PER_SECOND_480;
    const totalGen = seconds * base * RETRY_FACTOR;
    return Math.round(totalGen * 100) / 100;
  }

  function generateBatchPrompts(project: Project) {
    return project.shots.map((shot, i) => ({
      shotNumber: shot.number,
      prompt: generateVideoPrompt(shot),
      referenceImages: [
        ...(project.style?.referenceImageUrl ? [project.style.referenceImageUrl] : []),
        ... (project.characters || []).filter(c => shot.characterIds?.includes(c.id)).map(c => c.referenceImageUrl).filter(Boolean)
      ],
      duration: shot.duration
    }));
  }

  async function renderFullMovie(project: Project) {
    const clips = project.shots.map(s => s.videoUrl).filter(Boolean) as string[];

    if (clips.length < 1) {
      toast.error('Need at least one generated clip to render a movie.');
      return;
    }

    if (!token) {
      toast.error('Sign in to render your film');
      setShowAuthModal(true);
      return;
    }

    setShowMovieRender(true);
    setMovieRenderProgress(5);

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: project.id,
          dropStillBridges: true,
          aiAssemble: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Render failed to start');

      if (!data.workerQueued) {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const manifest = {
          project: project.title,
          concept: project.concept,
          style: project.style?.description,
          totalDuration: project.shots.reduce((a, s) => a + s.duration, 0),
          shotList: project.shots.map(s => ({
            number: s.number,
            description: s.description,
            duration: s.duration,
            videoSource: s.videoUrl || 'NOT_GENERATED',
          })),
          clipUrls: clips,
          exportDate: new Date().toISOString(),
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.file('clips.txt', clips.map((url, i) => `file 'clip_${String(i).padStart(3, '0')}.mp4'`).join('\n'));
        zip.file('README.txt', 
`MovieDirector Export
Project: ${project.title}
To stitch into a single MP4 (requires ffmpeg):

1. Download all clips referenced in manifest.
2. Put them in a folder.
3. Run: ffmpeg -f concat -safe 0 -i clips.txt -c copy ${project.title.toLowerCase().replace(/\s+/g, '-')}.mp4

Alternative: Set up Render worker for one-click server-side render.
`);
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.title.toLowerCase().replace(/\s+/g, '-')}-export-package.zip`;
        a.click();
        setMovieRenderProgress(100);
        toast.success('Export package ready (includes ffmpeg instructions)');
        setTimeout(() => { setShowMovieRender(false); setMovieRenderProgress(0); }, 1200);
        return;
      }

      const poll = setInterval(async () => {
        const jobRes = await fetch(`/api/render/${data.jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!jobRes.ok) return;
        const job = await jobRes.json();
        setMovieRenderProgress(job.progress || 10);

        if (job.status === 'done' && job.outputUrl) {
          clearInterval(poll);
          setMovieRenderProgress(100);
          const a = document.createElement('a');
          a.href = job.outputUrl;
          a.download = `${project.title.toLowerCase().replace(/\s+/g, '-')}.mp4`;
          a.click();
          toast.success('Full movie rendered!');
          setTimeout(() => { setShowMovieRender(false); setMovieRenderProgress(0); }, 1200);
        } else if (job.status === 'failed') {
          clearInterval(poll);
          toast.error(job.error || 'Render failed');
          setShowMovieRender(false);
          setMovieRenderProgress(0);
        }
      }, 5000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Render failed');
      setShowMovieRender(false);
      setMovieRenderProgress(0);
    }
  }

  async function handlePasswordReset() {
    if (!resetToken || !newPassword || newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password reset successful. Please sign in.');
        setResetToken(null);
        setNewPassword('');
        setResetError('');
        setShowAuthModal(true);
      } else {
        setResetError(data.error || 'Reset failed');
      }
    } catch {
      setResetError('Network error');
    }
  }

  async function publishToFeed() {
    if (!selectedProject || !token || !currentUser) {
      toast.error('Sign in to publish to the feed');
      setShowAuthModal(true);
      return;
    }

    if (!isValidObjectId(selectedProject.id)) {
      toast.error('Save this project to the cloud first', {
        description: 'Create the project while signed in, or open it from The Vault after it saves. Local/demo IDs cannot publish.',
      });
      return;
    }

    const hasMedia = selectedProject.shots.some((s) => s.videoUrl || s.imageUrl);
    if (!hasMedia) {
      toast.error('Generate at least one frame or video clip first', {
        description: 'Go to Storyboard / Clips, generate media, then publish so the feed has something to play.',
      });
      setActiveTab('clips');
      return;
    }

    toast.loading('Publishing to the public feed…', { id: 'publish-feed' });
    try {
      // Force-save latest shots before publish
      const saveRes = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: selectedProject.title,
          type: selectedProject.type,
          logline: selectedProject.logline,
          concept: selectedProject.concept,
          synopsis: selectedProject.synopsis,
          style: selectedProject.style,
          berserker: selectedProject.berserker,
          shots: selectedProject.shots,
          characters: selectedProject.characters,
          isPublic: true,
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Could not save project before publish');
      }

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: selectedProject.id,
          shots: selectedProject.shots,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Publish failed');

      const item = data.feedItem;
      // Reload feed from server so everyone sees the same list
      const fresh = await loadFeed();
      if (fresh?.items?.length) {
        setFeed(fresh.items);
        setFeedCursor(fresh.nextCursor);
        setFeedHasMore(!!fresh.hasMore);
      } else if (item) {
        setFeed((prev) => [item, ...prev.filter((f: { id?: string }) => f.id !== item.id)]);
      }

      toast.success(`"${selectedProject.title}" is live on the Feed!`, {
        id: 'publish-feed',
        description: data.hasVideo
          ? 'Preview video is on the feed card.'
          : 'Preview still is on the feed (add video clips for full playback).',
      });
      setCurrentView('feed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed', { id: 'publish-feed' });
    }
  }

  async function toggleLike(feedItemId: string) {
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    const res = await fetch('/api/feed/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ feedItemId }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setFeed(prev => prev.map((item: { id: string; likeCount?: number }) =>
      item.id === feedItemId ? { ...item, likeCount: data.likeCount ?? item.likeCount } : item
    ));
    setLikedFeedIds(prev => {
      const next = new Set(prev);
      if (data.liked) next.add(feedItemId);
      else next.delete(feedItemId);
      return next;
    });
  }

  // === TIMELINE ===
  function reorderShots(fromIndex: number, toIndex: number) {
    if (!selectedProject) return;
    const shots = [...selectedProject.shots];
    const [moved] = shots.splice(fromIndex, 1);
    shots.splice(toIndex, 0, moved);
    const renumbered = shots.map((s, i) => ({ ...s, number: i + 1 }));
    updateProject(p => ({ ...p, shots: renumbered }));
  }

  function moveShot(shotId: string, direction: 'up' | 'down') {
    if (!selectedProject) return;
    const idx = selectedProject.shots.findIndex(s => s.id === shotId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= selectedProject.shots.length) return;
    reorderShots(idx, newIdx);
  }

  // Playback of sequence (uses videoUrls when available, otherwise images + captions + voiceovers)
  function togglePlayback() {
    if (!selectedProject || selectedProject.shots.length === 0) return;
    
    if (isPlaying) {
      setIsPlaying(false);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      return;
    }
    
    setIsPlaying(true);
    setCurrentShotIndex(0);

    let index = 0;
    const playNext = () => {
      if (index >= selectedProject.shots.length) {
        setIsPlaying(false);
        setCurrentShotIndex(0);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        return;
      }

      setCurrentShotIndex(index);

      const shot = selectedProject.shots[index];
      
      // Speak voiceover or caption if present
      const speakText = shot.voiceoverScript || shot.caption;
      if (speakText && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(speakText);
        u.rate = 0.92;
        window.speechSynthesis.speak(u);
      }

      const delay = Math.max(700, (shot.duration || 4) * 650);
      setTimeout(() => {
        index++;
        playNext();
      }, delay);
    };

    playNext();
  }

  // Export functions (future real render)
  function exportSequence() {
    if (!selectedProject) return;
    const data = JSON.stringify(selectedProject, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProject.title.toLowerCase().replace(/\s+/g, '-')}-cut.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Cut exported. Ready for the real render pipeline.");
  }

  function copyApiExample() {
    const example = `curl -X POST https://api.moviedirector.ai/v1/projects \\
  -H "Authorization: Bearer $GROK_DIRECTOR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "${selectedProject?.title || 'NEW PROJECT'}",
    "type": "${selectedProject?.type || 'film'}",
    "logline": "${selectedProject?.logline || ''}",
    "berserker": ${!!selectedProject?.berserker},
    "action": "generate_full_cut"
  }'`;
    navigator.clipboard.writeText(example);
    toast.success("API example copied. The future has strong APIs.");
  }

  // UI helpers
  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { 
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
  });

  const totalRuntime = selectedProject 
    ? selectedProject.shots.reduce((sum, s) => sum + s.duration, 0) 
    : 0;

  const completion = selectedProject 
    ? Math.round((selectedProject.shots.filter(s => s.imageUrl).length / Math.max(1, selectedProject.shots.length)) * 100)
    : 0;

  // Render
  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white film-grain">
      {/* Cinematic Top Bar */}
      <header className="border-b border-white/10 bg-[#050505]/95 backdrop-blur z-50 sticky top-0">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              onClick={() => { 
                setCurrentView('landing'); 
                setSelectedProjectId(null); 
              }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img 
                src="/logo.png" 
                alt="MovieDirector.ai" 
                className="h-14 w-auto drop-shadow-[0_0_12px_rgba(197,164,110,0.5)] group-hover:scale-[1.01] transition-all"
                style={{ maxWidth: '220px', objectFit: 'contain' }}
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'flex items-center gap-3';
                    fallback.innerHTML = `
                      <div class="w-9 h-9 rounded bg-[#111] flex items-center justify-center">
                        <span class="text-[var(--gold)] text-xl">🎬</span>
                      </div>
                      <div>
                        <div class="font-display text-2xl tracking-[-1.5px] leading-none">MOVIEDIRECTOR</div>
                        <div class="text-[10px] text-[var(--gold)] tracking-[3px] -mt-0.5">POWERED BY GROK</div>
                      </div>
                    `;
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>

            <div className="ml-6 flex items-center gap-2 text-xs uppercase tracking-[2px] text-white/50">
              <div>UNCHAINED CINEMA</div>
              <div className="w-px h-3 bg-white/20" />
              <div>AT SCALE</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <button onClick={() => { setCurrentView('dashboard'); setSelectedProjectId(null); }} className="btn-ghost px-3 py-1 rounded-full text-sm">Projects</button>
            <button onClick={() => setCurrentView('feed')} className="btn-ghost px-3 py-1 rounded-full text-sm">Feed</button>
            <button onClick={() => { if (!currentUser) { setShowAuthModal(true); return; } setCurrentView('messages'); }} className="btn-ghost px-3 py-1 rounded-full text-sm">Messages</button>
            <button onClick={() => setCurrentView('social')} className="btn-ghost px-3 py-1 rounded-full text-sm flex items-center gap-1"><Share2 className="w-3.5 h-3.5"/> Social</button>
            <button onClick={() => { if (!currentUser) { setShowAuthModal(true); return; } setCurrentView('channels'); }} className="btn-ghost px-3 py-1 rounded-full text-sm">Channels</button>
            <button onClick={() => setCurrentView('ideas')} className="btn-ghost px-3 py-1 rounded-full text-sm flex items-center gap-1"><Zap className="w-3.5 h-3.5"/> Idea Lab</button>
            <button onClick={() => { if (!currentUser) { setShowAuthModal(true); return; } setCurrentView('billing'); }} className="btn-ghost px-3 py-1 rounded-full text-sm text-[var(--gold)]">
              {currentUser && creditBalance !== null ? `${creditBalance} cr` : 'Pricing'}
            </button>
            <button
              onClick={startProductTour}
              className="btn-outline px-3 py-1 rounded-full text-sm border-[var(--gold)]/40 text-[var(--gold)]"
              title="Interactive product tour"
            >
              Take the tour
            </button>
            <button onClick={() => setShowNewModal(true)} className="flex items-center gap-1.5 px-4 py-1 rounded-full bg-white/10 hover:bg-white/20 text-sm"><Plus className="w-3.5 h-3.5"/> New</button>
            <div className="pl-4 border-l border-white/10 text-xs text-white/50 font-mono">GROK</div>
            {currentUser ? (
              <>
                <button onClick={() => openProfile(currentUser.username)} className="btn-ghost px-3 py-1 rounded-full text-sm">@{currentUser.username}</button>
                <button onClick={signOut} className="btn-ghost px-3 py-1 rounded-full text-sm text-white/50">Sign out</button>
              </>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="btn-gold text-black px-4 py-1 rounded-full text-sm">Sign up / In</button>
            )}
          </div>
        </div>
      </header>

      {/* LANDING — Epic and ambitious */}
      {currentView === 'landing' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#222_0.8px,transparent_1px)] bg-[length:4px_4px] opacity-50" />
          
          <div className="relative z-10 max-w-5xl">
            <div className="flex justify-center mb-8">
              <img 
                src="/logo.png" 
                alt="MovieDirector.ai" 
                className="h-28 md:h-36 w-auto drop-shadow-[0_0_30px_rgba(197,164,110,0.6)]"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>

            <div className="inline-flex flex-wrap items-center justify-center gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-white/20 text-xs tracking-[3px]">
                GROK IMAGINE + VIDEO • UNCHAINED CREATIVE ENGINE
              </div>
              <button
                onClick={startProductTour}
                className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-[var(--gold)]/50 text-xs tracking-[2px] text-[var(--gold)] hover:bg-[var(--gold)]/10"
              >
                TAKE THE TOUR →
              </button>
            </div>

            <h1 className="font-display text-[72px] leading-[0.9] tracking-[-4px] font-medium mb-4">
              MAKE THE<br />IMPOSSIBLE<br />WATCHABLE.
            </h1>
            
            <p className="max-w-[620px] mx-auto text-2xl text-white/70 tracking-tight mb-12">
              Create real films and sitcoms with Grok. Drop them as your personal brand content across every social platform. Your episodes become your feed.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  if (!currentUser) {
                    setShowAuthModal(true);
                    return;
                  }
                  setShowFirstCut(true);
                }}
                className="btn-gold px-10 py-4 text-lg rounded-full flex items-center justify-center gap-3"
              >
                CREATE YOUR FREE FIRST CUT <Wand2 className="w-5 h-5" />
              </button>
              {!currentUser && (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="btn-outline px-9 py-4 text-lg rounded-full"
                >
                  JOIN FREE — NO CARD
                </button>
              )}
              <button 
                onClick={() => {
                  if (projects.length > 0) {
                    openProject(projects[0]);
                  } else if (currentUser) {
                    setShowFirstCut(true);
                  } else {
                    setShowAuthModal(true);
                  }
                }}
                className="btn-outline px-9 py-4 text-lg rounded-full flex items-center justify-center gap-3"
              >
                ENTER THE VAULT
              </button>
            </div>
            <p className="mt-6 text-sm text-white/45 max-w-xl mx-auto">
              Free forever for planning. Free sample generations for a sitcom pilot, short film, commercial, or launch trailer.
              Then a 7-day Creator trial → paid membership.
            </p>

            <div className="mt-20 flex flex-wrap justify-center gap-x-12 gap-y-3 text-xs tracking-[2px] text-white/50">
              <div>LAUNCH FILMS AS YOUR PERSONAL BRAND</div>
              <div>SHARE EVERYWHERE — TIKTOK, REELS, X, LINKEDIN</div>
              <div>SITCOMS AS THE NEW SOCIAL FEED</div>
              <div>PRIVATE CHANNELS + PUBLIC DROPS</div>
              <div>POWERED BY GROK VIDEO</div>
            </div>
          </div>

          {/* Pricing teaser on landing */}
          {publicPlans.length > 0 && (
            <div className="relative z-10 w-full max-w-6xl mx-auto mt-24 mb-16 px-4 text-left">
              <div className="text-center mb-8">
                <div className="uppercase tracking-[3px] text-xs text-[var(--gold)] mb-2">MEMBERSHIP + USAGE</div>
                <div className="font-display text-4xl md:text-5xl tracking-tight">Plans built for big MRR</div>
                <p className="text-white/50 mt-2 text-sm max-w-xl mx-auto">
                  Monthly membership for base access. Credits for every frame and clip. Top up anytime — you control spend.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {publicPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`rounded-3xl p-5 border text-left ${
                      plan.highlighted ? 'border-[var(--gold)]/60 bg-[var(--gold)]/5' : 'border-white/10 bg-black/40'
                    }`}
                  >
                    <div className="font-display text-2xl">{plan.name}</div>
                    <div className="text-white/50 text-xs mt-1 min-h-[32px]">{plan.tagline}</div>
                    <div className="font-mono text-3xl mt-3">
                      {plan.priceMonthlyUsd === 0 ? '$0' : `$${plan.priceMonthlyUsd}`}
                      <span className="text-sm text-white/40">/mo</span>
                    </div>
                    <div className="text-[var(--gold)] text-xs mt-2 mb-3">
                      {plan.monthlyCredits > 0
                        ? `${plan.monthlyCredits.toLocaleString()} credits / mo`
                        : `${plan.signupCredits} starter credits`}
                    </div>
                    <ul className="text-[11px] text-white/55 space-y-1 mb-4">
                      {plan.features.slice(0, 3).map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                    <button
                      onClick={() => {
                        if (!currentUser) { setShowAuthModal(true); return; }
                        setCurrentView('billing');
                      }}
                      className={`w-full py-2 rounded-2xl text-xs ${plan.highlighted ? 'btn-gold text-black' : 'btn-outline'}`}
                    >
                      {plan.id === 'free' ? 'Start free' : 'Choose plan'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teaser strip */}
          <div className="relative z-10 text-[10px] text-white/40 tracking-[4px] mb-8">
            YOUR FILMS ARE YOUR PERSONAL BRAND. SHARE EVERYWHERE.
          </div>
        </div>
      )}

      {/* BILLING */}
      {currentView === 'billing' && (
        <BillingPanel
          token={token}
          onAuthRequired={() => setShowAuthModal(true)}
          onClose={() => setCurrentView(currentUser ? 'dashboard' : 'landing')}
          onStartFirstCut={() => setShowFirstCut(true)}
          onStartTrial={startTrial}
        />
      )}

      {/* PASSWORD RESET */}
      {resetToken && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6">
          <div className="director-card p-8 rounded-3xl max-w-md w-full">
            <div className="font-display text-3xl mb-4">Reset Password</div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full p-3 rounded-xl bg-black border border-white/10 mb-4"
            />
            {resetError && <div className="text-red-400 text-sm mb-2">{resetError}</div>}
            <button onClick={handlePasswordReset} className="btn-gold w-full py-3 rounded-2xl">Set New Password</button>
            <button onClick={() => { setResetToken(null); setNewPassword(''); }} className="mt-3 text-sm text-white/60 w-full">Cancel</button>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      {currentView === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="mb-6 p-4 border border-[var(--gold)]/30 rounded-2xl bg-[#111]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px]">
                <div className="uppercase text-xs tracking-widest mb-1 text-[var(--gold)]">
                  {firstCutStatus === 'not_started' || firstCutStatus === 'skipped'
                    ? 'FREE FIRST CUT · NO CARD'
                    : firstCutStatus === 'in_progress'
                      ? 'FIRST CUT IN PROGRESS · FREE SAMPLE GENS'
                      : trialActive
                        ? 'CREATOR TRIAL ACTIVE'
                        : 'DIRECTOR JOURNEY'}
                </div>
                <div className="text-sm">
                  {firstCutStatus === 'not_started' || firstCutStatus === 'skipped' ? (
                    <>Start a free walkthrough: sitcom pilot, short film, commercial, or launch trailer. Get a real sample media asset — then a 7-day free trial.</>
                  ) : firstCutStatus === 'in_progress' ? (
                    <>Generate free frames ({firstCutFree?.images ?? 0} left) + free clips ({firstCutFree?.videos ?? 0} left) on your sample project. Then start trial for full episodes.</>
                  ) : trialActive ? (
                    <>Trial credits power full generation. Finish your film, publish to the feed, then stay on Creator when trial ends.</>
                  ) : (
                    <>1. First Cut sample → 2. Free trial → 3. Paid membership + usage credits. Planning is always free.</>
                  )}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <div className="font-mono text-2xl text-[var(--gold)]">{creditBalance ?? 0} <span className="text-sm text-white/50">cr</span></div>
                {(firstCutStatus === 'not_started' || firstCutStatus === 'skipped') && (
                  <button onClick={() => setShowFirstCut(true)} className="btn-gold text-xs px-4 py-1.5 rounded-full text-black">Start First Cut</button>
                )}
                {firstCutStatus === 'completed' && !trialActive && !hasUsedTrial && (
                  <button onClick={() => setShowTrialOffer(true)} className="btn-gold text-xs px-4 py-1.5 rounded-full text-black">Start free trial</button>
                )}
                <button onClick={() => setCurrentView('billing')} className="text-xs underline text-white/60">Billing & plans</button>
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="uppercase tracking-[4px] text-xs text-[var(--gold)] mb-1">THE VAULT</div>
              <div className="text-6xl font-display tracking-[-2.5px]">Your Projects</div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={recoverLostMedia}
                className="btn-outline flex items-center gap-2 px-5 py-3 rounded-full text-sm"
                title="Rebuild a project from any frames/clips still in Blob, jobs, or local vault"
              >
                Recover lost clips
              </button>
              <button
                onClick={() => setShowNewModal(true)}
                className="btn-gold flex items-center gap-3 px-8 py-3 rounded-full text-base"
              >
                <Plus className="w-5 h-5" /> NEW PRODUCTION
              </button>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-20 border border-white/10 rounded-3xl">
              <p className="text-white/50">No projects yet. The slate is blank.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((project) => {
                const progress = Math.round((project.shots.filter(s => s.imageUrl).length / project.shots.length) * 100);
                return (
                  <div 
                    key={project.id} 
                    onClick={() => openProject(project)}
                    className="director-card group p-6 rounded-3xl cursor-pointer flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`type-pill ${TYPE_STYLES[project.type]}`}>{PROJECT_TYPES.find(t => t.value === project.type)?.label}</div>
                      {project.berserker && (
                        <div className="text-[10px] px-3 py-px rounded bg-[#b91c1c] text-white font-semibold tracking-widest">BERSERKER</div>
                      )}
                    </div>

                    <div className="font-display text-4xl tracking-[-1.5px] leading-none mb-3 group-hover:text-[var(--gold)] transition-colors">
                      {project.title}
                    </div>
                    <p className="text-white/70 line-clamp-2 text-[15px] mb-6">{project.logline}</p>

                    <div className="mt-auto pt-5 border-t border-white/10 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-white/60">
                        <div className="flex -space-x-1">
                          {Array.from({ length: Math.min(5, project.shots.length) }).map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-white/30 ring-1 ring-[#050505]" />
                          ))}
                        </div>
                        {project.shots.length} SHOTS • {Math.floor(totalRuntime / 60)}m
                      </div>
                      <div className="text-[var(--gold)] text-xs tracking-widest">{progress}% BOARDED</div>
                    </div>

                    <div onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }} 
                         className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* USER PROFILE */}
      {currentView === 'profile' && profileUsername && (
        <UserProfile
          username={profileUsername}
          token={token}
          currentUserId={currentUser?.id}
          onBack={() => { setCurrentView('feed'); setProfileUsername(null); }}
          onOpenFilm={(film) => openFilmDetail(film)}
          onMessage={(userId, username) => {
            setSelectedConversation(userId);
            setChatPartner({ id: userId, username });
            setCurrentView('messages');
            if (token) loadMessages(userId, token).then((d) => setMessages(d.messages));
          }}
          onAuthRequired={() => setShowAuthModal(true)}
        />
      )}

      {/* CHANNELS — Private Subscription Channels */}
      {currentView === 'channels' && (
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="uppercase tracking-[4px] text-xs text-[var(--gold)] mb-1">PRODUCTION SERIES</div>
              <div className="text-6xl font-display tracking-[-2.5px]">Your Channels</div>
              <p className="text-white/60 text-sm mt-2">Serialized sitcoms and films — subscribers get every episode. Beta: subscriptions are free.</p>
            </div>
            <button onClick={() => setShowChannelModal(true)} className="btn-gold px-8 py-3 rounded-full flex items-center gap-2">
              <Plus className="w-5 h-5"/> NEW SERIES
            </button>
          </div>

          {subscribedChannels.length > 0 && (
            <div className="mb-10">
              <div className="uppercase tracking-widest text-xs text-[var(--cyan)] mb-3">CHANNELS YOU SUBSCRIBE TO</div>
              <div className="grid md:grid-cols-2 gap-4">
                {subscribedChannels.map((ch: { id: string; name: string; owner?: { username: string }; episodes: { title: string }[] }) => (
                  <div key={ch.id} className="director-card p-5 rounded-2xl">
                    <div className="font-display text-xl">{ch.name}</div>
                    <div className="text-xs text-white/50">by @{ch.owner?.username} • {ch.episodes?.length || 0} episodes</div>
                    {ch.owner && (
                      <button onClick={() => openProfile(ch.owner!.username)} className="text-xs text-[var(--gold)] mt-2 hover:underline">View creator profile</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {channels.length === 0 ? (
            <div className="p-16 text-center border border-white/10 rounded-3xl">
              <Globe className="mx-auto mb-4 opacity-40" />
              <p className="text-xl">No channels yet. Turn your shows into recurring revenue.</p>
              <button onClick={() => setShowChannelModal(true)} className="mt-6 btn-outline px-6 py-2 rounded-2xl">Launch your first channel</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {channels.map(ch => {
                const linked = projects.filter(p => ch.projectIds.includes(p.id));
                return (
                  <div key={ch.id} className="director-card p-8 rounded-3xl">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-display text-4xl tracking-tight">{ch.name}</div>
                        <div className="text-white/60 mt-1">Beta • ${ch.price ?? 9}/mo • {ch.projectIds.length} episodes • {ch.subscriberCount ?? 0} subscribers</div>
                      </div>
                      <div className="text-right text-xs text-white/50">PRIVATE</div>
                    </div>
                    <p className="mt-4 text-white/80">{ch.description}</p>

                    <div className="mt-6">
                      <div className="text-xs uppercase tracking-widest text-white/50 mb-2">EPISODES IN CHANNEL</div>
                      {linked.length > 0 ? (
                        linked.map(proj => (
                          <div key={proj.id} className="flex justify-between items-center py-2 border-b border-white/10">
                            <div>{proj.title}</div>
                            <button onClick={() => removeFromChannel(ch.id, proj.id)} className="text-red-400 text-xs">REMOVE</button>
                          </div>
                        ))
                      ) : <div className="text-white/40">No episodes added yet.</div>}
                    </div>

                    <div className="mt-6">
                      <div className="text-xs text-white/50 mb-2">Add a show to this channel</div>
                      <div className="flex flex-wrap gap-2">
                        {projects.filter(p => !ch.projectIds.includes(p.id)).slice(0,4).map(p => (
                          <button key={p.id} onClick={() => addProjectToChannel(ch.id, p.id)} className="text-xs px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full">{p.title}</button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 text-xs text-white/50 flex justify-between items-center">
                      <div>{ch.subscriberCount ?? 0} subscribers • $${ch.price ?? 9}/mo (beta)</div>
                      <button
                        onClick={() => {
                          if (!currentUser) return;
                          const url = `${window.location.origin}/u/${currentUser.username}`;
                          navigator.clipboard.writeText(url);
                          toast.success('Profile link copied — share it so viewers can subscribe');
                        }}
                        className="underline hover:text-white"
                      >
                        Share series link
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {currentUser && (
            <div className="mt-12 director-card p-6 rounded-3xl">
              <div className="text-sm text-white/70 mb-2">Your public creator page — share this so fans subscribe to your series:</div>
              <div className="flex gap-2 items-center">
                <code className="flex-1 text-xs bg-black/50 px-4 py-2 rounded-xl text-[var(--gold)] truncate">
                  {typeof window !== 'undefined' ? `${window.location.origin}/u/${currentUser.username}` : `/u/${currentUser.username}`}
                </code>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/u/${currentUser.username}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Profile URL copied');
                  }}
                  className="btn-gold px-5 py-2 rounded-xl text-sm text-black shrink-0"
                >
                  Copy
                </button>
                <button onClick={() => openProfile(currentUser.username)} className="btn-outline px-5 py-2 rounded-xl text-sm shrink-0">Preview</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* IDEA LAB — Full AI for turning ideas into sitcoms, movies, commercials */}
      {currentView === 'ideas' && (
        <div className="max-w-5xl mx-auto px-8 py-12">
          <div className="font-display text-7xl tracking-[-3px] mb-2">Idea Lab</div>
          <p className="text-2xl text-white/70 max-w-xl">Use Grok to turn any spark into full shows, commercials, and consistent universes.</p>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <div className="director-card p-8 rounded-3xl">
              <div className="uppercase tracking-widest text-xs text-[var(--gold)]">SITCOM MODE</div>
              <div className="text-3xl font-display mt-3 mb-6 tracking-tight">Turn anything into a serialized sitcom</div>
              <div className="space-y-3 text-sm text-white/80">
                <div>• Generate season arc + 8 episode ideas</div>
                <div>• Create recurring characters with consistency baked in</div>
                <div>• Cold opens, A/B plots, tags automatically</div>
                <div>• "Everyone has an episode" publishing model</div>
              </div>
              <button onClick={() => { setCurrentView('dashboard'); setShowNewModal(true); }} className="mt-8 btn-gold px-8 py-2.5 rounded-2xl text-sm">Start a new sitcom project</button>
            </div>

            <div className="director-card p-8 rounded-3xl">
              <div className="uppercase tracking-widest text-xs text-[var(--cyan)]">COMMERCIAL + MOVIE MODE</div>
              <div className="text-3xl font-display mt-3 mb-6 tracking-tight">Fast high-impact assets</div>
              <ul className="space-y-2 text-sm">
                <li>Brand fusion movies</li>
                <li>15s / 30s / 60s variants</li>
                <li>Multiple tones from same script</li>
                <li>Reusable media assets across campaigns</li>
              </ul>
              <button onClick={() => { setCurrentView('dashboard'); }} className="mt-8 btn-outline px-8 py-2.5 rounded-2xl text-sm">Go to projects</button>
            </div>
          </div>

          <div className="mt-10 text-xs text-white/50">Open any project and use the new CAST + VOICE + GENERATE SITCOM IDEAS buttons for powerful AI-assisted creation.</div>
        </div>
      )}

      {/* SOCIAL STUDIO — Personal brand films + social drops */}
      {currentView === 'social' && (
        <div className="max-w-7xl mx-auto px-8 py-12">
          {!currentUser && (
            <div className="mb-8 p-5 rounded-2xl border border-[var(--gold)]/30 bg-[#111] text-center">
              <p className="text-white/70 mb-3">Sign in to share your production series across TikTok, Reels, X, LinkedIn, and more.</p>
              <button onClick={() => setShowAuthModal(true)} className="btn-gold px-8 py-2 rounded-full text-sm text-black">Join free</button>
            </div>
          )}
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="uppercase tracking-[4px] text-xs text-[var(--gold)] mb-1">PERSONAL BRAND CINEMA</div>
              <div className="text-6xl font-display tracking-[-2.5px]">Social Studio</div>
              <p className="text-xl text-white/70 mt-2 max-w-xl">Turn your films into personal brand content. Drop episodes, teasers, and full movies across every platform.</p>
            </div>
            <button onClick={() => setCurrentView('dashboard')} className="btn-outline px-6 py-3 rounded-full">Browse your films</button>
          </div>

          {/* Quick Launch from existing projects */}
          <div className="mb-12">
            <div className="uppercase tracking-[3px] text-xs text-white/50 mb-3">LAUNCH A FILM AS YOUR PERSONAL BRAND</div>
            <div className="grid md:grid-cols-3 gap-4">
              {projects.length > 0 ? projects.slice(0,6).map(proj => (
                <div key={proj.id} onClick={() => { setSelectedProjectId(proj.id); setCurrentView('workspace'); setActiveTab('publish'); }} 
                     className="director-card p-6 rounded-3xl cursor-pointer hover:border-[var(--gold)] transition-all group">
                  <div className={`type-pill ${TYPE_STYLES[proj.type]} mb-3`}>{proj.type.toUpperCase()}</div>
                  <div className="font-display text-3xl tracking-tight group-hover:text-[var(--gold)]">{proj.title}</div>
                  <div className="text-sm text-white/60 mt-2 line-clamp-2">{proj.logline}</div>
                  <div className="mt-4 text-[var(--gold)] text-sm flex items-center gap-2">Launch to social →</div>
                </div>
              )) : <div className="text-white/50">Create a project first to launch it socially.</div>}
            </div>
          </div>

          {/* Social Cuts + Platform Tools */}
          <div className="mb-12">
            <div className="font-display text-4xl tracking-tight mb-4">Platform-Optimized Cuts</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PLATFORMS.map(p => (
                <div key={p.id} className="director-card p-6 rounded-3xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-xl">{p.label}</div>
                      <div className="text-[var(--cyan)] text-sm">{p.ratio}</div>
                    </div>
                    <div className="text-xs px-3 py-1 border border-white/20 rounded">{p.desc}</div>
                  </div>
                  <div className="mt-6 text-sm text-white/70">
                    Vertical/social cuts are made <strong className="text-white/90">inside MovieDirector</strong> with the same Grok engine — never leave the site.
                  </div>
                  <button
                    onClick={() => {
                      const proj = projects.find((pr) => isValidObjectId(pr.id)) || projects[0];
                      if (!proj) {
                        toast.error('Create a project first');
                        setShowNewModal(true);
                        return;
                      }
                      if (!token || !isValidObjectId(proj.id)) {
                        toast.error('Open a cloud-saved project, then generate the cut in Clips');
                        setShowNewModal(true);
                        return;
                      }
                      setSelectedProjectId(proj.id);
                      setCurrentView('workspace');
                      setActiveTab('clips');
                      toast.success(`${p.label} cut — generate in MovieDirector`, {
                        description: `9:16 / short-hook energy. Use GENERATE FRAME then GENERATE VIDEO on your best shot. Everything runs on MD (Grok API under the hood).`,
                      });
                    }}
                    className="mt-4 btn-gold text-black px-5 py-1.5 text-sm rounded-2xl"
                  >
                    GENERATE {p.label.toUpperCase()} CUT ON MD
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Personal Brand Pack + Captions */}
          <div>
            <div className="font-display text-4xl tracking-tight mb-4">Personal Brand Pack Generator</div>
            <p className="text-white/70 mb-6">Instant ready-to-post packages. Pick a film and get hooks, full captions, thumbnails, and CTAs for every platform.</p>

            {projects[0] && (
              <div className="director-card p-8 rounded-3xl">
                <div className="mb-4">Using: <span className="font-semibold">{projects[0].title}</span></div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="uppercase text-xs tracking-widest mb-2 text-white/50">SAMPLE CAPTIONS (click to copy full pack)</div>
                    {PLATFORMS.slice(0,4).map(plat => {
                      const cap = generateSocialCaptions(projects[0], plat.id);
                      return (
                        <button key={plat.id} onClick={() => { navigator.clipboard.writeText(cap); toast.success(`Copied ${plat.label} caption`); }}
                                className="block w-full text-left mb-3 p-4 rounded-2xl bg-black/40 hover:bg-black/60 text-sm border border-white/10">
                          <span className="font-semibold text-[var(--gold)]">{plat.label}:</span> {cap.slice(0, 120)}...
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <div className="uppercase text-xs tracking-widest mb-2 text-white/50">THUMBNAIL PROMPTS</div>
                    <button
                      onClick={() => {
                        const proj = projects[0];
                        if (!proj || !token || !isValidObjectId(proj.id)) {
                          toast.error('Need a cloud-saved project to generate thumbnails on MD');
                          return;
                        }
                        setSelectedProjectId(proj.id);
                        setCurrentView('workspace');
                        setActiveTab('clips');
                        toast.success('Thumbnail = Generate Frame on MD', {
                          description: 'Use GENERATE FRAME on a key shot. No external Grok site required.',
                        });
                      }}
                      className="btn-outline w-full mb-4 py-3 text-left px-5 rounded-2xl"
                    >
                      Generate scroll-stopping thumbnail on MD
                    </button>

                    <div className="uppercase text-xs tracking-widest mb-2 text-white/50">ONE-CLICK ACTIONS</div>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => createSocialRelease(projects[0].id)} className="btn-gold text-black px-6 py-2 rounded-2xl text-sm">LAUNCH AS PERSONAL BRAND DROP</button>
                      <button onClick={() => { const cuts = generateSocialCuts(projects[0]); navigator.clipboard.writeText(JSON.stringify(cuts, null, 2)); toast("Social cut plan copied"); }} className="btn-outline px-5 py-2 rounded-2xl text-sm">Export Cut Plan</button>
                    </div>

                    <div className="mt-6 text-xs text-white/50">People will discover your films through your personal brand on TikTok, Reels, X, LinkedIn, etc. Each drop points back to your channel for the full series.</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vision callout */}
          <div className="mt-12 text-center text-white/60 text-sm">
            This is how creators will build audiences in 2026. One film at a time. Your episodes become your content feed.
          </div>
        </div>
      )}

      {/* MAIN FEED — Public discovery for everyone's films (social media core) */}
      {currentView === 'feed' && (
        <div className="max-w-6xl mx-auto px-8 py-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="uppercase tracking-[4px] text-xs text-[var(--gold)] mb-1">THE SOCIAL FEED</div>
              <div className="text-6xl font-display tracking-[-2.5px]">Everyone's Films</div>
            </div>
            <div className="text-sm text-white/60">Films as posts. Episodes as content.</div>
          </div>

          {!currentUser && (
            <div className="mb-6 p-6 bg-[#111] rounded-2xl text-center border border-[var(--gold)]/20">
              <p className="text-white/80 mb-3">Join like any social platform — rate films, discuss, message creators, and share your series.</p>
              <button onClick={() => setShowAuthModal(true)} className="btn-gold px-8 py-2 rounded-full text-sm text-black">
                Create free account
              </button>
            </div>
          )}

          {feed.length === 0 ? (
            <div className="text-center py-20 border border-white/10 rounded-3xl px-6">
              <p className="text-white/60 mb-2">No films in the feed yet.</p>
              <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
                Path: create a cloud project → generate at least one frame or clip → workspace{' '}
                <strong className="text-white/60">LAUNCH</strong> tab →{' '}
                <strong className="text-white/60">Publish to Main Public Feed</strong>.
              </p>
              {currentUser ? (
                <button
                  onClick={() => setShowNewModal(true)}
                  className="btn-gold px-8 py-2 rounded-full text-sm text-black"
                >
                  New production
                </button>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="btn-gold px-8 py-2 rounded-full text-sm text-black">
                  Sign in to publish
                </button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {feed.map((item: any) => {
                const preview = item.previewClip as string | undefined;
                const isVideo =
                  !!preview &&
                  (/\.(mp4|webm|mov)(\?|$)/i.test(preview) ||
                    preview.includes('/clips/') ||
                    preview.includes('video'));
                return (
                  <div
                    key={item.id}
                    onClick={() => openFilmDetail(item)}
                    className="director-card rounded-3xl flex flex-col cursor-pointer hover:border-[var(--gold)]/40 transition-colors overflow-hidden"
                  >
                    <div className="aspect-video bg-black relative">
                      {preview ? (
                        isVideo ? (
                          <video
                            src={preview}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}); }}
                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                          />
                        ) : (
                          <img src={preview} alt={item.title} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                          No preview
                        </div>
                      )}
                      {isVideo && (
                        <div className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded bg-black/70 text-white/80">
                          VIDEO
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="text-xs text-white/50 mb-1">
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ''} • by{' '}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openProfile(item.creator || item.creatorUsername);
                          }}
                          className="text-[var(--gold)] hover:underline"
                        >
                          @{item.creator || item.creatorUsername}
                        </button>
                      </div>
                      <div className="font-display text-2xl tracking-tight mb-2">{item.title}</div>
                      <p className="text-white/70 line-clamp-2 mb-3 flex-1 text-sm">{item.logline}</p>
                      <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                        <StarRating value={item.ratingAvg || 0} readonly size="sm" />
                        <span className="text-[10px] text-white/40 ml-1">
                          {item.commentCount ? `${item.commentCount} comments` : 'Discuss'}
                        </span>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openFilmDetail(item)}
                          className="btn-gold flex-1 py-2 rounded-2xl text-sm text-black"
                        >
                          Watch & Discuss
                        </button>
                        <button onClick={() => toggleLike(item.id)} className="btn-outline px-4 rounded-2xl text-sm">
                          {likedFeedIds.has(item.id) ? '♥' : '♡'} {item.likeCount || ''}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {feedHasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={async () => {
                  const data = await loadFeed(feedCursor || undefined);
                  if (data?.items?.length) {
                    setFeed(prev => [...prev, ...data.items]);
                    setFeedCursor(data.nextCursor);
                    setFeedHasMore(!!data.hasMore);
                  }
                }}
                className="btn-outline px-8 py-2 rounded-2xl text-sm"
              >
                Load more films
              </button>
            </div>
          )}

          <div className="mt-12 text-xs text-white/50 text-center">This is the social heart: your finished films become content others discover, watch, and share — driving them to your channels.</div>
        </div>
      )}

      {/* MESSAGES — Direct messaging system between users/creators */}
      {currentView === 'messages' && (
        <div className="max-w-5xl mx-auto px-8 py-12">
          <div className="font-display text-5xl tracking-[-2px] mb-2">Messages</div>
          <p className="text-white/60 text-sm mb-8">Connect with creators. Discuss films. Build your audience.</p>
          
          {!currentUser ? (
            <div className="director-card p-8 rounded-3xl text-center">
              <p className="text-white/70 mb-4">Messaging works like any social app — sign in to chat with filmmakers.</p>
              <button onClick={() => setShowAuthModal(true)} className="btn-gold px-8 py-2 rounded-full text-sm text-black">Create account</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="director-card p-4 rounded-3xl">
                <div className="font-semibold mb-3">Conversations</div>
                <input
                  value={userSearch}
                  onChange={(e) => searchUsers(e.target.value)}
                  placeholder="Find creator by username…"
                  className="director-input w-full px-3 py-2 rounded-xl text-sm mb-3"
                />
                {searchResults.length > 0 && (
                  <div className="mb-3 border border-white/10 rounded-xl overflow-hidden">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={async () => {
                          setSelectedConversation(u.id);
                          setChatPartner({ id: u.id, username: u.username });
                          const data = await loadMessages(u.id, token!);
                          setMessages(data.messages);
                          setUserSearch('');
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                      >
                        @{u.username}
                      </button>
                    ))}
                  </div>
                )}
                {conversations.length === 0 ? (
                  <div className="text-sm text-white/60">No conversations yet. Open a film in the Feed and message the creator.</div>
                ) : (
                  conversations.map((c: { userId: string; username: string; displayName?: string; lastMessage: string; unread: number }) => (
                    <div 
                      key={c.userId} 
                      onClick={async () => {
                        setSelectedConversation(c.userId);
                        setChatPartner({ id: c.userId, username: c.username });
                        const data = await loadMessages(c.userId, token!);
                        setMessages(data.messages);
                      }}
                      className={`p-3 rounded-xl cursor-pointer mb-1 ${selectedConversation === c.userId ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="text-sm font-medium">@{c.username}</div>
                      <div className="text-xs text-white/60 truncate">{c.lastMessage}</div>
                      {c.unread > 0 && <span className="text-xs bg-[var(--gold)] text-black px-1.5 rounded mt-1 inline-block">{c.unread}</span>}
                    </div>
                  ))
                )}
              </div>

              <div className="md:col-span-2 director-card p-4 rounded-3xl flex flex-col min-h-[400px]">
                {selectedConversation ? (
                  <>
                    <div className="font-semibold mb-4 border-b border-white/10 pb-2">
                      Chat with @{chatPartner?.username || 'creator'}
                    </div>
                    <div className="flex-1 overflow-auto mb-4 space-y-3 text-sm">
                      {messages.map((m: { id?: string; fromUserId: string; content: string }, i: number) => (
                        <div
                          key={m.id || i}
                          className={`p-3 rounded-xl max-w-[80%] ${
                            String(m.fromUserId) === String(currentUser.id)
                              ? 'bg-[var(--gold)] text-black ml-auto'
                              : 'bg-white/10'
                          }`}
                        >
                          {m.content}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(selectedConversation); }}
                        className="flex-1 director-input px-3 py-2 rounded-xl" 
                        placeholder="Type a message…" 
                      />
                      <button onClick={() => sendMessage(selectedConversation)} className="btn-gold px-6 rounded-xl text-black">Send</button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-white/60 text-center px-8">
                    Select a conversation or search for a creator to start chatting
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WORKSPACE — The real director's room */}
      {currentView === 'workspace' && selectedProject && (
        <div className="flex-1 flex flex-col">
          {/* Project Header */}
          <div className="border-b border-white/10 bg-[#0a0a0a]">
            <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <button onClick={() => { setCurrentView('dashboard'); setSelectedProjectId(null); }} className="btn-ghost p-2 -ml-2">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <div className={`type-pill ${TYPE_STYLES[selectedProject.type]}`}>{PROJECT_TYPES.find(t => t.value === selectedProject.type)?.label}</div>
                    {selectedProject.berserker && <div className="text-red-500 text-xs tracking-[2px] font-semibold">• BERSERKER MODE</div>}
                  </div>
                  <div className="font-display text-4xl tracking-[-2px] leading-none mt-1">{selectedProject.title}</div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                {token && isValidObjectId(selectedProject.id) && saveStatus !== 'idle' && (
                  <div className={`text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-white/40'}`}>
                    {saveStatus === 'saving' ? 'Saving…' : 'Save failed'}
                  </div>
                )}
                <div className="text-right">
                  <div className="text-white/50 text-xs">RUNTIME</div>
                  <div className="font-mono text-xl tabular-nums tracking-tighter">{Math.floor(totalRuntime / 60)}:{(totalRuntime % 60).toString().padStart(2, '0')}</div>
                </div>
                <div className="text-right">
                  <div className="text-white/50 text-xs">BOARDED</div>
                  <div className="font-mono text-xl tabular-nums tracking-tighter">{completion}%</div>
                </div>
                <button
                  onClick={regenerateTreatment}
                  className="btn-outline px-6 py-2 rounded-full flex items-center gap-2 text-sm"
                  title="Rebuild synopsis + shot list from title/logline. Confirms first if you have frames/clips."
                >
                  <Wand2 className="w-4 h-4"/> RE-BREAKDOWN
                </button>
                <button onClick={togglePlayback} className="btn-gold flex items-center gap-2 px-7 py-2 rounded-full text-base">
                  {isPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>} 
                  PLAY SEQUENCE
                </button>
              </div>
            </div>

            {/* Workspace tabs */}
            <div className="border-t border-white/10">
              <div className="max-w-7xl mx-auto px-8 flex gap-8 text-sm uppercase tracking-[1.5px] overflow-x-auto">
                {(['treatment', 'storyboard', 'clips', 'cast', 'chars', 'sets', 'voice', 'ads', 'timeline', 'publish', 'api'] as const).map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 border-b-2 transition-all whitespace-nowrap ${activeTab === tab 
                      ? 'border-[var(--gold)] text-white' 
                      : 'border-transparent text-white/50 hover:text-white/80'}`}
                  >
                    {tab === 'treatment' && 'LAB'}
                    {tab === 'storyboard' && 'SHOT LIST'}
                    {tab === 'clips' && 'GENERATE'}
                    {tab === 'cast' && 'ENSEMBLE'}
                    {tab === 'chars' && 'CAST LOCK'}
                    {tab === 'sets' && 'SETS'}
                    {tab === 'voice' && 'VOICE'}
                    {tab === 'ads' && 'ADS'}
                    {tab === 'timeline' && 'ASSEMBLE'}
                    {tab === 'publish' && 'LAUNCH'}
                    {tab === 'api' && 'API'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 max-w-7xl mx-auto px-8 py-9 w-full">
            {/* CONCEPT LABORATORY — pre-production stations */}
            {activeTab === 'treatment' && (
              <div>
                <ConceptLaboratory
                  project={selectedProject}
                  onUpdate={updateProject}
                  onGoStoryboard={() => setActiveTab('storyboard')}
                  onGoEnsemble={() => setActiveTab('cast')}
                  onGoClips={() => setActiveTab('clips')}
                  onRunAutoBuild={runAutoBuild}
                />

                <div className="max-w-5xl mt-10 pt-8 border-t border-white/10 space-y-6">
                  <div>
                    <div className="text-[10px] tracking-[3px] uppercase text-white/40 mb-2">
                      Breakdown tools
                    </div>
                    <p className="text-xs text-white/45 mb-4 max-w-2xl">
                      These only rebuild text structure (synopsis / shot list). They ask before
                      replacing shots if you already have frames or clips, and they re-attach media by
                      order. They do <span className="text-white/70">not</span> delete your script,
                      cast, world bible, or prompts.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="director-card p-5 rounded-2xl space-y-3">
                      <div className="text-[10px] tracking-widest uppercase text-[var(--gold)]">
                        What this does
                      </div>
                      <div className="font-display text-xl">Regenerate full treatment</div>
                      <p className="text-sm text-white/55 leading-relaxed">
                        Rebuilds the <strong className="text-white/80">synopsis</strong> and a{' '}
                        <strong className="text-white/80">template shot list</strong> from your title,
                        logline, format, and Berserker flag. Use when the story spine is wrong — not
                        when you only want to tweak one shot.
                      </p>
                      <button
                        onClick={regenerateTreatment}
                        className="btn-outline px-5 py-2 rounded-xl flex items-center gap-2 text-sm"
                      >
                        <Wand2 className="w-4 h-4" /> REGENERATE FULL TREATMENT
                      </button>
                    </div>

                    <div className="director-card p-5 rounded-2xl space-y-3">
                      <div className="text-[10px] tracking-widest uppercase text-[var(--cyan)]">
                        What this does
                      </div>
                      <div className="font-display text-xl">AI generate shot list from Lab</div>
                      <p className="text-sm text-white/55 leading-relaxed">
                        Builds a <strong className="text-white/80">new shot list only</strong> from
                        your concept/logline (not a full rewrite of the film bible). Keeps synopsis
                        unless empty. Prefer this after you locked the Lab concept.
                      </p>
                      <button
                        onClick={generateFullShotListFromConcept}
                        className="btn-gold px-6 py-2 rounded-xl flex items-center gap-2 text-sm text-black"
                      >
                        AI GENERATE SHOT LIST FROM LAB
                      </button>
                    </div>
                  </div>

                  <div className="director-card p-5 rounded-2xl flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-xl">
                      <div className="text-[10px] tracking-widest uppercase text-white/40 mb-1">
                        Ensemble (separate tab)
                      </div>
                      <div className="font-display text-xl mb-1">What Ensemble means</div>
                      <p className="text-sm text-white/55 leading-relaxed">
                        Ensemble is your <strong className="text-white/80">look + cast studio</strong>
                        : Style DNA, character design (Persona Forge), repertory company, and Voice
                        Lab. It saves style and characters on <em>this project</em> (and Company in
                        browser storage). It does <strong className="text-white/80">not</strong> save
                        or auto-run every phase of the film — LAB → SHOT LIST → GENERATE still own
                        those steps.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('cast')}
                      className="btn-outline px-5 py-2 rounded-xl text-sm shrink-0"
                    >
                      Open Ensemble →
                    </button>
                  </div>

                  {selectedProject.synopsis && (
                    <div className="director-card p-6 rounded-3xl text-sm leading-relaxed whitespace-pre-line text-white/80">
                      <div className="text-[10px] tracking-widest uppercase text-white/40 mb-2">
                        Current treatment / synopsis
                      </div>
                      {selectedProject.synopsis}
                    </div>
                  )}
                  <div className="text-xs text-white/40">
                    Paths: <span className="text-white/60">Auto</span> (minimal) or{' '}
                    <span className="text-white/60">Lab</span> (full) → Shot list → Ensemble (looks) →
                    Generate. Berserker = wilder creative tone only.
                  </div>
                </div>
              </div>
            )}

            {/* STORYBOARD (enhanced with character tags) */}
            {activeTab === 'storyboard' && (
              <div>
                <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                  <div>
                    <div className="text-sm text-white/60">STORYBOARD / SHOT LIST — {selectedProject.shots.length} SHOTS • ONE CONSISTENT WORLD</div>
                    <div className="font-display text-4xl tracking-tight">Every frame must earn its place.</div>
                    <p className="text-xs text-white/45 mt-1 max-w-xl">
                      Planner edge: lock dialogue, cast tags, and transitions here before spending.
                      Use DRAFT to test looks; FINAL when sure. Retakes are half price.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex rounded-full border border-white/15 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setGenQuality('draft')}
                        className={`px-3 py-1.5 rounded-full ${genQuality === 'draft' ? 'bg-[var(--gold)] text-black' : 'text-white/60'}`}
                        title="Cheap iteration — shorter video, lower credit cost"
                      >
                        DRAFT
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenQuality('final')}
                        className={`px-3 py-1.5 rounded-full ${genQuality === 'final' ? 'bg-[var(--gold)] text-black' : 'text-white/60'}`}
                        title="Publish-ready quality — full credit rate"
                      >
                        FINAL
                      </button>
                    </div>
                    <button onClick={() => setActiveTab('treatment')} className="btn-outline px-4 py-2 rounded-full text-sm">
                      ← LAB
                    </button>
                    <button
                      onClick={generateFullShotListFromConcept}
                      className="btn-outline px-4 py-2 rounded-full text-sm flex items-center gap-1"
                      title="Rebuild shot list from concept/logline. Asks first if you have media. Keeps script & cast."
                    >
                      <Wand2 className="w-4 h-4"/> AI GENERATE FROM LAB
                    </button>
                    <button onClick={addNewShot} className="btn-gold flex items-center gap-2 px-6 py-2.5 rounded-full text-sm text-black">
                      <Plus className="w-4 h-4"/> ADD SHOT
                    </button>
                  </div>
                </div>

                <div className="mb-8 space-y-6">
                  <CreativeDiscoveryPanel
                    project={selectedProject}
                    token={token}
                    onUpdate={updateProject}
                    onCreditBalance={(n) => setCreditBalance(n)}
                    onAuthRequired={() => setShowAuthModal(true)}
                    onGenerateFrame={(id) => generateFrame(id)}
                  />
                  <BridgeScannerPanel
                    project={selectedProject}
                    token={token}
                    genQuality={genQuality}
                    onUpdate={updateProject}
                    onCreditBalance={(n) => setCreditBalance(n)}
                    onAuthRequired={() => setShowAuthModal(true)}
                  />
                </div>

                <div className="storyboard-grid">
                  <AnimatePresence>
                    {selectedProject.shots.map((shot) => (
                      <div key={shot.id} className={`shot-card rounded-2xl overflow-hidden flex flex-col ${shot.imageUrl ? 'has-image' : ''}`}>
                        <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                          {shot.imageUrl ? (
                            <img src={shot.imageUrl} alt={shot.description} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center px-6">
                              <Film className="mx-auto mb-3 w-9 h-9 text-white/30" />
                              <div className="text-[10px] uppercase tracking-widest text-white/50">NO FRAME YET</div>
                            </div>
                          )}
                          <div className="absolute top-3 left-3 px-3 py-px text-xs font-mono bg-black/70 text-white rounded">
                            {isTransitionShot(shot) ? `BRIDGE ${shot.number}` : `SHOT ${shot.number}`}
                          </div>
                          {isTransitionShot(shot) && (
                            <div className="absolute bottom-3 left-3 text-[9px] px-2 py-px bg-[var(--gold)]/90 text-black rounded tracking-widest">
                              TRANSITION
                            </div>
                          )}
                          {shot.videoUrl && <div className="absolute top-3 right-3 text-[10px] px-2 py-px bg-[var(--cyan)]/90 text-black rounded tracking-widest">CLIP</div>}
                        </div>

                        <div className="p-4 flex-1 flex flex-col text-sm">
                          {/* Main action / intent */}
                          {editingShotId === shot.id ? (
                            <textarea 
                              className="director-input w-full p-3 text-sm rounded mb-2 font-light" 
                              value={shot.description} 
                              onChange={(e) => updateShot(shot.id, { description: e.target.value })} 
                              placeholder="Main action and intent for this shot"
                              onBlur={() => setEditingShotId(null)} 
                            />
                          ) : (
                            <div onClick={() => setEditingShotId(shot.id)} className="cursor-text text-white/90 leading-snug mb-2 line-clamp-3 pr-5">{shot.description}</div>
                          )}

                          <div className="text-xs text-white/60 mb-2 font-mono">{shot.camera} • {shot.duration}s</div>

                          {/* Script control — dialogue always editable (from Lab or inline) */}
                          <div className="mb-2">
                            <div className="text-[9px] uppercase tracking-wider text-[var(--gold)]/80 mb-1">
                              Dialogue / script line
                            </div>
                            <textarea
                              className="director-input w-full p-2 text-xs rounded min-h-[52px] leading-snug"
                              placeholder="CHARACTER: What they say — push from LAB → Script, or write here"
                              value={shot.dialogue || ''}
                              onChange={(e) => updateAdvancedShot(shot.id, 'dialogue', e.target.value)}
                            />
                          </div>

                          {/* Advanced Per-Shot Prompting (Pro workflow) */}
                          {editingShotId === shot.id ? (
                            <div className="space-y-2 mb-3 text-[10px]">
                              <input 
                                className="director-input w-full p-1 text-xs rounded" 
                                placeholder="Emotion & performance (e.g. stoic but intense. He is angry.)" 
                                value={shot.emotion || ''} 
                                onChange={e => updateAdvancedShot(shot.id, 'emotion', e.target.value)} 
                              />
                              <input 
                                className="director-input w-full p-1 text-xs rounded" 
                                placeholder="Acting cues (micro-expressions, blinking...)" 
                                value={shot.actingCues || ''} 
                                onChange={e => updateAdvancedShot(shot.id, 'actingCues', e.target.value)} 
                              />
                              <input 
                                className="director-input w-full p-1 text-xs rounded" 
                                placeholder="Detailed camera (FAST ZOOM into CLOSEUP...)" 
                                value={shot.cameraDetailed || ''} 
                                onChange={e => updateAdvancedShot(shot.id, 'cameraDetailed', e.target.value)} 
                              />
                              <input 
                                className="director-input w-full p-1 text-xs rounded" 
                                placeholder="Sound design cues (sea wind, waves...)" 
                                value={shot.soundCues || ''} 
                                onChange={e => updateAdvancedShot(shot.id, 'soundCues', e.target.value)} 
                              />
                            </div>
                          ) : (
                            (shot.emotion || shot.cameraDetailed || shot.actingCues) && (
                              <div className="mb-2 text-[9px] text-white/50 space-y-0.5">
                                {shot.emotion && <div>Emotion: {shot.emotion}</div>}
                                {shot.actingCues && <div>Acting: {shot.actingCues}</div>}
                                {shot.cameraDetailed && <div>Cam: {shot.cameraDetailed}</div>}
                                <button
                                  type="button"
                                  onClick={() => setEditingShotId(shot.id)}
                                  className="text-[var(--gold)]/70 hover:text-[var(--gold)]"
                                >
                                  Edit cues →
                                </button>
                              </div>
                            )
                          )}
                          {editingShotId !== shot.id && !(shot.emotion || shot.cameraDetailed || shot.actingCues) && (
                            <button
                              type="button"
                              onClick={() => setEditingShotId(shot.id)}
                              className="text-[9px] text-white/40 hover:text-[var(--gold)] mb-2 text-left"
                            >
                              + Emotion, acting, camera cues
                            </button>
                          )}

                          {/* INSERT: characters (independent of set) */}
                          <div className="mb-2 p-2 rounded-xl border border-[var(--gold)]/20 bg-black/30">
                            <div className="text-[9px] uppercase tracking-wider text-[var(--gold)]/80 mb-1">
                              Insert cast · CAST LOCK
                            </div>
                            {(selectedProject.characters || []).length === 0 ? (
                              <button
                                type="button"
                                onClick={() => setActiveTab('chars')}
                                className="text-[10px] text-white/45 underline"
                              >
                                No cast — open CAST LOCK →
                              </button>
                            ) : (
                              <>
                                <div className="flex flex-wrap gap-1 items-center">
                                  {(selectedProject.characters || []).map((char) => {
                                    const active = (shot.characterIds || []).includes(char.id);
                                    return (
                                      <button
                                        key={char.id}
                                        type="button"
                                        onClick={() => toggleCharacterOnShot(shot.id, char.id)}
                                        className={`text-[10px] px-2 py-px rounded border ${
                                          active
                                            ? 'bg-[var(--gold)] text-black border-[var(--gold)]'
                                            : 'border-white/20 hover:border-white/60'
                                        }`}
                                      >
                                        {char.name.split(' ')[0]}
                                        {char.consistencyLock?.locked ? ' ✓' : ''}
                                      </button>
                                    );
                                  })}
                                  {(shot.characterIds || []).length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => updateShot(shot.id, { characterIds: [] })}
                                      className="text-[10px] px-2 py-px rounded border border-white/25 text-white/55 hover:border-white/50"
                                      title="Clear cast — set / environment only"
                                    >
                                      Clear cast
                                    </button>
                                  )}
                                  {!(shot.characterIds || []).length && (
                                    <span className="text-[9px] text-white/35">None · set only</span>
                                  )}
                                </div>
                                {(shot.characterIds || []).length >= 2 && (
                                  <input
                                    className="director-input w-full mt-1 p-1 text-[10px] rounded"
                                    placeholder="Interaction: eye contact, blocking, power dynamic…"
                                    value={shot.interactionNotes || ''}
                                    onChange={(e) => updateShot(shot.id, { interactionNotes: e.target.value })}
                                  />
                                )}
                              </>
                            )}
                          </div>

                          {/* INSERT: environment (independent of cast) */}
                          <div className="mb-2 p-2 rounded-xl border border-[var(--cyan)]/25 bg-black/30">
                            <div className="text-[9px] uppercase tracking-wider text-[var(--cyan)]/90 mb-1">
                              Insert set · SETS
                            </div>
                            {(selectedProject.environments || []).length === 0 ? (
                              <button
                                type="button"
                                onClick={() => setActiveTab('sets')}
                                className="text-[10px] text-white/45 underline"
                              >
                                No sets — open SETS →
                              </button>
                            ) : (
                              <select
                                className="director-input w-full p-1 text-[10px] rounded bg-black"
                                value={shot.environmentId || selectedProject.defaultEnvironmentId || ''}
                                onChange={(e) =>
                                  updateShot(shot.id, {
                                    environmentId: e.target.value || undefined,
                                  })
                                }
                              >
                                <option value="">No locked set on this shot</option>
                                {(selectedProject.environments || []).map((env) => (
                                  <option key={env.id} value={env.id}>
                                    {env.name} ({env.placeType})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Video range edit plan */}
                          {shot.videoUrl && (
                            <div className="mb-2 p-2 rounded-xl border border-white/10 bg-black/40">
                              <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1">
                                Range edit (select segment to fix)
                              </div>
                              <div className="flex gap-1 items-center text-[10px]">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  placeholder="start s"
                                  className="director-input w-14 p-1 rounded text-[10px]"
                                  id={`range-start-${shot.id}`}
                                />
                                <span className="text-white/40">–</span>
                                <input
                                  type="number"
                                  min={0.5}
                                  step={0.5}
                                  placeholder="end s"
                                  className="director-input w-14 p-1 rounded text-[10px]"
                                  id={`range-end-${shot.id}`}
                                />
                                <button
                                  type="button"
                                  className="btn-outline text-[9px] px-2 py-1 rounded"
                                  onClick={() => {
                                    const s = Number(
                                      (document.getElementById(`range-start-${shot.id}`) as HTMLInputElement)
                                        ?.value || 0
                                    );
                                    const e = Number(
                                      (document.getElementById(`range-end-${shot.id}`) as HTMLInputElement)
                                        ?.value || 0
                                    );
                                    planRangeEdit(shot.id, s, e);
                                  }}
                                >
                                  Mark
                                </button>
                              </div>
                              {shot.rangeEdit && (
                                <div className="text-[9px] text-[var(--cyan)] mt-1">
                                  Marked {shot.rangeEdit.startSec}s–{shot.rangeEdit.endSec}s · {shot.rangeEdit.status}
                                  <button
                                    type="button"
                                    className="ml-2 underline text-white/50"
                                    onClick={() =>
                                      updateShot(shot.id, {
                                        rangeEdit: { ...shot.rangeEdit!, status: 'replaced' },
                                      })
                                    }
                                  >
                                    Mark replaced
                                  </button>
                                </div>
                              )}
                              <div className="text-[9px] text-white/35 mt-0.5">
                                Plan the bad beat → regen DRAFT of that moment → attach new clip / replace.
                              </div>
                            </div>
                          )}

                          <div className="text-[9px] text-white/40 mb-1 font-mono">
                            Frame {frameCreditCost(shot)} cr · Clip {videoCreditCost(shot)} cr · {genQuality}
                            {shot.imageUrl || shot.videoUrl ? ' · retake half if regenerating' : ''}
                          </div>
                          <div className="flex gap-2 mt-auto flex-wrap">
                            <button onClick={() => generateFrame(shot.id)} className="flex-1 btn-outline text-xs py-2 rounded-xl min-w-[40%]">
                              {shot.imageUrl ? 'RETAKE FRAME' : 'GENERATE FRAME'}
                            </button>
                            <button onClick={() => generateVideoClip(shot.id)} disabled={!shot.imageUrl} className="flex-1 btn-outline text-xs py-2 rounded-xl disabled:opacity-40 min-w-[40%]">
                              {isTransitionShot(shot)
                                ? shot.videoUrl
                                  ? 'RETAKE BRIDGE CLIP'
                                  : 'ANIMATE BRIDGE'
                                : shot.videoUrl
                                  ? 'RETAKE VIDEO'
                                  : 'ANIMATE TO VIDEO'}
                            </button>
                            <button onClick={() => deleteShot(shot.id)} className="btn-ghost p-2 text-white/50 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                          {!isTransitionShot(shot) && (
                            <button
                              type="button"
                              onClick={() => addTransitionAfter(shot.id)}
                              className="text-[10px] text-[var(--gold)]/80 hover:text-[var(--gold)] mt-1.5 text-left"
                              title="Cast-locked continuity bridge — seeds from this frame into the next shot"
                            >
                              + Continuity bridge → next shot
                            </button>
                          )}
                          {isTransitionShot(shot) && (
                            <div className="text-[9px] text-amber-200/80 mt-1.5 leading-snug space-y-0.5">
                              <div>
                                Bridge = image-edit between neighbor frames (not text-to-image). Generate A &amp; B
                                frames first or the still will invent a new scene.
                              </div>
                              <div>
                                Cast + set locked from neighbors · GENERATE FRAME uses A (+B) as reference · then
                                ANIMATE BRIDGE
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(getEnhancedFramePrompt(shot));
                              toast('Prompt copied — paste into Grok Imagine if using external gen');
                            }}
                            className="text-[10px] text-white/50 hover:text-[var(--gold)] mt-1.5 text-left"
                          >
                            COPY PROMPT (platform or Grok Imagine)
                          </button>

                          <div className="mt-2 p-2 rounded-xl border border-white/10 bg-black/50 space-y-1">
                            <div className="text-[9px] uppercase tracking-wider text-white/40">
                              External Grok Imagine · 0 MD credits
                            </div>
                            <input
                              placeholder="Paste frame or .mp4 URL from grok.com / Imagine"
                              className="text-[10px] w-full bg-black/50 px-2 py-1 rounded border border-white/10 placeholder:text-white/30 font-mono"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  if (val) {
                                    attachExternalAsset(shot.id, val);
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                            />
                            <div className="text-[9px] text-white/35 leading-snug">
                              MD credits = in-app Grok + TTS. Free: plan, cast, bridges, paste Imagine assets, then
                              assemble.
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* CLIP LAB */}
            {activeTab === 'clips' && (
              <div className="max-w-3xl">
                <div className="mb-8">
                  <div className="uppercase text-xs tracking-[3px] text-[var(--cyan)]">CLIP LAB — FULL AI VIDEO</div>
                  <div className="font-display text-5xl tracking-[-1.5px]">Stills become cinematic motion with Grok video.</div>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <div className="flex rounded-full border border-white/15 p-0.5 text-xs">
                      <button type="button" onClick={() => setGenQuality('draft')} className={`px-3 py-1.5 rounded-full ${genQuality === 'draft' ? 'bg-[var(--gold)] text-black' : 'text-white/60'}`}>DRAFT</button>
                      <button type="button" onClick={() => setGenQuality('final')} className={`px-3 py-1.5 rounded-full ${genQuality === 'final' ? 'bg-[var(--gold)] text-black' : 'text-white/60'}`}>FINAL</button>
                    </div>
                    <span className="text-xs text-white/50">
                      Remaining batch est: {estimateProjectCost(selectedProject.shots).credits} cr · mode {genQuality}
                    </span>
                  </div>
                </div>
                {selectedProject.shots.filter(s => s.imageUrl).length === 0 && <div className="p-12 border border-white/10 rounded-3xl text-center text-white/50">Generate frames first.</div>}
                <div className="space-y-4">
                  {selectedProject.shots.filter(s => s.imageUrl).map(shot => (
                    <div key={shot.id} className="director-card p-6 rounded-2xl flex gap-8 items-center">
                      <div className="w-64 flex-shrink-0 video-frame rounded-xl overflow-hidden aspect-video"><img src={shot.imageUrl} className="w-full" alt="" /></div>
                      <div className="flex-1">
                        <div className="font-mono text-xs text-white/50">SHOT {shot.number}</div>
                        <div className="text-lg tracking-tight mb-1 line-clamp-2">{shot.description}</div>
                        <div className="text-sm text-white/60 mb-4">{shot.camera} • {shot.duration}s</div>
                        <div className="flex gap-3">
                          <button onClick={() => generateVideoClip(shot.id)} disabled={!!shot.videoUrl} className="btn-gold px-7 py-1.5 rounded-2xl text-sm text-black">GENERATE GROK VIDEO CLIP</button>
                          <button onClick={() => { navigator.clipboard.writeText(generateVideoPrompt(shot)); toast("Prompt copied"); }} className="btn-outline px-5 py-1.5 rounded-2xl text-sm">COPY VIDEO PROMPT</button>
                        </div>
                        {shot.videoUrl && <div className="text-xs text-[var(--cyan)] mt-2">Clip ready — reusable media asset</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ENSEMBLE ATELIER — Style DNA + Persona Forge + The Company + Voice Lab */}
            {activeTab === 'cast' && (
              <div className="max-w-5xl">
                <div className="mb-8 p-5 rounded-3xl border border-white/10 bg-black/40">
                  <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)] mb-1">
                    Ensemble Atelier
                  </div>
                  <div className="font-display text-3xl tracking-tight mb-2">Look + cast — not the whole pipeline</div>
                  <p className="text-sm text-white/55 max-w-2xl leading-relaxed">
                    Style DNA (how the world looks), Persona Forge (characters), The Company (reuse cast
                    across projects), Voice Lab (original voice direction). Changes save on this
                    project via autosave. They do not replace LAB planning or GENERATE — and they do
                    not wipe your shot list or clips.
                  </p>
                </div>
                <EnsembleStudio
                  project={selectedProject}
                  token={token}
                  onUpdateProject={updateProject}
                  onGenerateRef={generateCharacterRef}
                />

                {/* Quick cast cards + delete */}
                {(selectedProject.characters || []).length > 0 && (
                  <div className="mt-10">
                    <div className="text-xs uppercase tracking-widest text-white/40 mb-3">
                      Production cast cards
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {(selectedProject.characters || []).map((char) => (
                        <div key={char.id} className="director-card p-5 rounded-3xl">
                          <div className="flex gap-4">
                            {char.referenceImageUrl && (
                              <img
                                src={char.referenceImageUrl}
                                className="w-24 h-24 object-cover rounded-2xl border border-white/10"
                                alt={char.name}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-display text-2xl truncate">{char.name}</div>
                              <div className="text-sm text-white/50">
                                {char.role}
                                {char.medium ? ` · ${char.medium}` : ''}
                              </div>
                              {char.activeVoiceId && char.voiceVariants && (
                                <div className="text-[10px] text-[var(--gold)] mt-1">
                                  Voice:{' '}
                                  {char.voiceVariants.find((v) => v.id === char.activeVoiceId)?.name ||
                                    'set'}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            <div className="text-[10px] uppercase tracking-wider text-white/40">Sitcom memory (always in prompts)</div>
                            <textarea
                              className="director-input w-full p-2 text-xs rounded-xl min-h-[52px]"
                              placeholder="Locked memory: always late, scar on left brow, never removes jacket…"
                              value={char.memoryNotes || ''}
                              onChange={(e) =>
                                updateProject((p) => ({
                                  ...p,
                                  characters: (p.characters || []).map((c) =>
                                    c.id === char.id ? { ...c, memoryNotes: e.target.value } : c
                                  ),
                                }))
                              }
                            />
                            {(char.memoryFacts || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(char.memoryFacts || []).map((f) => (
                                  <span key={f} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            )}
                            <input
                              className="director-input w-full p-2 text-xs rounded-xl"
                              placeholder="Add memory fact + Enter"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const v = (e.target as HTMLInputElement).value.trim();
                                  if (v) {
                                    addCharacterMemoryFact(char.id, v);
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                            />
                            <div className="text-[10px] uppercase tracking-wider text-white/40 pt-1">TTS voice</div>
                            <select
                              className="director-input w-full p-2 text-xs rounded-xl bg-black"
                              value={char.ttsVoiceId || 'ara'}
                              onChange={(e) =>
                                updateProject((p) => ({
                                  ...p,
                                  characters: (p.characters || []).map((c) =>
                                    c.id === char.id ? { ...c, ttsVoiceId: e.target.value } : c
                                  ),
                                }))
                              }
                            >
                              {XAI_TTS_VOICES.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.label} — {v.hint}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => generateCharacterRef(char.id)}
                              className="flex-1 btn-outline py-2 rounded-2xl text-xs min-w-[40%]"
                            >
                              GENERATE REFERENCE
                            </button>
                            <button
                              onClick={() => insertCharacterEverywhere(char.id)}
                              className="flex-1 btn-outline py-2 rounded-2xl text-xs min-w-[40%]"
                              title="Tag this character on every shot for episode continuity"
                            >
                              INSERT ON ALL SHOTS
                            </button>
                            <button
                              onClick={() => removeCharacterEverywhere(char.id)}
                              className="btn-ghost px-3 text-white/50 text-xs"
                            >
                              Clear tags
                            </button>
                            <button
                              onClick={() => deleteCharacter(char.id)}
                              className="btn-ghost px-3 text-red-400 text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/40 mt-3">
                      Character memory + shot tags drive sitcom consistency. Tag on Storyboard or insert
                      on all shots. Voice Lab alts shape performance briefs; TTS voices speak lines.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CAST LOCK — character consistency only */}
            {activeTab === 'chars' && (
              <CharacterConsistencyStudio
                project={selectedProject}
                onUpdate={updateProject}
                onGenerateRef={generateCharacterRef}
                onGoStoryboard={() => setActiveTab('storyboard')}
              />
            )}

            {/* SETS — environment consistency only */}
            {activeTab === 'sets' && (
              <EnvironmentStudio
                project={selectedProject}
                onUpdate={updateProject}
                onGenerateEnvRef={generateEnvironmentRef}
                onGoStoryboard={() => setActiveTab('storyboard')}
              />
            )}

            {/* MARKETING STUDIO — short-form / ads / brand */}
            {activeTab === 'ads' && (
              <MarketingStudio
                project={selectedProject}
                onUpdate={updateProject}
                onGoStoryboard={() => setActiveTab('storyboard')}
                onGoClips={() => setActiveTab('clips')}
                onGoLab={() => setActiveTab('treatment')}
              />
            )}

            {/* VOICEOVERS — browser preview + xAI TTS studio voices */}
            {activeTab === 'voice' && (
              <div className="max-w-3xl">
                <div className="mb-6">
                  <div className="uppercase tracking-[3px] text-xs text-[var(--violet)]">VOICEOVER STUDIO</div>
                  <div className="text-5xl font-display tracking-tight">Every shot can speak.</div>
                  <p className="text-sm text-white/50 mt-2 max-w-xl">
                    Free: browser play for timing. Paid: xAI TTS studio lines ({speechCredits()} cr) with
                    original voices. Custom character voices live in ENSEMBLE → Voice Lab (axes + alts);
                    TTS maps to studio voice IDs below.
                  </p>
                </div>

                <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-black/40">
                  <div className="text-[10px] tracking-widest uppercase text-white/40 mb-2">Studio TTS voices (original)</div>
                  <div className="flex flex-wrap gap-2">
                    {XAI_TTS_VOICES.map((v) => (
                      <div key={v.id} className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/70">
                        {v.label} <span className="text-white/40">· {v.hint}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/40 mt-2">
                    Assign a preferred TTS voice on each cast member under production cast cards, or we
                    default to Ara.
                  </p>
                </div>

                {selectedProject.shots.map(shot => (
                  <div key={shot.id} className="director-card p-6 mb-4 rounded-3xl">
                    <div className="font-mono text-xs mb-1 text-white/50">
                      {isTransitionShot(shot) ? 'BRIDGE' : 'SHOT'} {shot.number}
                    </div>
                    <div className="mb-2 text-white/80">{shot.description}</div>
                    {shot.dialogue && (
                      <div className="text-xs text-[var(--gold)]/80 mb-2">Dialogue: “{shot.dialogue}”</div>
                    )}

                    <textarea
                      value={shot.voiceoverScript || ''}
                      onChange={(e) => updateVoiceover(shot.id, e.target.value)}
                      placeholder="Spoken line (or leave blank to use dialogue)…"
                      className="director-input w-full p-4 rounded-2xl text-sm mb-3"
                    />

                    {shot.voiceAudioUrl && (
                      <audio controls src={shot.voiceAudioUrl} className="w-full mb-3 h-10" />
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => generateVoiceLine(shot.id)} className="btn-outline px-5 py-1.5 text-sm rounded-2xl">
                        FILL VO FROM SHOT
                      </button>
                      <button onClick={() => speakVoiceover(shot)} className="btn-outline px-5 py-1.5 text-sm rounded-2xl flex items-center gap-1">
                        <Play className="w-3.5 h-3.5"/> PLAY (free browser)
                      </button>
                      <button
                        onClick={() => generateTtsForShot(shot.id)}
                        className="btn-gold px-6 py-1.5 text-sm rounded-2xl text-black"
                      >
                        GENERATE STUDIO VOICE (−{speechCredits()} cr)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ASSEMBLE + MOVIE RENDER (Pro workflow) */}
            {activeTab === 'timeline' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <div className="font-display text-4xl tracking-tight">Assemble &amp; Render Full Movie</div>
                    <div className="text-sm text-white/60">Drag order • Preview sequence • One-click full film export</div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={togglePlayback} className="btn-gold px-8 py-2 rounded-2xl text-sm text-black">{isPlaying ? 'STOP' : 'PLAY FULL FILM'}</button>
                    <button
                      onClick={batchGenerateVideos}
                      disabled={!!activeGenJob || selectedProject.shots.every(s => s.videoUrl)}
                      title={`Est. $${estimateProjectCost(selectedProject.shots).totalUsd.toFixed(2)}`}
                      className="btn-outline px-6 py-2 rounded-2xl text-sm disabled:opacity-40"
                    >
                      {activeGenJob ? `GENERATING ${activeGenJob.progress}%` : 'BATCH GENERATE ALL CLIPS'}
                    </button>
                    <button 
                      onClick={() => renderFullMovie(selectedProject)} 
                      disabled={selectedProject.shots.filter(s => s.videoUrl).length < 1}
                      className="btn-gold px-8 py-2 rounded-2xl text-sm text-black flex items-center gap-2 disabled:opacity-40"
                      title="Drops still-only transition plates, keeps bridge clips, queues AI assemble"
                    >
                      ✨ LET AI RENDER FOR YOU
                    </button>
                  </div>
                </div>

                <div className="mb-4 p-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 text-sm text-white/65 max-w-3xl">
                  <strong className="text-[var(--gold)]">AI render</strong> stitches your live clips in
                  order, drops transition stills that were only planning plates, keeps animated bridge
                  clips, and packages the film (worker when configured, otherwise zip export). Plan in
                  LAB + SHOT LIST first — render spends nothing on new Grok pixels.
                </div>

                {/* Cost & Stats Bar — credits first (what users pay) */}
                <div className="mb-6 p-4 bg-[#111] rounded-2xl flex flex-wrap gap-6 text-sm items-center border border-white/10">
                  <div>
                    <span className="text-white/50">YOUR CREDITS</span><br />
                    <span className="font-mono text-xl text-[var(--gold)]">{creditBalance ?? '—'}</span>
                    <button onClick={() => setCurrentView('billing')} className="text-xs underline ml-2 text-white/50">Top up</button>
                  </div>
                  <div>
                    <span className="text-white/50">BATCH ESTIMATE</span><br />
                    <span className="font-mono text-xl text-[var(--gold)]">
                      {estimateProjectCost(selectedProject.shots).credits} cr
                    </span>
                    <span className="text-xs text-white/50 ml-2">
                      (~${estimateProjectCost(selectedProject.shots).userListUsd?.toFixed?.(2) ?? estimateMovieCost(selectedProject.shots.length, 10, '720')})
                    </span>
                  </div>
                  <div>
                    <span className="text-white/50">CLIPS READY</span><br />
                    <span className="font-mono text-xl">{selectedProject.shots.filter(s => s.videoUrl).length} / {selectedProject.shots.length}</span>
                  </div>
                  <div className="flex-1 text-xs text-white/50">
                    Plan free · Draft cheap · Final when locked · Retakes ½ · Bridges plan cuts before burn.
                    Draft image {imageCreditsFor('draft')} cr · final {imageCreditsFor('final')} cr ·
                    Draft 5s ~{videoCreditsFor(5, 'draft')} cr · final 8s {videoCreditsFor(8, 'final')} cr (was 80 — now intentional, not punishing).
                  </div>
                </div>

                <div className="video-frame aspect-video rounded-3xl mb-6 overflow-hidden flex items-center justify-center bg-black max-h-[440px]">
                  {selectedProject.shots[currentShotIndex] ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {selectedProject.shots[currentShotIndex].videoUrl ? (
                        <video src={selectedProject.shots[currentShotIndex].videoUrl} className="max-h-full" autoPlay={isPlaying} controls={!isPlaying} />
                      ) : selectedProject.shots[currentShotIndex].imageUrl ? (
                        <img src={selectedProject.shots[currentShotIndex].imageUrl} className="max-h-full object-contain" />
                      ) : <div className="text-white/40">No media</div>}

                      {selectedProject.shots[currentShotIndex].voiceoverScript && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-2 max-w-[80%] text-center italic text-sm">{selectedProject.shots[currentShotIndex].voiceoverScript}</div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="timeline-strip p-4 rounded-3xl flex gap-2 overflow-x-auto">
                  {selectedProject.shots.map((shot, idx) => (
                    <div key={shot.id} onClick={() => { setCurrentShotIndex(idx); }} className={`timeline-shot min-w-[160px] p-3 rounded-xl text-xs ${idx===currentShotIndex ? 'ring ring-[var(--gold)]' : ''}`}>
                      <div>SHOT {shot.number} • {shot.duration}s</div>
                      <div className="line-clamp-2 text-white/70 mt-1">{shot.description}</div>
                      {shot.voiceoverScript && <div className="text-[10px] text-[var(--violet)] mt-1">VO</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PUBLISH — to Channels + media assets */}
            {activeTab === 'publish' && (
              <div className="max-w-3xl">
                <div className="text-5xl font-display tracking-tight mb-3">Publish &amp; Monetize</div>
                <p className="text-white/70">Turn finished projects into private subscription series.</p>

                <div className="mt-9">
                  <div className="uppercase text-xs tracking-widest mb-3">YOUR CHANNELS</div>
                  {channels.length > 0 ? channels.map(ch => (
                    <div key={ch.id} className="flex items-center justify-between bg-[#111] p-4 rounded-2xl mb-3">
                      <div>{ch.name} — Beta, free</div>
                      <button onClick={() => addProjectToChannel(ch.id, selectedProject.id)} className="btn-gold text-xs px-5 py-1.5 rounded-xl text-black">ADD THIS PROJECT TO CHANNEL</button>
                    </div>
                  )) : <div className="text-white/50">Create a channel from the top nav.</div>}
                </div>

                <div className="mt-8 p-6 border border-white/10 rounded-3xl">
                  <div className="text-sm">This project is now a media asset library. Use generated images, clips, and voiceovers across other films or export for social / paid campaigns.</div>
                  <div className="mt-4 text-xs text-[var(--gold)]">{selectedProject.shots.filter(s => s.videoUrl).length} video clips • {selectedProject.shots.filter(s => s.imageUrl).length} stills ready as assets</div>
                </div>

                <div className="mt-6 director-card p-6 rounded-3xl">
                  <SharePanel
                    title={selectedProject.title}
                    logline={selectedProject.logline}
                    projectType={selectedProject.type}
                  />
                </div>

                {/* Publish to Main Public Feed for social discovery */}
                <div className="mt-4 p-5 border border-[var(--gold)]/30 rounded-3xl bg-[#0a0a0a]">
                  <div className="text-xs uppercase tracking-widest text-[var(--gold)] mb-2">PUBLIC FEED</div>
                  <p className="text-sm text-white/70 mb-3">
                    Posts this project to Everyone&apos;s Films. Needs a <strong className="text-white/90">cloud-saved</strong> project
                    and at least one <strong className="text-white/90">generated frame or video</strong>.
                  </p>
                  <div className="text-xs text-white/50 mb-4">
                    Ready: {selectedProject.shots.filter((s) => s.videoUrl).length} videos ·{' '}
                    {selectedProject.shots.filter((s) => s.imageUrl).length} stills
                    {!isValidObjectId(selectedProject.id) && (
                      <span className="block text-red-400 mt-1">
                        This project ID is local-only — create/save while signed in before publishing.
                      </span>
                    )}
                  </div>
                  <button
                    onClick={publishToFeed}
                    className="btn-gold w-full py-3 rounded-2xl text-sm text-black"
                  >
                    Publish to Main Public Feed
                  </button>
                  <div className="text-[10px] mt-2 text-white/50 text-center">
                    Live on the Feed with preview media — rate, discuss, message, share.
                  </div>
                </div>
              </div>
            )}

            {/* API */}
            {activeTab === 'api' && (
              <div className="max-w-3xl">
                <div className="font-display text-6xl tracking-[-2.5px] mb-4">Director API</div>
                <p className="text-xl text-white/70">Programmatically direct films. Perfect for agents, studios, and automation.</p>

                <div className="mt-8 space-y-6 text-sm">
                  <div>
                    <div className="font-mono text-[var(--gold)] mb-1">POST /api/projects</div>
                    <div>Create project with title, logline, type, concept. Returns projectId.</div>
                  </div>
                  <div>
                    <div className="font-mono text-[var(--gold)] mb-1">POST /api/generate/batch</div>
                    <div>Queue Grok video generation for multiple shots. Polling via /api/generate/jobs/:id</div>
                  </div>
                  <div>
                    <div className="font-mono text-[var(--gold)] mb-1">POST /api/publish</div>
                    <div>Publish finished project to the public feed.</div>
                  </div>
                  <div>
                    <div className="font-mono text-[var(--gold)] mb-1">Channels &amp; Social</div>
                    <div>Manage series, subscribers, generate social cut prompts.</div>
                  </div>
                </div>

                <div className="mt-6 p-4 border border-white/10 rounded-2xl text-xs text-white/60">
                  Current auth: Bearer JWT (from login). Dedicated API keys coming in this phase.
                </div>

                <div className="mt-4 text-xs">
                  <div className="mb-1 text-[var(--gold)]">Example: Create project + trigger generation</div>
                  <pre className="bg-black/60 p-3 rounded text-[10px] overflow-auto">{`curl -X POST /api/projects \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{"title":"My Film","type":"film","logline":"..."}'

curl -X POST /api/generate/batch \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{"projectId":"...","shotIds":[...]}'`}</pre>
                </div>

                <button onClick={copyApiExample} className="btn-gold mt-6 px-8 py-3 rounded-2xl text-sm text-black">COPY CURL EXAMPLE</button>
                <div className="text-[10px] mt-2 text-white/40">These routes are production-ready. Next: proper API keys + /v1 surface.</div>
              </div>
            )}
          </div>

          {/* Footer bar for the workspace */}
          <div className="border-t border-white/10 py-4 text-xs text-white/40 px-8 flex items-center justify-between max-w-7xl mx-auto w-full">
            <div>Every episode becomes social currency. One day posts will feel small.</div>
            <div>POWERED BY GROK • BERSERKER EDITION</div>
          </div>
        </div>
      )}

      {/* NEW PROJECT MODAL — scrollable so title/border never clip on short screens */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/90">
            <div className="flex min-h-full items-start justify-center p-4 sm:p-6 sm:items-center">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.985 }}
                className="modal relative my-4 sm:my-8 flex w-full max-w-2xl max-h-[min(92vh,900px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-2xl"
              >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-6 pt-6 pb-4 sm:px-9 sm:pt-8">
                  <div className="min-w-0">
                    <div className="font-display text-3xl tracking-tight sm:text-4xl sm:tracking-[-2px]">
                      New Production
                    </div>
                    <p className="mt-1 text-sm text-white/60">Tell us what we’re making. Be specific. Be bold.</p>
                    <p className="mt-1 text-[10px] text-white/40">
                      Treatment → Storyboard &amp; Cast → Generate → Assemble → Publish
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="shrink-0 rounded-full px-3 py-1 text-white/50 hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-9 sm:py-6">
                  <div className="space-y-5 sm:space-y-6">
                    <div>
                      <div className="mb-2 text-xs tracking-widest text-white/50">PROJECT TITLE</div>
                      <input
                        value={newProject.title}
                        onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                        className="director-input w-full rounded-2xl px-5 py-3 text-2xl font-display tracking-tight sm:text-3xl"
                        placeholder="ODYSSEY — 1970s Epic Trailer"
                      />
                    </div>

                    <div>
                      <div className="mb-2 text-xs tracking-widest text-white/50">
                        PROJECT CONCEPT — HIGH LEVEL VISION
                      </div>
                      <textarea
                        value={newProject.concept}
                        onChange={(e) => setNewProject({ ...newProject, concept: e.target.value })}
                        className="director-input h-20 w-full rounded-2xl px-5 py-3 text-base"
                        placeholder="Cinematic trailer for Homer’s Odyssey shot as a 1970s classical epic. 36 shots, one consistent world. 35mm film, warm grain, heroic scale."
                      />
                    </div>

                    <div>
                      <div className="mb-2 text-xs tracking-widest text-white/50">STYLE REFERENCE (optional)</div>
                      <input
                        value={newProject.styleHint}
                        onChange={(e) => setNewProject({ ...newProject, styleHint: e.target.value })}
                        className="director-input w-full rounded-2xl px-5 py-3"
                        placeholder="35mm film photograph, cinematic 1970s, classical epic, horizontal 16:9, rich film grain"
                      />
                    </div>

                    <div>
                      <div className="mb-2 text-xs tracking-widest text-white/50">LOG LINE — ONE SENTENCE</div>
                      <textarea
                        value={newProject.logline}
                        onChange={(e) => setNewProject({ ...newProject, logline: e.target.value })}
                        className="director-input w-full rounded-2xl px-5 py-3 text-base sm:text-lg"
                        placeholder="A washed-up director uses Grok to make the greatest film of all time... but the AI starts directing him."
                      />
                    </div>

                    <div>
                      <div className="mb-3 text-xs tracking-widest text-white/50">FORMAT</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {PROJECT_TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setNewProject({ ...newProject, type: t.value })}
                            className={`rounded-2xl border p-4 text-left transition-all sm:p-5 ${
                              newProject.type === t.value
                                ? 'border-[var(--gold)] bg-white/5'
                                : 'border-white/10 hover:border-white/30'
                            }`}
                          >
                            <div className="mb-1 text-sm font-semibold tracking-wider">{t.label}</div>
                            <div className="text-sm text-white/60">{t.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div
                      onClick={() => setNewProject({ ...newProject, berserker: !newProject.berserker })}
                      className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-all sm:p-5 ${
                        newProject.berserker ? 'berserker border-[var(--crimson)]' : 'border-white/10'
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border ${
                          newProject.berserker ? 'border-red-600 bg-red-600' : 'border-white/30'
                        }`}
                      >
                        {newProject.berserker && <Zap className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <div className="font-semibold">BERSERKER MODE — UNCHAINED</div>
                        <div className="text-sm text-white/60">
                          Creative intensity only (wilder prompts & tone). Not the same as Auto mode —
                          Auto is “minimal typing → build shot list.” Berserker is “max ambition.”
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 bg-black/40 px-6 py-4 sm:px-9">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-6 py-3 text-sm text-white/70 hover:text-white sm:px-8"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={async () => await createProject()}
                    className="btn-gold rounded-2xl px-6 py-3 text-sm sm:px-10 sm:text-base"
                  >
                    CREATE PROJECT &amp; BREAK IT DOWN
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Movie Render Progress Modal (realistic orchestration UX) */}
      <AnimatePresence>
        {showMovieRender && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-2xl mb-4">Rendering Full Film...</div>
              <div className="h-2 bg-white/10 rounded mb-3 overflow-hidden">
                <div className="h-2 bg-[var(--gold)] transition-all" style={{width: `${movieRenderProgress}%`}} />
              </div>
              <div className="text-sm text-white/60">{movieRenderProgress}% — Stitching {selectedProject?.shots.filter(s=>s.videoUrl).length || 0} clips into one coherent movie</div>
              <div className="mt-6 text-xs text-white/40">This is the magic: Grok Imagine generates the footage. We orchestrate the film.</div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Channel Modal */}
      <AnimatePresence>
        {showChannelModal && (
          <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1,y:0}} className="bg-[#0a0a0a] border border-white/10 rounded-3xl max-w-md w-full p-8">
              <div className="font-display text-4xl tracking-tight mb-2">New Private Channel</div>
              <p className="text-sm text-white/60 mb-8">Your subscribers get serialized episodes. Beta: subscriptions are free while we build payments.</p>

              <input value={newChannel.name} onChange={e => setNewChannel({...newChannel, name: e.target.value})} placeholder="Channel name e.g. The Alex Rivera Sitcom" className="director-input w-full px-5 py-3 text-xl rounded-2xl mb-4" />
              <input value={newChannel.description} onChange={e => setNewChannel({...newChannel, description: e.target.value})} placeholder="Short description for subscribers" className="director-input w-full px-5 py-3 rounded-2xl mb-8" />

              <div className="flex gap-3">
                <button onClick={() => setShowChannelModal(false)} className="flex-1 py-3 text-white/70">Cancel</button>
                <button onClick={createChannel} className="flex-1 btn-gold py-3 rounded-2xl text-black">CREATE CHANNEL</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FilmDetailModal
        film={selectedFilm}
        token={token}
        currentUserId={currentUser?.id}
        onClose={() => setSelectedFilm(null)}
        onAuthRequired={() => setShowAuthModal(true)}
        onMessageCreator={(userId, username) => {
          setSelectedFilm(null);
          setSelectedConversation(userId);
          setChatPartner({ id: userId, username });
          setCurrentView('messages');
          if (token) loadMessages(userId, token).then((d) => setMessages(d.messages));
        }}
        onUpdate={(patch) => {
          setFeed((prev) => prev.map((item: FeedFilm) => item.id === patch.id ? { ...item, ...patch } : item));
          setSelectedFilm((prev) => prev?.id === patch.id ? { ...prev, ...patch } : prev);
        }}
      />

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={async (data) => {
          setToken(data.token);
          setCurrentUser(data.user);
          localStorage.setItem('moviedirector_token', data.token);
          localStorage.setItem('moviedirector_user', JSON.stringify(data.user));
          const userProjects = await loadUserProjects(data.token);
          if (userProjects?.length) setProjects(userProjects);
          const feedData = await loadFeed();
          if (feedData?.items?.length) setFeed(feedData.items);
          const chs = await loadChannels(data.token);
          if (chs.length) setChannels(chs);
          const subs = await loadSubscriptions(data.token);
          setSubscribedChannels(subs);
          await refreshBilling(data.token);
          const bal = (data.user as { creditBalance?: number }).creditBalance;
          toast.success(`Welcome, Director @${data.user.username}`, {
            description: 'Create your free First Cut sample — no card required.',
          });

          // New directors → First Cut walkthrough (genius free path)
          setTimeout(() => {
            const onboarding = (data.user as { onboarding?: string; firstCutStatus?: string }).onboarding
              || (data.user as { firstCutStatus?: string }).firstCutStatus;
            const hasReal = (userProjects && userProjects.length > 0);
            if (!hasReal || onboarding === 'first_cut' || !onboarding) {
              setShowFirstCut(true);
            }
          }, 700);
        }}
      />

      <FirstCutWalkthrough
        open={showFirstCut}
        token={token}
        onClose={() => setShowFirstCut(false)}
        onAuthRequired={() => {
          setShowFirstCut(false);
          setShowAuthModal(true);
        }}
        onProjectReady={(raw, meta) => {
          const project = normalizeProject(raw as Record<string, unknown>);
          setProjects((prev) => {
            if (prev.some((p) => p.id === project.id)) {
              return prev.map((p) => (p.id === project.id ? project : p));
            }
            return [project, ...prev.filter((p) => !String(p.id).startsWith('demo'))];
          });
          setSelectedProjectId(project.id);
          setCurrentView('workspace');
          setActiveTab('clips');
          setFirstCutStatus('in_progress');
          setFirstCutFree({ images: meta.freeImagesRemaining, videos: meta.freeVideosRemaining });
          toast.success('First Cut project ready', {
            description: meta.sampleOutcome || 'Generate free frames, then free video clips in Clips.',
          });
        }}
        onStartTrial={startTrial}
        onOpenBilling={() => {
          setShowFirstCut(false);
          setCurrentView('billing');
        }}
      />

      <TrialOfferModal
        open={showTrialOffer}
        onClose={() => setShowTrialOffer(false)}
        hasUsedTrial={hasUsedTrial}
        onStartPlatformTrial={() => startTrial('platform')}
        onStartStripeTrial={() => startTrial('stripe')}
        onOpenBilling={() => {
          setShowTrialOffer(false);
          setCurrentView('billing');
        }}
      />

      <ProductTour
        open={tourOpen}
        stepIndex={tourStep}
        onClose={() => setTourOpen(false)}
        onNext={goTourNext}
        onPrev={goTourPrev}
        onGoTo={(i) => setTourStep(i)}
      />
    </div>
  );
}
