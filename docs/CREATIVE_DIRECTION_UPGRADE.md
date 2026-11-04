# Creative Direction Upgrade — Video Pipeline

> **Purpose:** hand this file to Claude Code to fix why every Fresh-CAN video comes out as the same small customer moment, and to make the video pipeline (brief → script → stills → clips → narration) write and shoot like a senior creative director at an agency.
> **Status:** diagnosis + implementation plan. No code changed yet.
> **Read first:** `CLAUDE.md`, `docs/PROMPT_ARCHITECTURE.md`, `docs/freshcan-creative-knowledge.md` (§5, §6A, Appendix A).

---

## 1. The problem in one paragraph

Whatever idea the creator types, the video comes back as **one person, one small errand, one convenience gag**: someone needs an item → finds a Fresh-CAN unit → shops → small smile, with a punchy "you"-voice ad over the top. Ideas about **community impact** don't come through: an older couple who no longer spend half a day travelling for groceries and now have that time for their grandchildren; a campus or office where one unit makes life simpler for students, professors and staff; a remote, cold northern community where fresh vegetables and fruit are hard to find. Those ideas get shrunk into the same small-quest template.

**Is it hardcoded?** No scenes are hardcoded. But the prompt stack has **defaults, banned lists and production limits that all push toward the same shape**, and nothing in the system knows how to think about communities, the emotional value of time saved, or bigger story structures. The effect is the same as hardcoding.

---

## 2. What is stopping creativity (with file references)

### 2.1 The story engine assumes one lead character and a small problem

| Where | What it says | Effect |
|---|---|---|
| `prompts/core/composeText.ts:486` `STORY_CRAFT_CLAUSE` (e) | "Give the **lead character** one want and one small worry" | Every story needs a single protagonist. There's no ensemble, community or place-led story. |
| same, line 495 | Tweak the idea with "a funny misunderstanding, a reversal, **sharper small stakes**" | Pushes toward cute gags. Real stakes like time, isolation or access get treated as too big. |
| same, line 512 | Framework list, "**small_quest unless** the idea fits another better" | `small_quest` = *ordinary moment → small problem → Fresh-CAN → little journey → warm payoff*. That's the exact template you're seeing. |
| `steps/video/generateScript.ts:171` `STORY_FRAMEWORKS` | 12 frameworks, all single-character or problem/solution (`pas`, `bab`, `small_quest`, `demo_drop`…) | There's no framework for a community portrait, a place transformation, vignettes of many lives around one unit, a ripple effect or a manifesto. |
| `composeText.ts:689` `storyPlanningClause` | Silent 6-step plan: hook, arc, device, brand role, motif | It never asks *who the community is*, *what barrier they face*, or *what the time and energy saved turns into*. |

### 2.2 The default voice is a formula ad

| Where | What it says | Effect |
|---|---|---|
| `composeText.ts:505` (b3) | "Choose the narration voice. **Default to 'promo'**… When unsure, choose 'promo'." | Most videos get the promo voice. |
| `composeText.ts:1140` PROMO VOICE | Relatable truth about "you" → **Fresh-CAN as the hero line** → "no queue, no wait" run → callback close | This is a fixed copy template, so every promo video sounds the same. |
| `composeText.ts:1192` | "Never a joke… **never about hardship**"; PLAIN WORDS: no literary imagery | Rules out the heartfelt and anthem registers a real agency would use for community stories. |
| `brand/fresh-can.ts:46-101` `narrationTells`, `narrationAbstractNouns`, banned closers | Bans "close to home", "more room for", "togetherness", "just in time", "making memories", and abstract nouns like *connection, belonging, joy* in the close | These are the exact words of the grandparents and community ideas. The narration code (`lib/narrationStyle.ts`) and the review (`composeNarrationReviewSystemPrompt`) then flag them as defects. |
| `composeText.ts:1028` + `localizeScript` word bands | Narration fills ~3.1 words/s in every scene; low end allowed in at most 2 scenes | Voiceover runs wall to wall with no silent beats. Pro ads let pictures and music breathe. |

### 2.3 Mission and community impact are actively suppressed when the creator types an idea

