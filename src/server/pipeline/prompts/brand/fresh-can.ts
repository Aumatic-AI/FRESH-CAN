// THE ONE FILE TO SWAP PER CLIENT. To rebrand for another company: copy this
// file to brand/<new-brand>.ts with that brand's own unit/referenceImages,
// then change the one import in prompts/index.ts. Nothing else needs to
// change.
//
// Structured data only — no assembled prose, no per-category or per-angle
// creative direction. See docs/PROMPT_ARCHITECTURE.md for the full layer
// model, the corrected business-model facts this file encodes, and the
// incident history behind the specific rules below (door/hatch/wordmark
// defects, reference-photo corrections, etc.) — this file keeps only the
// current rule, not the archaeology of how it was found.
import type { BrandProfile } from '../types'

export const BRAND_PROFILE: BrandProfile = {
  name: 'Fresh-CAN',

  missionStatement:
    'Fresh-CAN is a Canadian company operating autonomous, cashierless mobile grocery stores — each a ' +
    'self-contained, walk-in store built inside a converted shipping container that stands on its own — ' +
    'bringing fresh fruit, vegetables, and everyday food staples directly to streets and communities across ' +
    'Canada. Customers find the nearest unit through the free Fresh-CAN app; on a first visit they register ' +
    'and link a payment card, and on every visit after that they simply scan their app QR code to enter, ' +
    'take what they need off the shelves, and walk out. In-store AI, cameras, and shelf sensors register ' +
    'what was taken, and the linked card is charged automatically — no cashier, no checkout counter, no ' +
    'till, no queue.',

  neutralIdentityLine:
    'Fresh-CAN operates autonomous, cashierless mobile grocery units — self-contained stores built inside ' +
    'converted shipping containers, found through the free Fresh-CAN app. Customers scan an app QR code to ' +
    'enter, take what they need, and walk out, with payment handled automatically by their linked card.',

  voiceGuidelines:
    'Warm, hopeful, community-driven — never corporate. Highlight real people, local farmers, and ' +
    'communities; frame technology as serving people, not the other way around. Write in third person only ' +
    '— never "we", "our", or "us"; always "Fresh-CAN", "the app", or "the team". Use Canadian spellings ' +
    '(neighbourhood, colour, organise, prioritise, centre, realise). Never name, reference, hint at, or ' +
    'compare to any other retailer or product, positively or negatively — no competitor names, ever. Never ' +
    'name a specific Canadian city, town, neighbourhood, or province as a setting or example (e.g. Toronto, ' +
    'Vancouver, Ontario) — "Canada" is the only place name to use. Leave the reader feeling hopeful, not ' +
    'lectured.',

  // Everyday, family-friendly dress for every person in every image (see core/compose.ts and
  // the image validator): fully covered, nothing revealing.
  dressRule: 'Everyone is modestly dressed in fully covering everyday clothes.',

  narrationTells: [
    'hearts sink',
    'heart sinks',
    'heart sank',
    'relieved smile',
    'relieved smiles',
    'keeps essentials close',
    'keeps everyday essentials close',
    'essentials close',
    'close to home',
    'more room for',
    'less stress',
    'togetherness',
    'just in time',
    'laughter, and',
    'every bite',
    'a taste of',
    'plans change',
    'meant for nobody else',
    'for nobody else',
    // Generic lifestyle-ad language (knowledge base §6A.4; the owner's list)
    'fuss', 'agenda', 'vibe', 'little moment', "life's little pleasures", 'main character energy',
    'a whole new level', "it's the little things", 'more than just', 'because you deserve it',
    'fresh feels', 'making memories', 'make memories', 'treat yourself', 'hits different',
    "chef's kiss", 'a breath of fresh air', 'best life', 'next level',
    // Literary / scene-painting words that are not Reel-easy
    'detour', 'drift', 'bitten', 'linger', 'whisper', 'glimmer', 'cascade', 'tapestry', 'symphony', 'unfold',
    'savour', 'amble', 'wander', 'dappled', 'golden hour', 'bathed in', 'kissed by',
    // French
    'petits plaisirs', 'une nouvelle dimension', 'parce que vous le méritez', 'parce que tu le mérites',
    'créer des souvenirs', 'sans tracas', 'sans chichi', "ce sont les petites choses", 'plus qu’un simple',
    "plus qu'un simple", 'un vent de fraîcheur',
  ],
  // Fine in the "story" voice (relationships, community, place); only the promo ad voice bans them.
  narrationTellsAllowedInStory: [
    'close to home', 'more room for', 'togetherness', 'just in time',
    // Imagery a surreal, poetic or documentary idea may need (the promo ad voice still bans them).
    'detour', 'drift', 'linger', 'whisper', 'glimmer', 'unfold', 'wander', 'savour', 'dappled', 'golden hour',
  ],
  narrationVaguePhrases: [
    'the whole reason', 'to count', 'world go by', 'world pass', 'watches the world', 'nothing needs',
    'for once', 'simply because', 'quite happy', 'wants one thing after another', 'what happens after',
    'something passing', 'already finding', 'already thinking', 'looking forward to', 'no particular reason', 'nowhere to be', 'all that matters',
    // French
    'tout simplement parce que', 'regarde le monde', 'pour une fois', 'nulle part où être',
  ],
  narrationAbstractNouns: [
    'happiness', 'joy', 'togetherness', 'freshness', 'memories', 'connection', 'belonging',
    'bonheur', 'joie', 'fraîcheur', 'souvenirs', 'convivialité',
  ],
  narrationBannedOpeners: [
    'in a world where', 'imagine', 'meet ', 'introducing', 'picture this',
    // French
    'dans un monde où', 'imaginez', 'imagine ', 'découvrez', 'faites connaissance', 'voici ',
  ],
  narrationBannedClosers: [
    'fresh food, for everyone',
    'freshness delivered',
    'because everyone deserves',
    'fresh food for everyone',
    // French
    'des aliments frais pour tous', 'la fraîcheur livrée', 'parce que tout le monde mérite', 'parce que chacun mérite',
  ],
  narrationForbiddenTerms: [
    'truck', 'trucks', 'wheels', 'trailer', 'cashier', 'cashiers', 'driver',
    // French
    'camion', 'camions', 'roues', 'remorque', 'caissier', 'caissière', 'caissiers', 'chauffeur',
  ],
  // Each hard fact about how the service works is stated once per video, in
  // the scene it fits best — never recited scene after scene.
  narrationHardFacts: [
    { label: 'payment', pattern: '\\b(?:pay|pays|paid|payment|charged|billing|checkout|card|paiement|payer|payé|carte|caisse|facturé)\\b' },
    { label: 'the QR scan', pattern: '\\b(?:scan|scans|scanned|scanning|qr|reader|scanne|scanner|lecteur)\\b' },
    { label: 'the account', pattern: '\\b(?:account|registered|register|sign(?:ed)? up|compte|inscri\\w*)\\b' },
  ],
  bannedWords: [
    'seamlessly',
    'effortlessly',
    'revolutionize',
    'game-changer',
    'cutting-edge',
    'innovative solution',
    "in today's world",
    'imagine a world where',
  ],

  // Real, verified stats — cite verbatim if relevant, never paraphrase into
  // a different number, never force one into an unrelated topic. The 2018
  // figure is dated; flagged for owner review (PROMPT_REFACTOR_BRIEF.md §16.7).
  statistics: [
    'roughly one in five Canadians lives in a food desert region',
    'one in eight Canadian households experienced food insecurity as of 2018',
    '54% of First Nations people living on reserve face food insecurity',
    'only about one in four food-insecure households uses a food bank',
  ],

  // The real, step-by-step customer journey — the ground truth for any
  // "how it works" content. Get this exactly right: the QR code identifies
  // who is entering, it is never a payment QR and never a per-item scan.
  journey: [
    'First visit only: the customer registers in the Fresh-CAN app and links a payment card — payment is ' +
      'set up once, in advance, never at the unit itself.',
    "Every visit: the customer scans their app QR code at the door reader to enter — this identifies who " +
      'is entering; it is not a payment QR and not a per-item scan.',
    'Inside, the customer takes items off the shelves into a basket or their own bag — in-store AI, ' +
      'cameras, and shelf/weight sensors register what was taken; there is no scanning of individual items.',
    'The customer walks out — the linked card is charged automatically. No billing, no line, no scanning ' +
      'at exit.',
  ],

  positiveVisualTruths: [
    'Entry (outside only): a small white square QR panel on the rear face, beside the rear door; a customer stands beside it holding up a phone — never shown stepping in.',
    'Inside: a narrow single aisle, realistic occupancy (typically 1-3 people), shelves and glass-door ' +
      'fridges, unobtrusive ceiling cameras/sensors.',
    'Exit (outside only): a customer already outside, standing or walking near the unit with their items — never shown stepping out.',
    'Produce and packaged goods always look clean, fresh, tidy, and appetising.',
  ],

  // What this business is NOT — atomic, visual, non-negotiable. Enforced in
  // every visual prompt path, not just ones that feature the unit, since a
  // scene can misrepresent the business model without the unit ever
  // appearing (e.g. a generic market-stall or cashier scene).
  businessModelNegatives: [
    'Not an open-air market, farmers\' market stall, produce stand, or pop-up tent.',
    'Not a food truck, canteen, or service-window vendor — customers are never served through a window or ' +
      'hatch.',
    'Never a truck, cab, wheels, trailer, chassis or any vehicle — the unit is only a standalone shipping ' +
      'container resting on the ground, never driving, parked as a vehicle, hauled or loaded onto a vehicle.',
    'Not a freight/transport/logistics operation — the unit is never shown as cargo being hauled, loaded ' +
      'onto another vehicle, or sitting in a depot/warehouse yard as freight.',
    'Not a food bank or charity handout line — Fresh-CAN is a paid, autonomous retail store, not free food ' +
      'assistance.',
    'Never claim a specific store count, city, launch date, or price that is not in the brand facts above.',
    'Never name, reference, hint at, or compare to any other retailer, product, or brand — no competitor ' +
      'mentions, ever.',
  ],

  unit: {
    // Minimum recognisable descriptor — background/incidental appearances only.
    identity:
      'A standalone deep maroon (#6B1A1A) corrugated steel shipping container resting on the ground, with no ' +
      'truck, cab or wheels. The white "Fresh [maple leaf icon] CAN" wordmark appears once on each long side ' +
      'panel — nowhere else on the container.',

    // Complete structural rule set — used when the unit is a featured subject.
    // Every face named explicitly (front/side/rear), not left to an implied
    // "nowhere else" — see docs/PROMPT_ARCHITECTURE.md for why that
    // specificity matters here.
    full:
      'The Fresh-CAN mobile grocery store: a standalone deep maroon (#6B1A1A) corrugated steel shipping ' +
      'container resting on the ground, with no truck, cab, wheels, trailer or chassis. It has two long side ' +
      'panels and two end faces. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears ' +
      'once on each of the two long side panels — nowhere else on the container. Both long side panels are ' +
      'solid, unbroken corrugated maroon steel. One end face is plain solid maroon with no wordmark. The other ' +
      "end face holds the container's only opening — a black-frame glass double door flush at ground level, " +
      'reached straight from the ground, with one small white square QR panel beside it — which is the only ' +
      'entrance and the only place customers are ever served.',

    // Same rules as `full`, said once each.
    sceneCompact:
      'The Fresh-CAN mobile grocery store: a standalone deep maroon (#6B1A1A) corrugated steel shipping ' +
      'container on the ground — no truck, cab or wheels. The white "Fresh [maple leaf icon] CAN" wordmark, ' +
      'never distorted, appears once on each long side panel and nowhere else. Both long side panels are ' +
      'solid, unbroken maroon steel with no opening; one end face is plain maroon; the other end face holds ' +
      'the only opening, a black-frame glass double door at ground level, plus one small white square QR panel ' +
      'beside it and no wordmark. That door is the only entrance and the only place customers are served. ' +
      'Never place the wordmark or logo on any other object.',

    proportions:
      'The container is long and low, roughly twice as long as it is tall — never a cube or a tall box — ' +
      'and it rests directly on the ground with no truck, cab or wheels anywhere.',

    interior:
      'The interior of the Fresh-CAN mobile grocery store: a narrow aisle inside the shipping container ' +
      'with light grey wood-look laminate flooring and bright overhead fluorescent lighting. Black wire ' +
      'shelving units on one side of the aisle, stocked with bagged snacks and packaged groceries. ' +
      'Black-framed glass-door refrigerated cases on the other side, each topped with a deep maroon (#6B1A1A) header sign ' +
      'bearing a white "Fresh [maple leaf icon] CAN" wordmark, stocked with beverages and fresh salad ' +
      'containers (plain, unlettered). A stainless steel prep ' +
      'counter and sink — a fixed utility fitting, never a checkout or point-of-sale — at the far end of the ' +
      'aisle, with no door in view.',

    wordmarkText: 'Fresh CAN',
  },

  forbiddenOnUnit: [
    'No door, hatch, service window, vent, or fixture of any kind on either long side or the plain end — the ' +
      'glass double door on the one door end is the only entrance and only opening.',
    'No wordmark, logo or signage on either end face — the wordmark appears exactly once ' +
      'per long side panel, nowhere else on the container. The only addition allowed is the one small white ' +
      'square QR panel on the door end beside the door.',
    'No other text, graphics, decals, stripes, URLs, or QR panels anywhere on the unit (the single door-end QR panel excepted).',
    'No truck, cab, wheels, trailer, chassis or vehicle of any kind — the container rests directly on the ground.',
    'Colour and structure identical in every appearance — always this exact maroon (#6B1A1A), wordmark never ' +
      'distorted.',
    'Never place the Fresh-CAN wordmark or logo on any other vehicle, sign, storefront, building, or object.',
  ],

  forbiddenInScene: [
    'No cashier, staff member serving customers, checkout counter, cash register, POS terminal, card ' +
      'machine, receipt printer, barcode scanner, price gun, or cash/coins visible.',
    'No queue or line of people waiting to pay.',
    'No shopping trolleys or carts — baskets or reusable bags only, the interior aisle is narrow.',
    'Never a specific Canadian city, town, neighbourhood, or province visually identified — no landmarks, ' +
      'no provincial flags, no recognisable skylines; "Canada" is the only place identity.',
  ],

  noTextInstruction:
    'Photorealistic. Absolutely no text, no words, no letters, ' +
    'no captions, no titles, no logos, no watermarks, no typography anywhere in the image — pure photography only.',

  noNewTextInstruction:
    'Photorealistic. Keep the container\'s real signage/logo exactly as shown in the reference photo, unaltered. ' +
    "The only lettering in frame is the container's own signage; packaging, labels, and shopping bags have " +
    'blank fronts — pure photography only.',

  ctaBarText: 'Visit fresh-can.com',

  // From the real FreshCAN Brand Guidelines doc: typeface is Manrope; the
  // CTA/header bars use the brand's near-black Charcoal (hex #1F1F1F), not a
  // generic "dark" tone.
  typographyDescriptor:
    'Manrope or a very similar clean, modern, geometric sans-serif typeface — bold weight for the headline, ' +
    'semi-bold weight for the subtitle, never cursive, never script, never a serif font.',
  // Maroon sampled from the real container photos in assets/fresh-can/
  // (~#6B1A1A) — swap the hex here if the official guideline value differs.
  // The image clause is what scene-image prompts carry; the video clause is
  // deliberately short (sceneVideo has a tight character budget).
  sceneGuard: {
    image: 'Self-serve store, not a market: no staff serving, no crates or produce outside.',
    video:
      ' Self-serve and cashierless: customers pick up their own items from the shelves inside; all goods ' +
      'stay in the store.',
  },
  appUi: {
    imageClause:
      'Fresh-CAN app phone screens are ONLY maroon (#6B1A1A) and white: white background, maroon header, ' +
      'buttons, icons and QR code; no other colors, gradients or dark mode; little text. One screen, on the ' +
      'phone\'s front only.',
    videoClause:
      ' Any phone screen showing the Fresh-CAN app stays strictly maroon (#6B1A1A) and white in every frame — ' +
      'white background, maroon header, buttons and icons. The phone has one screen, on its ' +
      'front only; its plain back faces what is scanned.',
  },
  // How the speech-to-text step tends to mis-hear the brand's second word
  // (real job f63f3f5c captioned "Fresh Khan"); used only to repair captions.
  asrMishearings: ['khan', 'kan', 'kahn', 'cann', 'cahn', 'kans', 'kansis', 'cans', 'cansis'],
  ctaBarColorDescriptor: 'a solid charcoal-black band, similar to hex #1F1F1F',

  // Fallback ONLY — real ElevenLabs voice IDs, used by synthesizeVoice.ts
  // solely when a job has no per-job voiceIdOverride. Every real job carries
  // its own selected voice on content_jobs.voice_id_en/voice_id_fr (picked
  // from src/lib/videoVoices.ts's VIDEO_VOICES list via the dashboard's
  // VoiceCardGroup picker), always preferred over these two IDs when present.
  videoVoiceIds: {
    EN: 'epkQ8pqDcY2DxhmFi8xl',
    FR: 'n2pCwUKS6q9Iur03Rten',
  },

  // Uploaded to the public brand-assets Supabase bucket from
  // assets/fresh-can/. One is picked per image — `whatItShows` must
  // accurately describe what that specific photo shows, since the image
  // adapter edits from it; `disregard` lists every real-but-non-canonical
  // element it shows. The exterior is ONE container-only photo used as an
  // identity anchor: scenes may frame the container from any angle, so the
  // structure rules in `unit.full` (which faces carry what) cover the sides
  // this photo does not show.
  referenceImages: {
    exterior: [
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/container_1.png',
        whatItShows:
          'A standalone red shipping container resting on the ground, seen from a front three-quarter angle: ' +
          'the end face on the left with the black-frame glass double door, one small white square QR panel ' +
          'beside the door, two small floodlights at the top corners and a small white sensor box centred above ' +
          'the door; the long side panel on the right is one solid, unbroken corrugated wall carrying a single ' +
          'white "Fresh [maple leaf icon] CAN" wordmark — reproduce that exact wordmark faithfully, once. There is no truck, ' +
          'cab or wheels. Use it only for the container\'s design, never its angle, background or lighting.',
        disregard: [
          'the glass office building, trees, hedges and paved plaza behind the container',
          'the photo\'s brighter, sun-lit red: the container\'s true colour is the brand maroon (#6B1A1A)',
          'the particular goods visible through the glass door',
        ],
      },
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/container_2.png',
        whatItShows:
          'The same container from the opposite front three-quarter angle: the long solid wordmark side fills ' +
          'the left and centre, and the door end is on the right with its black-frame glass double door, the ' +
          'small white QR panel beside the door, two small floodlights at the top corners and the small white ' +
          'sensor box above the door. One white "Fresh [maple leaf icon] CAN" wordmark on the long side, reproduced faithfully, ' +
          'once. No truck, cab or wheels. A design guide only, never its angle, background or lighting.',
        cameraFace: 'door-end-3q',
        disregard: [
          'the trees, glass building, hedges, paving and dappled shadows around the container',
          'the photo\'s brighter, sun-lit red: the container\'s true colour is the brand maroon (#6B1A1A)',
          'the particular goods visible through the glass door',
        ],
      },
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/container_3.png',
        whatItShows:
          'The door end seen straight-on at ground level: the black-frame glass double door with two black pull ' +
          'handles centred in a plain end face, two small floodlights at the top corners and a small white ' +
          'sensor box above the door; no wordmark on this face. The small white QR panel beside the door is not ' +
          'visible in this photo but still belongs there. No truck, cab or wheels. A design guide only, never its ' +
          'angle, background or lighting.',
        cameraFace: 'door-end-straight',
        disregard: [
          'the glass buildings, trees, hedges and paved plaza behind the container',
          'the photo\'s brighter, sun-lit red: the container\'s true colour is the brand maroon (#6B1A1A)',
          'the particular goods and plants visible through the glass door',
        ],
      },
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/container_4.png',
        whatItShows:
          'The long side seen straight-on: one solid, unbroken corrugated deep-maroon wall with a single centred ' +
          'white "Fresh [maple leaf icon] CAN" wordmark, reproduced faithfully, once, and two dark rectangular forklift pockets ' +
          'along the bottom rail; no door or opening on this side. No truck, cab or wheels. A design guide only, ' +
          'never its angle, background or lighting.',
        cameraFace: 'long-side-straight',
        disregard: ['the glass buildings, trees, hedges and paved plaza behind the container'],
      },
    ],
    interior: [
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/freshcan_interior_1.png',
        whatItShows:
          'Camera positioned near the entrance looking straight down the aisle toward the white door at the ' +
          'far end, wire shelving on the left and glass-door refrigerated cases on the right receding into ' +
          'the distance.',
        disregard: [],
      },
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/freshcan_interior_2.png',
        whatItShows:
          'Camera positioned further down the aisle, close to the refrigerated cases, with the glass-door ' +
          'fridges and their red Fresh CAN header signs filling most of the frame on the left and a ' +
          'stainless sink and counter visible near the white door ahead.',
        disregard: [],
      },
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/freshcan_interior_3.png',
        whatItShows:
          'Camera just inside the entrance looking straight down the aisle toward a plain white door at the far ' +
          'end: black metal shelving with wood-tone shelves on both sides stocked with bagged and jarred ' +
          'groceries, a rustic wood-clad counter at the left front, wooden crates of fresh produce on the ' +
          'right, trailing green plants on top of the shelves, strip lights and a wall-mounted air-conditioning ' +
          'unit on the ceiling, and a warm wood-look floor.',
        disregard: [
          'the edges of the glass entrance doors and their black handles at both sides of the frame',
          'the exact packaged goods, labels and brands on the shelves: fill shelves with plain, unlettered goods',
          'the warm golden tint of the lighting',
        ],
      },
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/freshcan_interior_4.png',
        whatItShows:
          'Camera inside the aisle looking toward a plain white door at the far end: black metal shelving with ' +
          'wood-tone shelves on both sides stocked with bagged snacks, jars and cardboard boxes, trailing plants on ' +
          'top of the shelves, strip lights and a wall-mounted air-conditioning unit on the ceiling, and a ' +
          'wood-look floor.',
        disregard: [
          'the red "Fresh CAN" lettering on the right-hand wall: never reproduce wall lettering or any sign',
          'the small watermark in the top-right corner',
          'the sun-dappled leaf shadows on the wall and the exact packaged goods and labels',
        ],
      },
      {
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/freshcan_interior_5.png',
        whatItShows:
          'A close-up of one stocked shelf bay with no aisle in view: black metal frame, wood-tone shelves lit by ' +
          'a warm strip under the shelf above, glass jars of sauce, pesto, pasta and legumes, plain kraft paper ' +
          'pouches, a wicker basket, cardboard boxes and a trailing green plant. Use it for the texture and ' +
          'feel of the shelving and goods, not as a composition.',
        disregard: [
          'the specific jars, pouches and products: fill shelves with plain, unlettered goods',
          'the under-shelf glow and the shallow close-up framing',
        ],
      },
    ],
  },
}
