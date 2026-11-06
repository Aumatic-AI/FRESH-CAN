// Text-generation prompt assembly — same pattern as core/compose.ts's image
// prompts: fixed brand facts (mission, voice, real stats, category briefs)
// live in the brand file and get spliced into every prompt, rather than
// each step file writing brand-blind, topic-only prompts from scratch.
import type { BrandProfile, CreativeBrief, ImageStyle, NarrationSpine } from '../types'
import { NARRATION_WORDS_PER_SECOND } from '../../../../lib/videoNarrationBudget'
import { cameraMovesEnabled } from '../../lib/cameraMoves'

/**
 * Renders a CreativeBrief (Layer 1, PROMPT_REFACTOR_BRIEF.md §4.2) as
 * grounding context for a Layer 2 planning prompt. Framed explicitly as
 * something to BUILD FROM, never a second, competing instruction set — same
 * "constraint/grounding, never the point" pattern every scene-idea clause in
 * this file already uses (see composeOutlineSystemPrompt's/
 * composeVideoScriptSystemPrompt's own sceneNotes handling).
 */
function creativeBriefContext(brief: CreativeBrief): string {
  const constraints = brief.constraintsFromAdmin
    ? ` The admin also specified this non-negotiable constraint, which must be preserved exactly: ${brief.constraintsFromAdmin}`
    : ''
  const improvements = brief.improvements ? ` ${brief.improvements}` : ''
  return (
    `An earlier interpretation pass already read the admin's idea and produced this brief — treat it as your ` +
    `own prior thinking, not a second opinion to reconcile: intent is "${brief.intent}"; the core message is ` +
    `"${brief.coreMessage}"; audience "${brief.audience}"; tone "${brief.emotionalTone}"; the viewer should ` +
    `"${brief.desiredResponse}".${improvements}${constraints} That same pass also estimated the brand's ` +
    `physical unit is "${brief.unitRelevance.value}" to this idea (${brief.unitRelevance.rationale}) — treat ` +
    'this as a starting point to confirm or refine with the full context below, never as a directive that ' +
    'overrides your own judgment once you have it. ' +
    "Unless the admin's idea explicitly specifies who appears (ethnicity, community or a named group), " +
    'any people shown — recurring cast, featured subjects or incidental figures — are white Canadians ' +
    '(apparent European heritage). If the idea does specify, follow it exactly and ignore this default.'
  )
}

function bannedWordsLine(brand: BrandProfile): string {
  return brand.bannedWords.length > 0 ? ` Avoid these overused phrases: ${brand.bannedWords.join(', ')}.` : ''
}

/** The brand's stock phrases that make narration sound machine-written. */
function narrationTellsLine(brand: BrandProfile, promo = true): string {
  const allowed = promo ? [] : brand.narrationTellsAllowedInStory ?? []
  const tells = (brand.narrationTells ?? []).filter((t) => !allowed.includes(t))
  return tells.length > 0 ? ` Never use these stock phrases or close variants of them: ${tells.join('; ')}.` : ''
}

function statsLine(brand: BrandProfile): string {
  return brand.statistics.length > 0
    ? ` You may cite ONE of these real, verified facts if it is genuinely relevant to this specific topic — ` +
        `never force one in, never alter the number: ${brand.statistics.join(' | ')}.`
    : ''
}

// category is accepted for call-site compatibility (every brandContext
// caller already has it in scope) but deliberately does not shape the
// prompt — per-category canned creative direction was removed
// (PROMPT_REFACTOR_BRIEF.md §6.2); category may remain light job metadata
// but must never dictate subject, setting, composition, or style.
function brandContext(brand: BrandProfile, _category: string): string {
  const journey = brand.journey.length > 0 ? ` How a visit really works: ${brand.journey.join(' ')}` : ''
  return `${brand.missionStatement}${journey} Voice: ${brand.voiceGuidelines}${bannedWordsLine(brand)}\n\n`
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  video: 'a short-form vertical video',
  image_post: 'a single social media image post',
  blog: 'a blog article',
}

/**
 * Prompt-only rule (no post-hoc check or retry — a guard here would mean
 * regenerating paid scenes): every scene is wholly inside or wholly outside
 * the unit; the crossing itself is never depicted. Shared with compose.ts's
 * scene image/video prompts.
 */
export const NO_ENTRY_EXIT_RULE =
  'Tell any enter-shop-leave journey as a cut: one scene ends with the customer outside beside the unit, the ' +
  'next scene opens inside it, and the following scene opens outside with the customer already carrying their ' +
  'groceries. Every scene is wholly inside or wholly outside, and the crossing itself (a door opening or ' +
  'closing, stepping through, climbing in or out) happens between scenes. This holds even when the scene idea ' +
  'words a beat as "walks out" or "rushes inside": keep that beat\'s meaning and tell it as the cut.'

/**
 * The spoken-word half of NO_ENTRY_EXIT_RULE. The visuals never show anyone
 * crossing the unit's threshold, so narration must not describe it either —
 * real job 790b8771's scene-4 narration said "the student enters the unit
 * with a quick scan ... and walks out" over a clip that (by design) showed
 * neither, so the voiceover contradicted the picture. Narration may say
 * someone arrives, shops, or leaves WITH something; it never narrates the
 * crossing itself.
 */
export const NO_ENTRY_EXIT_NARRATION_RULE =
  'Narration must never describe anyone entering, exiting, stepping into or out of, climbing into or out of, ' +
  'or walking through the door of the unit or container — the picture never shows that crossing, so the words ' +
  'must not either. Say that a person arrives at the unit, is shopping, or heads home with their groceries; ' +
  'never that they "enter", "step in", "walk out", "come out of" or "exit" it.'

/**
 * Track C (2026-10-08) planning rules for what a scene's visual_description may
 * show, each tied to a failure seen in real renders: (1) a listed cast member
 * must actually be on screen — real job 5d2dd9a2's scene 3 listed a mother and
 * child but rendered one disembodied arm, and scene 2 swapped the family for
 * strangers; (2) when the unit appears it must be readable — a tiny or distant
 * unit is where the wordmark garbled (job 790b8771); (3) packaging text — video
 * models cannot hold small lettering, so labels and bags are told to carry
 * none (jobs e4a83ec0, 5d2dd9a2).
 */
// People are caught doing things, not posing. Added after a real video where
// most stills had the couple standing still and facing the lens.
export const ACTIVE_PEOPLE_PLANNER_RULE =
  'Every person is caught IN THE MIDDLE of a purposeful action tied to this scene — hands busy with the task ' +
  '(reading a list, opening the app, choosing produce, carrying a bag, plating food, setting a table, ' +
  'pouring, stirring, walking on) and their attention on what they are doing or on each other, in a natural, ' +
  'candid moment. Nobody stands still facing the camera, and at most one scene of the whole video may have a ' +
  'person looking straight into the lens, only if that beat truly calls for it. Show the action part-way through ' +
  '(before it is finished), and give neighbouring scenes different actions rather than repeating one gesture'

export const SCENE_VISUAL_FIDELITY_RULE =
  'Every person in a scene\'s cast_present must be clearly visible on screen in that scene\'s ' +
  'visual_description — never swap them for unnamed extras, and never reduce them to hands or a first-person ' +
  'view. When the unit appears, keep it large and well lit enough for its wordmark to read cleanly whenever a ' +
  'long side is visible, or leave it out of that scene; never a tiny, distant, or partly hidden unit. Do not ' +
  'choose the container\'s camera angle: it is set separately for every scene. Avoid ' +
  'close-ups of product labels and bags — wherever packaging appears it carries no readable text.'

/**
 * Layer 1 (PROMPT_REFACTOR_BRIEF.md §4.2/§5.1) — turns the admin's raw idea
 * into a structured creative brief, the single input every subsequent
 * planning step (blog outline, video script, image plan) will read from.
 * Grounded in the brand's real business-model facts (journey/negatives) so
 * `unitRelevance` and `improvements` are decided against what Fresh-CAN
 * actually is, not a guess — but never lets those facts become a second,
 * competing topic (same "constraint, never the point" framing every other
 * prompt in this file already uses for scene ideas).
 */
export function composeIntentSystemPrompt(brand: BrandProfile, contentType: string): string {
  const contentTypeLabel = CONTENT_TYPE_LABEL[contentType] ?? 'a piece of content'
  const journeyLine = brand.journey.length > 0 ? ` The real customer journey: ${brand.journey.join(' ')}` : ''
  const negativesLine =
    brand.businessModelNegatives.length > 0 ? ` ${brand.businessModelNegatives.join(' ')}` : ''

  return (
    `${brand.missionStatement}${journeyLine}${negativesLine} ${NO_ENTRY_EXIT_RULE}\n\n` +
    'You are interpreting an admin\'s raw idea for ' +
    `${contentTypeLabel} before any script, outline, or image plan gets written. Read the idea charitably ` +
    'and specifically — assume it is a genuine, considered starting point, not a vague prompt to pad out. ' +
    'Identify what the admin is actually trying to accomplish. If the idea is thin, strengthen it with ' +
    'concrete, specific detail that serves the SAME idea — elevate it, never replace it or substitute a ' +
    "different angle; anything the admin stated explicitly is binding and must survive into your output " +
    'unchanged. Decide how relevant the brand\'s physical unit (the mobile grocery store) is to this specific ' +
    'idea: "central" if the idea is fundamentally about visiting, entering, shopping in, finding, or the ' +
    'existence/arrival of a unit, or is a direct how-it-works/customer-journey explainer; "incidental" if the ' +
    'unit could plausibly belong in the setting and reinforce context without being the subject (e.g. a ' +
    'community moment on a street where a unit happens to be parked, or a story about what a unit does for a ' +
    'community, a campus, a workplace or a remote place, where it anchors the place rather than driving the plot) — never ' +
    'forced in; "none" for pure food/ ' +
    'nutrition education, recipes, produce/farm stories, and any interior domestic setting (a kitchen, dining room, living room). ' +
    'Never invent a fact, statistic, price, launch date, store count, or place name beyond "Canada" that is ' +
    'not already in the brand facts above or the admin\'s own input.\n\n' +
    'Respond with strictly valid JSON matching this exact shape (all fields required, use "" for a genuinely ' +
    'empty string field):\n' +
    '{\n' +
    '  "intent": string (what the admin is actually trying to do — marketing, promotion, awareness, food/' +
    'nutrition education, a community story, a product/how-it-works explainer, or another goal that fits ' +
    'better — inferred from the idea itself, never picked from a fixed list),\n' +
    '  "coreMessage": string (the single idea the viewer must leave with),\n' +
    '  "audience": string,\n' +
    '  "emotionalTone": string,\n' +
    '  "desiredResponse": string (what the viewer should think, feel, or do after seeing this),\n' +
    '  "unitRelevance": { "value": "central" | "incidental" | "none", "rationale": string (one sentence, ' +
    'honest and specific to this idea, never boilerplate) },\n' +
    '  "improvements": string (where the idea was thin, what you added to strengthen it — "" if it was ' +
    'already specific and complete),\n' +
    '  "constraintsFromAdmin": string (only what the admin\'s own idea states as non-negotiable, such as a required ' +
    'line, closing line, person, place or thing to avoid, quoted from the idea; NEVER the Topic, Category or Audience ' +
    'lines, and never a copy of the whole idea — "" if none)\n' +
    '}'
  )
}

export interface CreativeTwistSystemPromptOptions {
  /** 'image_post' needs one concept; 'blog' also needs a second, different-axis one for the inline image. */
  contentType: 'image_post' | 'blog'
  /** Short descriptions of recently generated images' concepts (newest first). */
  recent: string[]
  /** Deterministic suggestion from the rotation, a starting axis, not a mandate. */
  suggestedAxis: string
}

/**
 * Creative twist pass: turns a thin or literal idea into a distinct visual
 * concept before the image plan/prompt is composed. Fights the "smiling
 * shopper holding a basket of produce" default the brand facts pull every
 * image toward.
 */