| Where | What it says | Effect |
|---|---|---|
| `composeText.ts:791` | When `sceneNotes` exists, the **full mission statement is replaced with `neutralIdentityLine`**, which drops the food-desert and community language | The model never sees *why* Fresh-CAN exists. |
| `composeText.ts:798` | The `sceneNotes` path drops `statsLine` (the real stats are never offered) | "1 in 5 Canadians lives in a food desert" and "54% of First Nations people on reserve…" are never available for impact stories. |
| `composeText.ts:950` | "never drift into generic brand, mission, or **food-desert messaging** unless the idea genuinely calls for it" | Added to fix an old hijack bug, but it now also mutes impact ideas. |
| `composeText.ts:154` `composeIntentSystemPrompt` | unitRelevance **"none"** for "awareness or **community/emotional pieces**" | A "Fresh-CAN transforms a campus" idea gets classified as unit = none, so the unit is barely shown. |
| `CreativeBrief` (`prompts/types.ts`) | Fields: intent, coreMessage, audience, tone, desiredResponse, unitRelevance… | No `communityLens`, `accessBarrier`, `benefitLadder` or `impactAngle`, so Layer 1 can't carry the meaning forward. |

### 2.4 Form inputs that should steer creativity are ignored

| Input | What happens today |
|---|---|
| **Script Type** (`SOLUTION` / `COMMUNITY`) | `composeText.ts:803` only says `Script type: ${opts.scriptType}`. The model is **never told what these mean**; the definitions live only in the UI hint text. |
| **Category** (e.g. "Community Impact") | `brandContext(_category)` deliberately ignores it, and the `sceneNotes` path only passes it in the user prompt. It shapes nothing. |
| **Target audience** (4 fixed options) | Passed as one line. There's no community picker (seniors, campus, workplace, remote north…). |

### 2.5 Production limits shrink stories to one or two people

| Where | Limit | Effect on community stories |
|---|---|---|
| `inngest/functions/video.ts:312` | Cast bible capped at **4** portraits | A campus story with students, a professor and a staff member gets cut down. |
| `prompts/core/compose.ts:812` `MAX_CAST_REFERENCES = 3` per scene | — | Group scenes lose consistency. |
| `brand/fresh-can.ts:152` | Interior "realistic occupancy (typically 1-3 people)" | Fine as truth, but nothing tells the planner that *community* can be shown outside, around the unit, or across vignettes. |
| `cast_bible` schema | Assumes recurring named people | Vignette-style "many lives" videos (a new person each scene) aren't supported as a mode. |
| `generateSceneVisual.ts` `COLLAGE_ISSUE` | Split-screen or multi-panel images are rejected | No before/after split frames. They have to be done as cuts, and the planner isn't told how. |
| Assembly (`avMerger.ts`) | No music bed, no supers or title cards, no end card | Manifesto and anthem ads rely on music + supers + the logo end card. Today everything has to come from voiceover. |
| `composeText.ts:31` `creativeBriefContext` | Default cast = **white Canadians** unless the idea specifies | Works against remote northern / First Nations and diverse campus or office stories unless the creator spells it out. **(Needs your decision — see §6.)** |

### 2.6 One giant LLM call does concept + script + shot list + 20 production fields

`generateScript.ts:757` → `composeVideoScriptSystemPrompt` asks one call to: interpret the idea, invent 3 concepts silently, pick one, write the hook/arc/motif, **and** fill the JSON for every scene (unit_presence, setting, framing, cast, visual_state, durations, doorway rules, camera rules…). The prompt is mostly negatives and production rules. **When a model is doing schema compliance and creative thinking in the same pass, compliance wins**, and you get the safest, smallest story. The "3 concepts" exist only in hidden reasoning, so they're never shown to you and you can't pick between them.

### 2.7 Freshness memory doesn't rotate the world

`summarizeRecentStory` / `summarizeRecentSettings` (`generateScript.ts:631-689`) remember hook type, framework, motif, light and places, but **not which community, story mode or benefit** a video used. So the system varies the camera and the opening line, but keeps telling the same "single urban shopper" story.

---

## 3. Target: how a creative director would work

For every idea, the pipeline should reason through:

1. **Community lens:** *who* the people are (seniors ageing in place, a campus, an office park, a remote cold-climate town, a shift-worker hospital block, an apartment tower, newcomers…).
2. **Access barrier:** the honest, specific friction (two buses and a heavy bag, -35° and a 3-hour drive, a 12-hour shift that ends after stores close, a campus with no grocery in walking distance).
3. **Benefit ladder:** feature (cashierless unit nearby) → functional benefit (minutes, not hours) → **emotional benefit (what the saved time and energy becomes)** → community impact (the neighbourhood changes).
4. **Human insight:** the one true line ("Time is the grocery nobody can buy more of.").
5. **Story mode + device:** chosen to fit the meaning, not by default.
6. **Three genuinely different concepts**, scored and **shown to the creator** with the reasoning.
7. Only then: script → shot plan → production fields.

