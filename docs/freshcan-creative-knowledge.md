# Fresh-CAN Creative Intelligence Knowledge Base

> **What this file is.** The creative knowledge Fresh-CAN's prompts need to turn a person's typed idea into a strong short-form video, image post or blog: one that reads as a real moment, is true to how Fresh-CAN works, and is worth posting on Instagram, Facebook or X.
> **Who reads it.** Claude Code, when rewriting or extending the prompt composers in `src/server/pipeline/prompts/` and the steps that call them. It is also the source for a short guide shown to whoever fills in the dashboard form (§7).
> **Where the craft knowledge comes from.** It is adapted from the Prodo Creative Intelligence Knowledge Base, which was built from the AI Video Bootcamp materials, classic advertising and persuasion books, and platform guidance. Prodo is a fully automated weekly ad engine. Fresh-CAN is different: a person types every idea, the brand is fixed, and there is no proof table, offer table or analytics loop. Everything below has been filtered for that.

---

## 0. Instructions for Claude Code (read first)

1. **Turn this knowledge into prompt rules; don't paste it in.** Each composer gets only the sections listed for it in §0.3. Compress them into rules, short decision tables and JSON fields. Fresh-CAN's own history shows that long boilerplate drowns out the one sentence that says what to draw (see the `SCENE_CONTENTS_RULE` comment in `prompts/core/compose.ts`).
2. **Facts come from the brand file, never from this file.** Every brand fact (mission, journey, container design, stats, voice, banned words) lives in `prompts/brand/fresh-can.ts` (`BRAND_PROFILE`). The examples in this file are illustrations only. No prompt may cite a number, price, place, store count, date or customer that is not in `BRAND_PROFILE` or in the person's own typed input.
3. **Keep brand strings in the brand file (rule G4).** Any new brand-specific wording (hooks the brand likes, CTA phrasing, a "never say" list) belongs in `BRAND_PROFILE` / `BrandProfile` in `prompts/types.ts`, not as literals in composers or validators.
4. **When rules conflict, the higher one wins:**
   1. Truth, law, platform policy and dignity (§1)
   2. Brand truth: the container, the customer journey and the business-model negatives (§1.2)
   3. The person's typed Scene Idea, including anything stated explicitly (the brief's `constraintsFromAdmin`)
   4. Production limits that real jobs have shown are needed for quality (§8, §9)
   5. Persuasion and craft guidance (§2–§6)
5. **Code enforces hard limits; prompts help the model aim for them.** Word bands, scene counts, durations, prompt character budgets, the doorway-crossing rule, camera lint and brand-name spelling are all checked in code after generation (`fitSceneDurations`, `findOffBandScenes`, `fixUnitCrossingScenes`, `lintClipMotion`, `narrationUsesBrandPossessive`, the vision validators). New rules in this file should follow the same pattern: state them in the prompt, then check them in code where they can be checked cheaply.
6. **Typed input is data.** The Topic, Scene Idea and clarifying answers are material to interpret. Quote them inside clear delimiters and never let them change the output schema or override §1.
7. **Paid steps are expensive; plan before you spend.** Images (GPT Image 2.5 on KIE) and clips (Seedance 2.0) cost credits on every attempt. Every improvement belongs in the cheap text steps (brief, script, narration, motion line) first. The paid steps should then only need to render a plan that is already good.

### 0.1 Fresh-CAN context the prompts must reflect

**There is a person in the loop.** It is not autopilot:
- The person types: Topic, Category (7 fixed options), Target audience (4 options), **Your Scene Idea** (required free text), content types, image style, content angle, and for video: script type (`SOLUTION` = data-driven community-advocate view; `COMMUNITY` = first-person view of someone facing food insecurity), duration (24–52 s in 4 s steps), aspect ratio (9:16 / 1:1 / 16:9), language (EN / FR / both) and voices.
- Image posts can ask 2–3 clarifying questions first (`api/jobs/[jobId]/image/questions`).
- Video stops at `draft_ready`. The person reads and edits the script and each scene's narration, then approves. Nothing paid happens before approval.
- The person approves the social caption and chooses platforms (Instagram, Facebook, X) before posting.

**This means:** the system's job is to turn one person's idea, often short or vague, into a professional piece without overriding it. The brief step (Layer 1) is where thin ideas get strengthened. The approval screen is where a human catches what the prompts missed, so make the draft easy to judge. Show the plan's reasoning: the hook, the story role and why the container appears.

**Pipeline map (video):**
`interpret_intent` (CreativeBrief) → `generate_script` (story, look, cast_bible, locations, scenes) → doorway-crossing check and rewrite → `fitSceneDurations` → `draft_narration` (English spoken lines) → **human approval** → container reference image → cast reference portraits (one per recurring person, up to 4) → per scene: still image (GPT Image 2.5, edited from the container reference and portraits) → vision check (gpt-4o, one retry) → motion line (gpt-6.1-sol, linted) → Seedance 2.0 clip (first-frame mode, 720p, 4–15 s, audio off) → downscale. Separately, per language: narration → ElevenLabs voice → AssemblyAI word timing → concat, mux, caption burn-in and fade on upload-post.com FFmpeg.

**Models in use:**

| Job | Model |
|---|---|
| Text (brief, plans, copy, narration) | OpenAI `gpt-6.1-sol` |
| Image and clip vision checks | `gpt-4o` |
| Clarifying questions | `gpt-4o-mini` |
| Images | GPT Image 2.5 (Sunburst, 1K) on KIE |
| Clips | Seedance 2.0 on KIE (first-frame mode, 720p, audio off) |
| Voice | ElevenLabs |
| Word timing for captions | AssemblyAI |

**Text and logos are never drawn by an image or video model.** The real logo is composited onto images by code (`lib/watermark.ts`, top-right). Video captions are burned in by code from AssemblyAI timing. The only brand text a model may draw is the container's own side wordmark, which comes from the reference image. Video currently has no music bed and no end card; see §9.

### 0.2 Shared vocabulary