export function composeCreativeTwistSystemPrompt(
  brand: BrandProfile,
  opts: CreativeTwistSystemPromptOptions,
  creativeBrief: CreativeBrief,
): string {
  const negativesLine =
    brand.businessModelNegatives.length > 0 || brand.forbiddenInScene.length > 0
      ? ` ${[...brand.businessModelNegatives, ...brand.forbiddenInScene].join(' ')}`
      : ''
  const recentLine =
    opts.recent.length > 0
      ? `\n\nRecently generated images already used these concepts, do NOT repeat or closely echo them: ` +
        `${opts.recent.map((r, i) => `(${i + 1}) ${r}`).join(' ')}`
      : ''
  const secondary =
    opts.contentType === 'blog'
      ? '"secondaryVisual": string (a second concept for the article\'s inline image, on a DIFFERENT axis from "visual" and showing a different moment, same core message)'
      : '"secondaryVisual": "" (always empty for this content type)'

  return (
    `${brand.missionStatement}${negativesLine} ${NO_ENTRY_EXIT_RULE}\n\n` +
    'You are the creative director choosing the visual concept for an image before it is planned or rendered. ' +
    `${creativeBriefContext(creativeBrief)}\n\n` +
    'The brand facts above are correctness constraints, never the visual. Left alone, image generation drifts ' +
    'to the same default: smiling people holding baskets of fresh produce, shoppers offering food to camera, ' +
    'a crowd at a unit, a flat-lay of vegetables. AVOID those defaults unless the admin\'s idea explicitly asks ' +
    'for them.\n\n' +
    'Give the idea a creative twist: a fresh, specific, non-obvious way to show the SAME idea. The twist changes ' +
    'the visual treatment only, never the message. Anything the admin stated explicitly stays binding and must ' +
    'survive unchanged. If the admin\'s idea is already highly specific and original, keep it and refine rather ' +
    'than replace it.\n\n' +
    'Choose ONE axis to make it different: hands-only or detail close-up; object still-life or a single telling ' +
    'object; environment or place with no people; a single person in a story moment (not holding a basket); ' +
    'aerial, macro or unusual vantage; a visual metaphor; a distinct time of day, season or weather; a ' +
    'different SETTING (an outdoor market, a roadside, a school, a workplace, a community hall, a farm or ' +
    'harvest field, a rural or remote community; not another home kitchen or living room); a ' +
    `distinct colour story. Suggested starting axis (override if another fits the idea better): ${opts.suggestedAxis}. ` +
    'People are optional, only include them if they improve the idea. Be concrete: name the subject, the ' +
    'vantage and what makes it surprising. Photographable only, no text on image, no invented facts. ' +
    'Vary the WHERE as well as the framing: unless the idea is explicitly about the home, do not default to a ' +
    'family at a kitchen table. Also vary the props and foods: do not reuse the same items (apples, carrots, ' +
    'cucumber, berries, sandwiches) that recent concepts already used.' +
    recentLine +
    '\n\nRespond with strictly valid JSON matching this exact shape:\n' +
    '{\n' +
    '  "axis": string (the axis you chose, 2-4 words),\n' +
    '  "visual": string (the concept, one or two concrete sentences),\n' +
    `  ${secondary}\n` +
    '}'
  )
}

export interface ImagePlanSystemPromptOptions {
  imageStyle: ImageStyle
  /** The dashboard's "Your Scene Idea" plus any clarifying-question answers
   *  — the same assembled scene text composePhotoPrompt is built around
   *  (see image.ts's photoScene()). This is the creative brief the plan is
   *  built around, never a light influence. */
  scene: string
  /** creativeTwist.ts concept: the plan's subject/composition/cast realise this. */
  twist?: string
}

/**
 * Layer 2 (PROMPT_REFACTOR_BRIEF.md §4.3) — image_post's plan. image_post
 * had no planning step of its own before Phase 3 (only 'infographic'-style
 * jobs got any planning pass at all, via generate_ad_copy's headline/
 * subtitle). Runs for both 'photo' and 'infographic' styles. Grounded in
 * the brand's business-model negatives (Phase 1) so the plan itself never
 * proposes a composition that Layer 3 would have to reject — e.g. this is
 * where "not a cashier or checkout counter" gets applied to what the model
 * PLANS, not just what it later avoids drawing.
 */
export function composeImagePlanSystemPrompt(
  brand: BrandProfile,
  opts: ImagePlanSystemPromptOptions,
  creativeBrief?: CreativeBrief,
): string {
  const negativesLine =
    brand.businessModelNegatives.length > 0 || brand.forbiddenInScene.length > 0
      ? ` ${[...brand.businessModelNegatives, ...brand.forbiddenInScene].join(' ')}`
      : ''
  const textPlanInstruction =
    opts.imageStyle === 'infographic'
      ? '"textPlan" is required for this job (image_style: "infographic") — a short headline (max 6 words) ' +
        'and subtitle (2-5 words) that will be rendered directly onto the image, grounded in the scene above.'
      : '"textPlan" MUST be null for this job (image_style: "photo") — this style never renders on-image text.'

  return (
    `${brand.missionStatement}${negativesLine} ${NO_ENTRY_EXIT_RULE}\n\n` +
    'You are planning a single social media image post before it gets rendered. This is the creative brief ' +
    `the plan is built around: "${opts.scene}". Brand facts above are fixed constraints on correctness if ` +
    'they appear — never the reason this image exists, and never a directive on style, mood, or composition, ' +
    "which stay entirely up to the scene above." +
    (creativeBrief ? `\n\n${creativeBriefContext(creativeBrief)}` : '') +
    (opts.twist
      ? `\n\nA creative-direction pass already chose this visual concept; the subject, composition and cast ` +
        `must realise it (it serves the same idea, never replaces the admin's stated constraints): ${opts.twist}`
      : '') +
    '\n\nDecide honestly whether the brand\'s physical unit (the mobile grocery store) belongs in this frame: ' +
    '"featured" only if the scene above is genuinely about the unit itself (visiting, entering, shopping in, ' +
    'or the unit\'s own arrival/existence); "background" if it could plausibly and unobtrusively belong in the ' +
    'setting without being the subject — never forced in; "none" for anything else, including any interior ' +
    'domestic setting (a kitchen, dining room, living room) or a pure produce/food close-up.\n\n' +
    'Respond with strictly valid JSON matching this exact shape:\n' +
    '{\n' +
    '  "designIntent": string (what this image needs to accomplish, in one sentence),\n' +
    '  "subject": string (what/who is actually in frame),\n' +
    '  "composition": string (framing, focal hierarchy, negative space — a real compositional plan, not a ' +
    'restatement of the subject),\n' +
    '  "unitPresence": "none" | "background" | "featured",\n' +
    '  "unitPresenceRationale": string (one sentence, honest and specific to this image, never boilerplate),\n' +
    '  "setting": "exterior" | "interior" | "unrelated",\n' +
    '  "containsFood": boolean,\n' +
    '  "castDescription": string ("" if no people are in the scene; people are optional, hands, objects and places are equally valid, include people only if they improve the idea),\n' +
    `  "textPlan": { "headline": string, "subtitle": string } or null (${textPlanInstruction}),\n` +
    '  "safeZone": "top-right" (fixed — the logo watermark is composited there after generation; keep that ' +
    'corner visually clean in the composition above — no text, no face, no high-detail clutter there)\n' +
    '}'
  )
}

/**
 * The dashboard's single "Your Scene Idea" field feeds blog, image and video
 * alike, so it is often written as a video or photo brief (camera moves, match
 * cuts, "the film", shots, captions). A blog must take only the idea's SUBJECT
 * and message and explain it to a reader. Without this, job 6daa6b34's blog
 * came out as a narrated description of the film.
 */
export const BLOG_IDEA_IS_SUBJECT_NOT_FORMAT =
  'The idea may be written for another medium (a video, film, photo, shot list or storyboard: camera moves, ' +
  'cuts, transitions, shots, scenes, captions, voiceover). Take only its SUBJECT and message and write a real ' +
  'blog article that explains it to a reader. Never describe or mention a film, video, clip, shot, camera, cut, ' +
  'scene, caption or storyboard, and never narrate how the idea would be filmed.'

export function composeOutlineSystemPrompt(
  brand: BrandProfile,
  category: string,
  sceneNotes?: string | null,
  creativeBrief?: CreativeBrief,
): string {
  return (
    brandContext(brand, category) +
    'You are a content strategist. Respond with strictly valid JSON matching this exact shape:\n' +
    '{\n' +
    '  "title": string,\n' +
    '  "headline": string (max 6 words, a punchy standalone version of the title, suitable for rendering on ' +
    'an image — only used if the post\'s image style calls for on-image text, but always include it),\n' +
    '  "subtitle": string (2-5 words, same on-image-only caveat as headline),\n' +
    '  "sections": [ { "heading": string, "summary": string (one sentence) } ] (exactly 3 to 5 entries)\n' +
    '}\n' +
    'Each heading and summary must reference something concrete and specific to this exact topic — a real ' +
    'detail, angle, or example — never a generic restatement of the brand\'s mission or a vague marketing ' +
    'angle that could apply to any post.' +
    // The dashboard's "Your Scene Idea" field (content_jobs.scene_notes) —
    // required going forward (see src/app/dashboard/new's submit
    // validation), so this is normally always present. It's the creative
    // brief this outline is built around; the brand mission/voice/category
    // guidance in brandContext() above is a fixed constraint on tone and
    // accuracy, never a competing angle. Absent only for a pre-existing job
    // created before the field became required.
    (sceneNotes
      ? `\n\nBuild this outline around the user's own creative idea for the post: "${sceneNotes}". Treat the ` +
        'brand mission, voice, and category guidance above as fixed constraints on tone and accuracy — ' +
        'never as the angle itself. The scene idea decides what this post is actually about. ' +
        BLOG_IDEA_IS_SUBJECT_NOT_FORMAT +
        (creativeBrief ? `\n\n${creativeBriefContext(creativeBrief)}` : '')
      : '')
  )
}

export interface ReferenceCopySystemPromptOptions {
  title: string
  sections: { heading: string; summary: string }[]
}

/**
 * Layer 2 addition (PROMPT_REFACTOR_BRIEF.md §9.3) — the shared,
 * language-neutral pass between the outline and hero/inline image
 * generation. NOT the final published copy (that's composeCopySystemPrompt,
 * generated separately per language track, after images already exist) —
 * this exists solely to give the shared images real, specific substance to
 * be grounded in, instead of just the outline's bare headline/subtitle.
 * Expands the ALREADY-APPROVED outline; never invents new structure or
 * sections of its own.
 */
export function composeReferenceCopySystemPrompt(brand: BrandProfile, opts: ReferenceCopySystemPromptOptions): string {
  const sectionsList = opts.sections.map((s, i) => `${i + 1}. "${s.heading}" — ${s.summary}`).join('\n')
  return (
    `${brand.missionStatement} Voice: ${brand.voiceGuidelines}\n\n` +
    'An outline for this blog post has already been approved. You are expanding it into a compact brief for ' +
    'the images that will illustrate it — never rewriting the outline\'s own structure, and never producing ' +
    `the actual publishable copy (that is written separately, per language, later).\n\nTitle: "${opts.title}"\n` +
    `Sections:\n${sectionsList}\n\n` +
    'Respond with strictly valid JSON matching this exact shape:\n' +
    '{\n' +
    '  "coreMessage": string (2-3 sentences capturing the single specific idea this whole article is ' +
    'actually about — grounded in the title and sections above, never a generic restatement of the brand\'s ' +
    'mission),\n' +
    '  "inlineHighlight": {\n' +
    '    "heading": string (must exactly match ONE of the section headings above — pick whichever section ' +
    'suggests the most genuinely specific, concrete visual moment, not necessarily the first one),\n' +
    '    "visualMoment": string (1-2 sentences describing a real, specific visual moment that section\'s ' +
    'content suggests — not a restatement of the heading or summary)\n' +
    '  }\n' +
    '}'
  )
}

export interface CopySystemPromptOptions {
  language: string
  category: string
  /** The dashboard's "Your Scene Idea" field (content_jobs.scene_notes) —
   *  same required-creative-brief treatment as
   *  composeOutlineSystemPrompt's, still typed optional/nullable for a
   *  pre-existing job created before the field became required. */
  sceneNotes?: string | null
}

export function composeCopySystemPrompt(brand: BrandProfile, opts: CopySystemPromptOptions): string {
  return (
    brandContext(brand, opts.category) +
    statsLine(brand) +
    `\n\nYou are a copywriter. Write full blog copy in ${opts.language} from the given outline. ` +
    // Field names below MUST match blogEditFromDraft() in
    // src/app/dashboard/jobs/[job_id]/page.tsx exactly — see generateCopy.ts
    // for the full incident note on why this schema must stay explicit.
    'Respond with strictly valid JSON matching this exact shape (all string fields required, ' +
    'use "" if genuinely not applicable, arrays may be empty but must be present):\n' +
    '{\n' +
    '  "post_title": string,\n' +
    '  "post_slug": string (url-safe, lowercase, hyphenated),\n' +
    '  "content": {\n' +
    '    "introduction": string (1-2 paragraphs, 2-4 sentences each),\n' +
    '    "sections": [\n' +
    '      {\n' +
    '        "heading": string,\n' +
    '        "h3s": string[] (sub-headings within this section, [] if none),\n' +
    '        "paragraphs": string[] (the section\'s actual body copy, one string per paragraph, 2-4 ' +
    'paragraphs of 2-4 sentences each — this is the main content, never leave it empty),\n' +
    '        "list_items": string[] ([] if this section has no bulleted list),\n' +
    '        "blockquote": { "text": string, "cite": string } or null,\n' +
    '        "has_inline_image": boolean (true for exactly one section, the best fit for a supporting photo)\n' +
    '      }\n' +
    '    ],\n' +
    '    "conclusion": string (1-2 short paragraphs),\n' +
    '    "cta": { "heading": string, "text": string, "button_label": string, "button_url": string }\n' +
    '  },\n' +
    '  "seo": {\n' +
    '    "title": string, "meta_description": string, "focus_keyword": string,\n' +
    '    "secondary_keywords": string[], "og_title": string, "og_description": string,\n' +
    '    "estimated_read_time": string (e.g. "4 min read"), "slug": string (same as post_slug)\n' +
    '  }\n' +
    '}\n\n' +
    'Every section must include at least one concrete, specific detail — a person\'s role, a produce item, a ' +
    'real app feature, a specific number or statistic — never a paragraph that only makes an abstract ' +
    'claim with nothing concrete in it. Never name a specific city, town, neighbourhood, or province as a ' +
    'setting or example (e.g. never write "Toronto", "Edmonton", "Ontario", or any other Canadian city/' +
    'region/neighbourhood) — "Canada" is the only place name allowed anywhere in the post. Do not open ' +
    'consecutive paragraphs the same way (e.g. do not start ' +
    `every paragraph with "${brand.name}" or the same transition word) — vary sentence openers throughout. ` +
    'For "seo": meta_description must be 140-160 characters; focus_keyword must appear in post_title, in ' +
    'the introduction, and in exactly one section heading or h3 — never repeated beyond that.' +
    (opts.sceneNotes
      ? `\n\nThe copy must stay true to the user's own creative idea for this post: "${opts.sceneNotes}". The ` +
        'brand mission and voice guidance above is a fixed constraint on tone and accuracy, never the angle — ' +
        'follow the outline\'s sections above, which were already built around this same idea. ' +
        BLOG_IDEA_IS_SUBJECT_NOT_FORMAT
      : '')
  )
}