---

## 4. Implementation plan (for Claude Code)

Keep everything that protects brand truth (no truck or arrival, no doorway crossing, no cashier, the container design, wordmark rules, no invented facts, dignity rules). Those are correct. The changes **add creative range** and **move production constraints after the creative thinking**.

### Phase A — Layer 0: brand data for communities (no behaviour change yet)

**File:** `src/server/pipeline/prompts/types.ts`, `prompts/brand/fresh-can.ts`

Add to `BrandProfile`:

```ts
communityLenses: {
  id: string                 // 'seniors_ageing_in_place' | 'campus' | 'workplace' | 'remote_north' | 'shift_workers' | 'apartment_towers' | 'newcomers' | 'rural_town' | 'busy_families' ...
  who: string                // plain description of the people
  accessBarrier: string      // honest friction, no invented numbers
  whatTimeBecomes: string    // the emotional payoff the saved time/energy turns into
  visualCues: string         // generic, never a named place (e.g. "snowbanks, low winter sun, a community centre")
  dignityNotes: string       // e.g. never pity, never poverty imagery, never "saviour" framing
  statLabel?: string         // which BRAND_PROFILE.statistics entry may apply, if any
}[]
storyModes: { id: string; description: string; bestFor: string[] }[]
benefitLadder: { feature: string; functional: string; emotional: string; community: string }
```

These are **reference material, not scripts**. The model picks or blends lenses and can invent a new one that fits the idea. Add a unit test like `noOldReferences.test.ts` that asserts no lens names a city or province.

### Phase B — Layer 1: richer brief

**Files:** `composeText.ts → composeIntentSystemPrompt`, `steps/shared/interpretIntent.ts → normalizeCreativeBrief`, `types.ts → CreativeBrief`