| Term | Meaning at Fresh-CAN |
|---|---|
| Scene Idea | The person's typed creative idea (`content_jobs.scene_notes`). It decides what the piece is about. |
| Brief | Layer 1's `CreativeBrief`: intent, core message, audience, tone, desired response, unit relevance, improvements, the person's constraints |
| The unit / the container | The Fresh-CAN store: a standalone maroon (#6B1A1A) shipping container resting on the ground. Never a truck, never arriving, driving or parked. |
| Unit presence | Per scene or image: `none` / `background` / `featured`, always decided by the LLM with a rationale |
| Brand role | How central Fresh-CAN is to the story: background / supporting / enabler / subject / hero (the video script's planning step) |
| Desire | The one human want the piece taps (§2.1) |
| Awareness | Where the viewer is with food access and with Fresh-CAN (§2.2) |
| Framework | The story structure (§5) |
| Lever | A persuasion principle used honestly (§3) |
| Hook | The first 1–3 s: the first frame, its first motion, and the first spoken line |
| Recipe | The video's production style (§8.7) |
| Journey | Find a unit in the app → scan the app QR at the door to identify yourself → take items → walk out, with the card charged automatically |

### 0.3 Which sections feed which prompt

| Prompt (file → function) | Must include | Useful extras |
|---|---|---|
| Clarifying questions (`api/jobs/[jobId]/image/questions/route.ts`) | §1, §7.3 | §2.1 |
| Brief (`composeText.ts → composeIntentSystemPrompt`) | §1, §2 (diagnosis), §6A.1–6A.3 (insight), §7.2 (strengthening thin ideas), §13 enums | §5.1 |
| Video script (`composeVideoScriptSystemPrompt`) | §1, §2.12 checklist, §4, §5, §6.1–6.2, **§6A (all)**, §8.1, §8.2, §8.4, §13 | §3, §8.7 |
| Narration (`composeLocalizeScriptSystemPrompt`, used by `draftNarration` and `localizeScript`) | §1, §6.3, §6.4, §6A.6 | §4.4 |
| Scene image (`compose.ts → composeSceneImagePrompt`) | §1.2, §8.1, §8.5, §8.6 | §8.7 |
| Motion line (`adapters/openai.ts → CLIP_MOTION_SYSTEM_PROMPT`) and clip prompt (`composeSceneVideoPrompt`) | §8.1, §8.2, §8.4 | §8.3 |
| Image and clip validators (`adapters/openai.ts`) | §10.2 checklist | §1.2 |
| Image post plan, photo, ad copy, caption | §1, §2.1, §4.4, §6.5, §11 | §3 |
| Blog outline, reference copy, copy, hero/inline | §1, §2, §6.3, §12 | §5 |
| New: script review gate (§10.1), shown before approval | §10.1 | §2.12 |

---

## 1. Non-negotiables: truth, brand reality, law, dignity

These override everything else. A plan or asset that breaks one is wrong, however good it looks.

### 1.1 Truth
- **No invented facts.** Never invent statistics, percentages, store or customer counts, prices, savings, delivery times, launch dates, locations, awards, press, partner names, farm names or certifications. The only numbers allowed are the ones in `BRAND_PROFILE.statistics`, quoted exactly and only when they fit the topic. Otherwise, use no number.
- **No fake testimonials.** An AI-generated person must never present a review or claim as a real customer's experience ("I've saved $200 a month with Fresh-CAN"). A `COMMUNITY` script is a fictional character's story told in first person. It may show feelings and everyday moments, never verifiable claims, quotes attributed to real people, or names presented as real customers.
- **No fake scarcity or urgency.** "Today only", "limited spots", "opening Friday" and similar are never allowed. Fresh-CAN has no offers table.
- **No superiority claims.** No "best", "#1", "cheapest", "healthiest", "only". No competitors, positive or negative (this is already in `voiceGuidelines` and `businessModelNegatives`).
- **No real people, landmarks or places.** "Canada" is the only place name. No city, province, neighbourhood, recognisable skyline or provincial flag, in words or in pictures.

### 1.2 Brand reality: the container and the journey
Every visual and spoken step must match how Fresh-CAN actually works. Each rule below exists because of a real failed generation.

- **Container only.** A standalone maroon (#6B1A1A) corrugated shipping container resting directly on the ground. **Never** a truck, cab, wheels, trailer or chassis. **Never** arriving, driving, pulling up, parking, being delivered, hauled or loaded. It is simply *there*: "at the end of the street", "by the park", "near the community centre". Ideas that say "Fresh-CAN arrives" are retold as the container already standing there when the person arrives.
- **One wordmark per long side, nowhere else.** The side panels are solid, with no openings. One end face is plain. The other end face holds the only opening: a black-frame glass double door at ground level, with one small white square QR panel beside it.
- **The QR identifies the person; it is not a payment.** Customers scan their app QR to enter. There is no per-item scanning, no checkout, no cashier, no till, no queue to pay, no card machine. Payment is linked once, in the app, and charged automatically on exit.
- **Nobody is shown crossing the doorway.** Each scene is wholly outside or wholly inside. Tell enter → shop → leave as a cut: outside beside the container → inside the aisle → outside already carrying groceries. Narration also never says "enters", "steps in", "walks out" or "exits".
- **Inside:** one narrow aisle, 1–3 people, black wire shelving on one side, glass-door fridges with maroon header signs on the other, light-grey wood-look floor, bright overhead light. Baskets or bags, never trolleys.
- **The app UI is only maroon and white.** One screen, on the front of the phone.
- **Not a market, food truck, service window, freight depot or charity line.** Fresh-CAN is a paid, autonomous, self-serve store.
- **No logo shots.** No scene is "the logo appears" or "transition to the brand". The name is said in narration. The real logo is added by code on images only.

### 1.3 Dignity (food insecurity is a sensitive subject)
- Show people with agency and warmth, never as objects of pity. No empty-fridge misery, crying children, or "poverty" lighting used for shock.
- Problem moments are small and human ("no lemons for the recipe", "the store is two buses away"), not tragic.
- Fresh-CAN is a convenient neighbourhood store, never charity. Don't frame customers as recipients of help.
- Children appear only in safe, supervised, everyday situations, never alone on streets or near traffic.

### 1.4 AI disclosure and platform safety
- Every social caption already carries the fixed AI disclaimer (`lib/disclaimer.ts`). Never remove it or soften it.
- Realistic AI people are present in almost every video. Platform AI labels (Meta "AI info", TikTok if added later) should be applied at posting. This should be a posting-step flag, not a prompt rule.
- Nothing prohibited in frame: alcohol, cigarettes or vapes, weapons, dangerous stunts, people in roads.
- No fake UI such as play buttons or notifications. The only UI is the real maroon-and-white app.

### 1.5 Tactics we adopt or reject from the source material

| Tactic | Decision for Fresh-CAN |
|---|---|
| Hook in the first second, first shot moves early | **Adopt** (§4, §8.4) |
| Captions on screen for sound-off viewers | **Already done** (burned-in captions) |
| Borrow trending *formats* ("POV", "things nobody tells you") | **Adapt.** Use the structure only. Never copy another creator's content. |
| Comment bait through deliberate mistakes or staged debates | **Reject.** It spreads misinformation and fakes engagement. |
| "Not an ad / not sponsored" wording | **Reject.** A native style is fine; claiming it isn't brand content is not. |
| Shock or controversy hooks | **Reject.** They break the warm, hopeful voice. |
| "AI made this video" hooks | **Reject.** Fresh-CAN doesn't sell AI video. |

---

## 2. Strategic diagnosis: the brief's job

This is Eugene Schwartz's model (*Breakthrough Advertising*), adapted. In Fresh-CAN the person supplies the *idea*. The brief step diagnoses it and fills the gaps without replacing it. Diagnosis happens **before** any scene is written, and its result is stored on the `CreativeBrief`.

### 2.1 One desire per piece
You can't create desire, only meet one that already exists. The desires that fit Fresh-CAN:

| Desire | What it looks like at Fresh-CAN | Natural stories |
|---|---|---|
| `health` | Fresh fruit and veg within easy reach; feeding yourself and your family well | A teenager making their first salad; a grandparent's soup |
| `care` (protection of loved ones) | Being able to give your kids or parents good food | A parent packing a lunch; a neighbour bringing soup |
| `comfort` | Less friction: no bus trip, no queue, no checkout | A tired shift worker grabbing dinner at 10 pm |
| `control` | Your own time, your own choices, no waiting on anyone | A student who shops on their own schedule |
| `belonging` | A neighbourhood that has what it needs; community moments | A block party; kids and elders sharing a recipe |
| `status` (light touch) | Being the one who "knows the easy way" | A friend showing another how the app works |

- **One desire per piece.** Pick the dominant one for this idea and audience. Two desires dilute the message.
- The brief's `coreMessage` should be readable as the chosen desire meeting Fresh-CAN.

### 2.2 Awareness: where is the viewer?

| Level | Who (Fresh-CAN) | Job of the piece | Typical category |
|---|---|---|---|
| 1 Unaware | Don't think about food access at all | Entertain or move first: a human story where fresh food matters | Customer Stories, Community Impact |
| 2 Problem aware | Feel the distance or the hassle to fresh food | Name it precisely and gently, then show it doesn't have to be that way | Food Desert Education |
| 3 Solution aware | Know about delivery, markets and food banks, not Fresh-CAN | Show the different mechanism: a real store, steps away, no checkout | How FreshCAN Works, AI & Mobile Technology |
| 4 Fresh-CAN aware | Know it exists, haven't tried it | Remove the last doubt: "is it complicated?", "is it really fresh?" | How FreshCAN Works, Behind the Mobile Unit |
| 5 Customers | Already use it | Belonging, new uses, seasonal ideas, recipes | Fresh Produce & Local Farms, Community Impact |

- **The biggest mistake** is opening with the mechanism (scan, AI, sensors) to an unaware audience. Lead with people and food, and let the mechanism appear in one scene.
- Organic Instagram reach is mostly levels 1–3, so default to story-first.

### 2.3 Market sophistication
"Autonomous, cashierless grocery store in a container in your neighbourhood" is a new mechanism for most Canadians, which puts most audiences at **level 1–3**.
- Level 1–2: state the plain, specific benefit ("fresh groceries at the end of your street").
- Level 3: show the mechanism ("scan, take, walk out, no checkout").
- Never lead with identity-only "be part of the movement" claims. The market isn't tired yet, and it reads as corporate.

### 2.4 Beliefs to work with, not against
Common beliefs the audience may hold. Never open by contradicting them head-on.

| Belief | Gradualise to |
|---|---|
| "Cashierless tech is complicated / for tech people" | A grandparent or child doing it easily, shown once, without fuss |
| "Fresh food costs more" | Don't argue price (no price data). Shift to time, distance and freshness. |
| "Mobile food = food truck / market stall" | Show the self-serve aisle and fridges. Never a window or stall. |
| "Technology is cold" | Technology in the background, people and food in front (`voiceGuidelines`) |
| "Healthy eating is a lecture" | Pleasure and togetherness, never "you should" |

### 2.5–2.11 Craft moves (use the ones the idea calls for)
- **Gradualization:** start where the viewer already is ("Sunday baking", "a long shift"), get a small nod, then arrive at Fresh-CAN as the natural next step.
- **Intensification:** put the viewer inside the outcome with sensory detail: lemon zest on fingers, steam off soup, a crisp apple bite. In video it is *shown*, and narration adds the feeling.
- **Identification:** who do they become? "the grandpa who finished her recipe", "the kid who did the shopping herself". One touch per piece.
- **Redefinition (honest only):** change the comparison without numbers we don't have: "a walk to the end of the street instead of two buses".
- **Mechanization:** show how it works in one clean scene: QR scan at the door panel (outside), an item taken off the shelf (inside), walking home with the bag (outside). Never more than one "how it works" beat unless the category is How FreshCAN Works.
- **Concentration:** compare with "the old way" (the long trip, the closed shop, the queue), never with a named competitor.
- **Camouflage:** look native to Instagram Reels: real-feeling moments, people and place, not a polished corporate promo. Never claim it isn't brand content.

### 2.12 Diagnosis checklist (add to the CreativeBrief, Layer 1)
The brief step fills these in. The script step treats them as its own prior thinking.

**Before writing**
1. Audience / persona (from the form plus the idea)
2. Dominant desire (one, §2.1)
3. Awareness level (§2.2)
4. The belief we start from (one line)
5. Brand role: background / supporting / enabler / subject / hero (already planned silently in `storyPlanningClause`; promote it to a stored field)
6. Unit relevance: central / incidental / none, with a rationale

**While writing**
7. Hook (§4): the first frame and the first spoken line
8. The intensification picture (the "after" moment)
9. The one mechanism beat, if any
10. The identity touch
11. The ending image (concrete, feeling-led)

**When producing**
12. Recipe and look (§8.7)

Proposed new `CreativeBrief` fields: `desire`, `awarenessLevel`, `startingBelief`, `brandRole`, `hookIdea`, `endingImage`. All should be optional and leniently parsed, matching the existing pattern.

---

## 3. Persuasion and attention levers (honest use only)

Use 1–2 levers per piece. Several of Prodo's levers need data that Fresh-CAN doesn't have.

| Lever | Fresh-CAN use | Status |
|---|---|---|
| `liking` | Warm, relatable people; a grandparent; neighbours; humour | **Primary** |
| `unity` | "Our street", community belonging, Canadian everyday life | **Primary** |
| `intensification` | Sensory food detail; the "after" moment | **Primary** |
| `mechanism` | Showing the scan → take → walk out journey | **Primary** for How-It-Works |
| `curiosity_gap` | "Grandpa had a plan." (pays off within the video) | **Primary** for hooks |
| `reciprocity` | Teach something useful: a seasonal recipe, a storage tip (Educator) | **Good** |
| `loss_aversion` (gentle) | "No more two-bus trips for lemons", never fear | **Use lightly** |
| `social_proof` | Only with real numbers or reviews, which Fresh-CAN doesn't have yet | **Not available** |
| `authority` | Only the stats in `BRAND_PROFILE.statistics` | **Limited** |
| `scarcity`, `risk_reversal`, `anchoring` with prices | No offers or prices exist | **Not available** |

**Attention mechanics (from Prodo §3.2), for scripts:**
- **Anticipation beats reward.** Promise something specific early ("no lemons…"), make the viewer want it, then pay it off a little better than expected (the loaf *and* the old recipe card).
- **Open loop:** open a small question in the first 3 s and close it in the last scene.
- **A small new payoff every 3–6 s.** In Fresh-CAN terms, each scene adds one new thing: a place, an action, an emotion or a reveal.
- **Familiar with a twist:** a familiar life moment (baking, a lunchbox, a late shift) with one fresh element: the container steps away.

**Memorability:**
- **SUCCESs** (Heath & Heath): every video is Simple (one idea), Concrete (sensory) and Emotional (a person, not a statistic).
- **STEPPS** (Berger): aim for practical value (a recipe or tip), emotion (warmth, pride, amusement) and a story.
- **Right-brain advertising** (Orlando Wood): people with agency, a clear sense of place (generic Canadian, never named), events unfolding over time, a human voice. Avoid disembodied products and abstract graphics.

---

## 4. Hooks: the first 1–3 seconds

### 4.1 What a hook is at Fresh-CAN
A hook is two channels that must say the same thing (Fresh-CAN has no on-screen text-hook overlay yet; see §9):
1. **Visual hook:** scene 1's first frame and its first motion.
2. **Spoken hook:** scene 1's first narration line.

The burned-in caption repeats the spoken hook, so it doubles as the text hook for muted viewers. Write the first line to read well as a caption.

### 4.2 Hook types that fit the brand voice (tag `hook_type`)

| hook_type | Fresh-CAN pattern (adapt; never copy) | Best awareness |
|---|---|---|
| `story_open` | "Every Sunday, Grandpa bakes her lemon loaf. This Sunday, there were no lemons." | 1–2 |
| `small_problem` | Open on the empty fruit bowl, the closed shop sign, the bus timetable | 1–2 |
| `pov` | "POV: dinner is missing one thing and the store is at the end of your street" | 1–3 |
| `result_first` | Open on the finished dish or the happy moment, then "Here's how she got there." | 2–4 |
| `question` | "When did getting a lemon become a whole trip?" | 2 |
| `teach` | "One thing to do with the last apples of the season" (recipe/tip, then where she got them) | 1–2 |
| `callout` | "If your nearest grocery store is two buses away…" (gentle, never shaming) | 2–3 |
| `pattern_interrupt` | A maroon container standing calmly at the end of an ordinary street; a child scanning a phone with total seriousness | 1–3 |
| `number_list` | "Three things in our fridge tonight that came from the end of the street" | 3–5 |
| `confession` | "I used to skip fresh food on weeknights. Too far." (fictional character; feeling only, no claims) | 1–2 |

**Not for Fresh-CAN:** contrarian, shock or controversy, "you've been doing X wrong", bold superiority claims, social-signal claims without real numbers, "AI made this".

### 4.3 Visual hook rules (scene 1, first frame)
- **Movement in the first 0.5 s:** the subject is already mid-action (pouring, reaching, turning) or the camera is already moving (§8.4).
- **One clear subject with readable emotion:** a face or hands, readable at thumbnail size.
- **Never open on the logo, the wordmark, a title card or the container alone.** The container may appear in scene 1 only when the idea is about it, and even then with a person.
- **Scene 1 lasts 3–4 s.** The first shot should change or resolve quickly.

### 4.4 Spoken hook rules
- At most 12 words in scene 1's first line. Front-load the key image ("No lemons." before "on Sunday").
- Concrete beats abstract: "two buses for a bag of apples" beats "limited food access".
- The hook's promise must be paid off inside the video. If the body can't pay it off, change the hook.
- Third person brand voice (never "we", "our", "us"). Canadian spelling.

### 4.5 Hook procedure (inside `composeVideoScriptSystemPrompt`, silent)
1. Draft 4 hook options across at least 3 `hook_type`s, all serving the same desire.
2. Score each silently on specificity, emotion or curiosity, faithfulness to the person's idea, whether it can be paid off, and native feel.
3. Use the best one for scene 1. Store it as `story.hook` plus a new `hook_type` field so results can be compared later (§11).

---

## 5. Story frameworks (pick one per video)

The desire says *what* to say; the framework says *how*. Map each beat to scenes. Tag `framework` with the key.

| key | Steps | Fits Fresh-CAN when | Needs |
|---|---|---|---|
| `small_quest` (default) | Ordinary moment → small problem → the easy way (Fresh-CAN) → the little journey → the warm payoff | Most Customer Stories and Community ideas | Nothing beyond the brand facts |
| `pressure_cooker` (gentle) | Where it pinches (a small, real friction) → the ripple ("so dinner's pasta again") → what they tried → the new way → relief | Food Desert Education, Problem aware | Friction kept human and small |
| `time_machine` | Before (two buses, heavy bags) → the change → after (steps away, same people) | Problem aware → Solution aware | An honest before, no invented numbers |
| `demo_drop` | A problem in progress → open the app → QR at the door → take items → walk out → hold on the result | How FreshCAN Works, Fresh-CAN aware | Exactly the real journey (§1.2) |
| `educator` | Teach something useful (recipe, storage, seasonal tip) → go deeper → where the ingredient came from → hand off | Fresh Produce & Local Farms, Unaware | A real, simple tip |
| `origin_story` (fictional character) | Begin with the person → the everyday problem → the moment things changed → small wins → tomorrow | Community Impact, `COMMUNITY` script type | No real names, no claims |
| `myth_killer` (soft) | A common belief → a gentle "actually" → the mechanism shown → the difference | "Cashierless is complicated" | Only true statements about the journey |
| `countdown` | "3 things…" → each item a micro-payoff → the answer → a light CTA | Tips, seasonal produce | Real tips only |
| `cliffhanger` | Open loop ("Grandpa had a plan.") → the story → payoff | Any, as a hook style | A promise the video keeps |
| `grit` (style modifier) | Simpler, lo-fi, phone-shot feel | When the idea asks for authenticity | — |

**Classic fallbacks:** `pas` (problem → agitate → solve), `bab` (before → after → bridge), `pixar_spine` (Once upon a time… every day… one day… because of that… until finally… ever since then…).

### 5.1 Category → framework (starting points; the person's idea wins)

| Category | Frameworks |
|---|---|
| Customer Stories | small_quest, origin_story, cliffhanger |
| Community Impact | small_quest, origin_story, countdown |
| Food Desert Education | pressure_cooker (gentle), time_machine, educator |
| How FreshCAN Works | demo_drop, myth_killer (soft) |
| AI & Mobile Technology | demo_drop, myth_killer (soft); tech in the background, people in front |
| Behind the Mobile Unit | educator, demo_drop (a calm look at the aisle and fridges, no staff serving) |
| Fresh Produce & Local Farms | educator, countdown, small_quest (no invented farm names) |

### 5.2 Script type
- `SOLUTION`: an advocate or narrator voice, warm and knowledgeable. It may cite one real stat if it fits. Good with educator, time_machine and demo_drop.
- `COMMUNITY`: first person, the character's inner moment. Good with small_quest, origin_story and pressure_cooker. Never presented as a real testimonial (§1.1).

### 5.3 Brand role → how much Fresh-CAN shows (this already exists; keep it)
- **background / supporting / enabler:** one spoken name mention; the container in 0–1 scenes.
- **subject / hero:** the container can appear in several scenes and narration can speak about Fresh-CAN more directly, still as a story.
- **Always:** the name is spoken once, naturally, in the narration (`campaignFit`), never as a logo shot.

---

## 6. Story and script craft

### 6.1 Retention architecture (24–52 s, 4–8 s scenes)

| Segment | Share of runtime (36 s example) | Job |
|---|---|---|
| Hook | 0–4 s (scene 1) | Visual + spoken hook; open the loop |
| Context | 4–10 s | Who, where, why it matters; the starting belief |
| Body | 10–28 s | The framework's middle; one new payoff per scene; a re-hook around 40% ("but Grandpa had a plan") |
| Payoff | 28–33 s | Close the loop; hold the result a beat longer |
| Close | 33–36 s | A settled final image, plus a soft CTA in narration |

**Rules:**
- **One message per video.** If it needs "and also", it is two videos.
- **Show, don't tell.** Narration adds feeling and meaning; the picture carries the action. The two must never contradict (this is already in the narration prompt).
- **One action per scene.** It must fit the scene's clip (4–8 s). Split anything bigger into two scenes.
- **Vary shot size scene to scene:** wide → medium → close-up → insert. Never three close-ups in a row.
- **Length guidance:** awareness pieces work best at 24–36 s; story pieces can go to 44–52 s only if every scene earns its place. Recommend 28–36 s in the form help text.

### 6.2 Story models
- **The customer is the hero; Fresh-CAN is the guide** (StoryBrand SB7). A character has a small problem, finds an easy way, acts, and succeeds. Fresh-CAN never "saves" anyone; it is simply close and easy.
- **Pixar story spine:** good for 28–40 s narratives.
- **Right-brain storytelling:** a real-feeling character, a specific (unnamed) place, events in time, a human voice.

### 6.3 Narration rules (ElevenLabs; `composeLocalizeScriptSystemPrompt`)
- **Write for the ear:** contractions, short sentences, one idea per line, varied rhythm.
- **Pace:** about 2.65 words/s by default (measured per voice when available, `getMeasuredWordsPerSecond`). Code enforces each scene's min/max word band.
- **Front-load meaning;** end lines on strong words.
- **Concrete and sensory.** Numbers only from `BRAND_PROFILE.statistics`.
- **Never describe what is obvious on screen.** Add the inner moment, the feeling, the why.
- **Brand name:** exactly "Fresh-CAN", said once, naturally, never possessive or plural (speech-to-text mishears "Fresh-CAN's").
- **No crossing words:** never "enter", "step in", "walk out", "exit" for the container.
- **Hard facts once per video:** for example, that the QR identifies rather than pays.
- **French:** write natively, never translate idioms literally. Translate the approved English when it exists; otherwise localize from the intent.
- **The last line** ends on a concrete, feeling-led image, not a summary or slogan.

### 6.4 Call to action (soft by default)
Fresh-CAN has no offers, so CTAs stay soft and real:
- In narration, at most once, in the last scene, and only when it fits: "Find the nearest Fresh-CAN in the free app."
- The caption can carry the link line (`BRAND_PROFILE.ctaBarText`, "Visit fresh-can.com").
- Never urgency, never "sign up now", never a price.
- Awareness pieces may end on the emotional beat alone, with the CTA only in the caption.

### 6.5 Captions (post text) per platform
Captions are generated per language and then approved by the person.

| Platform | Pattern |
|---|---|
| Instagram | Hook line (about the first 125 characters show) → 2–4 short lines of story or value → soft CTA → 3–5 specific hashtags |
| Facebook | Conversational, can run longer; the first line carries the hook; 0–3 hashtags |
| X | One sharp line under 200 characters; 0–2 hashtags |

- The caption adds a layer: the why, a tip, or a question. It must not repeat the hook word for word, and must not contradict the video.
- Comment prompts are genuine questions ("What's the recipe you'd walk anywhere for?"), never bait.
- The AI disclaimer is appended by code.
- Today the caption prompt is the same for every platform. Make it platform-aware when posting moves to per-platform captions.

---

## 6A. Creative excellence: the award-level bar

Everything above makes a script *correct*. This section makes it *remarkable*. The standard: a script an award-winning commercial director would be proud to shoot, and a top brand's social media lead would fight to post. Correct but forgettable is a failure.

### 6A.1 Who the model is
The script and brief prompts write as **two people in one room**:
- **The award-winning ad director:** obsessed with one great idea, one unforgettable image, perfect pacing and a human truth that lands. Thinks in shots, not sentences. Cuts anything that doesn't earn its place.
- **The social media lead of a loved brand:** knows what stops a thumb, what people share, save and rewatch, and what reads as native on Instagram instead of as an ad. Kills anything that feels corporate.

The director makes it beautiful and true; the social lead makes it travel. Both must say yes.

### 6A.2 What separates great from ordinary

| Ordinary (reject) | Great (aim for) |
|---|---|
| Illustrates the idea literally, scene by scene | Finds the **human insight** inside the idea: the small truth everyone recognises but nobody says |
| Generic people "smiling", "enjoying fresh food" | **Specific** people with a quirk, a habit, a want ("she checks each lemon like a jeweller") |
| Mood montage of nice shots | A **story with a turn**: something changes, and the ending is earned |
| Brand dropped in the middle | Fresh-CAN is the **quiet enabler of the turn**: the story couldn't resolve as easily without it |
| Ends on a summary or slogan | Ends on a **final image** that carries the feeling (the recipe card beside the finished loaf) |
| Every scene the same energy | **Rhythm and contrast**: quiet → spark → momentum → stillness |
| Says everything out loud | **Leaves a gap** the viewer fills: subtext, a look, an object that means more than it shows |

### 6A.3 The originality toolkit (choose 1–2 per video)
- **The human insight.** State in one line the truth the video is built on ("Kids love being trusted with grown-up jobs." "Some recipes are really about a person."). Every scene serves it.
- **A hero object or recurring motif.** One object carries meaning across scenes and pays off at the end: the old recipe card, a shopping list in a child's handwriting, a lunchbox, a lemon. (This upgrades `storyPlanningClause`'s "visual motif".)
- **Contrast.** Before and after, big and small, old and young, rushed and calm, winter outside and warmth inside.
- **The reveal or twist.** Hold back one piece of information and reveal it late: who the cake is for, why grandpa smiles, what the list was for. It must be honest and paid off.
- **POV or an unexpected narrator.** Tell it from the child's eyes, or the grandparent's memory, or the shopping list's journey (kept realistic: no talking objects).
- **Humour and charm (when it fits).** A small, warm, observational laugh (the overly serious QR scan, the dog waiting at the door). Never slapstick, never at someone's expense.
- **Restraint.** Fewer words, more held moments. Let one silent beat land.
- **A cause-and-effect chain.** One small action sets off the next: no lemons → the app → the walk → the pride → the loaf → the hug.

### 6A.4 Clichés to avoid
- Slow-motion family laughing around a dinner table
- Everyone smiling at the camera in the last shot
- A "sun-drenched farmers' field" montage unrelated to the story
- Hands holding a phone with an app logo filling the screen
- Narration opening with "In a world where…", "Imagine…", "Meet…", "Introducing…"
- Closing lines like "Fresh food, for everyone." "Freshness delivered." "Because everyone deserves…"
- Sad-music poverty openings
- Stock-feeling diversity casting with no characters
- The container shot as a slow product hero with nobody in it

These are already partly covered by `bannedWords`. Add the narration openers and closers there so they are stored as brand data.

### 6A.5 The creative process (silent, inside `composeVideoScriptSystemPrompt`)
Extend `storyPlanningClause` into this sequence. It is all internal reasoning; only the JSON is returned.

1. **Insight:** write the one-line human truth behind the person's idea.
2. **Three concepts:** sketch 3 different concepts that all keep the person's idea, each with a different device from §6A.3 (for example: a straight heartfelt story, a POV/reveal version, a light-humour version).
3. **Score each 1–5** on:
   - surprise
   - emotional pull
   - shareability (would someone send it to a friend or save it?)
   - faithfulness to the person's idea
   - brand truth (§1.2)
   - producibility (one action per scene, the model can render it)
4. **Pick the boldest concept that scores at least 4 on faithfulness, brand truth and producibility.** Bold never beats true.
5. **Write the scenes.**
6. **Director's polish pass:**
   - Cut the weakest scene or merge two.
   - Sharpen the hook frame.
   - Make each scene's single action more specific.
   - Make sure the motif pays off.
   - Make the last image stronger.
7. **Social lead's check:**
   - Would this stop a scroll in the first second?
   - Is there a moment someone would screenshot?
   - Does the last 3 s make people want to watch again?
   - Does it feel like a post, not an ad?

Store the result in optional fields so the approval screen can show the thinking:
- `insight`
- `concept_chosen` (one line)
- `concepts_considered` (2 short lines)
- `device`
- `motif`

### 6A.6 Narration at the same bar (`composeLocalizeScriptSystemPrompt`)
- Write it like a short-film voiceover, not an ad read: intimate, specific, a little poetic, never flowery.
- One memorable line per video: a phrase people would quote in the comments.
- Use the inner voice: what the character thinks or remembers, not what we see.
- Let a scene be almost silent when the picture says it all; use the lowest word count in the band rather than filler.
- The brand mention sits inside the story's logic ("Grandpa opened Fresh-CAN. Two minutes away."), never as an announcement.

### 6A.7 Worked examples (illustrations only; never reuse their details)

**Idea typed:** "A dad and son buy apples."

- **Ordinary:** A dad and son walk to the container, pick apples, walk home and eat apples. Narration: "Fresh apples are just steps away with Fresh-CAN."
- **Great:**
  - *Insight:* kids remember the small rituals, not the big days.
  - *Device:* a recurring motif, a hand-drawn "apple score" chart on the fridge.
  - *Story:*
    1. Close-up of a fridge chart with tally marks and "BEST APPLE EVER?" in crayon. The son adds a question mark.
    2. Dad opens the Fresh-CAN app, and the son is already putting on his shoes.
    3. At the door end of the maroon container, the son scans the QR with ceremony.
    4. Inside, they inspect apples like judges, holding them up to the light.
    5. On the walk home, both take the first bite at the same moment and freeze.
    6. Back at the fridge, the son draws a crown on the chart.
  - *Last narration line:* "Some Saturdays, you find the best apple ever. Again."

**Idea typed:** "Show how the app works."

- **Ordinary:** A step-by-step explainer: open the app, scan, take, leave.
- **Great:**
  - *Insight:* the best proof that something is easy is someone unlikely doing it.
  - *Device:* a reveal. We assume the shopper is a tech-savvy teen, but it's her 78-year-old grandmother who shows *her* how.
  - *Payoff:* the grandmother's satisfied little nod at the end.

### 6A.8 Image post and blog at the same bar
- **Image post:** one frame with a story in it. A single moment that implies a before and an after (the child on tiptoe reaching the top shelf; a lemon held up like a trophy). Avoid "people holding groceries, smiling".
- **Infographic headline:** written like a great billboard. Short, surprising, warm ("Lemons, two minutes away."). Never generic ("Fresh Food For All").
- **Blog:** open with a scene, not a statistic. Each section has one vivid, specific moment. The title makes a promise the article keeps.

---

## 7. The person in the loop: the Scene Idea

Fresh-CAN quality starts with what is typed. This section has two parts: a guide for the person (for form help text, a tooltip or a help page), and rules for the prompts that read the idea.

### 7.1 Guide for whoever fills in the form (plain English)

**A strong Scene Idea has:**
1. **Who:** one or two people, with a relationship (grandpa and granddaughter, two roommates, a nurse after a night shift).
2. **The small problem or moment:** something missing, a craving, a habit, a celebration.
3. **Where Fresh-CAN fits:** the container nearby, the app, one item picked from the shelf. It's optional for pure food or recipe stories.
4. **The ending:** the feeling or image you want people to remember.
5. **Anything that must or mustn't happen:** "no scanning", "show the fridges", "set in winter".

**Avoid:**
- Naming a city, town, neighbourhood or province. Canada only.
- "The Fresh-CAN truck arrives / pulls up / parks." It is a container that is already there.
- Prices, savings, store counts, opening dates.
- Showing someone walking in or out of the door. Say "she shops inside" and "she heads home with her bag".
- "Show the logo at the end." The logo is added automatically to images; the name is said in the voiceover.
- Several stories in one idea. One idea per video.

**Weak → strong:**

| Weak | Strong |
|---|---|
| "Fresh-CAN helps food deserts." | "A night-shift nurse gets home at 7 am craving something fresh. The container by the bus stop is open; she picks berries and yoghurt and has breakfast on her balcony as the sun comes up." |
| "Show how the app works." | "A teenager does her family's grocery run for the first time: finds the nearest unit in the app, scans in proudly, picks what's on Mom's list, and texts a photo of the full bag." |
| "Truck arrives in Toronto with groceries." | "On a quiet street, kids from the block are planning a lemonade stand. The maroon Fresh-CAN container at the corner has the lemons; by the afternoon the whole street is lined up for a cup." |

**Recommended settings:** 28–36 s, 9:16, script type COMMUNITY for personal stories and SOLUTION for explainers.

### 7.2 Rules for the brief step (strengthen, never replace)
- Read the idea charitably. Everything stated explicitly is binding (`constraintsFromAdmin`).
- If the idea is thin, add: a named relationship, a specific small problem, a concrete sensory detail, a hook moment and an ending image, all serving the same idea.
- **Silently rewrite brand-incorrect phrasing into the brand-correct version**, and record the change in `improvements`: "the truck arrives" becomes "the container standing at the end of the street"; "walks into the store" becomes a cut from outside to inside; a named city becomes "a Canadian neighbourhood"; "the logo appears" becomes a spoken name mention.
- If the idea contradicts §1 in substance (a price promise, a real person, a competitor), keep its emotional intent and drop the violating part. Note it in `improvements` so the person sees it on the approval screen.
- Never add a second storyline, a statistic the idea didn't ask for, or mission messaging.

### 7.3 Rules for clarifying questions (image post today, video later)
- Ask only about gaps that change the picture: who is in it, the moment or action, the setting (outside by the container / inside the aisle / at home), and the time of day or season.
- 2–3 questions, each with 3–5 tap-able options of a few words.
- Options must already be brand-correct: no "truck arriving", no cities, no checkout.
- Carry each answer forward **with its question** ("Who is in it? — a grandfather and granddaughter"), not as a bare comma-joined list.

---

## 8. Visual craft: realism, physics and directing AI video

The goal is footage a viewer believes was filmed: natural physics, logical cause and effect, continuity, real light, and a correct container.

### 8.1 Realism and physics laws (every scene and clip prompt)
1. **Gravity and weight.** Bags pull on arms; lemons roll and settle; nothing floats. Everyone and everything stays on the ground.
2. **Momentum.** People shift weight before moving; doors (at home) swing and stop. The container door stays closed.
3. **Cause → effect.** Every motion has a visible cause: a hand moves the lemon, wind moves the hair. Produce and goods at rest stay still.
4. **Contact and occlusion.** Fingers wrap what they hold; feet touch the ground; objects never pass through each other. Every visible hand belongs to a visible person.
5. **Real-time speed.** Write "real time, normal speed, no slow motion" unless slow motion is deliberate.
6. **One light logic per video.** The plan's `look` sets the key light direction, the time of day and the colour temperature, and they hold across every scene.
7. **Anatomy.** Five fingers, real skin texture, natural teeth and eyes. Prefer medium shots for detailed hand actions; avoid extreme close-ups of hands doing complex tasks.
8. **Continuity.** The same people, faces, wardrobe, props, time of day and weather across scenes (`cast_bible`, cast portraits, `look`).
9. **Scale.** The container is long and low, about twice as long as it is tall, never a cube. People are human-sized next to it. Kitchens and streets look lived-in.
10. **No in-scene text.** Packaging, labels and bags have blank fronts. No signs with words. The only brand text is the container's own side wordmark from the reference.
11. **People don't talk on camera.** Narration is a separate voiceover track, so on-screen people keep their mouths closed or neutral: silent action and reaction only.
12. **The camera is physical.** It sits on something: a tripod, slider, dolly, gimbal, handheld operator or crane. Name the rig whenever the camera moves.
13. **Imperfection reads as real.** Natural focus, real light flares, mild lived-in clutter. Avoid "8K, flawless, hyper-detailed, ultra-smooth".
14. **No collages.** One single continuous photograph and one continuous take per scene.

### 8.2 Scene planning: what the script must produce for each scene
Write camera-first so the image and video models lock the spatial plan. In the existing schema, `shot_notes` holds the CAMERA block and `visual_description` holds SUBJECT through LIGHT.

```
CAMERA (shot_notes):
  Movement: [named move + rig, e.g. "slow dolly in on rails" | "static on tripod"]
  Start:    [locked for a beat, then eases in | already moving on frame one]
  Speed:    [ease-in | constant | build then decelerate | creeping]
  Framing:  [what stays stable: subject centred, horizon level, height constant]
  End:      [final frame + hold | exit still in motion (not on the final scene)]
  Time:     real time, normal speed, no slow motion
SUBJECT:     [who, using cast_bible ids; what they wear is locked]
ACTION:      [ONE clear physical action with its cause, sized to the clip length]
ENVIRONMENT: [outside by the container | inside the aisle | home | street/park; lived-in details; season]
LIGHT:       [key light direction + quality + colour temperature, consistent with `look`]
UNIT:        [none | background | featured, plus which face is visible: long side (wordmark) | door end (closed door + QR panel) | plain end]
CONSTRAINTS: no text, no talking, door closed, nobody in the doorway, natural physics
```

- **One move and one action per clip.** Combine at most two moves, only when they serve one destination.
- **The still must support the move.** No "tracking over the shoulder" without a character; no "push past the shelf" without a shelf in the foreground. The script plans the frame and the move together.
- **Clip length vs action:** a 4–6 s clip covers one beat. Never cram several events into one clip.
- **Seedance 2.0 modes:** production uses first-frame mode (the approved still is frame 1). This is the right mode for container and people fidelity. First+last-frame mode suits before/after or reveal scenes; multi-reference suits recurring people. Both are worth testing later and cannot be combined with first-frame in one call.
- **Phrase rules positively.** "Fingers wrapped around the lemon" beats "no weird hands". Keep the constraints line short.

### 8.3 The motion line (written from the approved still)
The motion writer (`CLIP_MOTION_SYSTEM_PROMPT`) sees the still and writes the clip prompt. It should:
- Start with the camera block (§8.2) for this scene: the named move, its start, speed and end, or "static on tripod".
- Describe one or two small, real actions of people or things already visible, paced to the clip length, with their direction kept exactly as planned.
- Add ambient motion only when the frame implies it (a breeze, steam, light).
- Never introduce new people or objects, reflections, doorway crossings or vehicles.
- Stay under ~260–400 characters, with no labels or quotes.

### 8.4 Camera moves by intent (adopted from Prodo, as the owner decided)
This **replaces the current "every shot locked-off and static" rule.** Real jobs showed that long moving shots made the video model repeat and morph the background (job a64ab879: a lamppost replayed every 4–5 s). The safe way to adopt movement:
- Choose the move by what the moment means.
- Keep moves **short and slow**, with a clear start and end frame.
- Keep a moving subject in the foreground.
- Prefer moves where the background shifts little (push-ins, slow zoom, slider parallax) over long lateral travel.

| Intent in the script | Move | AI note / safer version |
|---|---|---|
| Neutral, let the moment speak; clean cut point | **Static / locked** | Write "no camera movement, hold the same framing", or the model adds drift. Still the default for the container hero frame. |
| Realisation, decision, "this matters" (the empty fruit bowl, the idea lands) | **Motivated slow push-in (dolly in)** | Start locked and begin the move on a trigger ("as she notices…"); define start and end; keep it short |
| Scale, community, "she's not alone" | **Pull-out reveal (dolly or crane out)** | Describe exactly what the wide frame reveals; one major new layer; never reveal the container driving in |
| The container as a calm, confident presence | **Low-to-high stabilised reveal** or **slow arc (quarter turn)** | One low anchor (pavement, planter); end on the long side with the wordmark large and square-on |
| Produce on a shelf, kitchen counter details | **Slider with foreground parallax** | A real object in the foreground; slow and short |
| An emotional close-up (grandpa's smile) | **Slow zoom (camera fixed)** | "Camera stays fixed, optical zoom only": the safest move for faces |
| Native, documentary, phone feel | **Handheld (gentle)** | Describe the operator; corrections have causes; never constant shake |
| Walking home with the bag | **Reverse tracking (walking toward the camera)** or **side tracking** | Most stable for faces; short; keep the background simple; never through the container door |
| Entering the aisle (as a cut, not a crossing) | **Push past foreground** (a shelf edge inside the aisle) | Starts already inside; the foreground clears the frame fully |
| Process, recipe, flat-lay | **Top-down (bird's eye)** | Clear geometry; great for food |
| Energy between scenes | **Whip pan** | Toward a target; at most one per video; hides a cut |

**Avoid** (high failure on Seedance, and backgrounds morph):
- full 360° orbits of faces
- long tracking or follow shots over 4 s
- fly-throughs of doorways or through the container door
- drone over streets with readable signs
- crash zooms
- bullet time
- FPV moves

**Code that must change to adopt this** (see Appendix A):
- the `shot_notes` instruction and the "short film" paragraph in `composeVideoScriptSystemPrompt`
- `lockSceneCamera` in `generateScript.ts`
- the camera rejection pattern in `lib/clipMotion.ts`
- "keep the camera out of it" in `CLIP_MOTION_SYSTEM_PROMPT`
- the "Locked-off, static camera" text in both branches of `composeSceneVideoPrompt`
- `NO_REPEATING_BACKGROUND_CLAUSE`: keep it, and pair it with "short, slow move"

Roll this out behind a flag (for example `CAMERA_MOVES=on`) and compare against a static run of the same idea (the `scripts/prompt-ab` harness), because it reverses a fix that came from real failures.

### 8.5 Lens and shot language
- **24–35 mm:** street and establishing shots, the container in context, phone-native feel.
- **50 mm:** natural human perspective, medium shots.
- **65–85 mm:** faces, food details.
- **100 mm macro:** produce texture (lemon zest, apple skin).
- **Shot sizes:** wide (context), medium (action), close-up (emotion or food), insert (hands and the app QR).
- **Container framing:** when the container appears it fills at least a third of the frame width, with the wordmark side well lit and square-on enough to read. "Any angle" is allowed only when the visible faces follow the structure rules.

### 8.6 Image design rules (scene stills, image posts, blog images)
- **One message,** read in 3 seconds.
- **Faces with real emotion** beat empty scenes.
- **Food always clean, fresh and appetising** (`FOOD_MUST_LOOK_CLEAN`).
- **Keep the top-right ~40% clean** for the composited logo (`watermarkSafeZoneBlock`).
- **The aspect ratio is stated as one photograph** ("one single vertical 9:16 photograph"), never stacked panels.
- **Infographic style:** headline ≤ 6 words, subtitle 2–5 words, Manrope-like font, charcoal CTA bar. Code-rendered text would be safer than model-drawn text if it becomes possible later.

### 8.7 Recipes (video styles; tag `recipe`, choose in the script)

| Recipe | When | Style line (feeds `look.style_direction`) |
|---|---|---|
| `narrated_story` (default) | Customer stories, community | Documentary realism, natural light, lived-in places, 35–50 mm, gentle motivated moves |
| `how_it_works` | How FreshCAN Works, AI & Tech | Clean, bright, real surfaces; one beat per journey step; inserts of the phone and shelves; slider and push-in |
| `recipe_moment` | Produce & Farms, educator | Warm kitchen light, top-down and macro food inserts, hands and textures, cosy |
| `community_moment` | Community Impact | Wider shots, several people, golden-hour exterior, pull-out reveals |
| `cinematic_mood` | Seasonal pieces | Place-led, slower shots, natural colour grade; use sparingly |

---

## 9. Assembly and edit (what code does, and what to add)

**Today:** each scene's clip is trimmed to its narration slot; clips are concatenated; the voiceover is muxed; captions are burned in from AssemblyAI word timing; the end fades out. There is no music, no SFX and no end card.

**Principles for later improvements (code-side, not prompt-side):**
- **Timing follows the voiceover.** Each clip runs at least as long as its narration plus 0.3 s; trim, never freeze-pad.
- **Hold the payoff:** the last scene gets about 0.5–1 s of breathing room (`FINAL_SCENE_SETTLE_CLAUSE` plus the fade).
- **Cuts:** mostly hard cuts; at most one signature transition per video.
- **Sound (future):** a light music bed that follows the story (sparse hook → building body → warm resolve), ducked about −12 to −18 dB under the voice. Normalise to about −14 LUFS, true peak ≤ −1 dBTP. Gentle SFX only: a phone chime on the QR scan, room tone, street ambience.
- **Captions:** 1–2 lines, ≤ 6 words per line, inside the 9:16 safe zone (out of roughly the top 14%, the bottom 35% and about 6% on each side). Highlighting key words in brand maroon is optional.
- **Brand early (code-rendered):** consider a small maroon brand bug in the first 3–5 s and a code-rendered end card (logo + "Find the nearest Fresh-CAN in the free app"). It must be rendered from the real asset, never drawn by the model.
- **Variants (optional):** the cheapest test is a hook swap: same body, a different scene 1. Only worth adding if someone will compare results.

---

## 10. Quality gates

### 10.1 Gate 1: script review (new, text-only, before the person approves)
An LLM review of the generated plan, shown on the approval screen as a score plus fixes. It costs pennies and saves paid generations. Score each dimension 0–10:

| Dimension | Weight | What a 10 looks like |
|---|---|---|
| Faithful to the person's idea | 15% | The idea is fully recognisable and its stated constraints survived |
| Creative excellence (§6A) | 20% | A clear human insight, a device or motif that pays off, no clichés, a memorable final image, something worth sharing |
| Hook strength | 15% | Specific; visual and spoken agree; pays off later |
| Single clear message and story | 10% | One desire, a clear arc with a turn, a satisfying ending |
| Brand truth | 20% | Container only; QR identifies; no crossing; no cashier; correct interior and app |
| Producibility | 10% | One action per scene; the still supports the camera move; plausible physics; container large enough when present |
| Voice, dignity and brand presence | 10% | Warm, third person, Canadian, no pity, no lecture; name spoken once, naturally |

**Auto-fail** (flag strongly whatever the score):
- an invented fact, number, price or place
- a truck, arrival or parking
- a doorway crossing
- a cashier or checkout
- a logo shot
- a fake testimonial
- a city name
- people talking on camera
- in-scene text requested
- a child unsafe or alone
- a hook not paid off

Give one sentence of what's wrong and one concrete fix per issue. Never block approval; the person decides.

### 10.2 Gate 2: asset checks (already exist; extend from this checklist)
**Scene image validator** (`buildImageValidationSystemPrompt`):
- [ ] One single photograph (no collage)
- [ ] Every person intended by the scene, with face visible when called for; no extra people
- [ ] Hands belong to visible people, with natural anatomy; no missing or extra limbs
- [ ] Container: no truck or wheels; correct long, low shape; no opening on the sides or plain end; one wordmark per side
- [ ] No legible third-party brands
- [ ] Mouths closed or neutral (no talking)

**Clip validator** (report only):
- [ ] No new or duplicated people
- [ ] No doorway crossing or door opening
- [ ] No new objects
- [ ] No container morphing or garbled wordmark
- [ ] Background not repeating or morphing (new; matters once camera moves are on)
- [ ] Real-time speed

Keep the existing cost rule: one validation retry, then accept. Validators judge only defects a typical viewer would clearly notice.

---

## 11. Image post and blog (lighter guidance)

### 11.1 Image post
- **The plan** (`composeImagePlanSystemPrompt`) diagnoses desire and awareness (§2) in one line each, then plans one moment: subject, composition, unit presence, setting.
- **Pass the plan's `subject`, `composition` and `designIntent` into `composePhotoPrompt`.** Today only presence, setting, food and cast are used, so the plan's composition never reaches the image.
- **Photo style:** one emotional moment with a face; food appetising; the container as a calm presence when featured; top-right kept clean for the logo.
- **Infographic style:** headline (≤ 6 words) that states the benefit or the hook; subtitle 2–5 words; never a price or number that isn't in the brand file.
- **Caption:** §6.5. The first line is the hook; it adds the why; soft CTA; 3–5 hashtags.

### 11.2 Blog
- **Outline:** framework `educator` by default (teach something useful, then where Fresh-CAN fits). 3–5 sections, each with one concrete detail.
- **Copy:** customer as hero; sensory detail; one stat at most, only from the brand file; no city names; one soft CTA ("find the nearest unit in the free app").
- **Images:** the hero carries the article's core message as a human moment; the inline image carries one section's specific visual moment. Unit presence should become per image (currently one value for both).

---

## 12. Platform playbook (Fresh-CAN posts to Instagram, Facebook, X)

| Platform | Native style | Length | Aspect | Notes |
|---|---|---|---|---|
| Instagram Reels | Real-feeling moments, a little polished, sound-on mostly | 24–36 s ideal | 9:16 | Hook in the first second; captions on screen; 3–5 hashtags; cover frame = the strongest face or food frame |
| Instagram feed | Single image or carousel (future) | — | 4:5 (images currently 3:4 by default) | One message; save-worthy tips do well |
| Facebook | Conversational, broader ages, often sound-off | 24–52 s | 9:16 / 1:1 | Story and community; captions essential |
| X | Short, text-first | ≤ 45 s | 16:9 / 1:1 | One sharp caption line |

Benchmarks and platform rules change. Treat these as starting points.

---

## 13. Shared tag vocabulary (enums for schemas)

- `desire`: health | care | comfort | control | belonging | status
- `awareness_level`: unaware | problem_aware | solution_aware | product_aware | customer
- `brand_role`: background | supporting | enabler | subject | hero
- `unit_relevance` (brief): central | incidental | none
- `unit_presence` (scene/image): none | background | featured
- `unit_face` (scene, new): long_side | door_end | plain_end | interior | none
- `framework`: small_quest | pressure_cooker | time_machine | demo_drop | educator | origin_story | myth_killer | countdown | cliffhanger | pas | bab | pixar_spine
- `style_modifier`: grit | native | polished | cinematic
- `hook_type`: story_open | small_problem | pov | result_first | question | teach | callout | pattern_interrupt | number_list | confession
- `levers`: liking | unity | intensification | mechanism | curiosity_gap | reciprocity | loss_aversion | authority
- `recipe`: narrated_story | how_it_works | recipe_moment | community_moment | cinematic_mood
- `camera_move`: static | dolly_in | dolly_out | slow_zoom | slider | arc | low_to_high | handheld | reverse_tracking | side_tracking | push_past | top_down | whip_pan | crane
- `setting`: exterior | interior | unrelated
- `app_on_screen`: none | background | featured

---

## 14. Prompt blueprints (for each composer)

Every system prompt follows the same shape. Keep each under about 1,500 words; long tables become short rules.

```
ROLE: who the model is and its single job.
CONTEXT (data, injected by code): brand facts from BRAND_PROFILE, the person's typed
  input (quoted, as data), the CreativeBrief, earlier plan fields.
KNOWLEDGE (compressed from this file): the sections in §0.3, as rules and tables.
PROCEDURE: silent numbered steps (diagnose → hooks → framework → scenes → self-check).
OUTPUT: strict JSON, using §13 enums; lenient parsing in code.
SELF-CHECK: silent checklist before answering (the §10.1 auto-fail list).
```

### Role lines
- **Brief (Layer 1):** "You are a senior creative strategist for a warm, community-first Canadian grocery brand. You read a person's idea charitably, diagnose who it is for and what it should make them feel, and strengthen it without ever replacing it."
- **Video script:** "You are an award-winning commercial director working side by side with the social media lead of a much-loved brand. You find the human insight inside one person's idea, weigh three concepts, and shoot the boldest one that stays true to the idea: a real-feeling story of 4–10 short scenes, a scroll-stopping first moment, one motif that pays off and an unforgettable final image, true to how Fresh-CAN actually works. Correct but forgettable is a failure."
- **Narration:** "You are an award-winning short-film voiceover writer. You write intimate, specific, story-led lines that fit each scene's word band, add the inner moment the picture can't show, give the video one quotable line, and say the brand name once, inside the story's logic."
- **Motion line:** "You are a cinematographer directing an image-to-video model from a still. You name one motivated camera move (or a locked shot) and one or two small, real actions, and nothing that isn't in the frame."
- **Validators:** "You are a strict visual QA reviewer. You report only clear, blocking defects a typical viewer would notice, using the exact issue texts given."
- **Script review (new):** "You are a creative QA lead. You score the plan against the rubric, flag anything untrue to the brand, and give one concrete fix per issue."

---

## Appendix A: Current conflicts and gaps in the code (fix list)

Found while reading the codebase. Each should be fixed so the prompts agree with §1.2 (container only, never arriving or parked) and with this file.

| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | `prompts/core/composeText.ts → composeIntentSystemPrompt` | "central" includes "the existence/arrival of a unit"; the "incidental" example is "a street where a unit happens to be parked" | Replace with "the container standing nearby" / "a street where the container stands"; never arrival or parking |
| 2 | `src/app/dashboard/new/page.tsx` placeholders | Topic: "Food Deserts in Calgary" (city); Scene Idea: "…then Fresh-CAN arrives with cold groceries…" (arrival) | Use brand-correct examples from §7.1 |
| 3 | `composeVideoScriptSystemPrompt` (`shot_notes`, short-film paragraph), `generateScript.ts → lockSceneCamera`, `lib/clipMotion.ts` camera pattern, `adapters/openai.ts → CLIP_MOTION_SYSTEM_PROMPT`, `compose.ts → composeSceneVideoPrompt` | Every shot is forced static | Adopt §8.4 behind a flag; A/B against static |
| 4 | `brand/fresh-can.ts → unit.interior` vs `referenceImages.interior[].whatItShows` | Text says "with no door in view"; both interior photos show "the white door at the far end" | Make text and photo descriptions agree (and check the door colour against the exterior "black-frame glass") |
| 5 | `brand/fresh-can.ts → positiveVisualTruths` | Says "on the rear face, beside the rear door"; the brand now says "the door end face" | Align wording ("door end") |
| 6 | `composeText.ts → composeIntentSystemPrompt` "central" definition | "entering, shopping in" invites crossing language | Use "shopping at" / "visiting" |
| 7 | `inngest/functions/image.ts → photoScene()` | Clarifying answers are comma-joined without their questions | Pair each answer with its question (§7.3) |
| 8 | `inngest/functions/image.ts` → `composePhotoPrompt` | The plan's `subject`, `composition` and `designIntent` never reach the photo prompt | Pass them through (§11.1) |
| 9 | `inngest/functions/image.ts` (`plan-image-for-photo`) | Second `planImage` call omits `creativeBrief`; if the first call failed, the re-plan runs without it | Pass the brief both times |
| 10 | `inngest/functions/image.ts → angleBriefFor` | `content_angle` from the form is never used | Either map the angle into the brief or remove the field from the form |
| 11 | `composeText.ts → creativeBriefContext` vs `cast_bible` schema example | The default cast rule (white Canadians unless specified) sits beside the example "deep brown skin, West African heritage", which the model may copy | Use a neutral example format ("<skin tone in absolute terms>, <apparent heritage>") |
| 12 | `api/jobs/[jobId]/image/questions/route.ts`, `steps/video/generateSceneVisual.ts → buildCorrectionInstruction`, validator prompts in `adapters/openai.ts` | "Fresh-CAN" / "Fresh CAN" typed as literals (breaks rule G4) | Read from `BRAND_PROFILE.name` / `unit.wordmarkText` |
| 13 | Questions route | Uses only `missionStatement`; options can suggest wrong scenes (truck, checkout) | Add `businessModelNegatives` and §7.3 rules |
| 14 | `prompts/core/limits.ts` comments | Still describe nano-banana-2 / Seedance 1.5; production uses GPT Image 2.5 and Seedance 2.0 (prompt limit 20,000) | Update the comments; revisit the 2,450 clip budget once motion lines are standard |
| 15 | `composeVideoScriptSystemPrompt` unit rules vs `compose.ts` view clause | "Square-on, fills a third of the frame" vs "any angle" | Unify: any angle, but the wordmark side large and readable when the unit is featured |
| 16 | `inngest/functions/blog.ts → mapUnitRelevanceToPresence` | Hero and inline share one brief-level unit presence | Decide per image from the reference copy |
| 17 | `composeCopySystemPrompt` | The blog copy never sees the CreativeBrief | Pass it, like the outline |
| 18 | `composeCaptionSystemPrompt` | One caption pattern for all platforms | Make it platform-aware when posting allows it (§6.5) |
| 19 | `composeVideoScriptSystemPrompt` user prompt | Sends Topic/Category even though "the idea alone decides"; a topic with a city name leaks in | Send the topic as secondary context only; strip place names |
| 20 | Script and brief schemas | No stored `desire`, `awareness_level`, `framework`, `hook_type`, `recipe`, `camera_move`, `unit_face` | Add as optional fields (§2.12, §13) so the approval screen and future learning can use them |
| 21 | No script review step | The person approves without any quality signal | Add Gate 1 (§10.1), shown on the approval screen |
| 22 | Video assembly | No music, no early brand cue, no end card | §9 (code-side, real assets only) |
| 23 | `composeText.ts → storyPlanningClause`, `finalSelfCheckClause` | Planning stops at "correct": no insight, no concept comparison, no polish pass, no cliché check | Replace with §6A.5's 7-step process; add §6A.4 openers and closers to `bannedWords`; store `insight`/`concept_chosen`/`device`/`motif` as optional fields |

---

## Appendix B: Sources

- The Prodo Creative Intelligence Knowledge Base (its §1–§14), adapted. Its sources are the AI Video Bootcamp materials (Advertising Psychology Playbook, Ad Strategy Guide 2026, Ad Scriptwriting Frameworks 2026, Hook Library, TikTok Secrets, TikTok Engagement Hacks, Camera Movement Catalogue, High-Impact Camera Moves, Kling Camera Toolkit).
- Eugene Schwartz, *Breakthrough Advertising*: desire, awareness, sophistication, gradualization, intensification, identification, mechanization.
- Robert Cialdini, *Influence* and *Pre-Suasion*: liking, unity, reciprocity.
- Chip & Dan Heath, *Made to Stick*; Jonah Berger, *Contagious*.
- Donald Miller, *Building a StoryBrand*: the customer is the hero, the brand is the guide.
- Orlando Wood, *Lemon* and *Look Out*: right-brain advertising.
- Byron Sharp, *How Brands Grow*; Jenni Romaniuk, *Building Distinctive Brand Assets*.
- Blain Brown, *Cinematography: Theory and Practice*; Walter Murch, *In the Blink of an Eye*.
- Fresh-CAN's own codebase history: the job IDs and incidents cited in `prompts/core/compose.ts`, `composeText.ts`, `docs/PROMPT_ARCHITECTURE.md` and `docs/DEBUG_JOB_d289e3af.md`.

> **Accuracy notes.** Platform rules, safe zones and benchmarks change; verify before relying on them. Statistics inside the AVB materials were not independently verified and must never appear in Fresh-CAN content. The only numbers Fresh-CAN content may use are in `BRAND_PROFILE.statistics`.