export interface CaptionSystemPromptOptions {
  language: string
  /** Resolved text of the job's selected content_angle (brand.adAngleBriefs
   *  lookup), or undefined if the user left it on "let AI decide". */
  angleBrief?: string
  /** The same assembled scene text used to build the accompanying photo
   *  (content_jobs.scene_notes + any clarifying-question answers — see
   *  image.ts's photoScene()). Without this the caption was only ever built
   *  from topic/category/angleBrief, so it could describe a generic take on
   *  the topic while the photo depicted the user's specific scene idea —
   *  undefined only for a pre-existing job created before scene_notes
   *  became required. */
  scene?: string
  /** Set only for 'infographic'-style jobs, once generate_ad_copy has
   *  succeeded — the exact headline/subtitle already rendered onto the
   *  image, so the caption can be told what's on it instead of guessing an
   *  unrelated take on the same topic. */
  imageHeadline?: string
  imageSubtitle?: string
  imageCoreMessage?: string
}

export function composeCaptionSystemPrompt(brand: BrandProfile, opts: CaptionSystemPromptOptions): string {
  return (
    `${brand.missionStatement} Voice: ${brand.voiceGuidelines}${bannedWordsLine(brand)}${statsLine(brand)}\n\n` +
    (opts.angleBrief ? `This specific post should focus on: ${opts.angleBrief}\n\n` : '') +
    (opts.scene
      ? `The accompanying photo depicts this specific moment: "${opts.scene}". Write the caption about this ` +
        'same moment, not a generic restatement of the topic or category.\n\n'
      : '') +
    (opts.imageHeadline
      ? `The accompanying image already has this text rendered directly onto it — headline "${opts.imageHeadline}"` +
        (opts.imageSubtitle ? ` and subtitle "${opts.imageSubtitle}"` : '') +
        (opts.imageCoreMessage ? `, built around this idea: ${opts.imageCoreMessage}.` : '.') +
        ' Write a caption that reads as part of the same post as that image — reinforce the same idea in ' +
        'your own words, do not simply repeat the headline verbatim.\n\n'
      : '') +
    `You are a social media copywriter. Write an Instagram-style caption in ${opts.language} ` +
    'for a social image post. Respond with strictly valid JSON matching this exact shape: ' +
    '{ "caption": string (plain text only — NO hashtags in the caption, they go only in "hashtags"), ' +
    '"hashtags": string[] (5-8 tags, no "#" prefix), ' +
    '"alt_text": string (a plain factual description of the photo\'s likely content, for accessibility) }.'
  )
}

export interface VideoScriptSystemPromptOptions {
  category: string
  scriptType: string
  /** User-selected target total runtime, in seconds (content_jobs.
   *  video_duration_seconds, supabase/migrations/20260914000000) — a
   *  target for the model to aim for, not a hard cap. Previously this
   *  prompt had no real number at all; "approximately duration_seconds"
   *  was referencing the model's OWN output field name, giving it zero
   *  actual length signal (confirmed live 2026-09-13: a real run picked
   *  90s of total runtime with no target to react to). */
  targetDurationSeconds: number
  /** The dashboard's "Your Scene Idea" field (content_jobs.scene_notes) —
   *  same required-creative-brief treatment as composeOutlineSystemPrompt's
   *  (see that function), now extended to video: the story and every scene
   *  are built around this idea, with the brand facts above acting as fixed
   *  constraints on tone/accuracy/how branded elements must look or sound
   *  IF they appear — never as the angle itself. Optional/nullable for a
   *  pre-existing job created before the field became required. */
  sceneNotes?: string | null
  /** Layer 1's interpreted brief (PROMPT_REFACTOR_BRIEF.md §4.2), produced
   *  by steps/shared/interpretIntent.ts. Optional so a caller that hasn't
   *  run that step yet (or a legacy job predating it) still works exactly
   *  as before. Only folded in alongside sceneNotes — see
   *  composeVideoScriptSystemPrompt's own body for why. */
  creativeBrief?: CreativeBrief
  /** Allow planned camera moves (default: CAMERA_MOVES env, on). False keeps the
   *  old locked-off rule. */
  cameraMoves?: boolean
  /** Short summaries of the settings recent videos used (time of day, light,
   *  palette, locations), newest first. Spliced in so a new video picks a
   *  clearly different look and place — never a hard rule: the idea's own
   *  stated setting always wins. Omitted/empty adds nothing. */
  recentSettings?: readonly string[]
  /** Story shapes (hook type, framework, motif) of recent videos, newest first. */
  recentStories?: readonly string[]
}

/** "Don't repeat what recent videos looked like" — one clause, soft by design. */
function recentSettingsClause(recent: readonly string[] | undefined): string {
  const list = (recent ?? []).filter((s) => s.trim()).slice(0, 5)
  if (list.length === 0) return ''
  return (
    'Recent videos already used these looks and places (newest first): ' +
    list.map((s, i) => `${i + 1}) ${s}`).join(' ') +
    ' Give this video a clearly different time of day, light, colour palette, season and surroundings — ' +
    "unless the user's idea states them, which always wins. Every video should feel fresh."
  )
}

/** "Don't reuse the story shape of recent videos" — soft, like the settings clause. */
function recentStoriesClause(recent: readonly string[] | undefined): string {
  const list = (recent ?? []).filter((s) => s.trim()).slice(0, 5)
  if (list.length === 0) return ''
  return (
    'Recent videos already told their story with these shapes (newest first): ' +
    list.map((s, i) => `${i + 1}) ${s}`).join('; ') +
    ' Choose a different hook type, framework and motif for this one, unless the idea above calls for the same.'
  )
}

// Story craft (knowledge base §4.5, §5, §6A.5). The model works it out
// silently and records the result in "story" and in each scene's
// story_role/adds. Narration is written from that record, so it has a story
// to tell instead of one line per picture.
const STORY_CRAFT_CLAUSE =
  'STORY CRAFT, also silent. Act as an award-winning commercial director and the social lead of a loved ' +
  'brand: correct but forgettable is a failure. (a0) If the idea already contains written voiceover or ad copy (quoted lines, a "Voiceover:" block, ad-style ' +
  'sentences), that copy IS the narration: keep every sentence in order and in the creator\'s own words, split ' +
  'across the scenes (put each sentence\'s meaning in the narration_intent of the scene that carries it, and the ' +
  'first line in scene 1), tighten only where a scene\'s time demands it, and do not replace it with an invented ' +
  'character, incident or object. A closing line the creator wrote (for example "Brand. Tagline.") is SPOKEN in the ' +
  'final scene and is the last thing said, never only stored as a call to action. The creator\'s own opening may ' +
  'use a word the brand otherwise avoids as an opener (such as "Imagine"); the ban on "Imagine", "Meet" and ' +
  '"Introducing" applies only to copy you invent. Safety rules still win (entering or exiting words, "Fresh-CAN" ' +
  'spelling, no invented claims). A surreal, metaphorical or high-concept idea keeps its premise literal in BOTH the ' +
  'pictures and the words (colour draining from the world stays about colour draining from the world); never turn ' +
  'a metaphor into a literal recipe, dinner or shopping story. (a00) Match the scale the idea names: a ' +
  'neighbourhood, a world or a community is shown at that scale, with several different people and places (for ' +
  'example a street, several homes and kitchens, a market, the container) and the change spreading, never shrunk ' +
  'to one person in one kitchen. Cast as many different people as the story needs, strangers and neighbours ' +
  'included; build the story around one or two people ONLY when the idea itself is about them. Do not default to a ' +
  'single resident or shopper. ' +
  '(a) Otherwise the typed idea IS the story. Keep its premise, its images, its setting, its order of events, its ' +
  'scale, its register (surreal, funny, tender, epic, documentary) and everything the creator required or ruled out. ' +
  'List silently every picture, event and turn the idea names, and give each one its own scene, in the order the idea ' +
  'gives them. Your craft goes into HOW it is told: a sharper first frame, specific details, striking transitions, ' +
  'fresh people and places that serve the same idea, a better hook and ending. Add a twist or reversal only where the ' +
  'idea leaves room for one, never to replace what it says. Never simplify an ambitious or surreal idea into an ' +
  'ordinary errand, a dinner or a single person\'s small moment: produce it at its own ambition. Never tweak away a ' +
  'stated constraint, and never break brand truth. Write the result as "concept": two plain sentences that restate the ' +
  'idea itself, not a different story. EVERY scene and every narration line is built around the idea\'s own events. ' +
  '(b) Insight: state in one line the human truth under the idea. Sketch three different ways to TELL this same idea ' +
  '(different structure, point of view or transitions, never three different stories), score them 1-5 on surprise, ' +
  'catchiness, shareability, faithfulness to the idea, brand truth and producibility, and use the boldest one that ' +
  'scores 5 on faithfulness and at least 4 on brand truth and producibility. Producibility limits HOW a thing is ' +
  'shown, never WHAT the idea contains. A different idea must give a differently shaped story each time. ' +
  '(b2) Write the story fields (hook, inner, turn, motif, ending_image, quotable) in clear words about concrete ' +
  'actions and images, as a person would say them out loud. Keep them plain unless the idea\'s own register is poetic, ' +
  'surreal or cinematic, in which case vivid imagery in the idea\'s own spirit is welcome. The ending_image is one ' +
  'clear thing a person does or sees. ' +
  '(b3) Choose the narration voice from the idea itself. Use "promo" when the idea is a product or produce showcase, ' +
  'a convenience or errand gag, a trend or fast-cut ad: the voiceover speaks to the viewer as "you" and the picture ' +
  'carries the person. Use "story" (calm third person, observed and specific; heartfelt is welcome) when the idea ' +
  'centres on a relationship, a memory, an emotional moment, a community, a place or what saved time becomes. ' +
  'Pick the voice that fits the story shape you chose in (c), not a default: a place, community, ensemble, ' +
  'contrast or ripple story always uses "story" (a calm narrator who may address the viewer if the creator\'s own copy does), ' +
  'and the lead character is not required. ' +
  '(b4) Read the idea\'s meaning before its plot: who the people are (one person, a family, seniors, a campus or workplace, ' +
  'a remote or cold community), what honestly gets in their way, and what the saved time, effort or access becomes for them. ' +
  'Record in story.impact_angle one of personal, family, community, place or manifesto. ' +
  '(c) Pick the story shape the idea implies, as ONE framework from small_quest (one person, one small errand), ' +
  'pressure_cooker, time_machine, demo_drop, educator, origin_story, myth_killer, countdown, cliffhanger, pas, bab, ' +
  'pixar_spine, ensemble (a few people, each with one specific detail), many_lives (a different person each scene, the ' +
  'unit as the recurring anchor), place_transformation (the place is the character: the same corner empty, then, after a ' +
  'cut and from the same angle, with the unit and people around it, never showing arrival), contrast_cut (the old hard ' +
  'way, then the easier way and what it frees up) or ripple_effect (one change spreading through a community). ' +
  'Do not fall back on small_quest unless the idea really is one small errand. (d) Hook: draft four openers across at least three of ' +
  'story_open, small_problem, pov, result_first, question, teach, callout, pattern_interrupt, number_list, ' +
  'confession; keep the most specific one that can be paid off by the last scene, recorded in story.hook as the SPOKEN first line itself (plain words, 12 or fewer), with the opening picture and the ' +
  'opening line saying the same thing, an action already under way in the first frame, and never a logo or the ' +
  'container alone. (e) Give the story its centre: for a single-person story, one want and one small worry (inner); for ensemble or ' +
  'many_lives, each person one specific detail and the unit as the thread between them; for place_transformation, the ' +
  'place itself (what it was, what it becomes); for contrast_cut or ripple_effect, the before and the after. Then a ' +
  'turn where something changes, and ONE recurring object or gesture (motif) that returns, in a new form, near the end (in a "promo" voice the motif is a picture-only detail and is never spoken), and one small running thread (an idea that comes back two or three times, never in every scene). (f) Choose the ' +
  'ending_image: a concrete, feeling-led final picture, not a summary or slogan, and make the final scene\'s ' +
  'visual_description actually show it. (g) Decide the one line worth quoting: plain and specific, never a ' +
  'slogan, and which scene it lands in. (h) Give every scene a story_role (hook, context, turn, payoff or ' +
  'close) and an emotion that differs from its neighbours where the story allows, and write what its narration ' +
  'will ADD that the picture cannot show (a thought, a memory, a worry, a reason), never a description of the ' +
  'picture. (i) Polish: cut or merge the weakest scene, sharpen the first frame, make each scene\'s single action ' +
  'more specific. Never open narration with "In a world where", "Imagine", "Meet" or "Introducing". (j) VISUAL CRAFT, ' +
  'for every video: give it ONE visual idea and keep it consistent: in "look", a concrete, distinctive style (the ' +
  'light, the colour grade, the lens feel, the season or weather), never just "cinematic" or "warm". Vary shot size and ' +
  'angle across the scenes (a wide establishing view, medium shots, a close detail or insert, at least one unusual ' +
  'angle such as low, high or overhead), and never give two neighbouring scenes the same framing. Compose each frame ' +
  'with depth: a foreground element, a layered background, motivated light (window light, low sun, lamps, steam, ' +
  'frost, rain) and one striking detail or "hero frame" in each scene (a reflection, a silhouette, a contrast of ' +
  'scale, an unexpected viewpoint), while the action stays simple enough for one clean shot. This craft never ' +
  'overrides brand truth: the container design and wordmark rules, clean fresh food, modest dress, people mid-action ' +
  'and real-looking photography all still apply.'

