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
    'self-contained, walk-in store built inside a converted shipping container mounted on a box truck — ' +
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
      'A white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The white "Fresh ' +
      '[maple leaf icon] CAN" wordmark appears once, centered, on each side panel — nowhere else on the ' +
      'vehicle.',

    // Complete structural rule set — used when the unit is a featured subject.
    // Every face named explicitly (front/side/rear), not left to an implied
    // "nowhere else" — see docs/PROMPT_ARCHITECTURE.md for why that
    // specificity matters here.
    full:
      'The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container ' +
      'mounted on back. The cab is plain white and unbranded; all branding is on the container only. The ' +
      'white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of ' +
      'the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the ' +
      'rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR ' +
      'panel beside the door. The front face and both side panels are ' +
      "solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass " +
      'double door flush at bumper height, reached straight from the ground — which is the only entrance and ' +
      'the only place customers are ever served.',

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
    'No door, hatch, service window, vent, or fixture of any kind on the front face or either side — the ' +
      'rear glass double door is the only entrance and only opening, on any face.',
    'No wordmark, logo or signage on the front or rear faces — the wordmark appears exactly once ' +
      'per side panel, nowhere else on the vehicle. The only addition allowed is the one small white square QR ' +
      'panel on the rear face beside the door.',
    'No other text, graphics, decals, stripes, URLs, or QR panels anywhere on the unit (the single rear-face QR panel excepted).',
    'The cab is plain white and completely unbranded.',
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
    'Photorealistic. Keep the vehicle\'s real signage/logo exactly as shown in the reference photo, unaltered. ' +
    "The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have " +
    'blank fronts — pure photography only.',

  ctaBarText: 'Visit fresh-can.com',

  // From the real FreshCAN Brand Guidelines doc: typeface is Manrope; the
  // CTA/header bars use the brand's near-black Charcoal (hex #1F1F1F), not a
  // generic "dark" tone.
  typographyDescriptor:
    'Manrope or a very similar clean, modern, geometric sans-serif typeface — bold weight for the headline, ' +
    'semi-bold weight for the subtitle, never cursive, never script, never a serif font.',
  // Maroon sampled from the real truck container photos in assets/fresh-can/
  // (~#6B1A1A) — swap the hex here if the official guideline value differs.
  // The image clause is what scene-image prompts carry; the video clause is
  // deliberately short (sceneVideo has a tight character budget).
  sceneGuard: {
    image: 'Self-serve store, not a market: no staff serving, no crates or produce outside.',
    video:
      ' Self-serve and cashierless: never show staff serving, hand-overs of goods, outdoor produce stands, or ' +
      'a service window.',
  },
  appUi: {
    imageClause:
      'Fresh-CAN app phone screens are ONLY maroon (#6B1A1A) and white: white background, maroon header, ' +
      'buttons, icons and QR code; no other colors, gradients or dark mode; little text. One screen, on the ' +
      'phone\'s front only.',
    videoClause:
      ' Any phone screen showing the Fresh-CAN app stays strictly maroon (#6B1A1A) and white in every frame — ' +
      'never red, green or any other UI color. The phone has one screen, on its front only; its plain back faces ' +
      'what is scanned.',
  },
  // How the speech-to-text step tends to mis-hear the brand's second word
  // (real job f63f3f5c captioned "Fresh Khan"); used only to repair captions.
  asrMishearings: ['khan', 'kan', 'kahn', 'cann', 'cahn'],
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
  // assets/fresh-can/. One is picked per image (hero/inline/photo pick
  // independently) — `whatItShows` must accurately describe what that
  // specific photo shows, since the image adapter edits from it; `disregard`
  // lists every real-but-non-canonical element that specific photo shows, so
  // nothing is left for the model to notice and try to faithfully reproduce.
  // The side profile is listed FIRST because composeCharacterRefPrompt always
  // uses referenceImages.exterior[0]. These three are retouched (2026-10-10)
  // so nothing real-but-non-canonical remains in frame: no extra wordmarks,
  // QR panel, URL text, vents or graphic wave, and no door anywhere but the
  // rear — hence empty `disregard`. Each entry carries its `view`; video
  // scenes pick by the planner's `unit_view` (compose.ts pickExteriorByView).
  // Both rear photos (_clean_2) show the single entry QR panel beside the door.
  referenceImages: {
    exterior: [
      {
        view: 'side',
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/truck_exterior_side_clean.png',
        whatItShows:
          'Camera positioned directly to the side of the truck, a full profile view of the whole container ' +
          'and the white cab: both side panels are one solid, unbroken corrugated maroon wall carrying a ' +
          'single "Fresh CAN" wordmark — reproduce that exact wordmark faithfully, once.',
        disregard: [],
      },
      {
        view: 'rear34',
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/truck_exterior_rear34_clean_2.png',
        whatItShows:
          'Camera positioned behind and to the side of the truck, a rear three-quarter view: the glass double ' +
          'door and one small white square QR panel to its right are on the rear face only (the rear face ' +
          'carries no wordmark), while the long side panel stays solid maroon with a single "Fresh CAN" ' +
          'wordmark and no opening of any kind.',
        disregard: [],
      },
      {
        view: 'rear',
        url: 'https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/truck_exterior_rear_clean_2.png',
        whatItShows:
          'Camera positioned directly behind the truck, straight-on, facing the rear entrance: a black-frame ' +
          'glass double door, plain unbranded maroon on either side of it, and one small white square QR panel ' +
          'on the rear face to the right of the door (as seen from behind) — reproduce that single panel once.',
        disregard: [],
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
    ],
  },
}
