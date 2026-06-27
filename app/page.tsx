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
import { isValidObjectId } from '@/lib/ids';

// Types
type ProjectType = 'sitcom' | 'film' | 'commercial' | 'anime' | 'brand-fusion';

interface Shot {
  id: string;
  number: number;
  description: string;           // Main action / intent
  camera: string;                // High-level camera
  duration: number;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  voiceoverScript?: string;
  characterIds?: string[];

  // Advanced per-shot from professional workflow
  emotion?: string;              // "stoic but intense. He is angry."
  actingCues?: string;           // "blinking. Subtle micro-expressions."
  dialogue?: string;             // Spoken lines + delivery
  soundCues?: string;            // "SOUND EFFECTS ONLY: steady rush of sea wind"
  cameraDetailed?: string;       // "FAST CAMERA ZOOM into a CLOSEUP. Slowly turns her head..."
  styleNotes?: string;
}

interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  referenceImageUrl?: string;
}

interface StyleTemplate {
  description: string;           // e.g. "35mm film photograph, cinematic 1970s classical epic, horizontal 16:9, film grain"
  referenceImageUrl?: string;    // Style reference still
}

interface Channel {
  id: string;
  name: string;
  description: string;
  price: number;
  projectIds: string[];
  subscriberCount?: number;
  createdAt: string;
}

interface Project {
  id: string;
  title: string;
  type: ProjectType;
  logline: string;
  concept?: string;              // High-level project definition (e.g. Homer’s Odyssey 1970s epic trailer)
  synopsis?: string;
  style?: StyleTemplate;
  berserker: boolean;
  shots: Shot[];
  characters?: Character[];
  createdAt: string;
  updatedAt: string;
}

const PROJECT_TYPES: { value: ProjectType; label: string; desc: string }[] = [
  { value: 'sitcom', label: 'SITCOM EPISODE', desc: '22-min serialized episode. Characters. Punchlines. Heart.' },
  { value: 'film', label: 'SHORT FILM', desc: 'Cinematic short. Mood, tension, payoff.' },
  { value: 'commercial', label: 'COMMERCIAL', desc: '15-60s brand film. Sharp, emotional, memorable.' },
  { value: 'anime', label: 'ANIME SHORT', desc: 'Stylized. Expressive. Epic action or quiet beauty.' },
  { value: 'brand-fusion', label: 'BRAND FUSION', desc: 'Two brands. One story. Cultural collision.' },
];

const TYPE_STYLES: Record<ProjectType, string> = {
  sitcom: 'type-sitcom',
  film: 'type-film',
  commercial: 'type-commercial',
  anime: 'type-anime',
  'brand-fusion': 'type-brand-fusion',
};