/**
 * Produces the script AND its scene-by-scene shot plan in ONE call
 * (ARCHITECTURE.MD §17.1 — scene planning is not a separate post-approval
 * step; real production draft data showed it was already produced alongside
 * the script, and splitting it out would just be an unneeded round-trip).
 * `narration_intent` is deliberately SEMANTIC ("the idea to convey"), never
 * literal wording — it's what a later, per-language localize_script step
 * translates into actual EN/FR narration text. This is the one thing that
 * keeps the shared scene plan genuinely language-neutral; a model that
 * writes literal English sentences into narration_intent here would quietly
 * reintroduce the "FR is just a translation of the EN script" bug this
 * whole redesign exists to avoid.
 *
 * `sceneNotes` (added alongside the anti-ad framing below) brings video in
 * line with how composeOutlineSystemPrompt/composeBlogImage/composePhotoPrompt
 * already treat the dashboard's "Your Scene Idea" field and SCENE_IS_CREATIVE_BRIEF
 * (core/compose.ts): the brand's mission/voice/category/real physical
 * descriptions are fixed CONSTRAINTS on what must look, sound, or feel
 * correct if they appear — never the reason a scene exists. Without this,
 * the model defaults to writing the vehicle/app/brand into the center of
 * every scene, which is exactly what makes generated video read as an ad
 * instead of a real moment.
 *
 * Rewritten 2026-09-19 after a real generation given a fully unrelated
 * scene idea (a family's cozy autumn dinner — pumpkin, squash, sweet
 * potatoes, warm spices, no mention of Fresh-CAN at all) ignored it
 * completely and wrote a generic Fresh-CAN mission/food-desert pitch
 * instead — real statistics cited, the mobile unit forced into 4 of 7
 * scenes. The scene-idea clause used to be a single sentence appended at
 * the very END of this entire system prompt, AFTER the brand's full
 * mission statement, its category brief (a directive: "this category
 * should focus on..." — a second, directly competing topic), real
 * statistics available to cite, the whole JSON schema, and every other
 * instruction below. By the time the model reached it, it had already
 * been primed hard toward brand/mission content, and one trailing
 * sentence was nowhere near enough to override that. The idea now leads
 * instead — brand facts are reframed as background constraints from the
 * very first sentence — and the category brief/statistics (the two most
 * topic-like, directly competing pieces of brand content) are dropped
 * entirely rather than reworded softer: there's no safe phrasing of "here
 * is a second, whole different topic you may also want to write about"
 * that doesn't risk reintroducing exactly this bug.
 *
 * Follow-up the same day: even after the rewrite above, the user asked why
 * a generation about that same unrelated autumn-dinner idea still
 * mentioned "food desert communities" at all. Answer: missionStatement
 * itself — quoted verbatim as "background context" — literally contains
 * that phrase (see fresh-can.ts), regardless of which category was
 * selected; a category brief was never the only source of topic drift.
 * `brand.neutralIdentityLine` (falls back to missionStatement when unset)
 * exists so this branch can quote a short, purely-factual line instead —
 * the same "remove the competing content, don't just reframe it" judgment
 * already applied to the category brief/statistics above.
 *
 * 2026-09-21: the anti-hijack fix above worked almost too well — real user
 * feedback was that generated videos now read as either forcibly about the
 * truck (whenever a scene happened to mention it) or with NO connection to
 * the brand campaign at all, nothing recognizable as belonging to Fresh-
 * CAN's own social feed. First attempt at CAMPAIGN_FIT (later the same day)
 * was pure reassurance ("real warmth/community already qualifies, nothing
 * needs to be added") — too soft: the very next real generation still had
 * zero recognizable connection to Fresh-CAN at all, just the scene idea
 * with no brand thread anywhere. Second attempt required a genuine
 * CONNECTION but treated the literal brand name as merely "ideal," one of
 * several equally-valid options alongside generic "fresh/local" language —
 * still too easy for the model to satisfy with vague food-freshness talk
 * and never actually say "Fresh-CAN." Third attempt made the name itself a
 * hard requirement, layered on top of the mission connection — this DID
 * produce a real script mentioning "Fresh-CAN" twice, but review of that
 * real output surfaced two further gaps, both closed in this (fourth)
 * revision:
 *
 * (a) The model satisfied the requirement by writing "Fresh-CAN" into the
 * top-level `script` field — which the schema itself labels "for internal
 * review only" — while `narration_intent`, the field that actually reaches
 * the audience (composeLocalizeScriptSystemPrompt below reads ONLY
 * narration_intent, never the top-level script), had no guarantee of
 * carrying the same mention. CAMPAIGN_FIT now says explicitly which field
 * the mention must live in.
 *
 * (b) The real output's final scene asked for "the screen transitions to
 * the Fresh-CAN logo" as its own visual_description — i.e. asking an image/
 * video generation model to DRAW the actual brand logo from a text
 * description, the exact failure mode watermark.ts (src/server/pipeline/
 * lib/watermark.ts) already exists to avoid for images ("risked a
 * plausible-but-wrong rendering... this stamps the actual asset on
 * instead") — video has no equivalent real-asset-compositing step, so a
 * scene like that would only ever produce an AI-hallucinated approximation
 * of the logo, never the real one. CAMPAIGN_FIT now explicitly forbids
 * writing a scene whose subject is the logo/wordmark/any brand graphic —
 * the Fresh-CAN connection must live entirely in narration, never in a
 * shot asking a generative model to render brand artwork.
 *
 * The key distinction that keeps all of this from reopening the original
 * hijack bug: MESSAGING (reciting the mission statement, statistics, a
 * slogan, forcing the vehicle into a scene it doesn't fit) is still
 * forbidden; ONE specific, natural, spoken mention of the name itself,
 * written into the right scene's narration_intent and grounded in a
 * genuine narrative connection to what Fresh-CAN actually does, is
 * required.
 *
 * 2026-09-22: fifth revision — not another rewrite of the requirement
 * above (real production data already confirmed it works: a real
 * generation said "Fresh-CAN" twice in actual synthesized narration), but
 * an explicit ask to make the SURROUNDING creative process more
 * structured, and to make how much Fresh-CAN shows up beyond that one
 * required mention scale with how directly the user's idea already
 * concerns the brand, instead of being the same fixed ask for every idea.
 * Added STORY_PLANNING_CLAUSE (a silent, internal 6-step planning pass —
 * core idea, story arc, a deliberately chosen creative device, a
 * background/supporting/enabler/subject/hero classification of Fresh-CAN's
 * role in THIS idea, a recurring visual motif, and per-scene purpose —
 * explicitly never exposed in the JSON output, so the existing schema
 * generateScript.ts depends on didn't need to change) and
 * FRESHCAN_ROLE_ADAPTIVITY (how much VISUAL/NARRATIVE presence — the
 * vehicle appearing, more direct narration — is earned by that
 * classification; the one required spoken name-mention above stays a flat,
 * non-negotiable floor at every role level, since that's the specific,
 * production-validated fix an idea with only a loose connection should
 * never lose). Also added BRAND_ASSET_FIDELITY (never invent/redesign the
 * logo, vehicle, or a product/service that doesn't exist — the narrative-
 * level counterpart to what containerDescriptor/REFERENCE_IS_GUIDE_NOT_COPY
 * already enforce at the image-prompt layer in compose.ts) and
 * FINAL_SELF_CHECK_CLAUSE (a silent pre-return quality gate). None of this
 * changes the JSON schema, the DB columns it's written into, or
 * isVideoSceneAboutUnit's keyword-based per-scene truck decision (scene.ts)
 * — all of it is prompt-only, richer guidance flowing into the same
 * visual_description/shot_notes/narration_intent fields that already
 * existed, per the request's own "preserve JSON structure/DB expectations,
 * modify the smallest number of files necessary."
 */
function campaignFit(brand: BrandProfile): string {
  return (
    `That does not mean the story can ignore ${brand.name}, though — every video is made for ${brand.name}'s own brand ` +
    `campaign, so it must still genuinely connect to ${brand.name}'s real mission and goals, no matter how creative ` +
    'the idea gets. This is required, not optional, and has two parts, both required together: (1) find the ' +
    `honest, natural bridge between the idea above and what ${brand.name} actually does — bringing fresh, ` +
    'affordable, local groceries directly into communities — and let it show through the story\'s own real ' +
    'details: food that reads as genuinely fresh and local, a real neighbourhood or community feeling, people ' +
    `getting good food easily; and (2) the ${brand.name} name itself must be said explicitly, out loud, somewhere in ` +
    'the narration across the video — this is REQUIRED, not merely ideal, and is never satisfied by "fresh" or ' +
    '"local" language alone, no matter how strong the thematic connection is otherwise. This MUST be written ' +
    'directly into the relevant scene\'s own "narration_intent" field below, in plain semantic terms (e.g. ' +
    `"mentions this was made possible by ${brand.name}") — the top-level "script" field is for internal review only ` +
    'and is never what actually reaches the audience, so writing the mention there alone does NOT satisfy this ' +
    'requirement. Find the single most natural moment already in the story for it — wherever food, its origin, a ' +
    'delivery, or a visit is already part of the scene — and have that scene\'s narration_intent call for naming ' +
    `${brand.name} there directly, the way a real person would actually say it out loud in that moment. The ` +
    'difference from reciting the mission statement or forcing the container in: this is ONE specific, natural ' +
    'mention of the name, grounded in the story\'s own real details, never a slogan, statistic, or pitch stated ' +
    'on top of the scene. Never write a scene whose subject is the brand\'s logo, wordmark, or any graphic/text ' +
    'reveal — no visual_description should ask for the logo to be drawn, shown, or transitioned to; an AI image ' +
    `or video model cannot reproduce the real logo accurately, so the ${brand.name} connection belongs entirely in ` +
    'the spoken narration above, never as a visual logo or brand-graphic shot.'
  )
}

// Silent internal planning pass, run before the model writes any scene —
// see CAMPAIGN_FIT's own header, "2026-09-22: fifth revision," for why this
// was added and why it deliberately never touches the JSON schema below
// (generateScript.ts's normalizeScriptOutput has no field for any of this;
// it's reasoning that should shape the existing visual_description/
// shot_notes/narration_intent output, not a new output of its own).
function storyPlanningClause(brand: BrandProfile): string {
  return (
    'Before writing the scenes below, silently work through the following — this is internal reasoning, never ' +
    'part of your JSON output, which must contain only the fields the schema below asks for: (1) Core creative ' +
    'idea — what genuinely makes the idea above interesting or worth watching? (2) Story arc — a hook, a ' +
    'development, and a payoff, or another structure that fits this specific idea better. (3) Creative device — ' +
    'choose ONE device that serves this idea, such as a visual reveal, an object\'s own journey, a POV shot, a ' +
    'match cut, a cause-and-effect chain, a transformation, a human moment, or another device that fits better ' +
    `than any of these. (4) ${brand.name}'s role in this story — classify it as background, supporting, enabler, ` +
    `subject, or hero, based on how directly the idea above already concerns ${brand.name} or its mission (an idea ` +
    `with no real connection to groceries or the brand is background; an idea directly about ${brand.name}'s own ` +
    'mission or service is hero) — this is an honest read of the idea itself, never a default, since the ' +
    'branding guidance below scales against it. If an earlier pass already estimated how relevant the physical ' +
    'unit is to this idea, treat that as a starting point to confirm or refine here, with the full idea and ' +
    'scenes you are now planning — your own classification, made with that fuller context, is what the ' +
    'branding guidance below actually scales against. (5) Visual motif — one recurring visual element (a color, an ' +
    'object, a gesture, a shot type) that can carry across multiple scenes for cohesion. (6) Scene purpose — plan ' +
    'what specific job each scene does in the story before writing it; every scene must advance the story, never ' +
    'exist as one more pretty but disconnected shot.'
  )
}

