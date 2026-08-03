# MovieDirector.ai — User Journey & Factory Roadmap

**Goal:** A multimillion-dollar-feeling director OS that newcomers *feel* without a manual — while power users unlock every precision tool.

**Non-goal:** Shipping every tab as equal weight. Features load when the journey needs them.

---

## 1. Do we generate a whole sitcom episode from a prompt?

### Today (honest)

| Path | What you get | Full episode? |
|------|----------------|---------------|
| **First Cut → Sitcom pilot** | Cold open + title sting + A-plot launch (short sample, free gens) | **No** — pilot *sample*, not 15 min |
| **Concept Lab → Auto Mode** | Title + logline → treatment + full **shot list** (planning free) | **Plan yes / pixels no** until generate |
| **Expand scene + Discover** | Fill empty beats; harvest cast/set | Series continuity tools |
| **Batch generate** | Frames/videos for many shots once planned | Can *render* a hybrid episode if user spends credits |

**Verdict:** We can go **prompt → structured episode *plan* (shot board)** today. We do **not** yet have one button: *“Make me a full 12–15 min sitcom episode with all motion.”* That should be **Instant Mode** (below): one prompt → AI writes bible + cast + N shots → optional auto-draft frames — with clear cost preview and Draft vs Final.

### Target product promise

> **Instant Episode:** one line (or full script) → Grok drafts a sitcom pilot *episode structure* (acts, cold open, 2 plots, tag) + cast locks + shot board.  
> **You choose:** *Plan only (free)* · *Draft stills* · *Hybrid motion package*.

---

## 2. Dual rails (the retention architecture)

Every newcomer lands on **one choice**, not twelve tabs:

```
                    ┌─────────────────────────────┐
                    │   What do you want to make?  │
                    │  Sitcom · Film · Ad · Trailer │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                                         ▼
     ┌─────────────────┐                      ┌─────────────────┐
     │  🎬 PLAN MODE    │                      │  ⚡ INSTANT MODE │
     │  “I’m the        │                      │  “Surprise me /  │
     │   director”      │                      │   just go”       │
     └────────┬────────┘                      └────────┬────────┘
              │                                         │
   World → Script → Cast →                     Minimal or full
   Continuity → Ready →                        prompt → AI episode
   Generate                                    draft → harvest locks
              │                                         │
              └────────────────────┬────────────────────┘
                                   ▼
                    SAME WORKSPACE (progressive tabs)
                    Factory · Cast · Sets · Shots · Ads · Publish
```

### Plan Mode (power + series)

1. **Lab** — world, script, style (existing Concept Lab stations).  
2. **Cast & Sets** — invent or import packs; lock.  
3. **Shot board** — beats, camera, dialogue.  
4. **Factory** — generate frames/motion with refs.  
5. **Bridge / Discover** — continuity between shots.  
6. **Ads** — insert brand spots into the cut.  
7. **Assemble → Publish**.

### Instant Mode (creative dopamine)

1. One field: *minimal prompt* or *paste full script*.  
2. Goal chips: *Pilot cold open* · *Full pilot plan* · *Episode draft (stills)* · *With motion (costly)*.  
3. AI returns: title, logline, 4–6 cast cards, 1 set, 8–20 shot beats.  
4. **Review gate:** accept / rename / delete cast · edit beats.  
5. Optional: **Generate draft frames** (Draft quality, cheaper).  
6. User can **graduate** any invent → lock → same bank as Plan Mode.

**Rule:** Instant never traps users in a black box. Always “Open in director workspace” with every asset editable.

---

## 3. Progressive workspace (fix bloat)

### Phase A — First 5 minutes (only these)

| Surface | Why |
|---------|-----|
| **Start** (Plan vs Instant) | One decision |
| **Story** (logline / script / beats) | Core creative |
| **Create** (Factory) | Make pictures/motion |
| **Play** | Dopamine |
| **?** help bubbles | Teach in place |

### Phase B — After first frame or first lock

| Surface | Unlocks when |
|---------|----------------|
| **Cast** | Frame exists *or* Instant invents people |
| **Sets** | Same |
| **Discover** | User likes an invent frame |
| **Bridge** | ≥2 frames |

### Phase C — Power / series