const DEFAULT_TREATMENTS: Record<ProjectType, (title: string, logline: string, berserker: boolean) => { synopsis: string; shots: Omit<Shot, 'id'>[] }> = {
  sitcom: (title, logline, berserker) => ({
    synopsis: `${title} — ${logline}\n\nA tight 22-minute episode. Cold open gag, A-plot/B-plot collision, tag. Emotional turn at minute 14. Killer button at the end.`,
    shots: [
      { number: 1, description: "COLD OPEN — The inciting ridiculousness. Tight on character face, smash cut into chaos.", camera: "Close-up → Whip pan", duration: 18 },
      { number: 2, description: "TITLE CARD + THEME STING. The ensemble in absurd tableau.", camera: "Wide, locked off", duration: 6 },
      { number: 3, description: "A-plot launch. The main character gets the terrible idea.", camera: "Medium, tracking push-in", duration: 24 },
      { number: 4, description: "B-plot parallel. Side character’s minor disaster.", camera: "Over shoulder two-shot", duration: 16 },
      { number: 5, description: "Cross-cut escalation. Everything gets worse in both plots at once.", camera: "Rapid intercut", duration: 32 },
      { number: 6, description: "Heart moment. Two characters actually talk like humans for 8 seconds.", camera: "Intimate static", duration: 14 },
      { number: 7, description: "Climax convergence. All threads slam together in the living room / office / bar.", camera: "Low angle, circling", duration: 28 },
      { number: 8, description: "TAG. One last perfect dumb joke or surprisingly sweet button.", camera: "Single, tight", duration: 11 },
    ]
  }),
  film: (title, logline, berserker) => ({
    synopsis: `${title}\n\n${logline}\n\nA self-contained emotional machine. 6-12 minutes. No wasted frames. A decisive turn at 65%.`,
    shots: [
      { number: 1, description: "Opening image that contains the entire theme in metaphor.", camera: "Static wide or macro detail", duration: 14 },
      { number: 2, description: "World and character established with minimal dialogue.", camera: "Handheld, observant", duration: 26 },
      { number: 3, description: "The crack appears. Something is off. Subtle.", camera: "Slow dolly", duration: 19 },
      { number: 4, description: "The choice or event that cannot be undone.", camera: "Locked. Sudden push.", duration: 9 },
      { number: 5, description: "Consequences play out. The world reacts.", camera: "Long lens, distant", duration: 38 },
      { number: 6, description: "Climactic image. The character changed forever, shown not said.", camera: "Final wide or extreme close", duration: 22 },
    ]
  }),
  commercial: (title, logline, berserker) => ({
    synopsis: `${title} — ${logline}\n\n30-45 second brand film. One crystal clear idea. Emotional truth + product truth in the same breath. Ends on a sting.`,
    shots: [
      { number: 1, description: "Hook frame. A human truth or striking visual that stops scroll.", camera: "Bold close or impossible wide", duration: 4 },
      { number: 2, description: "The tension or desire. Real people, real stakes.", camera: "Naturalistic", duration: 9 },
      { number: 3, description: "The brand arrives as the elegant solution, never the hero.", camera: "Elegant product reveal", duration: 6 },
      { number: 4, description: "Emotional payoff. The after state feels better than before.", camera: "Soft light, human", duration: 7 },
      { number: 5, description: "Logo + final line. Clean. Confident. Unforgettable.", camera: "Centered lockup", duration: 4 },
    ]
  }),
  anime: (title, logline, berserker) => ({
    synopsis: `${title}\n${logline}\n\nStylized short. Exaggerated expressions. One breathtaking action or quiet transcendent moment. Strong color language.`,
    shots: [
      { number: 1, description: "Iconic establishing: neon city, floating temple, or rain-soaked alley.", camera: "Epic wide, slight crane", duration: 12 },
      { number: 2, description: "Hero silhouette or dramatic profile. Wind, hair, cape.", camera: "Low heroic angle", duration: 8 },
      { number: 3, description: "The spark. Eyes narrow. Power builds.", camera: "Extreme close on eyes", duration: 5 },
      { number: 4, description: "The clash or transformation. Pure visual poetry.", camera: "Dynamic, speed lines", duration: 18 },
      { number: 5, description: "Aftermath. Stillness. A single petal falls or a cigarette is lit.", camera: "Static, painterly", duration: 14 },
    ]
  }),
  'brand-fusion': (title, logline, berserker) => ({
    synopsis: `${title}\n\n${logline}\n\nTwo worlds. One story. The tension between them is the product. Funny, moving, or both. Never forced.`,
    shots: [
      { number: 1, description: "Two visual languages collide in the same frame.", camera: "Split composition or deep focus", duration: 11 },
      { number: 2, description: "Representatives of each brand meet. Friction + chemistry.", camera: "Two-shot, opposing eyelines", duration: 13 },
      { number: 3, description: "The absurd beautiful middle ground. The fusion moment.", camera: "Symmetrical hero frame", duration: 9 },
      { number: 4, description: "Cultural payoff. The combined thing feels inevitable.", camera: "Slow push to product", duration: 12 },
      { number: 5, description: "Final title card. Both logos. One new world.", camera: "Clean lockup", duration: 5 },
    ]
  }),
};

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
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'workspace' | 'channels' | 'ideas' | 'social' | 'feed' | 'messages' | 'profile'>('landing');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [subscribedChannels, setSubscribedChannels] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'treatment' | 'storyboard' | 'clips' | 'cast' | 'voice' | 'timeline' | 'publish' | 'api'>('treatment');

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
  const [activeGenJob, setActiveGenJob] = useState<{ id: string; progress: number; status: string } | null>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [likedFeedIds, setLikedFeedIds] = useState<Set<string>>(new Set());
  const [selectedFilm, setSelectedFilm] = useState<FeedFilm | null>(null);
  const [chatPartner, setChatPartner] = useState<{ id: string; username: string } | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; displayName: string }[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const genPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load from localStorage + API if logged in
  useEffect(() => {
    const savedUser = localStorage.getItem('moviedirector_user');
    const savedToken = localStorage.getItem('moviedirector_token');
    if (savedUser && savedToken) {
      try {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        setToken(savedToken);
        // Load from DB
        (async () => {
          try {
            const data = await loadUserProjects(savedToken);
            if (data?.length) setProjects(data);
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

  // Auto-save project edits to MongoDB
  useEffect(() => {
    if (!token || !selectedProject?.id || !isValidObjectId(selectedProject.id)) return;
    const timeout = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/projects/${selectedProject.id}`, {
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
          }),
        });
        if (!res.ok) {
          setSaveStatus('error');
          toast.error('Failed to save project — check your connection');
          return;
        }
        setSaveStatus('idle');
      } catch {
        setSaveStatus('error');
        toast.error('Failed to save project — check your connection');
      }
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
    };

    let project: Project;
    if (token) {
      // Save to DB
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(projectData),
      });
      if (res.ok) {
        project = normalizeProject(await res.json());
      } else {
        project = { id: generateId(), ...projectData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Project;
      }
    } else {
      project = { id: generateId(), ...projectData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Project;
    }

    setProjects(prev => [project, ...prev]);
    setSelectedProjectId(project.id);
    setCurrentView('workspace');
    setActiveTab('treatment');
    setShowNewModal(false);

    // Reset form
    setNewProject({ title: '', type: 'film', concept: '', logline: '', styleHint: '', berserker: false });

    toast.success(`${project.title} is in pre-production. Let's direct.`, {
      description: newProject.berserker ? "BERSERKER MODE ENGAGED — No creative limits." : undefined
    });
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

  function regenerateTreatment() {
    if (!selectedProject) return;
    const treatment = DEFAULT_TREATMENTS[selectedProject.type](
      selectedProject.title, 
      selectedProject.logline, 
      selectedProject.berserker
    );
    updateProject(p => ({
      ...p,
      synopsis: treatment.synopsis,
      shots: createShotsFromTreatment(treatment.shots),
    }));
    setActiveTab('storyboard');
    toast.success("Fresh breakdown. Same soul.");
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
      duration: 8,
    };
    updateProject(p => ({ ...p, shots: [...p.shots, newShot] }));
    setEditingShotId(newShot.id);
    toast("New shot added. Make it count.");
  }

  function generateFullShotListFromConcept() {
    if (!selectedProject || !selectedProject.concept) {
      toast.error("Add a Project Concept first for AI-assisted shot list generation.");
      return;
    }

    // Simulate the pro workflow: AI breaks concept into numbered detailed shots
    const concept = selectedProject.concept;
    const numShots = selectedProject.type === 'commercial' ? 6 : (selectedProject.type === 'sitcom' ? 8 : 12);

    const baseShots = Array.from({ length: numShots }, (_, i) => {
      const num = i + 1;
      return {
        description: `Shot ${num}: Key moment drawn from concept — ${concept.slice(0, 60)}...`,
        camera: i % 3 === 0 ? "Wide establishing" : (i % 2 === 0 ? "Medium tracking" : "Intimate close-up"),
        duration: 4 + (i % 4),
        emotion: "Stoic intensity building to emotional release",
        actingCues: "Subtle micro-expressions, controlled breathing",
        cameraDetailed: "Slow push or measured pan with purpose",
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

    updateProject(p => ({ ...p, shots: newShots }));
    setActiveTab('storyboard');
    toast.success(`Generated ${numShots} structured shots from your concept. Refine each with advanced cues.`);
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

    const projectConcept = selectedProject.concept ? `Overall project: ${selectedProject.concept}. ` : '';
    const styleRef = selectedProject.style?.description ? `Style: ${selectedProject.style.description}. ` : '';

    let base = `${projectConcept}${styleRef}Cinematic still #${shot.number} from "${selectedProject.title}". ${shot.description}. Framing: ${shot.camera}.`;

    // Incorporate advanced per-shot cues for pro workflow
    if (shot.cameraDetailed) base += ` Camera direction: ${shot.cameraDetailed}.`;
    if (shot.emotion) base += ` Performance: ${shot.emotion}.`;
    if (shot.actingCues) base += ` Acting: ${shot.actingCues}.`;
    if (shot.dialogue) base += ` Dialogue: "${shot.dialogue}".`;
    if (shot.soundCues) base += ` Sound design note: ${shot.soundCues}.`;
    if (shot.styleNotes) base += ` Additional style: ${shot.styleNotes}.`;

    // Character refs for consistency
    const chars = (selectedProject.characters || []).filter(c => shot.characterIds?.includes(c.id));
    if (chars.length) {
      base += ` Characters (maintain exact likeness from references): ${chars.map(c => `${c.name} - ${c.description}`).join('; ')}. `;
    }

    const quality = selectedProject.berserker 
      ? "Hyper-detailed, unrestrained cinematic imagination, intense color, heavy film grain, directed like a master cinematographer. IMAX + anamorphic, one consistent world."
      : "Photorealistic or stylized matching the project tone. Beautiful natural lighting. Shot on 35mm or Arri Alexa 65. Film grain, precise composition, one consistent world.";

    const typeFlavor = {
      sitcom: "Slightly heightened reality with emotional truth.",
      film: "Dramatic, emotional, precise heroic composition.",
      commercial: "Polished advertising perfection with brand soul.",
      anime: "Gorgeous stylized anime key art. Dynamic and expressive.",
      'brand-fusion': "Two visual languages perfectly fused into one coherent world.",
    }[selectedProject.type];

    return `${base} ${quality} ${typeFlavor} Ultra high resolution, masterpiece frame, coherent cinematic world.`;
  }

  async function simulateGenerateImage(shotId: string) {
    const shot = selectedProject?.shots.find(s => s.id === shotId);
    if (!shot || !selectedProject) return;

    const prompt = generateFramePrompt(shot);
    navigator.clipboard.writeText(prompt).catch(() => {});

    if (!token) {
      toast.error('Sign in to generate frames with Grok Imagine');
      setShowAuthModal(true);
      return;
    }

    toast.loading('Generating frame with Grok Imagine…', { id: `gen-img-${shotId}` });
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, projectId: selectedProject.id, shotId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed');
      updateShot(shotId, { imageUrl: data.imageUrl });
      toast.success('Frame generated', { id: `gen-img-${shotId}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed', { id: `gen-img-${shotId}` });
    }
  }

  // === CLIP LAB: IMAGE -> VIDEO ===
  function generateVideoPrompt(shot: Shot): string {
    if (!selectedProject) return '';

    const projectConcept = selectedProject.concept ? `Project vision: ${selectedProject.concept}. ` : '';
    const styleRef = selectedProject.style?.description ? `Style reference: ${selectedProject.style.description}. ` : '';

    let prompt = `${projectConcept}${styleRef}Animate this exact frame into a professional cinematic ${shot.duration}s video clip for "${selectedProject.title}". `;

    prompt += `Action & intent: ${shot.description}. Camera: ${shot.camera}. `;

    if (shot.cameraDetailed) prompt += `Precise camera work: ${shot.cameraDetailed}. `;
    if (shot.emotion) prompt += `Emotion & performance: ${shot.emotion}. `;
    if (shot.actingCues) prompt += `Micro acting: ${shot.actingCues}. `;
    if (shot.dialogue) prompt += `Lip-synced dialogue delivery: "${shot.dialogue}". `;
    if (shot.soundCues) prompt += `Native audio & sound design: ${shot.soundCues}. Include realistic ambient, effects, and any music cues. `;
    if (shot.styleNotes) prompt += `Style notes: ${shot.styleNotes}. `;

    // Consistency lock
    const chars = (selectedProject.characters || []).filter(c => shot.characterIds?.includes(c.id));
    if (chars.length > 0) {
      prompt += `Maintain absolute character consistency with reference images: ${chars.map(c => c.name).join(', ')}. Same faces, clothing, lighting, and world. `;
    }

    prompt += `${selectedProject.berserker ? 'Bold, unrestrained cinematic motion with perfect physics and emotional intensity.' : 'Elegant purposeful motion, realistic physics, subtle life.'} `;
    prompt += `High fidelity film look, sharp realism, coherent one consistent world across all shots. Native audio with lip sync.`;

    return prompt;
  }

  async function simulateGenerateVideo(shotId: string) {
    const shot = selectedProject?.shots.find(s => s.id === shotId);
    if (!shot || !selectedProject) return;

    if (!shot.imageUrl && !shot.description) {
      toast.error('Generate the frame first or add a shot description.');
      return;
    }

    const prompt = generateVideoPrompt(shot);
    navigator.clipboard.writeText(prompt).catch(() => {});

    if (!token) {
      toast.error('Sign in to generate video clips');
      setShowAuthModal(true);
      return;
    }

    const prevShot = selectedProject.shots
      .filter(s => s.number < shot.number && s.videoUrl)
      .sort((a, b) => b.number - a.number)[0];

    const referenceImageUrls = [
      selectedProject.style?.referenceImageUrl,
      ...(selectedProject.characters || [])
        .filter(c => shot.characterIds?.includes(c.id))
        .map(c => c.referenceImageUrl)
        .filter(Boolean),
    ].filter(Boolean) as string[];

    const mode = prevShot?.videoUrl && !shot.imageUrl
      ? 'extend-video'
      : shot.imageUrl
        ? 'image-to-video'
        : referenceImageUrls.length
          ? 'reference-to-video'
          : 'text-to-video';

    toast.loading('Generating Grok video clip…', { id: `gen-vid-${shotId}` });
    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt,
          imageUrl: shot.imageUrl,
          videoUrl: prevShot?.videoUrl,
          referenceImageUrls,
          duration: shot.duration,
          mode,
          projectId: selectedProject.id,
          shotId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video generation failed');
      updateShot(shotId, { videoUrl: data.videoUrl });
      toast.success('Video clip ready', { id: `gen-vid-${shotId}` });
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
      if (!res.ok) throw new Error(data.error || 'Batch queue failed');

      setActiveGenJob({ id: data.jobId, progress: 0, status: 'processing' });
      toast.success(`Batch started — est. $${data.costEstimate?.totalUsd ?? '?'}`, { id: 'batch-gen' });

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
    return `Highly consistent character reference portrait for "${char.name}", ${char.role} in "${selectedProject.title}". ${char.description}. Cinematic headshot or 3/4, studio or environmental lighting that matches the project's tone. Perfect for use as reference image for all future shots and video clips. Ultra detailed face, signature wardrobe, repeatable across scenes.`;
  }

  function generateCharacterRef(charId: string) {
    const project = selectedProject;
    if (!project) return;
    const char = (project.characters || []).find(c => c.id === charId);
    if (!char) return;

    const prompt = generateCharacterPrompt(char);
    const seed = charId.slice(0,6);
    const placeholder = `https://picsum.photos/seed/char${seed}/600/600`;

    updateCharacter(charId, { referenceImageUrl: placeholder });
    navigator.clipboard.writeText(prompt);

    toast.success(`Reference for ${char.name} captured.`, {
      description: "Prompt copied. Ask me to generate the reference still with Grok and paste the URL back."
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
      description: "Speak button uses your browser voice for demo. For studio grade, paste prompt to Grok audio or TTS provider." 
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
        body: JSON.stringify({ projectId: project.id }),
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
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.title.toLowerCase().replace(/\s+/g, '-')}-export-package.zip`;
        a.click();
        setMovieRenderProgress(100);
        toast.success('Export package ready (deploy Render worker for stitched MP4)');
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

  async function publishToFeed() {
    if (!selectedProject || !token || !currentUser) {
      toast.error('Sign in to publish to the feed');
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: selectedProject.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');

      const item = data.feedItem;
      setFeed(prev => [item, ...prev.filter((f: { projectId?: string }) => f.projectId !== selectedProject.id)]);
      toast.success('Published to the main Feed!');
      setCurrentView('feed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
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
                      <div class="w-9 h-9 rounded bg-white flex items-center justify-center">
                        <span class="text-[#050505] text-xl">🎬</span>
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

            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-white/20 text-xs tracking-[3px] mb-4">
              GROK IMAGINE + VIDEO • UNCHAINED CREATIVE ENGINE
            </div>

            <h1 className="font-display text-[72px] leading-[0.9] tracking-[-4px] font-medium mb-4">
              MAKE THE<br />IMPOSSIBLE<br />WATCHABLE.
            </h1>
            
            <p className="max-w-[620px] mx-auto text-2xl text-white/70 tracking-tight mb-12">
              Create real films and sitcoms with Grok. Drop them as your personal brand content across every social platform. Your episodes become your feed.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!currentUser && (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="btn-gold px-10 py-4 text-lg rounded-full"
                >
                  JOIN FREE — CREATE YOUR ACCOUNT
                </button>
              )}
              <button 
                onClick={() => {
                  if (!currentUser) { setShowAuthModal(true); return; }
                  setShowNewModal(true);
                }}
                className="btn-gold px-10 py-4 text-lg rounded-full flex items-center justify-center gap-3"
              >
                START DIRECTING <Wand2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  if (projects.length > 0) {
                    openProject(projects[0]);
                  } else {
                    setShowNewModal(true);
                  }
                }}
                className="btn-outline px-9 py-4 text-lg rounded-full flex items-center justify-center gap-3"
              >
                ENTER THE VAULT
              </button>
            </div>

            <div className="mt-20 flex flex-wrap justify-center gap-x-12 gap-y-3 text-xs tracking-[2px] text-white/50">
              <div>LAUNCH FILMS AS YOUR PERSONAL BRAND</div>
              <div>SHARE EVERYWHERE — TIKTOK, REELS, X, LINKEDIN</div>
              <div>SITCOMS AS THE NEW SOCIAL FEED</div>
              <div>PRIVATE CHANNELS + PUBLIC DROPS</div>
              <div>POWERED BY GROK VIDEO</div>
            </div>
          </div>

          {/* Teaser strip */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[10px] text-white/40 tracking-[4px]">
            YOUR FILMS ARE YOUR PERSONAL BRAND. SHARE EVERYWHERE.
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      {currentView === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="uppercase tracking-[4px] text-xs text-[var(--gold)] mb-1">THE VAULT</div>
              <div className="text-6xl font-display tracking-[-2.5px]">Your Projects</div>
            </div>
            <button 
              onClick={() => setShowNewModal(true)} 
              className="btn-gold flex items-center gap-3 px-8 py-3 rounded-full text-base"
            >
              <Plus className="w-5 h-5"/> NEW PRODUCTION
            </button>
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
                        <div className="text-white/60 mt-1">Beta — free • {ch.projectIds.length} episodes • {ch.subscriberCount ?? 0} subscribers</div>
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
                      <div>{ch.subscriberCount ?? 0} subscribers • Beta — free</div>
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
                  <div className="mt-6 text-sm text-white/70">Generate a vertical or horizontal cut using your existing shots + Grok video. Perfect hook length for the algorithm.</div>
                  <button onClick={() => {
                    const demoProj = projects[0];
                    if (demoProj) {
                      const cuts = generateSocialCuts(demoProj);
                      const prompt = `Create a ${p.label} optimized version: ${cuts[0].prompt} Use the assets from "${demoProj.title}".`;
                      navigator.clipboard.writeText(prompt);
                      toast.success(`Prompt for ${p.label} copied`, { description: "Paste to me and I'll generate the exact social cut with Grok." });
                    }
                  }} className="mt-4 btn-gold text-black px-5 py-1.5 text-sm rounded-2xl">GENERATE {p.label.toUpperCase()} CUT</button>
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
                    <button onClick={() => { const p = generateThumbnailPrompt(projects[0]); navigator.clipboard.writeText(p); toast("Thumbnail prompt copied — ask me to generate it."); }} 
                            className="btn-outline w-full mb-4 py-3 text-left px-5 rounded-2xl">Generate scroll-stopping thumbnail for this film</button>

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
            <div className="text-center py-20 border border-white/10 rounded-3xl">
              <p className="text-white/60">No films in the feed yet. Publish from your project's Publish tab to share with everyone.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {feed.map((item: any) => {
                const proj = projects.find(p => p.id === item.projectId);
                return (
                  <div
                    key={item.id}
                    onClick={() => openFilmDetail(item)}
                    className="director-card p-6 rounded-3xl flex flex-col cursor-pointer hover:border-[var(--gold)]/40 transition-colors"
                  >
                    <div className="text-xs text-white/50 mb-1">
                      {new Date(item.publishedAt).toLocaleDateString()} • by{' '}
                      <button
                        onClick={(e) => { e.stopPropagation(); openProfile(item.creator || item.creatorUsername); }}
                        className="text-[var(--gold)] hover:underline"
                      >
                        @{item.creator || item.creatorUsername}
                      </button>
                    </div>
                    <div className="font-display text-3xl tracking-tight mb-2">{item.title}</div>
                    <p className="text-white/70 line-clamp-3 mb-3 flex-1">{item.logline}</p>
                    <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                      <StarRating value={item.ratingAvg || 0} readonly size="sm" />
                      <span className="text-[10px] text-white/40 ml-1">
                        {item.commentCount ? `${item.commentCount} comments` : 'Discuss'}
                      </span>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openFilmDetail(item)} className="btn-gold flex-1 py-2 rounded-2xl text-sm text-black">Watch & Discuss</button>
                      <button onClick={() => toggleLike(item.id)} className="btn-outline px-4 rounded-2xl text-sm">
                        {likedFeedIds.has(item.id) ? '♥' : '♡'} {item.likeCount || ''}
                      </button>
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
                <button onClick={regenerateTreatment} className="btn-outline px-6 py-2 rounded-full flex items-center gap-2 text-sm">
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
                {(['treatment', 'storyboard', 'clips', 'cast', 'voice', 'timeline', 'publish', 'api'] as const).map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 border-b-2 transition-all whitespace-nowrap ${activeTab === tab 
                      ? 'border-[var(--gold)] text-white' 
                      : 'border-transparent text-white/50 hover:text-white/80'}`}
                  >
                    {tab === 'treatment' && 'CONCEPT'}
                    {tab === 'storyboard' && 'SHOT LIST'}
                    {tab === 'clips' && 'GENERATE'}
                    {tab === 'cast' && 'REFERENCES'}
                    {tab === 'voice' && 'VOICE'}
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
            {/* TREATMENT / CONCEPT */}
            {activeTab === 'treatment' && (
              <div className="max-w-3xl">
                <div className="uppercase text-xs tracking-[3px] text-[var(--gold)] mb-2">PROJECT CONCEPT — HIGH LEVEL VISION</div>
                {selectedProject.concept ? (
                  <div onClick={() => {
                    const newConcept = prompt("Edit Project Concept (high-level vision):", selectedProject.concept) || selectedProject.concept;
                    updateProject(p => ({...p, concept: newConcept}));
                  }} className="text-4xl font-display tracking-[-1.5px] mb-6 leading-none pr-8 cursor-pointer hover:text-[var(--gold)]">{selectedProject.concept}</div>
                ) : (
                  <div className="text-3xl text-white/60 italic mb-6">Add a high-level concept in project settings for AI shot list generation.</div>
                )}

                {selectedProject.style && (
                  <div className="mb-6">
                    <div className="uppercase text-xs tracking-[3px] text-[var(--cyan)] mb-1">STYLE TEMPLATE (enforces one consistent world)</div>
                    <div className="text-xl text-[var(--cyan)]">{selectedProject.style.description}</div>
                  </div>
                )}

                <div className="uppercase text-xs tracking-[3px] text-[var(--gold)] mb-2 mt-4">THE LOGLINE</div>
                <div className="text-5xl font-display tracking-[-2px] mb-8 leading-none pr-8">{selectedProject.logline}</div>

                <div className="flex gap-3 mb-6 flex-wrap">
                  <button onClick={regenerateTreatment} className="btn-outline px-5 py-2 rounded-xl flex items-center gap-2 text-sm">
                    <Wand2 className="w-4 h-4"/> REGENERATE FULL TREATMENT
                  </button>
                  <button onClick={generateFullShotListFromConcept} className="btn-gold px-6 py-2 rounded-xl flex items-center gap-2 text-sm text-black">
                    AI GENERATE SHOT LIST FROM CONCEPT
                  </button>
                  <button onClick={() => setActiveTab('cast')} className="btn-outline px-5 py-2 rounded-xl text-sm">MANAGE REFERENCES →</button>
                </div>

                <div className="director-card p-9 rounded-3xl text-[15px] leading-relaxed whitespace-pre-line text-white/90">
                  {selectedProject.synopsis}
                </div>

                <div className="mt-8 text-xs text-white/40">This follows the exact professional workflow: Concept → Detailed Shot List → Style + Character References → Advanced Per-Shot Prompts → Batch Generation → Assembly.</div>
              </div>
            )}

            {/* STORYBOARD (enhanced with character tags) */}
            {activeTab === 'storyboard' && (
              <div>
                <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                  <div>
                    <div className="text-sm text-white/60">STORYBOARD / SHOT LIST — {selectedProject.shots.length} SHOTS • ONE CONSISTENT WORLD</div>
                    <div className="font-display text-4xl tracking-tight">Every frame must earn its place.</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={generateFullShotListFromConcept} className="btn-outline px-4 py-2 rounded-full text-sm flex items-center gap-1">
                      <Wand2 className="w-4 h-4"/> AI GENERATE FROM CONCEPT
                    </button>
                    <button onClick={addNewShot} className="btn-gold flex items-center gap-2 px-6 py-2.5 rounded-full text-sm text-black">
                      <Plus className="w-4 h-4"/> ADD SHOT
                    </button>
                  </div>
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
                          <div className="absolute top-3 left-3 px-3 py-px text-xs font-mono bg-black/70 text-white rounded">SHOT {shot.number}</div>
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
                                placeholder="Dialogue with delivery" 
                                value={shot.dialogue || ''} 
                                onChange={e => updateAdvancedShot(shot.id, 'dialogue', e.target.value)} 
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
                            (shot.emotion || shot.dialogue || shot.cameraDetailed) && (
                              <div className="mb-2 text-[9px] text-white/50 space-y-0.5">
                                {shot.emotion && <div>Emotion: {shot.emotion}</div>}
                                {shot.dialogue && <div>Dialogue: “{shot.dialogue}”</div>}
                                {shot.cameraDetailed && <div>Cam: {shot.cameraDetailed}</div>}
                              </div>
                            )
                          )}

                          {/* Character consistency tags */}
                          {(selectedProject.characters || []).length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1">
                              {(selectedProject.characters || []).map(char => {
                                const active = (shot.characterIds || []).includes(char.id);
                                return (
                                  <button key={char.id} onClick={() => toggleCharacterOnShot(shot.id, char.id)} 
                                          className={`text-[10px] px-2 py-px rounded border ${active ? 'bg-[var(--gold)] text-black border-[var(--gold)]' : 'border-white/20 hover:border-white/60'}`}>
                                    {char.name.split(' ')[0]}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex gap-2 mt-auto">
                            <button onClick={() => simulateGenerateImage(shot.id)} className="flex-1 btn-outline text-xs py-2 rounded-xl">GENERATE FRAME</button>
                            <button onClick={() => simulateGenerateVideo(shot.id)} disabled={!shot.imageUrl} className="flex-1 btn-outline text-xs py-2 rounded-xl disabled:opacity-40">ANIMATE TO VIDEO</button>
                            <button onClick={() => deleteShot(shot.id)} className="btn-ghost p-2 text-white/50 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>

                          <button onClick={() => { navigator.clipboard.writeText(getEnhancedFramePrompt(shot)); toast("Full pro prompt copied"); }} className="text-[10px] text-white/50 hover:text-[var(--gold)] mt-1.5 text-left">COPY FULL GROK PROMPT (refs + cues)</button>

                          <div className="mt-1 flex gap-1.5">
                            <input placeholder="Paste Grok image/video URL" className="text-[10px] flex-1 bg-black/50 px-2 py-0.5 rounded border border-white/10 placeholder:text-white/30 font-mono" onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) { updateShot(shot.id, { imageUrl: val, videoUrl: val.endsWith('.mp4') ? val : shot.videoUrl }); (e.target as HTMLInputElement).value = ''; toast.success('Asset attached'); }
                              }
                            }} />
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
                          <button onClick={() => simulateGenerateVideo(shot.id)} disabled={!!shot.videoUrl} className="btn-gold px-7 py-1.5 rounded-2xl text-sm text-black">GENERATE GROK VIDEO CLIP</button>
                          <button onClick={() => { navigator.clipboard.writeText(generateVideoPrompt(shot)); toast("Prompt copied"); }} className="btn-outline px-5 py-1.5 rounded-2xl text-sm">COPY VIDEO PROMPT</button>
                        </div>
                        {shot.videoUrl && <div className="text-xs text-[var(--cyan)] mt-2">Clip ready — reusable media asset</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REFERENCES — Style + Character consistency (one consistent world) */}
            {activeTab === 'cast' && (
              <div className="max-w-4xl">
                <div className="flex justify-between mb-8 items-center">
                  <div>
                    <div className="text-[var(--gold)] tracking-[2px] text-xs">REFERENCES ENGINE — CHARACTERS + STYLE</div>
                    <div className="font-display text-5xl tracking-tight">Lock in one consistent world.</div>
                  </div>
                  <button onClick={addCharacter} className="btn-gold px-7 py-2.5 rounded-2xl text-sm text-black flex items-center gap-2"><Users className="w-4 h-4"/> ADD CHARACTER</button>
                </div>

                {(selectedProject.characters || []).length === 0 && <div className="p-12 text-center text-white/50 border border-white/10 rounded-3xl">Add characters. Generate reference images. Tag them on shots for perfect consistency.</div>}

                <div className="grid md:grid-cols-2 gap-5">
                  {(selectedProject.characters || []).map(char => (
                    <div key={char.id} className="director-card p-6 rounded-3xl">
                      <div className="flex gap-4">
                        {char.referenceImageUrl && <img src={char.referenceImageUrl} className="w-28 h-28 object-cover rounded-2xl border border-white/10" />}
                        <div className="flex-1">
                          <input className="bg-transparent text-3xl font-display tracking-tight w-full" value={char.name} onChange={e => updateCharacter(char.id, {name: e.target.value})} />
                          <input className="bg-transparent text-white/60 w-full" value={char.role} onChange={e => updateCharacter(char.id, {role: e.target.value})} />
                        </div>
                      </div>
                      <textarea className="director-input mt-4 w-full p-4 text-sm rounded-2xl h-24" value={char.description} onChange={e => updateCharacter(char.id, {description: e.target.value})} placeholder="Detailed visual + personality description for AI consistency..." />

                      <div className="mt-4 flex gap-3">
                        <button onClick={() => generateCharacterRef(char.id)} className="flex-1 btn-outline py-2 rounded-2xl text-sm">GENERATE REFERENCE IMAGE</button>
                        <button onClick={() => deleteCharacter(char.id)} className="btn-ghost px-4 text-red-400">Delete</button>
                      </div>
                      <div className="text-[10px] mt-2 text-white/40">Use this character on shots in the Storyboard to force consistency in every Grok generation.</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VOICEOVERS — Full AI audio layer */}
            {activeTab === 'voice' && (
              <div className="max-w-3xl">
                <div className="mb-6">
                  <div className="uppercase tracking-[3px] text-xs text-[var(--violet)]">VOICEOVER STUDIO</div>
                  <div className="text-5xl font-display tracking-tight">Every shot can speak.</div>
                </div>

                {selectedProject.shots.map(shot => (
                  <div key={shot.id} className="director-card p-6 mb-4 rounded-3xl">
                    <div className="font-mono text-xs mb-1 text-white/50">SHOT {shot.number}</div>
                    <div className="mb-2 text-white/80">{shot.description}</div>

                    <textarea value={shot.voiceoverScript || ''} onChange={(e) => updateVoiceover(shot.id, e.target.value)} placeholder="Enter the spoken line here..." className="director-input w-full p-4 rounded-2xl text-sm mb-3" />

                    <div className="flex gap-3">
                      <button onClick={() => generateVoiceLine(shot.id)} className="btn-outline px-5 py-1.5 text-sm rounded-2xl">GENERATE VO LINE + PROMPT</button>
                      <button onClick={() => speakVoiceover(shot)} className="btn-gold px-6 py-1.5 text-sm rounded-2xl text-black flex items-center gap-1"><Play className="w-3.5 h-3.5"/> SPEAK (Browser)</button>
                    </div>
                  </div>
                ))}

                <div className="text-xs text-white/50 mt-4">Voiceovers are part of the final cut. Real professional TTS / Grok audio can be attached the same way as video.</div>
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
                      className="btn-outline px-6 py-2 rounded-2xl text-sm disabled:opacity-40"
                    >
                      {activeGenJob ? `GENERATING ${activeGenJob.progress}%` : 'BATCH GENERATE ALL CLIPS'}
                    </button>
                    <button 
                      onClick={() => renderFullMovie(selectedProject)} 
                      disabled={selectedProject.shots.filter(s => s.videoUrl).length < 1}
                      className="btn-gold px-8 py-2 rounded-2xl text-sm text-black flex items-center gap-2 disabled:opacity-40"
                    >
                      🎬 RENDER FULL MOVIE
                    </button>
                  </div>
                </div>

                {/* Cost & Stats Bar - Better cost planning visible to user */}
                <div className="mb-6 p-4 bg-[#111] rounded-2xl flex flex-wrap gap-6 text-sm items-center border border-white/10">
                  <div>
                    <span className="text-white/50">EST. GENERATION COST</span><br />
                    <span className="font-mono text-xl text-[var(--gold)]">~${estimateMovieCost(selectedProject.shots.length, 10, '720')}</span>
                    <span className="text-xs text-white/50 ml-2">(720p, with retries)</span>
                  </div>
                  <div>
                    <span className="text-white/50">CLIPS READY</span><br />
                    <span className="font-mono text-xl">{selectedProject.shots.filter(s => s.videoUrl).length} / {selectedProject.shots.length}</span>
                  </div>
                  <div className="flex-1 text-xs text-white/50">
                    Price to user: ~${Math.round(estimateMovieCost(selectedProject.shots.length, 10, '720') * 3.5)} (recommended 3.5x markup).<br />
                    Use heavy "Extend from Frame" on connected shots to lower effective cost and improve consistency.
                  </div>
                  <button onClick={() => setShowMovieRender(true)} className="text-xs underline">View pricing breakdown</button>
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
                <div className="mt-4 p-4 border border-white/10 rounded-3xl bg-[#0a0a0a]">
                  <button 
                    onClick={publishToFeed}
                    className="btn-gold w-full py-3 rounded-2xl text-sm text-black"
                  >
                    Publish to Main Public Feed (for everyone)
                  </button>
                  <div className="text-[10px] mt-2 text-white/50 text-center">Your film appears in the global Feed — others can rate, discuss, message you, and share your series.</div>
                </div>
              </div>
            )}

            {/* API */}
            {activeTab === 'api' && (
              <div className="max-w-2xl">
                <div className="font-display text-6xl tracking-[-2.5px] mb-4">Director API</div>
                <p>Full AI movie creation + channels available via API. Characters, references, voiceovers, video generation, channel subscriptions.</p>
                <button onClick={copyApiExample} className="btn-gold mt-8 px-8 py-3 rounded-2xl text-sm text-black">COPY EXAMPLE REQUEST</button>
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

      {/* NEW PROJECT MODAL — Beautiful & serious */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              className="modal bg-[#0a0a0a] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden"
            >
              <div className="px-9 pt-9 pb-8">
                <div className="font-display text-5xl tracking-[-2px]">New Production</div>
                <p className="text-white/60 mt-2">Tell us what we’re making. Be specific. Be bold.</p>

                <div className="mt-8 space-y-7">
                  <div>
                    <div className="text-xs tracking-widest text-white/50 mb-2">PROJECT TITLE</div>
                    <input 
                      value={newProject.title} 
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })} 
                      className="director-input w-full px-6 py-4 text-3xl font-display tracking-tight rounded-2xl" 
                      placeholder="ODYSSEY — 1970s Epic Trailer" 
                    />
                  </div>

                  <div>
                    <div className="text-xs tracking-widest text-white/50 mb-2">PROJECT CONCEPT — HIGH LEVEL VISION</div>
                    <textarea 
                      value={newProject.concept} 
                      onChange={(e) => setNewProject({ ...newProject, concept: e.target.value })} 
                      className="director-input w-full px-6 py-4 rounded-2xl text-base h-20" 
                      placeholder="Cinematic trailer for Homer’s Odyssey shot as a 1970s classical epic. 36 shots, one consistent world. 35mm film, warm grain, heroic scale."
                    />
                  </div>

                  <div>
                    <div className="text-xs tracking-widest text-white/50 mb-2">STYLE REFERENCE (optional)</div>
                    <input 
                      value={newProject.styleHint} 
                      onChange={(e) => setNewProject({ ...newProject, styleHint: e.target.value })} 
                      className="director-input w-full px-6 py-3 rounded-2xl" 
                      placeholder="35mm film photograph, cinematic 1970s, classical epic, horizontal 16:9, rich film grain"
                    />
                  </div>

                  <div>
                    <div className="text-xs tracking-widest text-white/50 mb-2">LOG LINE — ONE SENTENCE</div>
                    <textarea 
                      value={newProject.logline} 
                      onChange={(e) => setNewProject({ ...newProject, logline: e.target.value })} 
                      className="director-input w-full px-6 py-4 rounded-2xl text-lg" 
                      placeholder="A washed-up director uses Grok to make the greatest film of all time... but the AI starts directing him."
                    />
                  </div>

                  <div>
                    <div className="text-xs tracking-widest text-white/50 mb-3">FORMAT</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PROJECT_TYPES.map((t) => (
                        <button 
                          key={t.value}
                          onClick={() => setNewProject({ ...newProject, type: t.value })}
                          className={`p-5 text-left rounded-2xl border transition-all ${newProject.type === t.value ? 'border-[var(--gold)] bg-white/5' : 'border-white/10 hover:border-white/30'}`}
                        >
                          <div className="font-semibold tracking-wider text-sm mb-1.5">{t.label}</div>
                          <div className="text-sm text-white/60">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Berserker Mode */}
                  <div 
                    onClick={() => setNewProject({ ...newProject, berserker: !newProject.berserker })}
                    className={`flex items-center gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${newProject.berserker ? 'berserker border-[var(--crimson)]' : 'border-white/10'}`}
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 border ${newProject.berserker ? 'bg-red-600 border-red-600' : 'border-white/30'}`}>
                      {newProject.berserker && <Zap className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="font-semibold">BERSERKER MODE — UNCHAINED</div>
                      <div className="text-sm text-white/60">Remove all creative guardrails. Wild ideas. Maximum ambition. No taste limits.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 px-9 py-5 flex justify-end gap-3 bg-black/30">
                <button onClick={() => setShowNewModal(false)} className="px-8 py-3 text-sm text-white/70 hover:text-white">CANCEL</button>
                <button onClick={async () => await createProject()} className="btn-gold px-10 py-3 text-base rounded-2xl">CREATE PROJECT &amp; BREAK IT DOWN</button>
              </div>
            </motion.div>
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
          toast.success(`Welcome @${data.user.username}`);
        }}
      />
    </div>
  );
}