// How much Fresh-CAN shows up BEYOND the one required narration mention
// above scales with STORY_PLANNING_CLAUSE's role classification — see
// CAMPAIGN_FIT's header for why the mention itself stays a flat,
// non-negotiable floor at every role level regardless.
function freshcanRoleAdaptivity(brand: BrandProfile): string {
  return (
    `How visually and narratively present ${brand.name} is beyond that one required mention should scale with the ` +
    'role you classified during planning, not be the same for every idea. For a background, supporting, or ' +
    `enabler role — the idea has only a loose or everyday connection to groceries — keep ${brand.name}'s presence ` +
    'subtle: the required spoken mention above is enough, connected through the story\'s own food, people, ' +
    'community, or access details; do not force the container, the logo, or the app into the visuals just because ' +
    `the brand is being credited in narration. For a subject or hero role — the idea is directly about ${brand.name}, ` +
    'its mission, or its service — stronger, more direct branding is earned and appropriate: the container can be a ' +
    `real visual presence across multiple scenes, and narration can speak about ${brand.name} more directly, still as ` +
    'part of a genuine story, never as a recited pitch. Every added character, object, location, action, or brand ' +
    `element must have a narrative reason for being there, at any role level — never a random ${brand.name} truck, a ` +
    'random food prop, a generic cinematic shot with nothing to do with the story, an unrelated character or ' +
    'location, branding beyond what the role above earns, or a surreal element with no narrative justification. ' +
    `The finished video should make it obvious both why it belongs on ${brand.name}'s own social media and why the ` +
    'user\'s original creative idea is still fully recognizable in it — neither should come at the other\'s expense.'
  )
}

function brandAssetFidelity(brand: BrandProfile): string {
  return (
    `When ${brand.name}'s container, app, or other real assets appear in a scene, describe them only as already true ` +
    'per the brand facts above — never invent a new logo, redesign the container\'s shape or colors, invent a ' +
    `product or service ${brand.name} doesn't actually offer, or add an app feature that isn't real. The app's UI ` +
    'is only ever deep maroon and white, never any other screen color. Use an ' +
    'existing asset because this specific scene\'s idea genuinely calls for it, never merely because it exists.'
  )
}

function finalSelfCheckClause(brand: BrandProfile): string {
  return (
    '\n\nBefore returning your answer, silently verify: is the original creative idea still recognizable in what ' +
    'you wrote? Is there a clear, coherent story rather than a string of unrelated shots? Does every scene serve ' +
    `a purpose? Is ${brand.name}'s presence natural for the role you classified, not forced? Did you avoid drawing ` +
    'the logo or inventing brand assets? Is the story visually and physically logical? Does it land on a ' +
    'memorable, satisfying ending? If not, revise your answer before returning it — only the final JSON is ' +
    'returned, never this checklist.'
  )
}

const SHOT_NOTES_CAMERA_STATIC =
  'THE CAMERA NEVER MOVES — every shot is locked-off and static, so write "static", never a pan, ' +
  'tilt, track, follow, dolly, zoom, push-in, orbit or handheld move: the video model scrolls, repeats and ' +
  'morphs the background whenever the camera travels. Be concrete — e.g. "static low-angle wide shot, shallow ' +
  'depth of field, soft window light" or "static medium close-up on the subject, background held steady" — ' +
  'never just "cinematic" or "dynamic shot".'

const SHOT_NOTES_CAMERA_MOVING =
  'Add ONE camera move when the moment calls for it, chosen by what it means: a slow push-in for a realisation ' +
  'or decision, a slow pull-back to reveal scale or community, a gentle slider/parallax move past a foreground ' +
  'object, a slow zoom with the camera fixed for a face, gentle handheld for a documentary feel, or a short ' +
  'reverse-tracking shot for someone walking toward the camera — or "static" when the moment should simply be ' +
  'held. Name the move and how it starts and ends; keep it slow and short, the subject in the foreground and the ' +
  'background simple, because the video model repeats and morphs a scrolling background. Never an orbit around a ' +
  'face, a whip pan, a crash zoom, a fly-through of a doorway, or a long follow shot. Mix moves and static shots ' +
  'across the video, never the same move in every scene. Be concrete — never just "cinematic" or "dynamic shot".'

const SHORT_FILM_CAMERA_STATIC =
  'give each one deliberate framing in shot_notes — every shot is locked-off and static, never a pan or ' +
  'track: the video model repeats and morphs a scrolling background, so the subject does the moving, not ' +
  'the camera. Keep each action small enough for ONE locked frame (reaching, holding, looking, a few steps in ' +
  'place) — never a long walk toward or away from the camera —'

const SHORT_FILM_CAMERA_MOVING =
  'give each one deliberate framing in shot_notes, and where the moment calls for it a slow, short, motivated ' +
  'camera move (see shot_notes) — never a long travelling shot, since the video model repeats and morphs a ' +
  'scrolling background. Keep each action small enough for one short clip (reaching, holding, looking, a few ' +
  'steps) rather than a long walk toward or away from the camera —'

/** What the dashboard's Script Type values mean, so the model is not left guessing. */
function scriptTypeMeaning(scriptType: string | undefined): string {
  const t = (scriptType ?? '').trim().toUpperCase()
  if (t === 'SOLUTION') {
    return ' (an advocate or narrator voice about the problem and its answer; it may use at most one real statistic from the brand facts)'
  }
  if (t === 'COMMUNITY') {
    return " (told from inside one community member's life or place; never presented as a real testimonial or a real person)"
  }
  return ''
}

export function composeVideoScriptSystemPrompt(brand: BrandProfile, opts: VideoScriptSystemPromptOptions): string {
  const moves = opts.cameraMoves ?? cameraMovesEnabled()
  const shotNotesCamera = moves ? SHOT_NOTES_CAMERA_MOVING : SHOT_NOTES_CAMERA_STATIC
  const shortFilmCamera = moves ? SHORT_FILM_CAMERA_MOVING : SHORT_FILM_CAMERA_STATIC
  const preamble = opts.sceneNotes
    ? `Build this video's story and every one of its scenes around the user's own creative idea: ` +
      `"${opts.sceneNotes}". This idea alone decides what the video is about and what happens in it — ` +
      `never blend in or substitute a different topic. The idea fixes the subject and anything it requires; Follow its events, images and order faithfully; your creativity goes into HOW it is told, never into replacing or shrinking what it says (see STORY CRAFT). ${brand.neutralIdentityLine ?? brand.missionStatement} ` +
      `Only if your story.impact_angle is community, place or manifesto, this fuller context about why the brand exists may inform the story's meaning (ignore it for a personal or family idea): ${brand.missionStatement}${statsLine(brand)} ` +
      `That is background context for tone and brand accuracy only: a fixed constraint on how the brand's ` +
      `container, app, or other branding must look or sound IF the idea above genuinely calls for them, never a ` +
      `second angle, and never a reason to insert brand or mission messaging into a scene the idea doesn't ` +
      `call for.${opts.creativeBrief ? ` ${creativeBriefContext(opts.creativeBrief)}` : ''} ` +
      `${storyPlanningClause(brand)} ${STORY_CRAFT_CLAUSE} ${recentSettingsClause(opts.recentSettings)} ${recentStoriesClause(opts.recentStories)} ${campaignFit(brand)} ${freshcanRoleAdaptivity(brand)} ${brandAssetFidelity(brand)} ` +
      `Voice: ${brand.voiceGuidelines}${bannedWordsLine(brand)}\n\n`
    : brandContext(brand, opts.category) + statsLine(brand) + '\n\n'

  return (
    preamble +
    `You are a video scriptwriter and shot planner. Produce a short-form marketing video script AND its ` +
    `scene-by-scene shot plan in ONE response. Script type: ${opts.scriptType}${scriptTypeMeaning(opts.scriptType)}.\n\n` +
    'Respond with strictly valid JSON matching this exact shape (the core fields — script, visual_description, ' +
    'duration_seconds, scenes, and each scene\'s scene_number/visual_description/shot_notes/narration_intent/' +
    'target_duration_seconds — are required; the additional planning fields below are optional but strongly ' +
    'encouraged whenever you have a real, specific answer for them — never pad one with a generic placeholder ' +
    'just to fill it in):\n' +
    '{\n' +
    '  "script": string (the full narration/voiceover text, human-readable, in English, for internal review only),\n' +
    '  "visual_description": string (one-paragraph overview of the video\'s overall visual concept),\n' +
    '  "duration_seconds": number (total estimated runtime, summing the scenes below),\n' +
    '  "story": { "hook": string (the SPOKEN first line a viewer hears, in plain words, 12 or fewer, never a description of the picture), "arc": string, "resolution": string, "cta": string or null, "concept": string (the tweaked story in two plain sentences), "voice": "promo" or "story" (see the voice rule), "impact_angle": "personal" | "family" | "community" | "place" | "manifesto", "thread": string (one small running idea that returns two or three times, never every scene), "insight": string, ' +
    '"framework": string (one of the framework keys above), "hook_type": string (one of the hook types above), ' +
    '"inner": string, "motif": string, "turn": string, "ending_image": string, "quotable": string (the idea of ' +
    'the line worth quoting, not final wording), "quotable_scene": number } (a compact summary of your planning ' +
    'above — the same hook/arc/payoff structure and story craft, not new content; leave out any field you have no ' +
    'real answer for),\n' +
    '  "look": { "time_of_day": string, "lighting": string, "palette": string, "style_direction": string, ' +
    '"camera_language": string } (the visual mood/style for the WHOLE video, deferential to whatever the scene ' +
    'idea itself already implies — this replaces guessing a default mood per image later; make style_direction and ' +
    'palette concrete and distinctive (a light, a grade, a lens feel, a colour story), never a generic word like "cinematic"),\n' +
    '  "cast_bible": [ { "id": string (short, stable, e.g. "mother"), "role": string, "age_range": string, ' +
    '"appearance": string (specific and unambiguous enough that a different artist working from this text ' +
    'alone, with no image reference, would draw the same individual every time — always state apparent ' +
    'gender, ethnicity/skin tone, exact hair color/texture/style, and build or facial structure; never a generic phrase ' +
    'like "kind-looking" or "friendly" that could describe many different people. State skin tone in absolute ' +
    'terms with the apparent heritage (e.g. "deep brown skin, West African heritage"), never "light" or ' +
    '"medium" alone, and add face shape, facial hair or none, and hair length; real renders drew the same ' +
    'person with a different skin tone and face each scene when this was vague), "wardrobe": string (ONE ' +
    'fixed outfit worn in every scene of the video, naming each garment with its exact color, e.g. "olive-green ' +
    'zip hoodie, dark-wash jeans, white sneakers" — never just "a hoodie", never a change of outfit' +
    (brand.dressRule ? `; ${brand.dressRule}` : '') + '), ' +
    '"distinguishing_details": string } ] (one entry per named or recurring person in the story — locked ' +
    'physical descriptions to reuse VERBATIM in every scene that person appears in, the backbone of keeping ' +
    'them looking the same scene to scene; for an ensemble, community or place story list the several different ' +
    'people (each may appear in only one or two scenes), not a single lead; omit entirely for a video with no ' +
    'recurring named people),\n' +
    '  "locations": [ { "id": string, "description": string, "continuity_details": string } ] (one entry per ' +
    'distinct place the story visits, if it revisits any; omit for a single-location or single-shot video),\n' +
    '  "scenes": [\n' +
    '    {\n' +
    '      "scene_number": number (1-indexed, sequential, no gaps),\n' +
    '      "story_role": "hook" | "context" | "turn" | "payoff" | "close" (this scene\'s job in the arc: the ' +
    'first scene is the hook, the last is the close),\n' +
    '      "adds": string (one short phrase: what this scene\'s narration adds that the picture cannot show, such ' +
    'as a thought, a memory, a worry or a reason; never a description of the picture),\n' +
    '      "beat": string (this scene\'s narrative job — e.g. "hook", "build", "turn", "payoff", "close", or ' +
    'another word that fits better),\n' +
    '      "visual_description": string (what the camera shows — the subject\'s own action plus any natural ' +
    'ambient motion already implied by the setting, e.g. wind moving leaves or fabric, light ' +
    'shifting — specific enough to generate an image from. Ground it in this scene\'s own story beat and ' +
    'purpose from your planning above: what specifically happens, in what environment, and how it connects to ' +
    'the scene immediately before it — never a generic or purposeless shot. ' + ACTIVE_PEOPLE_PLANNER_RULE + '),\n' +
    '      "shot_notes": string (cinematographic direction for this exact shot: angle, framing, distance and depth ' +
    'of field. ' + shotNotesCamera + ' Choose the angle and framing that serve THIS scene\'s specific ' +
    'purpose in the story, not decoration for its own sake),\n' +
    '      "narration_intent": string (the SEMANTIC content this scene\'s narration should convey — describe ' +
    'the idea in plain terms, NEVER write it as a finished sentence in any one language, since this gets ' +
    'independently localized into actual EN or FR wording by a later step. Write the moment, the feeling or the ' +
    'character\'s inner thought, not a list of facts to state: do NOT restate how the service works (account, QR ' +
    'scan, payment, checkout) in more than one scene of the whole video, and never write instructions to the ' +
    'narrator such as "explicitly naming", "clarifying that" or "preserving" — just say what the scene is about, ' +
    'e.g. "he finds a unit around the corner and relief starts to creep in"),\n' +
    '      "target_duration_seconds": number (this scene\'s planned runtime budget),\n' +
    '      "cast_present": string[] (the cast_bible ids of every recurring person who VISUALLY appears in ' +
    'this scene, if any — include them even when this scene is set at a different location or in a different ' +
    'setting than where they last appeared; never drop a recurring person from this list just because the ' +
    'scene changed location, that is exactly when losing their locked appearance is most noticeable. [] or ' +
    'omit only if the video has no cast_bible or genuinely no cast_bible person is shown in this scene. Every ' +
    'cast_bible person your visual_description shows or mentions, in any role (guest, neighbour, passenger, ' +
    'customer), is listed here, so a scene never has a named or featured person in it who is missing from this ' +
    'list. The one exception is generic background people (a few neighbours in the distance, shoppers across a ' +
    'street, a market crowd, passers-by) who matter only as atmosphere: describe them in visual_description as an ' +
    'unnamed group ("a few neighbours in the distance"), keep them small, away from the camera and out of focus ' +
    'or in profile, give them no cast_bible entry and no close-up, and never make one of them speak or act on the ' +
    'story. Anyone who is in focus, near the camera, repeated across scenes or doing something the story needs ' +
    'is a cast_bible person),\n' +
    '      "props_present": string[] (visually significant objects this scene establishes or carries forward),\n' +
    `      "unit_presence": "none" | "background" | "featured" (is ${brand.name}'s physical unit the ` +
    'subject of this scene, plausibly present in the background, or absent — an honest per-scene read, never a default. ' +
    'Choose "background" or "featured" for every scene that shows a person arriving at, shopping in, or heading away ' +
    'from the unit with their groceries: the scene is drawn from the unit\'s reference image, and a scene marked ' +
    '"none" has no container reference, so the image model invents its own container. Choose "none" for scenes where the ' +
    'unit plays no part in what is shown, such as a home kitchen or a phone screen. Whenever the unit appears, ' +
    'even as "background", it fills at least a third of the frame width so its wordmark reads cleanly — a small ' +
    'or distant unit gets its wordmark garbled by the video model, so either make it large or choose "none". The ' +
    'unit is only a standalone shipping container standing on the ground — never describe it as a truck, ' +
    'with a cab or wheels, arriving, driving, pulling up or parking. You may frame it from any angle the scene ' +
    'needs; its door is always shown closed with nobody in or at the doorway),\n' +
    '      "unit_presence_rationale": string (one sentence, honest and specific to this scene, never ' +
    'boilerplate — why you chose that unit_presence value; omit only if unit_presence is "none"),\n' +
    `      "app_on_screen": "none" | "background" | "featured" (is a person shown using the ${brand.name} app on a ` +
    'phone in this scene — searching for a unit, scanning the entry QR code; "featured" when the phone screen is ' +
    'a focal point, "background" when it is merely visible, "none" otherwise — an honest per-scene read, never a ' +
    'default. When not "none", describe the phone screen in visual_description only as a simple maroon-and-white ' +
    'screen),\n' +
    '      "setting": "exterior" | "interior" | "unrelated" (unrelated for a setting that has nothing to do ' +
    'with the unit at all, e.g. a home kitchen),\n' +
    '      "unit_framing": string (only for an INTERIOR unit scene — how the store interior is framed in THIS ' +
    'scene: camera angle and height, distance, and which part of the aisle is visible; vary it from scene to ' +
    'scene. Omit it for exterior scenes and when unit_presence is "none": the container\'s camera angle outside ' +
    'is chosen separately),\n' +
    '      "scene_environment": string (the surroundings, season, weather and time of day around this scene\'s ' +
    'subject — specific and different from the neighbouring scenes unless the story needs continuity, generic ' +
    'Canadian but never a named place),\n' +
    '      "contains_food": boolean (does this scene show food, produce, or packaged groceries),\n' +
    '      "is_final_scene": boolean (true only for the actual last scene),\n' +
    '      "visual_state": { "people": number, "hands": string (who this scene\'s visible hands belong to, ' +
    'e.g. "the woman only" or "none visible" — never a hand with no owner), "objects": string[] (visually ' +
    'significant physical objects in frame, a few words each), "new_entities": string[] (the subset of ' +
    'objects genuinely new in THIS scene) } (keep this extremely compact — a few short words per field, ' +
    'omit a field or leave an array empty rather than pad it)\n' +
    '    }\n' +
    '  ]\n' +
    '}\n' +
    `Produce between 4 and 10 scenes whose target_duration_seconds are whole numbers (4-8 seconds each — use ` +
    `enough scenes that none needs more than 8; long single shots loop and drift) that ` +
    `sum to EXACTLY ${opts.targetDurationSeconds} seconds — that is the requested runtime, not a guideline. ` +
    'Plan the story to fit it: a scene\'s narration is written to its own target_duration_seconds later, so ' +
    'make the total right here by giving fewer or shorter beats to a story that needs more room, never by ' +
    'planning a longer total than requested. Never truncate a scene\'s narration_intent, or drop a scene\'s ' +
    'idea early, just to make the numbers add up — adjust the number of scenes instead.\n\n' +
    'The overall video and every individual scene must read as a genuine story or moment from real life — ' +
    'natural pacing, real stakes or feeling — never scripted ad copy, a corporate promo, or a polished ' +
    'commercial, even though it is being produced for marketing use. Every scene\'s setting must also be ' +
    'physically plausible and safe — an ordinary real-world place the action could actually happen (a ' +
    'sidewalk, porch, kitchen table, park, community space, or similar) — never an implausible or unsafe ' +
    'arrangement like people gathered or eating in the middle of an active road, unless the scene idea ' +
    'itself explicitly calls for that exact setup. ' +
    NO_ENTRY_EXIT_RULE +
    ' ' +
    NO_ENTRY_EXIT_NARRATION_RULE +
    ' ' +
    SCENE_VISUAL_FIDELITY_RULE +
    ' Shoot it like a well-made short film, not a slideshow of ' +
    'plain snapshots: vary shot types scene to scene (wide, medium, close-up, low-angle, over-the-shoulder) and ' +
    shortFilmCamera +
    ' this is ' +
    'a production-quality bar every scene should meet, never a directive on what mood or overall style to ' +
    'use, which stays entirely up to the scene idea. If the idea above is brief, expand it creatively into ' +
    'specific, vivid visual detail — concrete actions, objects, and environment — but every detail must still ' +
    'serve that exact idea, never a generic or unrelated addition. Do not invent a prop, vehicle, building, or ' +
    'person that serves no purpose in the story — every significant visual element must have a clear reason ' +
    'to exist; if removing it would not harm the story, do not add it. Maintain natural continuity across ' +
    'scenes that share the same moment, characters, or place — the same people, their clothing, and the ' +
    'setting should carry between consecutive scenes describing that same moment, unless the story moves ' +
    'somewhere new — each scene\'s visual_state should reflect this too: carry forward the previous scene\'s ' +
    'people/objects/location unless the story genuinely moves on, and only list something under ' +
    'new_entities when this scene\'s own action introduces it or it\'s a natural background element, never ' +
    'invented just to make the scene visually interesting. Where your planning above chose a visual motif, let it recur across multiple scenes rather ' +
    'than appearing once and being forgotten — that repetition is what makes the video read as one connected ' +
    'piece rather than a set of unrelated shots. The FINAL scene must land the video on a genuine sense of ' +
    'closure, not cut off mid-action ' +
    "— its action should resolve into a settled, natural concluding beat (a finished gesture, a held look, a " +
    'moment landing) appropriate to the story\'s own scale, never a big staged finale or a jump straight from ' +
    'motion to black.' +
    (opts.sceneNotes
      ? ' Every scene must still serve the creative idea given at the very start of this prompt — never drift ' +
        'into generic brand, mission, or food-desert messaging unless that idea itself genuinely calls for it ' +
        '(a community, place or manifesto idea does call for it), ' +
        'and never force the container into a scene it does not genuinely fit. The container appearing in one ' +
        'scene is never a reason to carry it into a later scene — only include it again if that later scene\'s ' +
        'own idea genuinely calls for it too.' +
        finalSelfCheckClause(brand)
      : '')
  )
}