- Add optional fields: `communityLens`, `accessBarrier`, `benefitLadder {functional, emotional, community}`, `impactAngle` (`'personal' | 'family' | 'community' | 'place_transformation' | 'brand_manifesto' | 'how_it_works'`), `humanInsight`.
- Fix the unitRelevance rule at line 154: community and impact pieces are **"incidental" or "central"**, not "none". "None" stays for recipes, nutrition tips and domestic-only scenes. (This also covers knowledge-base Appendix A #1 and #6.)
- Show the brief the community lenses from Phase A as options, not orders.
- Keep it lenient: every new field is optional, and old jobs keep working.

### Phase C — New step: `generate_creative_direction` (the "creative director" pass)

**New file:** `src/server/pipeline/steps/video/generateCreativeDirection.ts` plus a composer `composeCreativeDirectionSystemPrompt` in `composeText.ts`. Wire it into `src/inngest/functions/video.ts` between `interpret_intent` and `generate_script`, using the `pipeline_steps` ledger the same way `interpretIntent.ts` does (`hasSucceededStep` / `recordStepAttempt`, failing open).

- **Input:** scene idea, brief, category, audience, script type (with its *meaning* spelled out), brand truth (mission **including** the community and food-access purpose, journey, negatives), community lenses, story modes, real statistics, recent lenses and modes.
- **Prompt stance:** "You are the executive creative director of a top Canadian agency and the social lead of a loved brand." Few negatives here: only brand truth and dignity. **No production fields, no JSON for scenes.**
- **Output (strict JSON):**

```json
{
  "concepts": [
    {
      "title": "string",
      "story_mode": "single_hero | ensemble | community_portrait | place_transformation | many_lives_one_unit | ripple_effect | letter | day_in_the_life_of_the_unit | contrast_cut | manifesto | how_it_works | humour",
      "community_lens": "string",
      "human_insight": "string",
      "benefit_ladder": { "functional": "string", "emotional": "string", "community": "string" },
      "logline": "string (2 sentences)",
      "beat_outline": ["string", "..."],
      "voice": "story | promo | anthem | documentary",
      "why_it_works": "string (the reasoning a CD would give a client)",
      "scores": { "surprise": 1, "meaning": 1, "shareability": 1, "faithfulness": 1, "brand_truth": 1, "producibility": 1 }
    }
  ],
  "recommended": 0
}
```

- Three concepts must differ in **story mode or community lens**, not just tone.
- Save it on `content_drafts.draft_data.creative_direction`.
- Use a higher temperature or reasoning effort for this call only, if the OpenAI adapter supports it (`adapters/openai.ts` currently fixes the model; add an optional per-call override).

### Phase D — Show and choose concepts on the approval screen

**Files:** video tab under `src/app/dashboard/jobs/[job_id]/`, plus a new route `POST /api/jobs/[jobId]/video/concept` (add it to `API_DOCS.md`).

- Show the 3 concepts as cards (title, logline, insight, mode, lens, why it works, scores). The recommended one is preselected.
- "Use this concept" re-runs `generate_script` from that concept (cheap, text only, before any paid step).
- Optional "Auto" setting: skip the choice and use `recommended`.

### Phase E — Script planner writes *from* the chosen concept

**File:** `composeText.ts → composeVideoScriptSystemPrompt`, `STORY_CRAFT_CLAUSE`, `storyPlanningClause`, `campaignFit`; `generateScript.ts`

- New input `opts.creativeDirection` (the chosen concept). When present:
  - Replace "sketch three takes…" with "**Execute this concept faithfully**: story mode, lens, insight, benefit ladder, beat outline."
  - Remove "small_quest unless…" and "Default to promo". Use the concept's `story_mode` and `voice`.
  - Replace "lead character one want and one small worry" with mode-aware wording: *single_hero* keeps want and worry; *ensemble / many_lives* give each person one specific detail; *place_transformation* makes the **place** the character (before → cut → after); *manifesto* is led by voice, supers and images.
  - Bring the **mission line back** (not `neutralIdentityLine`) and the **stats line** when `impact_angle` is community, place_transformation or brand_manifesto.
  - Make the "never drift into food-desert messaging" sentence (line 950) apply only when `impact_angle` is personal or how_it_works.
- Extend `STORY_FRAMEWORKS` / `normalizeStory` with the new modes, and store `story_mode`, `community_lens` and `impact_angle` on `story`.
- **Define script type in the prompt:** SOLUTION = advocate or narrator voice that may cite one real stat; COMMUNITY = told from inside one community member's life (never presented as a real testimonial). Or replace the field (see §6, Q4).

### Phase F — Narration supports more than one register

**Files:** `composeLocalizeScriptSystemPrompt`, `storySpineBlock`, `composeNarrationReviewSystemPrompt`, `lib/narrationStyle.ts`, `brand/fresh-can.ts`

- Add voices **`anthem`** (manifesto: short, rhythmic lines about people and places, brand said once near the end) and **`documentary`** (calm third person, observed, specific).
- Make the banned lists **voice-aware**: keep the true clichés ("making memories", "treat yourself", "vibe", "next level") banned for every voice, but allow a small set for `story` / `anthem` (e.g. "close to home", "more time for", one abstract noun in the final line when it's earned). Move this into brand data as `narrationTellsByVoice`.
- Allow **silent or near-silent beats**: let the planner mark scenes `narration: 'none' | 'light' | 'full'`, and have localize respect it (keep the total duration correct by adjusting `fitSceneDurations` / word bands). Allow up to ~30% of the runtime to be silent in anthem and story modes.
- Narration review: score `meaning` and `community specificity` alongside catchiness, and stop marking down heartfelt lines in story and anthem modes.

### Phase G — Visual pipeline supports community-scale stories

**Files:** `inngest/functions/video.ts:312`, `compose.ts` (`MAX_CAST_REFERENCES`, `castClause`, `composeSceneImagePrompt`), `generateCastRefs.ts`, `generateScript.ts` schema text

- Raise the cast cap to ~6 (cost check: one portrait each) and keep `MAX_CAST_REFERENCES` per scene at 3. Add a **`featured` vs `extra`** role in `cast_bible`: extras get no portrait and are described generically, so crowds stay plausible without identity drift.
- **Vignette mode:** when `story_mode` is `many_lives_one_unit` or `community_portrait`, each scene may have its own subject with no recurring cast. The schema already allows an empty cast; the prompt has to say it's fine.
- **Place transformation:** teach the planner the legal way to show "before → after" without showing the unit arriving: scene A is the empty corner (unit_presence none), then a cut, then scene B is the same corner from the same angle with the unit standing there and people around it. Reuse the `locations` continuity fields for the same-angle match.
- **Wide establishing shots** of a community (campus quad, snowy main road, office plaza) with the unit large enough for the wordmark rule. This is already allowed; the planner just needs an example.
- `look.style_direction` per mode (documentary, warm cinematic, winter cold-to-warm grade…), as the knowledge base §8.7 "recipes" already describe.

### Phase H — Assembly: the tools an ad agency uses (code-side, real assets only)

**Files:** `adapters/avMerger.ts`, `steps/video/renderLanguageTrack.ts`

- **Music bed** from a small licensed library in Supabase storage, picked by mood (`look` or `voice`), ducked under the voiceover.
- **Supers / title cards:** short text lines (≤6 words) burned in by FFmpeg like captions, never drawn by the image model. Used for manifesto lines ("Less driving. More Sundays.").
- **End card:** the real logo asset + `ctaBarText`, composited by code (like `watermark.ts`).

### Phase I — Freshness and quality gate

- Add `community_lens`, `story_mode` and `impact_angle` to `summarizeRecentStory`, and ask the creative-direction step to rotate them unless the idea pins them.
- Add a **concept review** (text-only, like `narrationReview.ts`): it scores insight, meaning, distinctiveness vs recent videos, faithfulness and brand truth, and shows on the approval screen. It never blocks anything.

---

## 5. Acceptance tests (use these exact ideas)

For each idea, run `generate_creative_direction` + `generate_script` with the fake adapters/e2e harness (`videoPipeline.e2e.test.ts`) and check the plan by hand:

| Idea typed | Must see |
|---|---|
| "An older couple used to travel far for groceries; with Fresh-CAN they get time with their grandchildren." | Lens = seniors; emotional benefit = time with grandchildren; at least one concept in `ripple_effect` or `contrast_cut` mode (the old long trip vs the time now spent with family); the final image is the family moment, not the shop; no pity framing. |
| "A Fresh-CAN unit on a college campus / office area makes groceries simple for students, professors and staff." | Mode is `many_lives_one_unit` or `community_portrait`; 3+ different people across vignettes; the unit is a recurring anchor; the reasoning names *why* a campus or office (time between classes or meetings). |
| "Cold, frozen remote area — hard to find fresh vegetables or fruit; Fresh-CAN makes life simpler." | Lens = remote_north; a real stat offered if it fits; a cold-to-warm visual arc; a `place_transformation` or `documentary` concept; dignity respected; no named town. |
| "A mom buys apples on Saturday." (control) | Still allowed to be a small single-hero story. The upgrade **adds range** without forcing every idea into "community". |

Also check: three concepts differ in mode or lens; the brand is named once; no truck, arrival, doorway crossing, cashier, city name or invented number; and all existing tests in `composeText`, `compose`, `narration*` and `generateScript` still pass (update the snapshot or assertion tests where wording changed on purpose).

---

## 6. Open decisions for the owner (answer before Phase B/E)

1. **Truth about deployments:** are there real units on campuses, at offices, or in remote northern communities? If not, how should a video frame it: as a vision ("this is what a unit could do"), or only as general benefit without claiming a location? ("Imagine…" openers are currently banned.)
2. **Default cast ethnicity rule** (`composeText.ts:31`): keep "white Canadians unless specified", or change it to "cast to fit the community lens, realistic for Canada" (important for northern / First Nations and campus stories)?
3. **Unit arrival / before-after:** is a cut from an empty corner to the same corner with the unit standing there acceptable? (It doesn't show driving, hauling or arriving.)
4. **Script Type field:** keep SOLUTION / COMMUNITY, or replace it with a **Creative mode** select (Auto · Customer story · Community impact · Place transformation · Brand anthem · How it works · Humour) plus an optional **Community** select?
5. **Music and supers:** OK to add a licensed music library and code-burned title cards and an end card?
6. **Concept choice:** should the creator always pick from the 3 concepts, or should "Auto" be the default with the option to switch?
7. **Statistics:** OK to let impact-mode videos say one of the real stats aloud (e.g. "one in five Canadians lives in a food desert")?

---

## 7. Order of work

1. Phase A + B (data + brief): small, safe, no UI.
2. Phase C + E (creative direction step + planner reads it): the biggest quality jump.
3. Phase F (narration voices, silent beats).
4. Phase D (concept cards on the approval screen).
5. Phase G (cast and vignette support).
6. Phase H (music, supers, end card).
7. Phase I (freshness rotation, concept review).

Follow CLAUDE.md session rules: update `PROGRESS.md` / `TASKS.md`, add new endpoints to `API_DOCS.md`, keep brand strings in `BRAND_PROFILE` (rule G4), run `npx tsc --noEmit` and the test suite after each phase.