| Surface | Unlocks when |
|---------|----------------|
| **Ensemble / Style DNA** | User opens advanced |
| **Voice** | Dialogue on a shot |
| **Ads** | Explicit “Monetize / brand” or project type commercial |
| **Packs bank** | User locks anyone |
| **API / Batch** | Pro+ or “I’m making an episode” |

**Nav pattern:** Primary rail (Start · Story · Create · Play · Share). Secondary “Director tools” drawer for Cast / Sets / Voice / Ads / Packs — never 11 equal tabs on day one.

---

## 4. Prefill strategy (unique creativity)

| Moment | Prefill |
|--------|---------|
| **Very first project ever** (local flag `seenOdysseyPrefill`) | Elon/X *Odyssey*-class sample — memorable, on-brand for Grok |
| **Every project after** | **Rotating unique seeds** from a large bank (sitcom workplaces, sci-fi, brand films, anime cold opens) — never the same logline twice in a session |
| **Instant Mode empty state** | “One line is enough” + shuffle 🎲 for a new seed prompt |
| **Character / set name fields** | Empty or soft hint; never sticky Odyssey cast |

Implementation sketch:

```ts
// lib/creative-seeds.ts
// getPrefill(userId, projectIndex) → Odyssey once, else seeded-random unique
```

---

## 5. Help UX (question-mark bubbles)

Every non-obvious control gets a `?` that opens a **one-paragraph coach** (not a PDF):

| Control | Coach copy (example) |
|---------|----------------------|
| Draft vs Final | Draft = cheap test still. Final = higher quality when you’re sure. |
| Discover | AI invented people in this frame. Name + lock the ones you keep. |
| Bridge | Connects shot A → B with image-edit continuity — won’t invent new cast. |
| Pack download | Save this actor/set as a file. Drop into any other project later. |
| Character brain | Each locked character has a tiny “brain” that argues the scene *before* pixels. |
| Ads insert | Drop a brand beat between story shots — same cast language optional. |

Tone: fun, director-y, short. Optional “Show me” jumps to the right tab once.

---

## 6. Funnel journey (marketing → retention)

```
Feed / Landing
   → Free First Cut (path: sitcom / short / ad / trailer)
   → Shareable sample
   → Trial credits
   → First *real* project:
        Plan Mode  OR  Instant Mode
   → First lock (cast or set)  ← habit moment
   → Second project reuses pack  ← retention moment
   → Publish / channel / ads
```

**Aha moments (instrument these):**

1. First generated frame that matches their prompt.  
2. First **Discover → Lock** (they own the AI’s invention).  
3. First **reuse of a pack** on an empty shot.  
4. First **bridge** that doesn’t invent cast.  
5. First **ad insert** in their cut.

---

## 7. Additive improvements — only these (next major build)

Scoped factory features. Everything else is journey chrome around them.

### 7.1 Image & Video Creation Factory

**User story:** “I drop my own media in. The studio treats it like production assets.”

| Capability | UX surface | Notes |
|------------|------------|--------|
| Upload image/video as **reference** | Factory drop zone + per-character / per-set attach | Store to Blob; bind to packs |
| **Scan** uploaded media for characters | Same as Discover, but source = upload | Reuse `/api/generate/discover` + multi-frame sample for video |
| **Extract / remove character**, keep background | Factory tool: mask → edit | Image-edit + vision labels; v1 stills; video = keyframe + i2v later |
| **Remove background**, keep characters | Factory tool: cutout pack | Still: matte; Video: green-screen-like plate (async job) |

**Factory layout (single place, not scattered tabs):**

```
┌─ CREATE FACTORY ─────────────────────────────────────┐
│  [ Generate ] [ Upload ] [ Scan ] [ Edit tools ]       │
│  Drop zone · refs · shot picker · cost chip            │
│  Tools: Extract person | Remove person | Cutout BG     │
└──────────────────────────────────────────────────────┘
```

### 7.2 Environment & Character Placement

**User story:** “When I drop Maya into the War Room with Jordan, they *react* — not mannequins.”

Before pixel gen, inject a **placement brief**:

- Who is in the shot + relationship  
- Environment affordances (desk, door, window)  
- Blocking + eyelines + status (comedy power dynamics)