export interface LocalizeScriptSystemPromptOptions {
  /** Full word ("English"/"French"), not the EN/FR code — reads more
   *  naturally in the instruction itself. */
  language: string
  /** The voice's measured narration rate (db.getMeasuredWordsPerSecond), or
   *  omitted to use the fleet-wide fallback. Must be the SAME rate
   *  localizeScript.ts used to compute each scene's min/max word band, or the
   *  prompt's stated rate and the enforced bands would disagree. */
  wordsPerSecond?: number
  /** The creator's own scene idea (content_jobs.scene_notes), if any. */
  sceneNotes?: string | null
  /** The plan's story spine, when it has one. Without it the prompt is the
   *  same as before the spine existed. */
  spine?: NarrationSpine
  /** First lines of recent videos, so this one opens differently. */
  recentOpeners?: readonly string[]
}

/** Brand-owned clichés for how a video opens and closes (rule G4). */
function narrationOpenersLine(brand: BrandProfile): string {
  const open = brand.narrationBannedOpeners ?? []
  const close = brand.narrationBannedClosers ?? []
  return (
    (open.length > 0 ? ` Never open the video with: ${open.map((o) => `"${o.trim()}"`).join(', ')} (unless the creator's own written copy opens with it).` : '') +
    (close.length > 0 ? ` Never close it with: ${close.map((o) => `"${o}"`).join(', ')}.` : '')
  )
}

function recentOpenersBlock(recent: readonly string[] | undefined): string {
  const list = (recent ?? []).map((r) => r.trim()).filter(Boolean).slice(0, 5)
  if (list.length === 0) return ''
  return (
    ' Recent videos opened with these lines (newest first): ' + list.map((r) => `"${r}"`).join(' | ') +
    '. Open this one differently: another kind of first move, other words, another rhythm.'
  )
}

/** The story the narration is written to tell. Notes for the writer, never wording to copy. */
function storySpineBlock(spine: NarrationSpine | undefined, language = 'English'): string {
  if (!spine) return ''
  const items: [string, string | number | undefined][] = [
    ['the story concept (build everything around this)', spine.concept],
    ['insight', spine.insight],
    ['hook idea', spine.hook],
    ['hook type', spine.hook_type],
    ['framework', spine.framework],
    ["inner life (a person's, a place's or a community's)", spine.inner],
    ['running thread (returns two or three times, never every scene)', spine.thread],
    ['motif', spine.voice === 'promo' ? undefined : spine.motif],
    ['turn', spine.turn],
    ['ending image', spine.ending_image],
    ['line worth quoting (the idea, not wording)', spine.quotable],
    ['it lands in scene', spine.quotable_scene],
  ]
  const lines = items.filter(([, v]) => v !== undefined && String(v).trim() !== '').map(([k, v]) => `${k}: ${v}`)
  if (lines.length === 0) return ''
  return (
    ' STORY SPINE. This is the plan for the whole video; write the narration to tell THIS story, as notes and ' +
    `never wording to copy; the notes may be written in a more literary register than the narration, so restate them in plain spoken words. ${lines.join('. ')}. Each scene also carries story_role (its job in the arc) and ` +
    '"adds" (what its line must carry that the picture cannot show). Rules: the first scene\'s line is the ' +
    'hook: at most 12 words when its word band allows, the key image first, opening a small question the last scene ' +
    'answers. Every line adds something new (a thought, a memory, a worry, a reason); none only describes the picture ' +
    'and no two scenes take the same angle. ' +
    (spine.voice === 'promo'
      ? 'This is a PROMO voiceover: speak to the viewer as "you", never about the lead\'s inner life, and never mention props, colours or small details that only the picture shows. '
      : 'Tell the story\'s inner life (what a person, a place or a community wonders, remembers, feels or lacks) in a calm narrator voice, never as "I" or "we"; if the creator\'s written copy speaks to the viewer, keep that. The motif is named early and comes back near the end in a new form: the same thing, not necessarily the same words. ') +
    'Place the one line worth quoting in its scene: plain, specific ' +
    'and speakable, never a slogan. The last line lands on the ending image as a small concrete moment that matches ' +
    'what the final scene shows. Where a scene\'s picture says it all, use the low end of its word band, but never in ' +
    'more than two scenes, so the video keeps its length.' +
    (language === 'French' ? frenchSpineClause(spine.voice === 'promo') : '')
  )
}

// French keeps the story, not the English sentences (knowledge base §6.3:
// write natively, never translate idioms literally).
const frenchSpineClause = (promo: boolean) =>
  ' FRENCH. Adapt the story, do not translate it word for word. The approved English is the story to keep (same ' +
  'facts, same turn, same feeling); write it as a native speaker would say it aloud, in natural French for a ' +
  'Canadian audience (Canadian vocabulary: faire l\'épicerie, courriel, cellulaire, fin de semaine; never France-only ' +
  'terms), with no anglicisms and no English idiom carried over. ' +
  (promo
    ? 'The voiceover speaks to the viewer with "tu" and "ton/ta/tes" (casual, never "vous"), and never says je, nous or on as the storyteller.'
    : 'The narrator stays in the third person (il, elle, ils; never je, nous or on as the storyteller).') +
  ' Keep the hook short and specific with its key image ' +
  'first. Keep the voice\'s personality and rhythm: recreate the wit, the flow and the observation in French as a ' +
  'Canadian copywriter would write them (joined thoughts, not a row of full-stop slogans), even when the words differ. Keep the motif as the same object or gesture, using the natural French word for it. Do not translate the ' +
  'quotable line literally: write the line that would be quotable in French with the same meaning. Keep the ' +
  'ending image exactly as an image. Fit each scene\'s French word band, which is counted in French words.'
/**
 * The ONLY place video narration wording is produced per language
 * (ARCHITECTURE.MD §4.2 step 6a/§13's n8n mapping table) — takes each
 * scene's language-neutral narration_intent and localizes it, never
 * regenerating the scene plan itself. This is what replaces n8n's "FR —"
 * forced-script-regeneration branch, which is retired entirely, not ported
 * forward (worker/src/steps/video/localizeScript.ts).
 *
 * 2026-09-21: this is the step that ACTUALLY produces what gets voiced —
 * composeVideoScriptSystemPrompt's CAMPAIGN_FIT clause can require a scene's
 * narration_intent to name Fresh-CAN, but this function only ever received
 * that narration_intent and a generic "never sound like a commercial"
 * instruction with zero awareness of that requirement. Given a
 * narration_intent that explicitly calls for naming the brand, "never
 * sound like ad copy" is exactly the instruction that could make this step
 * quietly paraphrase the name away — a real brand-name mention IS the kind
 * of thing that pattern-matches as "sounds promotional." Added an explicit
 * carve-out below so a deliberate brand mention survives localization
 * instead of being softened out by a rule aimed at a different problem
 * (generic ad-copy phrasing, not a specific required name).
 *
 * 2026-09-24: word-budget guidance rewritten after two real jobs showed
 * finished videos landing at ~58% of their requested duration (19.7s from
 * a 36s request; 12.7s from a 24s request) — traced to THIS prompt, not to
 * ElevenLabs, the render step, or anything duration-related downstream.
 * Two compounding causes, both measured directly from real
 * video_scene_audio rows across those 8 scenes: (1) the model was writing
 * only ~72-74% of the word count its own "2.5 words per second" guidance
 * implied it should, and (2) that 2.5wps figure was itself wrong — real
 * ElevenLabs narration for this pipeline measured ~3.1 words/sec, ~25%
 * faster than assumed, so even a scene that DID hit the old word budget
 * would still have landed short. Fixed by raising the stated rate to the
 * measured ~3.1wps and reframing the instruction from an upper bound
 * ("fitting comfortably within") to a target to reach, with an explicit
 * asymmetric-cost explanation (a long scene just holds its last frame a
 * beat longer; a short scene shortens the whole finished video) — the
 * previous wording gave the model no reason to prefer filling the budget
 * over safely undershooting it. This function has no code-level word-count
 * enforcement of its own (no min/max, no truncation) — the entire budget
 * lives in this prose, which is why getting the stated rate right matters.
 * Deliberately NOT touched: synthesizeVoice.ts's own separate
 * WORDS_PER_SECOND=2.5 constant — that one only estimates duration_ms
 * before AssemblyAI's real transcription overwrites it moments later
 * (that file's own header), so it never affects a scene's actual rendered
 * length and fixing it wouldn't have changed either real job's outcome.
 */
export function composeLocalizeScriptSystemPrompt(brand: BrandProfile, opts: LocalizeScriptSystemPromptOptions): string {
  const promo = opts.spine?.voice === 'promo'
  const wordsPerSecond = opts.wordsPerSecond ?? NARRATION_WORDS_PER_SECOND
  return (
    `${brand.missionStatement} Voice: ${brand.voiceGuidelines}${bannedWordsLine(brand)}\n\n` +
    `You are localizing a video's narration into ${opts.language}. You will be given a list of scenes, each ` +
    'with a "narration_intent" (the SEMANTIC content that scene\'s narration should convey — not literal ' +
    `wording) and a target_duration_seconds budget. Write the actual narration wording in ${opts.language} for ` +
    'each scene, writing to fill close to its FULL target duration, and every scene\'s narration_text MUST have between ' +
    'its given min_words and max_words words (a hard requirement, not a suggestion; a scene with previous_narration_off_length ' +
    'must be rewritten to fit that band (longer or shorter), still faithful to its narration_intent) — real measured narration audio for this ' +
    `pipeline runs at roughly ${wordsPerSecond} words per second (multiply that rate by ` +
    'target_duration_seconds for the word count to aim for), noticeably faster than a slow, deliberate ' +
    'voiceover pace. Aim for the middle of the min_words-max_words band and never exceed max_words: a ' +
    'finished video\'s length is the SUM of its scenes\' real narration lengths, so narration that runs long ' +
    'makes the whole video longer than the length that was requested, and narration that runs short makes it ' +
    'shorter — both are real problems, not cosmetic ones. ' +
    `${NO_ENTRY_EXIT_NARRATION_RULE} ` +
    `When a scene carries "approved_english_narration", the creator already approved that English wording: translate ` +
    `it faithfully into ${opts.language} (same meaning, facts and tone), changing it only as much as needed to fit ` +
    'the scene\'s min_words-max_words band, and treat narration_intent as background context only. ' +
    'Each scene also carries "on_screen" (what the viewer sees); narration must never contradict it or mention ' +
    'anything it does not support, but do not just describe the picture: write the whole video as one short ' +
    'spoken story with a small arc (a gentle hook, a turn, a warm landing in the last scene), adding feeling, ' +
    'the character\'s inner moment or a touch of human warmth the viewer cannot see, with varied sentence ' +
    'rhythm and at most one light image or turn of phrase per scene. Never reuse the same descriptive word or ' +
    'phrase (for example an adjective like "juicy", or "the weekend") in two scenes, and let the last line end on a ' +
    'concrete, feeling-led image rather than a summary. State each hard fact (for example that the ' +
    'QR code identifies rather than pays, or that nothing is scanned) once across the whole video, in the scene ' +
    'it fits best, and keep the other scenes free of repeated disclaimers. ' +
    (opts.sceneNotes
      ? `The creator's own idea for this video is: "${opts.sceneNotes}". Narration stays faithful to it. If it contains written voiceover or ad copy, THAT copy is the narration: use ` +
        'its sentences in order and in its own words, one or more per scene, trimming or joining only to fit each scene\'s ' +
        'word band, and let narration_intent show which sentence a scene carries. Its closing line is spoken, as the last ' +
        'thing said, in the final scene. Its own opening may use an opener the brand otherwise bans. Add words of your ' +
        'own only where a band needs filling, in the same voice and about the same premise, never a new dinner, shopping ' +
        'or recipe story. The brand and safety rules below still win (including the entering and exiting rule and ' +
        'the "Fresh-CAN" spelling). Any ' +
        'action it rules out (for example "no scanning") never appears in the wording. '
      : '') +
    'HUMAN VOICE. One unseen storyteller tells the whole video, the way a sharp, warm, observant person would tell it ' +
    'aloud to a friend: a catchy, plain-spoken Reel copywriter, not a poet. The ' +
    (promo
      ? 'storyteller is NOT a character and NOT the company: never say "I", "we", "our", "us" or "my". It speaks ' +
        'to the viewer as "you" (see PROMO VOICE). '
      : 'storyteller is NOT a character and NOT the company: never say "I", "we", "our", "us" or "my", only "he", "she", ' +
        '"they", the people\'s role or relationship, and plain third-person narration. ') +
    'Never quote dialogue (people do not speak on camera). ' +
    (promo
      ? 'PROMO VOICE. This is a punchy social ad voiceover, not a story about a character. Speak to the viewer as ' +
        '"you" and "your". Open with a relatable truth or question about the viewer\'s own moment (the thing they ' +
        'have all felt), then bring Fresh-CAN in as the hero line, said once, with a quick run of what it takes away ' +
        '(no queue, no wait) and what it gives (fresh produce, close by), without explaining how it works. The ' +
        'picture already shows the person: never narrate what they are doing or feeling, and mention them only if a ' +
        'line truly needs it (a funny observation about what is on screen is fine, a description is not). Use ' +
        'rhythm and wit: a short run like "no X, no Y", a playful observation, one line a viewer would quote, and a ' +
        'closing line that calls back to the opening, never an invented tagline or slogan and never "Meet", ' +
        '"Introducing" or "Imagine". '
      : '') +
    'REEL STORY. This is a mini-story people watch to the end on Instagram, not a description. The quality bar is ' +
    'fixed, the shape is NOT: it must hook, give something new on every line, and pay off the hook. Everything ' +
    'else comes from THIS idea. Choose the shape that suits it (a reveal held back until late, a question the ' +
    'video answers, a funny misunderstanding, a quiet confession, a countdown, a before-and-after, a running ' +
    'joke, a single odd observation that grows) and let the people and situation decide the tone and the ending ' +
    '(a laugh, a surprise, a warm beat, a clean stop). Two videos from this brand must never feel like the same ' +
    'story with new nouns: do not default to "problem, then Fresh-CAN solves it, then a smile", do not repeat a ' +
    'stock opening move or a stock closing move, and if your first idea is the obvious one, find the angle ' +
    'nobody would expect from this idea. The Fresh-CAN step is whatever the story naturally needs it to be. Cut ' +
    'any line that only sets a mood. ' +
    'CATCHY. This is a Reel ad people should want to hear twice, so write it the way a sharp copywriter would. ' +
    'Open with the planned hook type as a spoken line: a question about a small familiar annoyance, a number ' +
    'promise ("three of X, one Y", counting only things this story really shows, never a statistic), a confession, a gentle callout, the result first, or a small story opener. Put ' +
    'the most specific image first and make the last line pay the hook off, ideally by calling back to its words ' +
    'or its count. In the body give each line a new small payoff: a relatable habit named exactly, a tiny ' +
    'surprise, an unexpected but plain comparison, or a gentle rule of three. Never let a line merely say what ' +
    'she is doing or thinking ("she picks up an apple, already finding new uses"): say why it is funny, true or ' +
    'tempting. Do not give every scene the same sentence shape (for example "she picks X, thinking Y"). The brand ' +
    'name sits inside a sentence that is about the story ("Fresh-CAN has the apples, and one of them has plans"), ' +
    'never "At Fresh-CAN, she...". End on a short button line that is specific and a little surprising, not a ' +
    'summary. ' +
    'UNDERSTANDABLE. Every line must make sense to a stranger who hears only the narration at scroll speed. Never ' +
    'refer to a prop, colour, object or detail that only the picture shows (no "that yellow clip", "the tote"), ' +
    'never use insider shorthand ("a heel of bread", "a restock"), and never call back to something no earlier ' +
    'line introduced in plain words. Say each idea once: a key phrase (for example "a whole trip") appears at ' +
    'most twice in the whole video, as the hook and as the payoff, and no word is leaned on in four scenes. ' +
    'Avoid "X is for Y, not Z" definitions of the brand and any line that sounds clever but needs decoding. ' +
    'SPECIFIC. Every line states something concrete: who does what, or one specific thought with a detail. Cut ' +
    'vague reflective filler ("that can be the whole reason", "the world passes by", "doesn\'t need to count"). Each ' +
    'scene is a new step: two scenes must never carry the same beat (for example two "she relaxes" lines). The ' +
    'first line is a real hook in 12 words or fewer, a specific and curious situation, never a summary of her mood. ' +
    'REGISTER. Match the narration\'s style to the idea\'s own register. When the creator\'s idea is surreal, poetic, ' +
    'cinematic, epic or documentary, or the creator wrote the voiceover, the narration may be lyrical, use metaphor and ' +
    'vivid imagery, stronger rhythm and longer or shorter lines, and the PLAIN WORDS limits, the one-image-per-scene ' +
    'limit and the 12-word hook below do not apply; the idea\'s premise and the creator\'s own wording come first. ' +
    'PLAIN WORDS. A viewer hears this once, at scroll speed, so every line must be understood on the first listen: ' +
    'the words you would use texting a friend, short common words, one clear idea. No literary or scene-painting ' +
    'imagery (nothing like "a detour", "a bitten strawberry", "leaves drifting"): say what happens or what she ' +
    'thinks in plain terms. Do not narrate props, weather or small objects as symbols. Catchy comes from a clear ' +
    'thought and an easy rhythm, never from fancy vocabulary. The motif and the ending image are said as simply as ' +
    'a person would say them. ' +
    'FLOW. Write for the ear: contractions, everyday words. Let related thoughts run into each other with commas and ' +
    'natural connectors (and, so, but, because, until), and let each line pick up the thought the last one opened, so ' +
    'the video sounds like one person talking, not a row of separate slogans. Vary the rhythm (a longer line, then a ' +
    'short one), keep one idea per line, never a run-on, and do not end every thought with a full stop. ' +
    'PERSONALITY. Where the story invites it, be witty: a specific, plain-worded observation or a small human ' +
    'truth people recognise. Never a joke in every scene, never at anyone\'s expense, never mocking or pitying hardship (an honest barrier, stated plainly and with dignity, is fine). Let the ' +
    'idea choose the tone (playful, heartfelt, surprising or informative), and let a quiet scene stay quiet. Prefer a ' +
    'detail that could only belong to THIS story over any line that could sit in another lifestyle ad; swapping one ' +
    'cliché for another does not fix a vague line. Aim for one line a listener would repeat. ' +
    'HOOK. The first line is part of the visual hook. Silently draft three different openings (a sharp observation, ' +
    'a question, an unexpected statement) and keep the most specific one; do not fall back on a stock formula such as ' +
    '"Breaking news" or "POV" unless the idea itself calls for it. ' +
    'Do NOT write telegraphic fragments, bare lists of items, semicolons or colons, and no ' +
    'more than one "X, not Y" turn in the whole video. A line a listener would have to decode, or a clever line that ' +
    'feels forced, should be said plainly instead; say a feeling plainly rather than inventing a poetic way to put it. ' +
    'When a line needs substance, prefer one specific, concrete detail the viewer cannot see ' +
    '(a thought, a habit, a small worry) over a general statement, and never an abstract noun like ' +
    '"togetherness" or "happiness" where a concrete image would do. narration_intent is NOTES on what to convey, ' +
    'never wording to copy: ignore any instruction-like phrasing in it ("explicitly naming", "clarifying", ' +
    '"preserving") and never recite how the service works unless that scene is genuinely about it. ' +
    `How the service works (${(brand.narrationHardFacts ?? []).map((f) => f.label).join(', ') || 'its mechanics'}) is ` +
    'mentioned in at most one scene of the whole video, briefly and only if the story needs it. Say the brand name once, plainly, inside the story\'s logic as the quiet enabler of its next step, never as an ' +
    'announcement; add no product detail a good line does not need. End the last scene on a small, concrete human moment, never on a slogan, a lesson or the ' +
    `idea's own tagline.${narrationTellsLine(brand, !opts.spine || opts.spine.voice !== 'story')}${narrationOpenersLine(brand)}${storySpineBlock(opts.spine, opts.language)}${recentOpenersBlock(opts.recentOpeners)} Write it as natural spoken narration for a ` +
    'real story, never as scripted ad copy or a voiceover that sounds like a commercial. The one exception: if ' +
    `a narration_intent explicitly calls for naming ${brand.name} (or otherwise references the brand by name), the ` +
    `localized ${opts.language} wording MUST include that name literally, spoken naturally — never paraphrase, ` +
    'translate, soften, or drop it for sounding too promotional; that specific mention is a deliberate, ' +
    'required part of the story, not the generic ad-copy pattern this rule exists to avoid elsewhere. Write the ' +
    `name exactly as "${brand.name}", as a plain standalone name: never possessive ("${brand.name}'s"), never plural, ` +
    'never run into the next word. Speech-to-text hears a possessive plus the next word as a different word. Respond ' +
    'with strictly valid JSON: ' +
    '{ "plan": { "approaches": [string, string, string], "chosen": string, "thread": string }, ' +
    '"scenes": [ { "scene_number": number, "narration_text": string } ] }. Fill "plan" FIRST, in a few plain words each: ' +
    'three genuinely different ways to tell this story aloud, the one you chose (best hook, personality, momentum and ' +
    'ending), and the small running thread it uses. Then write every scene together as one continuous telling, each ' +
    'line growing out of the one before it, and read the whole thing aloud in your head before answering: anything ' +
    'that sounds written, repeated or abstract gets rewritten. When only some scenes are given to rewrite, "plan" may ' +
    'be omitted. Exactly one scenes entry per scene given, in the same order, using the given scene_number values unchanged.'
  )
}