Output → merged into shot description / acting cues (text layer first; then image prompt).

### 7.3 Character Agents / Brains

**User story:** “Each character has a tiny brain that improvises the scene *before* we spend on video.”

```
Shot request
   → Agent table-read (completeText multi-turn or single multi-agent JSON)
   → Each character: goal, line, reaction to others, physical bit
   → Director agent merges → final beat JSON
   → User accepts → visual generation
```

- **Cost:** ~1 cr table-read (text), then normal frame/video.  
- **Storage:** `character.brain` = personality, speech pattern, relationships, secrets (lightweight).  
- **UX:** “Table read” button on shot or Instant Mode step 4.  
- **Not** full autonomous agents in production forever — scoped **pre-viz dialogue/blocking** so it stays fun and cheap.

### 7.4 Reusable Packs (strengthen existing)

**Already:** download `.mdpack.json`, inject into cast/set, local bank.

**Add:**

| Gap | Fix |
|-----|-----|
| Upload pack file into Factory / Cast | File picker → `parsePackJson` → inject |
| Project → project copy | “Import from another project” |
| Pack includes ref image URLs | Ensure Blob URLs survive; re-host on inject if needed |
| Pack marketplace later | Out of scope for this pass |

---

## 8. How the new features sit in the dual-rail journey

| Journey step | Plan Mode | Instant Mode |
|--------------|-----------|--------------|
| Start | Lab stations | One prompt |
| Assets | Build cast/sets | AI invents → Discover/lock |
| Factory | Upload refs, gen, extract/cutout | Same Factory after draft exists |
| Brains | Table-read before gen | Auto table-read optional checkbox |
| Placement | Tag cast + set on shot | Auto from agent merge |
| Packs | Export/import anytime | Export after harvest |
| Ads | Optional mid-timeline | Optional after draft episode |
| Empty shots 5–6 | Expand + insert packs | Same |

---

## 9. Ideal sitcom pilot path (storyboarded UX)

### Newcomer — Instant (10 min to smile)

1. **Start** → Sitcom → Instant.  
2. Prefill (Odyssey first time only) or type: *“Three failed founders share a SF loft; one secretly shipped an AI that insults investors.”*  
3. AI returns cold open + 8 shots + 3 characters + loft set.  
4. User unchecks one character, renames two.  
5. **Table read** (brains) → funny dialogue on shots 1–3.  
6. **Draft frames** for 1–3.  
7. **Discover** optional if AI still looks different from cards → lock.  
8. Expand shots 5–6 with locks; shot 4 = cutaway.  
9. Optional ad bumper between acts.  
10. Play + publish sample.

### Pro — Plan (series discipline)

1. Plan Mode → World Bible + full teleplay.  
2. Upload actor stills → Scan → lock packs.  
3. Place cast on board; table-read act 1.  
4. Factory: draft stills → bridges → motion Finals.  
5. Export packs for season 2 project.

---

## 10. Success metrics (UX, not vanity)

- Time to first frame &lt; 8 minutes (Instant).  
- % users who lock ≥1 character in first session.  
- % second project that imports a pack.  
- Support tickets: “how do I…” should drop as `?` coverage rises.  
- Feature discovery via progressive unlock, not landing-page feature soup.

---

## 11. Implementation order (for next major build)

1. **Journey chrome:** Start screen (Plan vs Instant) + progressive tab rail + `?` bubbles + unique prefills.  
2. **Instant Episode API** (text-only plan from prompt; cost 1–3 cr).  
3. **Factory shell** (upload + gen in one place).  
4. **Scan upload** (reuse Discover).  
5. **Pack import UI** polish (file drop).  
6. **Character brains table-read** (text pre-viz).  
7. **Placement intelligence** (prompt merge).  
8. **Extract / remove person** (image edit).  
9. **BG remove** (still first; video async later).

Ship 1–5 before heavy media surgery so the app feels *simple* even as Factory power grows.

---

## 12. One-line product truth

> **AI can invent the episode. You decide who gets a name, a lock, a voice, and a second scene — without reading a manual.**

That’s the journey. The Factory, brains, placement, and packs are how enthusiastic AI filmmakers stay in flow — and how series builders keep Monday’s cast looking like Monday’s cast on Friday.