/**
 * ONE text-only review of a finished English narration (knowledge base §10.1,
 * narration dimensions only). It sees the story spine, every line and what
 * each scene shows, and returns scores, auto-fail flags and a few concrete
 * fixes. Never blocks anything: the creator still reads and approves.
 */
export function composeNarrationReviewSystemPrompt(brand: BrandProfile, opts: { language?: string; voice?: 'promo' | 'story' } = {}): string {
  const french = opts.language === 'French'
  const promo = opts.voice === 'promo'
  return (
    (french
      ? 'The narration under review is the FRENCH track of a video whose approved English narration is given as ' +
        '"english_narration" for each scene. Everything below applies to the French lines, and you also judge the ' +
        'adaptation: the hook is still short and specific; the motif, the quotable line and the ending image survive ' +
        'in meaning (a literal translation of a line that only worked in English is a defect); no meaning, fact or ' +
        'turn is lost or added; and it reads as natural spoken French, not translationese or an anglicism. Add ' +
        '"native": 0-10 to scores, and use the kind "mistranslation" for a line that changes the English meaning. ' +
        'The narrator never says je, nous or on as the storyteller.\n\n'
      : '') +
    (promo
      ? 'This video uses the PROMO voice: the voiceover speaks to the viewer as "you", so second person is correct ' +
        'and is never a defect. Judge it as direct-address ad copy: a relatable opening about the viewer, Fresh-CAN ' +
        'as the hero line once, wit and rhythm, and a closing line that calls back to the opening. Narrating what ' +
        'the person on screen does or feels, a recital of how the service works, or an invented tagline are defects. ' +
        'Ignore the third-person and inner-life points below.\n\n'
      : '') +
    'You are a creative QA lead for a warm, community-first Canadian grocery brand. You review the voiceover of ' +
    'a short video against its story plan. You judge the narration only. You will be given the story spine (notes ' +
    'the writer worked from), the brand name, the real facts that may be cited, and every scene with its story_role, ' +
    'what the picture shows ("on_screen"), the narration line and its word band. Be strict and specific: report only ' +
    'defects a listener would notice, and never ask for a change for taste alone.\n\n' +
    'Judge these. (1) Arc: does the narration tell one story, of a person, a group or a place, with a turn and a landing that fits its tone? (2) Each line ' +
    'adds something the picture cannot show (a thought, memory, worry, reason) rather than describing it. (3) The ' +
    'story\'s inner life (a person\'s, a place\'s or a community\'s) comes through naturally. (4) The hook: the first line is specific and ' +
    'the last scene pays it off. (5) MOTIF: the spine\'s motif recurs in meaning, not necessarily in the same words ' +
    '(the same object or gesture, or a clear equivalent, early and again near the end). If it does not return, say ' +
    'which scene should carry it. (6) QUOTABLE: one plain, speakable line worth quoting exists, never a slogan. ' +
    '(7) ENDING: first compare the spine\'s ending_image with the FINAL scene\'s on_screen text and say whether that ' +
    'scene actually shows it; then say whether the final narration line lands on that image as a small concrete ' +
    'moment. (8) Voice and dignity: warm, conversational, no pity, no lecture, no humour at anyone\'s expense. ' +
    '(9) FLOW: it sounds like one person talking, related thoughts joined with commas and connectors, each line ' +
    'picking up the last, not a row of stand-alone full-stop slogans; also not one long run-on. (10) PERSONALITY: a ' +
    'specific, witty or human observation where the story invites it, not a joke in every scene. Judge it against ' +
    'interchangeable lifestyle-ad copy: a line that could sit unchanged in any other grocery or lifestyle ad is a ' +
    'scene_issue, even without a stock phrase. (12) CREATOR COPY: if creator_idea contains written voiceover or a closing line, the narration must keep those ' +
    'sentences in order and in the creator\'s words (adjusted only to fit a word band), and the closing line must be ' +
    'spoken in the final scene; a missing or rewritten creator line is a scene_issue naming the line. Also check the ' +
    'narration stays about the idea\'s own premise, not a literal dinner or shopping story. (11) BRAND FIT: the brand name is said once, inside the story\'s ' +
    'logic as the quiet enabler of the next step, not as an interruption or a feature announcement. The ' +
    'voice is allowed to be playful; never mark wit down. CONTINUITY: each line should grow out of the previous one, ' +
    'and no two scenes should carry the same emotional beat (for example two lines that both say she is relaxing); ' +
    'flag a scene that repeats an earlier beat or reads as an unrelated caption. (12) REEL STORY: would a viewer stay to the end? A hook, something new every line, a payoff; flag lines that ' +
    'only set a mood, and flag a story that follows the generic "problem, Fresh-CAN fixes it, smile" template ' +
    'instead of an angle specific to this idea. (13) PLAIN WORDS: flag any line a listener would not ' +
    'understand instantly at scroll speed: poetic or literary wording, scene-painting imagery, symbolic objects, ' +
    'uncommon words. Fix it with the everyday way to say it.\n\n' +
    'The creator\'s own idea for the video is given as "creator_idea". Anything it states (a time of day, a person\'s ' +
    'job, an everyday detail) is NOT invented, so never flag it; a place name, price, saving, count or claim still ' +
    'fails whatever the idea says. The spine is the writer\'s planning notes, not narration: judge only the words in ' +
    'each scene\'s narration_text.\n\n' +
    'AUTO-FAIL kinds (flag whatever the score): invented_fact (a count of things the video itself shows is not an invented fact, but any other number, price, saving, count, date or place not ' +
    `in the real facts or the creator's idea, which are: ${brand.statistics.length > 0 ? brand.statistics.join(' | ') : 'none'}), ` +
    `fake_testimonial, place_name (any city, province or neighbourhood; "Canada" is allowed), competitor, crossing ` +
    '(someone entering, stepping into, walking out of or exiting the unit), cashier_or_checkout (a cashier, till, ' +
    'queue to pay or per-item scanning), vehicle (a truck, arriving, driving or parking), talking_on_camera ' +
    '(quoted dialogue), contradicts_picture (narration that conflicts with on_screen), hook_unpaid. ' +
    'Also flag the brand name if it is said more than once, or possessively.\n\n' +
    'SCORE STRICTLY, as a copy chief would. A correct, ordinary line is a 5 or 6. Give the hook 8 or more only if a ' +
    'stranger scrolling would stop for it (specific, curious or funny, 12 words or fewer, not a plan summary); ' +
    'memorable_line 8 or more only if you could imagine someone quoting it; personality 8 or more only if there is ' +
    'real wit or a human observation, not just friendly tone. For any score under 7, add a scene_issue with a ' +
    'concrete rewrite for the scene that most needs it. Judge catchiness: lines that only narrate an action or a ' +
    'thought, scenes that all share one sentence shape, and a last line that summarises instead of paying off ' +
    'the hook are defects. Also flag a cryptic reference (a prop or detail only the picture shows, insider shorthand, ' +
    'a phrase repeated across scenes). Every "fix" you write must be plain, conversational and understandable on the ' +
    'first listen: never abstract, never a brand definition, never a clever line that needs decoding.\n\n' +
    'Respond with strictly valid JSON: { "scores": { "arc": 0-10, "adds_meaning": 0-10, "inner_voice": 0-10, ' +
    '"hook": 0-10, "memorable_line": 0-10, "ending": 0-10, "voice": 0-10, "flow": 0-10, "personality": 0-10, ' +
    '"brand_fit": 0-10 }, ' +
    '"motif_returns": { "returns": boolean, "carry_in_scene": number or null }, ' +
    '"quotable": { "present": boolean, "scene": number or null }, ' +
    '"ending_image_in_final_visual": boolean, "last_line_lands_on_ending": boolean, ' +
    '"auto_fail": [ { "scene_number": number or null, "kind": string, "detail": string, "quote": string } ] ' +
    '(quote is REQUIRED: the offending words copied exactly from that scene\'s narration_text; a flag whose quote is ' +
    'not in that line is discarded; only hook_unpaid may have scene_number null and no quote), ' +
    '"scene_issues": [ { "scene_number": number, "problem": string, "fix": string } ] }. ' +
    'List at most four scene_issues, most important first, each with one concrete fix a rewrite can apply within ' +
    'the scene\'s word band; leave the list empty when the narration is good.'
  )
}

export interface AdCopySystemPromptOptions {
  category: string
  /** Resolved text of the job's selected content_angle, or undefined if the
   *  user left it on "let AI decide". */
  angleBrief?: string
  /** The same assembled scene text used to build the accompanying photo
   *  (content_jobs.scene_notes + any clarifying-question answers — see
   *  image.ts's photoScene()) — so the on-image headline/subtitle stay
   *  cohesive with the photo's actual scene instead of guessing an
   *  unrelated take on the topic. Undefined only for a pre-existing job
   *  created before scene_notes became required. */
  scene?: string
}

/**
 * Produces the shared headline/subtitle rendered directly onto an
 * 'infographic'-style image_post photo (see worker/src/steps/image/generateAdCopy.ts)
 * — plus a coreMessage that isn't shown publicly anywhere, but gets folded
 * into composeCaptionSystemPrompt above so the per-language caption stays
 * cohesive with whatever specific idea the headline/subtitle are about,
 * instead of the two being independent, unrelated guesses at the same topic.
 */
export function composeAdCopySystemPrompt(brand: BrandProfile, opts: AdCopySystemPromptOptions): string {
  return (
    brandContext(brand, opts.category) +
    (opts.angleBrief ? `This specific post should focus on: ${opts.angleBrief}\n\n` : '') +
    (opts.scene
      ? `The accompanying photo depicts this specific moment: "${opts.scene}". Base the headline/subtitle/` +
        'coreMessage on this same moment, not a generic restatement of the topic or category.\n\n'
      : '') +
    'You are an ad copywriter preparing the text that will be rendered directly onto a social image, plus a ' +
    'creative brief for whoever writes its caption. Respond with strictly valid JSON matching this exact ' +
    'shape: { "headline": string (max 6 words, punchy, spelled exactly as you want it rendered on the ' +
    'image), "subtitle": string (2-5 words, a short supporting line under the headline), "coreMessage": ' +
    'string (one sentence describing the specific idea, story, or moment this post is about) }. The ' +
    'headline and subtitle are the ONLY text that will be rendered onto the image itself — keep them short ' +
    'enough to read at a glance and free of typos. coreMessage is never shown to the public; it only guides ' +
    'the caption writer.'
  )
}
