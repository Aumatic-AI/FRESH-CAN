# Video job d289e3af-d6c8-47ad-8180-cee11f1ddf5a — full pipeline data

## 1. User input (content_jobs)

- **topic**: test 2
- **category**: Behind the Mobile Unit
- **brand**: Fresh-CAN
- **target_audience**: General public
- **language**: EN
- **content_types**: ['video']
- **aspect_ratio**: 9:16
- **video_duration_seconds**: 32
- **image_style**: photo
- **voice_id_en**: epkQ8pqDcY2DxhmFi8xl
- **voice_id_fr**: n2pCwUKS6q9Iur03Rten
- **status**: ready
- **created_at**: 2026-10-13T04:25:29.254684+00:00
- **completed_at**: None
- **credential_pins**: {'kie': 'default', 'openai': 'default', 'assemblyai': 'default', 'elevenlabs': 'default', 'upload_post': 'default'}

**scene_notes (the brief the user typed):**

> A resident walks past a FreshCAN mini-market unit every day without noticing it. One evening, they stop, scan the QR code, and discover how easy it is to shop for everyday essentials right in their building. Show the maroon unit, the doors opening, colorful products on the shelves, and the resident leaving with a few groceries. A simple, modern marketing video focused on convenience and everyday discovery.

## 2. Layer 1 — interpret_intent (OpenAI)
```json
{
 "intent": "Create a simple, modern marketing video that turns a resident's everyday walk past a Fresh-CAN unit into an evening discovery of convenient grocery shopping.",
 "audience": "General public, especially residents who value convenient grocery shopping close to home.",
 "coreMessage": "Everyday essentials can be closer and easier to shop for than you realize, with a Fresh-CAN mobile store near home.",
 "improvements": "Strengthen the unnoticed-to-discovered contrast with the resident's repeated walk past the same maroon unit, followed by an evening pause to notice its stocked shelves. Establish first-visit registration and payment-card linking in the app before the resident scans their app QR code at the door reader; that scan identifies them for entry, not payment. Interpret the requested convenience 'right in their building' as shopping immediately outside their building in the truck-mounted, walk-in store, rather than inventing an indoor store location. Convey the requested doors-opening beat between scenes: end outside beside the unit, cut to shopping inside, then cut outside with the resident already carrying a few groceries. Inside, show them selecting colorful everyday essentials without individual item scanning; their linked card is charged automatically when they leave.",
 "emotionalTone": "Understated, modern, relatable, and pleasantly surprising.",
 "unitRelevance": {
  "value": "central",
  "rationale": "The resident's discovery of the mobile unit and their first shopping experience are the entire focus of the idea."
 },
 "desiredResponse": "Viewers should notice Fresh-CAN as a convenient shopping option and feel encouraged to find their nearest unit through the free app.",
 "constraintsFromAdmin": "Topic: test 2. Category: Behind the Mobile Unit. Audience: General public. Preserve the resident walking past the unit every day without noticing it, the evening stop and QR-code entry, the discovery of easy shopping for everyday essentials, the maroon unit, colorful products on shelves, and the resident leaving with a few groceries. Preserve the intended near-home convenience expressed as 'right in their building,' with the physical placement clarified above. Preserve the doors-opening beat through an off-screen transition, not a visible crossing. Keep the video simple and modern, focused on convenience and everyday discovery."
}
```

## 3. Layer 2 — generate_script (OpenAI)

### duration_seconds
```json
32
```
### visual_description
```json
"Topic: test 2. Category: Behind the Mobile Unit. Audience: General public. A simple, modern neighbourhood story uses repeated framing to turn an overlooked maroon, truck-mounted container store into an evening discovery. The same resident passes it on successive days, then pauses, prepares the app, scans her app QR code and shops among colourful everyday essentials. The doors-opening beat happens off-screen between the exterior and interior scenes. The final exterior scene finds her already carrying groceries beside her own building, making the near-home convenience tangible without suggesting an indoor store location. No graphic or logo reveal appears."
```
### story
```json
{
 "arc": "An evening pause breaks the routine; she registers, links a card and scans her app QR code before discovering the stocked interior.",
 "cta": null,
 "hook": "A resident repeatedly passes a grocery store immediately outside her building without noticing it.",
 "resolution": "She has a few everyday groceries, payment is handled automatically, and her building is only a few steps away."
}
```
### look
```json
{
 "palette": "The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and plain grocery packaging. App screens are exclusively deep maroon and white.",
 "lighting": "Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery.",
 "time_of_day": "Two successive daytime passes followed by one continuous early-evening visit.",
 "camera_language": "Locked-off static shots throughout. Repeat the opening wide composition, then vary medium, rear-view and interior framing as the resident begins paying attention.",
 "style_direction": "Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or readable product labels."
}
```
### locations
```json
[
 {
  "id": "building_forecourt",
  "description": "A residential building's paved pedestrian forecourt, with the maroon truck-mounted grocery unit parked in a designated bay immediately beside the building.",
  "continuity_details": "The same cream-brick building entrance, pedestrian paving and parked unit remain fixed. The store is outside the building, separated from moving traffic. Its only customer door is at the rear."
 },
 {
  "id": "unit_interior",
  "description": "The walk-in grocery interior of the same converted shipping-container unit, with stocked shelves and a compact produce display.",
  "continuity_details": "Use the existing unit's interior proportions and fixtures. Shelves hold colourful, unbranded everyday essentials; fresh apples, a milk carton and bread provide continuity into the final scene."
 }
]
```
### cast_bible
```json
[
 {
  "id": "resident",
  "role": "Resident discovering convenient groceries immediately outside her building",
  "wardrobe": "Olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers.",
  "age_range": "30\u201335",
  "appearance": "Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build.",
  "distinguishing_details": "Small silver stud earrings; a plain beige canvas grocery tote carried throughout."
 }
]
```
### Full voiceover script
> Every day, she passes the same maroon store without a second glance. Another day, the same routine. Then one evening, Fresh-CAN catches her eye. In the free app, she registers and links her payment card. Her app QR code identifies her at the door reader. Inside, everyday essentials and fresh local apples are easy to choose. A few groceries, an automatic charge to her linked card, and home is right beside her.

### Scene plan as generated (output of the script step)

```json
{
 "beat": "hook",
 "setting": "exterior",
 "unit_view": "side",
 "shot_notes": "Static eye-level wide shot, square-on to the unit's side, moderate depth of field. Keep the building entrance and resident in the same frame. Her brief movement stays within the locked composition.",
 "cast_present": [
  "resident"
 ],
 "scene_number": 1,
 "visual_state": {
  "hands": "Resident's hands only",
  "people": 1,
  "objects": [
   "Maroon unit",
   "Canvas tote",
   "Building entrance"
  ],
  "new_entities": [
   "Maroon unit",
   "Canvas tote",
   "Building entrance"
  ]
 },
 "app_on_screen": "none",
 "contains_food": false,
 "props_present": [
  "Maroon truck-mounted container store",
  "Beige canvas tote"
 ],
 "unit_presence": "featured",
 "is_final_scene": false,
 "narration_intent": "Establish the resident's daily habit of passing the same maroon grocery unit without noticing it.",
 "visual_description": "Daylight outside the residential building. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. She takes two ordinary steps across the pedestrian foreground, looking towards her building rather than the maroon truck-mounted container store beside it. The unit's broad side occupies at least half the frame, unobstructed and clearly lit.",
 "target_duration_seconds": 4,
 "unit_presence_rationale": "The overlooked store is the central visual information the resident has not yet noticed."
}
```
```json
{
 "beat": "repeat",
 "setting": "exterior",
 "unit_view": "side",
 "shot_notes": "Static eye-level wide shot matching scene 1 exactly. A hard match cut and changed daylight communicate another day; do not add a montage within the shot.",
 "cast_present": [
  "resident"
 ],
 "scene_number": 2,
 "visual_state": {
  "hands": "Resident's hands only",
  "people": 1,
  "objects": [
   "Maroon unit",
   "Canvas tote",
   "Building entrance"
  ]
 },
 "app_on_screen": "none",
 "contains_food": false,
 "props_present": [
  "Maroon truck-mounted container store",
  "Beige canvas tote"
 ],
 "unit_presence": "featured",
 "is_final_scene": false,
 "narration_intent": "Reinforce that the unit has become an unnoticed part of her everyday routine.",
 "visual_description": "Another day, in precisely the same forecourt composition, with slightly softer daylight. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. She repeats the same two-step pass, gaze still directed towards the building. The stationary maroon unit remains large, square-on and unobstructed beside her.",
 "target_duration_seconds": 4,
 "unit_presence_rationale": "Repeating the same large view makes the resident's lack of attention unmistakable."
}
```
```json
{
 "beat": "discovery",
 "setting": "exterior",
 "unit_view": "side",
 "shot_notes": "Static eye-level medium-wide shot, square-on to the unit's side. Frame her stopped body and attentive face clearly, with the familiar building entrance still visible. Hold her completed look.",
 "cast_present": [
  "resident"
 ],
 "scene_number": 3,
 "visual_state": {
  "hands": "Resident's hands only",
  "people": 1,
  "objects": [
   "Maroon unit",
   "Canvas tote",
   "Building entrance"
  ]
 },
 "app_on_screen": "none",
 "contains_food": false,
 "props_present": [
  "Maroon truck-mounted container store",
  "Beige canvas tote"
 ],
 "unit_presence": "featured",
 "is_final_scene": false,
 "narration_intent": "Mark the evening change in attention and explicitly name Fresh-CAN aloud as the store that finally catches her eye.",
 "visual_description": "Early evening at the same forecourt. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. This time she stops after one step and turns her head towards the maroon store, her expression shifting from routine distraction to quiet curiosity. The unit's side fills half the frame, illuminated clearly against the dusk.",
 "target_duration_seconds": 4,
 "unit_presence_rationale": "Her first conscious notice of the store is the turning point of the story."
}
```
```json
{
 "beat": "first_visit_setup",
 "setting": "exterior",
 "shot_notes": "Static three-quarter medium close-up including her face, both hands and phone. Moderate depth of field keeps the person and screen visible without requiring readable interface text. Do not animate invented app controls.",
 "cast_present": [
  "resident"
 ],
 "scene_number": 4,
 "visual_state": {
  "hands": "Resident's hands only",
  "people": 1,
  "objects": [
   "Phone",
   "Canvas tote",
   "Cream-brick wall"
  ],
  "new_entities": [
   "Phone"
  ]
 },
 "app_on_screen": "featured",
 "contains_food": false,
 "props_present": [
  "Phone",
  "Beige canvas tote"
 ],
 "unit_presence": "none",
 "is_final_scene": false,
 "narration_intent": "Explain that this first visit requires registration in the free Fresh-CAN app and linking a payment card before using the app QR code at the reader.",
 "visual_description": "Beside the building's cream-brick wall in the same forecourt, with the store outside this tighter frame. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Her face and upper body remain clearly visible as she looks down at her phone and makes two measured taps. The phone displays only a simple deep-maroon-and-white screen; the tote hangs from her forearm.",
 "target_duration_seconds": 6
}
```
```json
{
 "beat": "qr_identification",
 "setting": "exterior",
 "unit_view": "rear34",
 "shot_notes": "Static rear three-quarter medium-wide shot, with the unit occupying at least half the frame and its rear clearly lit. Show the resident's face, body and small phone-to-reader gesture. End while she remains outside beside the closed door. Place a restrained off-screen latch and door-opening sound across the cut to scene 6; never show the opening or crossing.",
 "cast_present": [
  "resident"
 ],
 "scene_number": 5,
 "visual_state": {
  "hands": "Resident's hands only",
  "people": 1,
  "objects": [
   "Maroon unit",
   "Closed rear door",
   "Door reader",
   "Phone",
   "Canvas tote"
  ],
  "new_entities": [
   "Door reader"
  ]
 },
 "app_on_screen": "background",
 "contains_food": false,
 "props_present": [
  "Maroon truck-mounted container store",
  "Rear door reader",
  "Phone",
  "Beige canvas tote"
 ],
 "unit_presence": "featured",
 "is_final_scene": false,
 "narration_intent": "Clarify that scanning her app QR code identifies her for access, rather than paying for groceries.",
 "visual_description": "At the rear of the parked maroon unit. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Standing beside the rear reader, clearly away from the doorway, she holds her phone towards it to scan her app QR code. The visible phone screen is simple deep maroon and white. The rear door stays fully closed throughout the shot, and nobody occupies the doorway.",
 "target_duration_seconds": 4,
 "unit_presence_rationale": "The rear reader is essential to showing the resident's QR-code identification before shopping."
}
```
```json
{
 "beat": "easy_shopping",
 "setting": "interior",
 "shot_notes": "Static eye-level medium shot down a short interior aisle, with her face and torso visible and the produce and shelves clearly established. Keep the reach and placement within one frame; end with the apple settled in the tote.",
 "cast_present": [
  "resident"
 ],
 "scene_number": 6,
 "visual_state": {
  "hands": "Resident's hands only",
  "people": 1,
  "objects": [
   "Colourful shelves",
   "Apples",
   "Milk carton",
   "Bread",
   "Canvas tote"
  ],
  "new_entities": [
   "Colourful shelves",
   "Apples",
   "Milk carton",
   "Bread"
  ]
 },
 "app_on_screen": "none",
 "contains_food": true,
 "props_present": [
  "Stocked shelves",
  "Fresh apples",
  "Plain milk carton",
  "Wrapped bread",
  "Beige canvas tote"
 ],
 "unit_presence": "featured",
 "is_final_scene": false,
 "narration_intent": "Convey the pleasant discovery of colourful everyday essentials and fresh local apples, selected normally without individual item scanning.",
 "visual_description": "The cut reveals the resident already shopping inside the same unit, with no doorway or threshold in view. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Beside shelves of colourful everyday groceries, she selects a fresh apple and places it in her open tote, where a plain milk carton and wrapped loaf of bread are already visible. Her phone is put away. No individual item scanning occurs, and all packaging has no readable text.",
 "target_duration_seconds": 5,
 "unit_presence_rationale": "The store's stocked interior is the discovery promised by the resident's evening pause."
}
```
```json
{
 "beat": "near_home_payoff",
 "setting": "exterior",
 "unit_view": "side",
 "shot_notes": "Static eye-level wide shot echoing the opening composition, square-on to the unit's side. Keep the grocery bag small within the wider human moment, not a packaging close-up. Let her completed glance and relaxed stance hold for the final beat.",
 "cast_present": [
  "resident"
 ],
 "scene_number": 7,
 "visual_state": {
  "hands": "Resident's hands only",
  "people": 1,
  "objects": [
   "Maroon unit",
   "Filled tote",
   "Milk carton",
   "Bread",
   "Building entrance"
  ]
 },
 "app_on_screen": "none",
 "contains_food": true,
 "props_present": [
  "Maroon truck-mounted container store",
  "Filled beige canvas tote",
  "Plain milk carton",
  "Wrapped bread",
  "Apples"
 ],
 "unit_presence": "featured",
 "is_final_scene": true,
 "narration_intent": "Resolve the visit with a few groceries already in hand, explain the automatic charge to her linked card after shopping, and emphasise that home is immediately beside the store.",
 "visual_description": "Outside again, the resident is already carrying her filled tote; the crossing has happened entirely between scenes. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. A milk carton and wrapped bread sit visibly at the tote's opening, with the apples inside. She takes one short step towards her building entrance, settles beside it and gives the nearby store a small, satisfied glance. The maroon unit's side occupies half the frame, clearly illuminated; the building entrance is immediately beside her.",
 "target_duration_seconds": 5,
 "unit_presence_rationale": "The store and building together establish that the completed grocery trip happened immediately outside her home."
}
```

## 4. Scenes as stored (video_scenes — after any edits/localization)

### Scene 1 — target 4000 ms
- **visual_description:** Daylight outside the residential building. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. She takes two ordinary steps across the pedestrian foreground, looking towards her building rather than the maroon truck-mounted container store beside it. The unit's broad side occupies at least half the frame, unobstructed and clearly lit.
- **shot_notes:** Static eye-level wide shot, square-on to the unit's side, moderate depth of field. Keep the building entrance and resident in the same frame. Her brief movement stays within the locked composition.
- **narration_intent (Layer-2 fields):** `{'beat': 'hook', 'text': "Establish the resident's daily habit of passing the same maroon grocery unit without noticing it.", 'setting': 'exterior', 'unit_view': 'side', 'cast_present': ['resident'], 'visual_state': {'hands': "Resident's hands only", 'people': 1, 'objects': ['Maroon unit', 'Canvas tote', 'Building entrance'], 'new_entities': ['Maroon unit', 'Canvas tote', 'Building entrance']}, 'app_on_screen': 'none', 'contains_food': False, 'props_present': ['Maroon truck-mounted container store', 'Beige canvas tote'], 'unit_presence': 'featured', 'is_final_scene': False, 'unit_presence_rationale': 'The overlooked store is the central visual information the resident has not yet noticed.'}`

### Scene 2 — target 4000 ms
- **visual_description:** Another day, in precisely the same forecourt composition, with slightly softer daylight. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. She repeats the same two-step pass, gaze still directed towards the building. The stationary maroon unit remains large, square-on and unobstructed beside her.
- **shot_notes:** Static eye-level wide shot matching scene 1 exactly. A hard match cut and changed daylight communicate another day; do not add a montage within the shot.
- **narration_intent (Layer-2 fields):** `{'beat': 'repeat', 'text': 'Reinforce that the unit has become an unnoticed part of her everyday routine.', 'setting': 'exterior', 'unit_view': 'side', 'cast_present': ['resident'], 'visual_state': {'hands': "Resident's hands only", 'people': 1, 'objects': ['Maroon unit', 'Canvas tote', 'Building entrance']}, 'app_on_screen': 'none', 'contains_food': False, 'props_present': ['Maroon truck-mounted container store', 'Beige canvas tote'], 'unit_presence': 'featured', 'is_final_scene': False, 'unit_presence_rationale': "Repeating the same large view makes the resident's lack of attention unmistakable."}`

### Scene 3 — target 4000 ms
- **visual_description:** Early evening at the same forecourt. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. This time she stops after one step and turns her head towards the maroon store, her expression shifting from routine distraction to quiet curiosity. The unit's side fills half the frame, illuminated clearly against the dusk.
- **shot_notes:** Static eye-level medium-wide shot, square-on to the unit's side. Frame her stopped body and attentive face clearly, with the familiar building entrance still visible. Hold her completed look.
- **narration_intent (Layer-2 fields):** `{'beat': 'discovery', 'text': 'Mark the evening change in attention and explicitly name Fresh-CAN aloud as the store that finally catches her eye.', 'setting': 'exterior', 'unit_view': 'side', 'cast_present': ['resident'], 'visual_state': {'hands': "Resident's hands only", 'people': 1, 'objects': ['Maroon unit', 'Canvas tote', 'Building entrance']}, 'app_on_screen': 'none', 'contains_food': False, 'props_present': ['Maroon truck-mounted container store', 'Beige canvas tote'], 'unit_presence': 'featured', 'is_final_scene': False, 'unit_presence_rationale': 'Her first conscious notice of the store is the turning point of the story.'}`

### Scene 4 — target 6000 ms
- **visual_description:** Beside the building's cream-brick wall in the same forecourt, with the store outside this tighter frame. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Her face and upper body remain clearly visible as she looks down at her phone and makes two measured taps. The phone displays only a simple deep-maroon-and-white screen; the tote hangs from her forearm.
- **shot_notes:** Static three-quarter medium close-up including her face, both hands and phone. Moderate depth of field keeps the person and screen visible without requiring readable interface text. Do not animate invented app controls.
- **narration_intent (Layer-2 fields):** `{'beat': 'first_visit_setup', 'text': 'Explain that this first visit requires registration in the free Fresh-CAN app and linking a payment card before using the app QR code at the reader.', 'setting': 'exterior', 'cast_present': ['resident'], 'visual_state': {'hands': "Resident's hands only", 'people': 1, 'objects': ['Phone', 'Canvas tote', 'Cream-brick wall'], 'new_entities': ['Phone']}, 'app_on_screen': 'featured', 'contains_food': False, 'props_present': ['Phone', 'Beige canvas tote'], 'unit_presence': 'none', 'is_final_scene': False}`

### Scene 5 — target 4000 ms
- **visual_description:** At the rear of the parked maroon unit. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Standing beside the rear reader, clearly away from the doorway, she holds her phone towards it to scan her app QR code. The visible phone screen is simple deep maroon and white. The rear door stays fully closed throughout the shot, and nobody occupies the doorway.
- **shot_notes:** Static rear three-quarter medium-wide shot, with the unit occupying at least half the frame and its rear clearly lit. Show the resident's face, body and small phone-to-reader gesture. End while she remains outside beside the closed door. Place a restrained off-screen latch and door-opening sound across the cut to scene 6; never show the opening or crossing.
- **narration_intent (Layer-2 fields):** `{'beat': 'qr_identification', 'text': 'Clarify that scanning her app QR code identifies her for access, rather than paying for groceries.', 'setting': 'exterior', 'unit_view': 'rear34', 'cast_present': ['resident'], 'visual_state': {'hands': "Resident's hands only", 'people': 1, 'objects': ['Maroon unit', 'Closed rear door', 'Door reader', 'Phone', 'Canvas tote'], 'new_entities': ['Door reader']}, 'app_on_screen': 'background', 'contains_food': False, 'props_present': ['Maroon truck-mounted container store', 'Rear door reader', 'Phone', 'Beige canvas tote'], 'unit_presence': 'featured', 'is_final_scene': False, 'unit_presence_rationale': "The rear reader is essential to showing the resident's QR-code identification before shopping."}`

### Scene 6 — target 5000 ms
- **visual_description:** The cut reveals the resident already shopping inside the same unit, with no doorway or threshold in view. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Beside shelves of colourful everyday groceries, she selects a fresh apple and places it in her open tote, where a plain milk carton and wrapped loaf of bread are already visible. Her phone is put away. No individual item scanning occurs, and all packaging has no readable text.
- **shot_notes:** Static eye-level medium shot down a short interior aisle, with her face and torso visible and the produce and shelves clearly established. Keep the reach and placement within one frame; end with the apple settled in the tote.
- **narration_intent (Layer-2 fields):** `{'beat': 'easy_shopping', 'text': 'Convey the pleasant discovery of colourful everyday essentials and fresh local apples, selected normally without individual item scanning.', 'setting': 'interior', 'cast_present': ['resident'], 'visual_state': {'hands': "Resident's hands only", 'people': 1, 'objects': ['Colourful shelves', 'Apples', 'Milk carton', 'Bread', 'Canvas tote'], 'new_entities': ['Colourful shelves', 'Apples', 'Milk carton', 'Bread']}, 'app_on_screen': 'none', 'contains_food': True, 'props_present': ['Stocked shelves', 'Fresh apples', 'Plain milk carton', 'Wrapped bread', 'Beige canvas tote'], 'unit_presence': 'featured', 'is_final_scene': False, 'unit_presence_rationale': "The store's stocked interior is the discovery promised by the resident's evening pause."}`

### Scene 7 — target 5000 ms
- **visual_description:** Outside again, the resident is already carrying her filled tote; the crossing has happened entirely between scenes. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. A milk carton and wrapped bread sit visibly at the tote's opening, with the apples inside. She takes one short step towards her building entrance, settles beside it and gives the nearby store a small, satisfied glance. The maroon unit's side occupies half the frame, clearly illuminated; the building entrance is immediately beside her.
- **shot_notes:** Static eye-level wide shot echoing the opening composition, square-on to the unit's side. Keep the grocery bag small within the wider human moment, not a packaging close-up. Let her completed glance and relaxed stance hold for the final beat.
- **narration_intent (Layer-2 fields):** `{'beat': 'near_home_payoff', 'text': 'Resolve the visit with a few groceries already in hand, explain the automatic charge to her linked card after shopping, and emphasise that home is immediately beside the store.', 'setting': 'exterior', 'unit_view': 'side', 'cast_present': ['resident'], 'visual_state': {'hands': "Resident's hands only", 'people': 1, 'objects': ['Maroon unit', 'Filled tote', 'Milk carton', 'Bread', 'Building entrance']}, 'app_on_screen': 'none', 'contains_food': True, 'props_present': ['Maroon truck-mounted container store', 'Filled beige canvas tote', 'Plain milk carton', 'Wrapped bread', 'Apples'], 'unit_presence': 'featured', 'is_final_scene': True, 'unit_presence_rationale': 'The store and building together establish that the completed grocery trip happened immediately outside her home.'}`

## 5. Narration per scene — EN track (video_scene_audio, ElevenLabs)

- Scene 1 (3388 ms, ready): "Every day, she passes the maroon grocery unit beside her building."  
  audio: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/EN/scene-1-audio-fit-86.mp3
- Scene 2 (3847 ms, ready): "It becomes part of the background, barely noticed on her way home."  
  audio: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/EN/scene-2-audio-fit-81.mp3
- Scene 3 (4152 ms, ready): "Then one evening, she pauses. Fresh-CAN finally catches her curious eye."  
  audio: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/EN/scene-3-audio.mp3
- Scene 4 (5826 ms, ready): "She registers through the free Fresh-CAN app and links her payment card, ready for the QR code reader."  
  audio: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/EN/scene-4-audio-fit-87.mp3
- Scene 5 (4086 ms, ready): "Her app QR code identifies her for access, not for payment."  
  audio: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/EN/scene-5-audio-fit-80.mp3
- Scene 6 (4932 ms, ready): "Colourful essentials, fresh local apples. She picks what she needs, without scanning each item."  
  audio: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/EN/scene-6-audio-fit-112.mp3
- Scene 7 (4813 ms, ready): "Shopping finished, her linked card is charged automatically. Home is right beside the store."  
  audio: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/EN/scene-7-audio.mp3

## 6. Captions (AssemblyAI) — status ready
file: None
```json
[{"end": 276, "text": "Every", "start": 97}, {"end": 438, "text": "day", "start": 276}, {"end": 617, "text": "she", "start": 438}, {"end": 1137, "text": "passes", "start": 682}, {"end": 1219, "text": "the", "start": 1154}, {"end": 1544, "text": "maroon", "start": 1219}, {"end": 2048, "text": "grocery", "start": 1641}, {"end": 2356, "text": "unit", "start": 2064}, {"end": 2698, "text": "beside", "start": 2389}, {"end": 2795, "text": "her", "start": 2698}, {"end": 3088, "text": "building.", "start": 2795}, {"end": 3584, "text": "It", "start": 3486}, {"end": 3960, "text": "becomes", "start": 3584}, {"end": 4319, "text": "part", "start": 4074}, {"end": 4401, "text": "of", "start": 4319}, {"end": 4466, "text": "the", "start": 4401}, {"end": 5218, "text": "background,", "start": 4548}, {"end": 5676, "text": "barely", "start": 5382}, {"end": 6265, "text": "noticed", "start": 5725}, {"end": 6346, "text": "on", "start": 6265}, {"end": 6510, "text": "her", "start": 6346}, {"end": 6592, "text": "way", "start": 6510}, {"end": 6935, "text": "home.", "start": 6690}, {"end": 7397, "text": "Then", "start": 7332}, {"end": 7608, "text": "one", "start": 7495}, {"end": 7868, "text": "evening,", "start": 7608}, {"end": 8015, "text": "she", "start": 7917}, {"end": 8535, "text": "pauses.", "start": 8080}, {"end": 9380, "text": "Fresh", "start": 9120}, {"end": 9575, "text": "can", "start": 9380}, {"end": 9998, "text": "finally", "start": 9705}, {"end": 10323, "text": "catches", "start": 10030}, {"end": 10502, "text": "her", "start": 10355}, {"end": 10908, "text": "curious", "start": 10502}, {"end": 11087, "text": "eye.", "start": 10908}, {"end": 11645, "text": "She", "start": 11419}, {"end": 12194, "text": "registers", "start": 11645}, {"end": 12388, "text": "through", "start": 12291}, {"end": 12469, "text": "the", "start": 12388}, {"end": 12857, "text": "free", "start": 12469}, {"end": 13503, "text": "FreshCan", "start": 12857}, {"end": 13746, "text": "app", "start": 13503}, {"end": 13826, "text": "and", "start": 13762}, {"end": 14085, "text": "links", "start": 13907}, {"end": 14166, "text": "her", "start": 14085}, {"end": 14554, "text": "payment", "start": 14230}, {"end": 14861, "text": "card,", "start": 14554}, {"end": 15588, "text": "ready", "start": 15297}, {"end": 15782, "text": "for", "start": 15620}, {"end": 15862, "text": "the", "start": 15782}, {"end": 16218, "text": "QR", "start": 15927}, {"end": 16590, "text": "code", "start": 16331}, {"end": 16913, "text": "reader.", "start": 16590}, {"end": 17508, "text": "Her", "start": 17311}, {"end": 17737, "text": "app", "start": 17639}, {"end": 18098, "text": "QR", "start": 17819}, {"end": 18540, "text": "code", "start": 18229}, {"end": 19179, "text": "identifies", "start": 18540}, {"end": 19376, "text": "her", "start": 19212}, {"end": 19524, "text": "for", "start": 19376}, {"end": 20196, "text": "access,", "start": 19769}, {"end": 20392, "text": "not", "start": 20212}, {"end": 20605, "text": "for", "start": 20425}, {"end": 20999, "text": "payment.", "start": 20605}, {"end": 21734, "text": "Colorful", "start": 21395}, {"end": 22267, "text": "essentials,", "start": 21734}, {"end": 22719, "text": "fresh", "start": 22525}, {"end": 23042, "text": "local", "start": 22767}, {"end": 23316, "text": "apples\u2014", "start": 23090}, {"end": 24075, "text": "she", "start": 23978}, {"end": 24268, "text": "picks", "start": 24075}, {"end": 24462, "text": "what", "start": 24317}, {"end": 24559, "text": "she", "start": 24462
```

## 7. Images and clips (content_visual_assets)

- scene - | character_ref | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/character-ref.png
  - raw: None
  - duration_ms: None  provider_ref: 9da4605ff5f2efdde5bfe4e936385799
- scene 2 | scene_image | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-2-image-g1-a1.png
  - raw: None
  - duration_ms: None  provider_ref: 7b3b44eb4fdc8fb9d174b2607e583b26
- scene 5 | scene_image | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-5-image-g1-a1.png
  - raw: None
  - duration_ms: None  provider_ref: 295584d4fab93c736e89c79147932c87
- scene 1 | scene_image | attempt 2 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-1-image-g1-a2.png
  - raw: None
  - duration_ms: None  provider_ref: d0080d6f592868020f18d6150a65fb10
- scene 4 | scene_image | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-4-image-g1-a1.png
  - raw: None
  - duration_ms: None  provider_ref: f5f2e53f3e2d253060b563c54f7c55bd
- scene 7 | scene_image | attempt 2 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-7-image-g1-a2.png
  - raw: None
  - duration_ms: None  provider_ref: 888de7047760497d61db7d2dc5766236
- scene 3 | scene_image | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-3-image-g1-a1.png
  - raw: None
  - duration_ms: None  provider_ref: 7bf296f7203a2a880d5ff0f949bd4462
- scene 6 | scene_image | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-6-image-g1-a1.png
  - raw: None
  - duration_ms: None  provider_ref: 0f8dccc44e912639417e439fb05f8b07
- scene 2 | scene_video_clip | attempt 2 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-2-clip.mp4
  - raw: None
  - duration_ms: None  provider_ref: 8cd933c9cb7d435b33ae93fe6dcaf5b7
- scene 3 | scene_video_clip | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-3-clip.mp4
  - raw: None
  - duration_ms: None  provider_ref: dd4c5c7eb8f9566a0b3d904c024cb6f9
- scene 6 | scene_video_clip | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-6-clip.mp4
  - raw: None
  - duration_ms: None  provider_ref: 14db32850346bbc052a3cf6065ccd144
- scene 5 | scene_video_clip | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-5-clip.mp4
  - raw: None
  - duration_ms: None  provider_ref: 9bdf04ac7ed074df8a8b5f09bceafdb9
- scene 4 | scene_video_clip | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-4-clip.mp4
  - raw: None
  - duration_ms: None  provider_ref: 71dbd5daaf3a4496942a983a8d5719eb
- scene 1 | scene_video_clip | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-1-clip.mp4
  - raw: None
  - duration_ms: None  provider_ref: 66e1f941059f174f8b6f45392ea35b74
- scene 7 | scene_video_clip | attempt 1 | ready
  - file: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-7-clip.mp4
  - raw: None
  - duration_ms: None  provider_ref: 144a1fca694c8a1ecbed6c2e31112431

## 8. Step timeline (pipeline_steps) — validator results, retries, motion prompts

### interpret_intent (attempt 1) — succeeded — openai
- 2026-10-13T04:25:54.256+00:00 → 2026-10-13T04:25:54.256+00:00
- error: None
- output: `{"intent": "Create a simple, modern marketing video that turns a resident's everyday walk past a Fresh-CAN unit into an evening discovery of convenient grocery shopping.", "audience": "General public, especially residents who value convenient grocery shopping close to home.", "coreMessage": "Everyday essentials can be closer and easier to shop for than you realize, with a Fresh-CAN mobile store near home.", "improvements": "Strengthen the unnoticed-to-discovered contrast with the resident's repeated walk past the same maroon unit, followed by an evening pause to notice its stocked shelves. Establish first-visit registration and payment-card linking in the app before the resident scans their app QR code at the door reader; that scan identifies them for entry, not payment. Interpret the requested convenience 'right in their building' as shopping immediately outside their building in the truck-mounted, walk-in store, rather than inventing an indoor store location. Convey the requested doors-opening beat between scenes: end outside beside the unit, cut to shopping inside, then cut outside with the resident already carrying a few groceries. Inside, show them selecting colorful everyday essentials without individual item scanning; their linked card is charged automatically when they leave.", "emotionalTone": "Understated, modern, relatable, and pleasantly surprising.", "unitRelevance": {"value": "central", "rationale": "The resident's discovery of the mobile unit and their first shopping experience are the entire focus of the idea."}, "desiredResponse": "Viewers should notice Fresh-CAN as a convenient shopping option and feel encouraged to find their nearest unit through the free app.", "constraintsFromAdmin": "Topic: test 2. Category: Behind the Mobile Unit. Audience: Genera`
### generate_script (attempt 1) — succeeded — openai
- 2026-10-13T04:27:47.882+00:00 → 2026-10-13T04:27:47.882+00:00
- error: None
- output: `(see section 3)`
### generate_character_ref (attempt 1) — succeeded — kie
- 2026-10-13T04:29:40.071+00:00 → 2026-10-13T04:29:40.071+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/character-ref.png"}`
### generate_scene_visual:image:4 (attempt 1) — succeeded — kie
- 2026-10-13T04:30:11.712+00:00 → 2026-10-13T04:30:11.712+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-4-image-g1-a1.png", "validationIssues": []}`
### generate_scene_visual:image:6 (attempt 1) — succeeded — kie
- 2026-10-13T04:30:14.078+00:00 → 2026-10-13T04:30:14.078+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-6-image-g1-a1.png", "validationIssues": []}`
### generate_scene_visual:image:5 (attempt 1) — succeeded — kie
- 2026-10-13T04:30:16.193+00:00 → 2026-10-13T04:30:16.193+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-5-image-g1-a1.png", "validationIssues": []}`
### generate_scene_visual:image:3 (attempt 1) — succeeded — kie
- 2026-10-13T04:30:17.681+00:00 → 2026-10-13T04:30:17.681+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-3-image-g1-a1.png", "validationIssues": []}`
### generate_scene_visual:image:7 (attempt 1) — failed_retryable — openai
- 2026-10-13T04:30:17.917+00:00 → 2026-10-13T04:30:17.917+00:00
- error: VALIDATION_RETRY:The truck's front face and both side panels are one solid, unbroken maroon steel wall with no door, hatch, window or opening; its only opening is the glass double door on the rear face, which is not visible here.
- output: `{"issues": ["door or opening drawn on the truck's side or front"]}`
### generate_scene_visual:image:2 (attempt 1) — succeeded — kie
- 2026-10-13T04:30:18.915+00:00 → 2026-10-13T04:30:18.915+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-2-image-g1-a1.png", "validationIssues": []}`
### generate_scene_visual:image:1 (attempt 1) — failed_retryable — openai
- 2026-10-13T04:30:21.848+00:00 → 2026-10-13T04:30:21.848+00:00
- error: VALIDATION_RETRY:The truck's front face and both side panels are one solid, unbroken maroon steel wall with no door, hatch, window or opening; its only opening is the glass double door on the rear face, which is not visible here.
- output: `{"issues": ["door or opening drawn on the truck's side or front"]}`
### generate_scene_visual:image:1 (attempt 2) — succeeded — kie
- 2026-10-13T04:31:06.411+00:00 → 2026-10-13T04:31:06.411+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-1-image-g1-a2.png", "validationIssues": []}`
### generate_scene_visual:image:7 (attempt 2) — succeeded — kie
- 2026-10-13T04:31:14.286+00:00 → 2026-10-13T04:31:14.286+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-7-image-g1-a2.png", "validationIssues": []}`
### generate_scene_visual:clip:5 (attempt 1) — succeeded — kie
- 2026-10-13T04:31:52.511+00:00 → 2026-10-13T04:31:52.511+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-5-clip.mp4", "motionPrompt": "Over four seconds, she gently extends her phone a little toward the rear reader, then holds it steady without stepping forward. She remains outside, the rear doors stay fully closed, and everything else holds still.", "clipCheckIssues": ["someone crossing or emerging from the unit, or its door swinging open"]}`
### generate_scene_visual:clip:3 (attempt 1) — succeeded — kie
- 2026-10-13T04:31:56.039+00:00 → 2026-10-13T04:31:56.039+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-3-clip.mp4", "motionPrompt": "In the first two seconds, she takes one small step and stops, then turns her head toward the store with quiet curiosity. She holds her attentive gaze for the remaining two seconds; everything else holds still."}`
### generate_scene_visual:clip:4 (attempt 1) — succeeded — kie
- 2026-10-13T04:32:18.561+00:00 → 2026-10-13T04:32:18.561+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-4-clip.mp4", "motionPrompt": "Over six seconds, she keeps her gaze on the phone and makes two measured taps with her index finger, lifting it slightly between taps. Everything else holds still."}`
### generate_scene_visual:clip:6 (attempt 1) — succeeded — kie
- 2026-10-13T04:32:27.058+00:00 → 2026-10-13T04:32:27.058+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-6-clip.mp4", "motionPrompt": "Over five seconds, she glances down at her shopping bag and gently lowers the container in her right hand into it, releasing it to settle inside. Everything else holds still."}`
### generate_scene_visual:clip:2 (attempt 1) — failed_retryable — kie
- 2026-10-13T04:36:38.781+00:00 → 2026-10-13T04:36:38.781+00:00
- error: KIE.ai poll timed out (task left resumable, not resubmitted)
- output: `null`
### generate_scene_visual:clip:1 (attempt 1) — succeeded — kie
- 2026-10-13T04:38:19.436+00:00 → 2026-10-13T04:38:19.436+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-1-clip.mp4", "motionPrompt": "Over four seconds, the woman takes two small steps left across the foreground, turning her head toward the building as her tote swings gently. She stays outside the doorway; everything else holds still."}`
### generate_scene_visual:clip:7 (attempt 1) — succeeded — kie
- 2026-10-13T04:38:40.971+00:00 → 2026-10-13T04:38:40.971+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-7-clip.mp4", "motionPrompt": "Over the first three seconds, she lowers her raised foot to settle outside the door and turns her head slightly toward the store with a satisfied smile. She holds the relaxed pose for the final two seconds; everything else holds still.", "clipCheckIssues": ["someone crossing or emerging from the unit, or its door swinging open"]}`
### generate_scene_visual:clip:2 (attempt 2) — succeeded — kie
- 2026-10-13T04:41:59.271+00:00 → 2026-10-13T04:41:59.271+00:00
- error: None
- output: `{"fileUrl": "https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/scene-2-clip.mp4"}`

## 9. Final output
- EN video: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/EN.mp4

## 10. Editable draft (content_drafts)
```json
{
 "look": {
  "palette": "The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and plain grocery packaging. App screens are exclusively deep maroon and white.",
  "lighting": "Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery.",
  "time_of_day": "Two successive daytime passes followed by one continuous early-evening visit.",
  "camera_language": "Locked-off static shots throughout. Repeat the opening wide composition, then vary medium, rear-view and interior framing as the resident begins paying attention.",
  "style_direction": "Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or readable product labels."
 },
 "story": {
  "arc": "An evening pause breaks the routine; she registers, links a card and scans her app QR code before discovering the stocked interior.",
  "cta": null,
  "hook": "A resident repeatedly passes a grocery store immediately outside her building without noticing it.",
  "resolution": "She has a few everyday groceries, payment is handled automatically, and her building is only a few steps away."
 },
 "scenes": [
  {
   "beat": "hook",
   "setting": "exterior",
   "unit_view": "side",
   "shot_notes": "Static eye-level wide shot, square-on to the unit's side, moderate depth of field. Keep the building entrance and resident in the same frame. Her brief movement stays within the locked composition.",
   "cast_present": [
    "resident"
   ],
   "scene_number": 1,
   "visual_state": {
    "hands": "Resident's hands only",
    "people": 1,
    "objects": [
     "Maroon unit",
     "Canvas tote",
     "Building entrance"
    ],
    "new_entities": [
     "Maroon unit",
     "Canvas tote",
     "Building entrance"
    ]
   },
   "app_on_screen": "none",
   "contains_food": false,
   "props_present": [
    "Maroon truck-mounted container store",
    "Beige canvas tote"
   ],
   "unit_presence": "featured",
   "is_final_scene": false,
   "narration_intent": "Establish the resident's daily habit of passing the same maroon grocery unit without noticing it.",
   "visual_description": "Daylight outside the residential building. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. She takes two ordinary steps across the pedestrian foreground, looking towards her building rather than the maroon truck-mounted container store beside it. The unit's broad side occupies at least half the frame, unobstructed and clearly lit.",
   "target_duration_seconds": 4,
   "unit_presence_rationale": "The overlooked store is the central visual information the resident has not yet noticed."
  },
  {
   "beat": "repeat",
   "setting": "exterior",
   "unit_view": "side",
   "shot_notes": "Static eye-level wide shot matching scene 1 exactly. A hard match cut and changed daylight communicate another day; do not add a montage within the shot.",
   "cast_present": [
    "resident"
   ],
   "scene_number": 2,
   "visual_state": {
    "hands": "Resident's hands only",
    "people": 1,
    "objects": [
     "Maroon unit",
     "Canvas tote",
     "Building entrance"
    ]
   },
   "app_on_screen": "none",
   "contains_food": false,
   "props_present": [
    "Maroon truck-mounted container store",
    "Beige canvas tote"
   ],
   "unit_presence": "featured",
   "is_final_scene": false,
   "narration_intent": "Reinforce that the unit has become an unnoticed part of her everyday routine.",
   "visual_description": "Another day, in precisely the same forecourt composition, with slightly softer daylight. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. She repeats the same two-step pass, gaze still directed towards the building. The stationary maroon unit remains large, square-on and unobstructed beside her.",
   "target_duration_seconds": 4,
   "unit_presence_rationale": "Repeating the same large view makes the resident's lack of attention unmistakable."
  },
  {
   "beat": "discovery",
   "setting": "exterior",
   "unit_view": "side",
   "shot_notes": "Static eye-level medium-wide shot, square-on to the unit's side. Frame her stopped body and attentive face clearly, with the familiar building entrance still visible. Hold her completed look.",
   "cast_present": [
    "resident"
   ],
   "scene_number": 3,
   "visual_state": {
    "hands": "Resident's hands only",
    "people": 1,
    "objects": [
     "Maroon unit",
     "Canvas tote",
     "Building entrance"
    ]
   },
   "app_on_screen": "none",
   "contains_food": false,
   "props_present": [
    "Maroon truck-mounted container store",
    "Beige canvas tote"
   ],
   "unit_presence": "featured",
   "is_final_scene": false,
   "narration_intent": "Mark the evening change in attention and explicitly name Fresh-CAN aloud as the store that finally catches her eye.",
   "visual_description": "Early evening at the same forecourt. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas gr
```

---

## B. Run timeline (UTC, from pipeline_steps; start==finish because rows are written at completion)

| time | step | attempt | status | provider | error |
|---|---|---|---|---|---|
| 04:25:54 | interpret_intent | 1 | succeeded | openai |  |
| 04:27:47 | generate_script | 1 | succeeded | openai |  |
| 04:29:40 | generate_character_ref | 1 | succeeded | kie |  |
| 04:29:41 | localize_script | 1 | succeeded | openai |  |
| 04:29:48 | synthesize_voice:scene:1 | 1 | succeeded | elevenlabs |  |
| 04:29:51 | synthesize_voice:scene:2 | 1 | succeeded | elevenlabs |  |
| 04:29:54 | synthesize_voice:scene:3 | 1 | succeeded | elevenlabs |  |
| 04:29:57 | synthesize_voice:scene:4 | 1 | succeeded | elevenlabs |  |
| 04:29:59 | synthesize_voice:scene:5 | 1 | succeeded | elevenlabs |  |
| 04:30:02 | synthesize_voice:scene:6 | 1 | succeeded | elevenlabs |  |
| 04:30:05 | synthesize_voice:scene:7 | 1 | succeeded | elevenlabs |  |
| 04:30:11 | generate_scene_visual:image:4 | 1 | succeeded | kie |  |
| 04:30:14 | generate_scene_visual:image:6 | 1 | succeeded | kie |  |
| 04:30:16 | generate_scene_visual:image:5 | 1 | succeeded | kie |  |
| 04:30:17 | generate_scene_visual:image:3 | 1 | succeeded | kie |  |
| 04:30:17 | generate_scene_visual:image:7 | 1 | failed_retryable | openai | VALIDATION_RETRY:The truck's front face and both side panels are one solid, unbroken maroo |
| 04:30:18 | generate_scene_visual:image:2 | 1 | succeeded | kie |  |
| 04:30:21 | generate_scene_visual:image:1 | 1 | failed_retryable | openai | VALIDATION_RETRY:The truck's front face and both side panels are one solid, unbroken maroo |
| 04:31:06 | generate_scene_visual:image:1 | 2 | succeeded | kie |  |
| 04:31:14 | generate_scene_visual:image:7 | 2 | succeeded | kie |  |
| 04:31:19 | transcribe_captions | 1 | succeeded | assemblyai |  |
| 04:31:52 | generate_scene_visual:clip:5 | 1 | succeeded | kie |  |
| 04:31:56 | generate_scene_visual:clip:3 | 1 | succeeded | kie |  |
| 04:32:18 | generate_scene_visual:clip:4 | 1 | succeeded | kie |  |
| 04:32:27 | generate_scene_visual:clip:6 | 1 | succeeded | kie |  |
| 04:36:38 | generate_scene_visual:clip:2 | 1 | failed_retryable | kie | KIE.ai poll timed out (task left resumable, not resubmitted) |
| 04:38:19 | generate_scene_visual:clip:1 | 1 | succeeded | kie |  |
| 04:38:40 | generate_scene_visual:clip:7 | 1 | succeeded | kie |  |
| 04:41:59 | generate_scene_visual:clip:2 | 2 | succeeded | kie |  |
| 04:46:05 | render | 1 | succeeded | upload-post |  |

Job created 04:25:29, script draft ready 04:27:47, final render 04:46:05, job `ready` 04:46:09 (~20.7 min). The scene 2 clip poll timeout (04:36:38 -> retry succeeded 04:41:59) cost about 5 min.


---

## A. Reconstructed prompts (rebuilt from stored data + current code — NOT the saved originals)


### A1. interpret_intent — system
```
Fresh-CAN is a Canadian company operating autonomous, cashierless mobile grocery stores — each a self-contained, walk-in store built inside a converted shipping container mounted on a box truck — bringing fresh fruit, vegetables, and everyday food staples directly to streets and communities across Canada. Customers find the nearest unit through the free Fresh-CAN app; on a first visit they register and link a payment card, and on every visit after that they simply scan their app QR code to enter, take what they need off the shelves, and walk out. In-store AI, cameras, and shelf sensors register what was taken, and the linked card is charged automatically — no cashier, no checkout counter, no till, no queue. The real customer journey: First visit only: the customer registers in the Fresh-CAN app and links a payment card — payment is set up once, in advance, never at the unit itself. Every visit: the customer scans their app QR code at the door reader to enter — this identifies who is entering; it is not a payment QR and not a per-item scan. Inside, the customer takes items off the shelves into a basket or their own bag — in-store AI, cameras, and shelf/weight sensors register what was taken; there is no scanning of individual items. The customer walks out — the linked card is charged automatically. No billing, no line, no scanning at exit. Not an open-air market, farmers' market stall, produce stand, or pop-up tent. Not a food truck, canteen, or service-window vendor — customers are never served through a window or hatch. Not a freight/transport/logistics operation — the unit is never shown as cargo being hauled, loaded onto another vehicle, or sitting in a depot/warehouse yard as freight. Not a food bank or charity handout line — Fresh-CAN is a paid, autonomous retail store, not free food assistance. Never claim a specific store count, city, launch date, or price that is not in the brand facts above. Never name, reference, hint at, or compare to any other retailer, product, or brand — no competitor mentions, ever. Tell any enter-shop-leave journey as a cut: one scene ends with the customer outside beside the unit, the next scene opens inside it, and the following scene opens outside with the customer already carrying their groceries. Every scene is wholly inside or wholly outside, and the crossing itself (a door opening or closing, stepping through, climbing in or out) happens between scenes. This holds even when the scene idea words a beat as "walks out" or "rushes inside": keep that beat's meaning and tell it as the cut.

You are interpreting an admin's raw idea for a short-form vertical video before any script, outline, or image plan gets written. Read the idea charitably and specifically — assume it is a genuine, considered starting point, not a vague prompt to pad out. Identify what the admin is actually trying to accomplish. If the idea is thin, strengthen it with concrete, specific detail that serves the SAME idea — elevate it, never replace it or substitute a different angle; anything the admin stated explicitly is binding and must survive into your output unchanged. Decide how relevant the brand's physical unit (the mobile grocery store) is to this specific idea: "central" if the idea is fundamentally about visiting, entering, shopping in, finding, or the existence/arrival of a unit, or is a direct how-it-works/customer-journey explainer; "incidental" if the unit could plausibly belong in the setting and reinforce context without being the subject (e.g. a community moment on a street where a unit happens to be parked) — never forced in; "none" for pure food/ nutrition education, recipes, produce/farm stories, awareness or community/emotional pieces with no natural place for the unit, and any interior domestic setting (a kitchen, dining room, living room). Never invent a fact, statistic, price, launch date, store count, or place name beyond "Canada" that is not already in the brand facts above or the admin's own input.

Respond with strictly valid JSON matching this exact shape (all fields required, use "" for a genuinely empty string field):
{
  "intent": string (what the admin is actually trying to do — marketing, promotion, awareness, food/nutrition education, a community story, a product/how-it-works explainer, or another goal that fits better — inferred from the idea itself, never picked from a fixed list),
  "coreMessage": string (the single idea the viewer must leave with),
  "audience": string,
  "emotionalTone": string,
  "desiredResponse": string (what the viewer should think, feel, or do after seeing this),
  "unitRelevance": { "value": "central" | "incidental" | "none", "rationale": string (one sentence, honest and specific to this idea, never boilerplate) },
  "improvements": string (where the idea was thin, what you added to strengthen it — "" if it was already specific and complete),
  "constraintsFromAdmin": string (anything the admin stated that is non-negotiable and must be preserved exactly — "" if none)
}
```

### A1. interpret_intent — user
```
Topic: test 2
Category: Behind the Mobile Unit
Audience: General public
Admin's own idea: A resident walks past a FreshCAN mini-market unit every day without noticing it. One evening, they stop, scan the QR code, and discover how easy it is to shop for everyday essentials right in their building. Show the maroon unit, the doors opening, colorful products on the shelves, and the resident leaving with a few groceries. A simple, modern marketing video focused on convenience and everyday discovery.
```

### A2. generate_script — system
```
Build this video's story and every one of its scenes around the user's own creative idea: "A resident walks past a FreshCAN mini-market unit every day without noticing it. One evening, they stop, scan the QR code, and discover how easy it is to shop for everyday essentials right in their building. Show the maroon unit, the doors opening, colorful products on the shelves, and the resident leaving with a few groceries. A simple, modern marketing video focused on convenience and everyday discovery.". This idea alone decides what the video is about and what happens in it — never blend in or substitute a different topic. Fresh-CAN operates autonomous, cashierless mobile grocery units — self-contained stores built inside converted shipping containers, found through the free Fresh-CAN app. Customers scan an app QR code to enter, take what they need, and walk out, with payment handled automatically by their linked card. That is background context for tone and brand accuracy only: a fixed constraint on how the brand's vehicle, app, or other branding must look or sound IF the idea above genuinely calls for them, never a second angle, and never a reason to insert brand or mission messaging into a scene the idea doesn't call for. An earlier interpretation pass already read the admin's idea and produced this brief — treat it as your own prior thinking, not a second opinion to reconcile: intent is "Create a simple, modern marketing video that turns a resident's everyday walk past a Fresh-CAN unit into an evening discovery of convenient grocery shopping."; the core message is "Everyday essentials can be closer and easier to shop for than you realize, with a Fresh-CAN mobile store near home."; audience "General public, especially residents who value convenient grocery shopping close to home."; tone "Understated, modern, relatable, and pleasantly surprising."; the viewer should "Viewers should notice Fresh-CAN as a convenient shopping option and feel encouraged to find their nearest unit through the free app.". Strengthen the unnoticed-to-discovered contrast with the resident's repeated walk past the same maroon unit, followed by an evening pause to notice its stocked shelves. Establish first-visit registration and payment-card linking in the app before the resident scans their app QR code at the door reader; that scan identifies them for entry, not payment. Interpret the requested convenience 'right in their building' as shopping immediately outside their building in the truck-mounted, walk-in store, rather than inventing an indoor store location. Convey the requested doors-opening beat between scenes: end outside beside the unit, cut to shopping inside, then cut outside with the resident already carrying a few groceries. Inside, show them selecting colorful everyday essentials without individual item scanning; their linked card is charged automatically when they leave. The admin also specified this non-negotiable constraint, which must be preserved exactly: Topic: test 2. Category: Behind the Mobile Unit. Audience: General public. Preserve the resident walking past the unit every day without noticing it, the evening stop and QR-code entry, the discovery of easy shopping for everyday essentials, the maroon unit, colorful products on shelves, and the resident leaving with a few groceries. Preserve the intended near-home convenience expressed as 'right in their building,' with the physical placement clarified above. Preserve the doors-opening beat through an off-screen transition, not a visible crossing. Keep the video simple and modern, focused on convenience and everyday discovery. That same pass also estimated the brand's physical unit is "central" to this idea (The resident's discovery of the mobile unit and their first shopping experience are the entire focus of the idea.) — treat this as a starting point to confirm or refine with the full context below, never as a directive that overrides your own judgment once you have it. Before writing the scenes below, silently work through the following — this is internal reasoning, never part of your JSON output, which must contain only the fields the schema below asks for: (1) Core creative idea — what genuinely makes the idea above interesting or worth watching? (2) Story arc — a hook, a development, and a payoff, or another structure that fits this specific idea better. (3) Creative device — choose ONE device that serves this idea, such as a visual reveal, an object's own journey, a POV shot, a match cut, a cause-and-effect chain, a transformation, a human moment, or another device that fits better than any of these. (4) Fresh-CAN's role in this story — classify it as background, supporting, enabler, subject, or hero, based on how directly the idea above already concerns Fresh-CAN or its mission (an idea with no real connection to groceries or the brand is background; an idea directly about Fresh-CAN's own mission or service is hero) — this is an honest read of the idea itself, never a default, since the branding guidance below scales against it. If an earlier pass already estimated how relevant the physical unit is to this idea, treat that as a starting point to confirm or refine here, with the full idea and scenes you are now planning — your own classification, made with that fuller context, is what the branding guidance below actually scales against. (5) Visual motif — one recurring visual element (a color, an object, a gesture, a shot type) that can carry across multiple scenes for cohesion. (6) Scene purpose — plan what specific job each scene does in the story before writing it; every scene must advance the story, never exist as one more pretty but disconnected shot. That does not mean the story can ignore Fresh-CAN, though — every video is made for Fresh-CAN's own brand campaign, so it must still genuinely connect to Fresh-CAN's real mission and goals, no matter how creative the idea gets. This is required, not optional, and has two parts, both required together: (1) find the honest, natural bridge between the idea above and what Fresh-CAN actually does — bringing fresh, affordable, local groceries directly into communities — and let it show through the story's own real details: food that reads as genuinely fresh and local, a real neighbourhood or community feeling, people getting good food easily; and (2) the Fresh-CAN name itself must be said explicitly, out loud, somewhere in the narration across the video — this is REQUIRED, not merely ideal, and is never satisfied by "fresh" or "local" language alone, no matter how strong the thematic connection is otherwise. This MUST be written directly into the relevant scene's own "narration_intent" field below, in plain semantic terms (e.g. "mentions this was made possible by Fresh-CAN") — the top-level "script" field is for internal review only and is never what actually reaches the audience, so writing the mention there alone does NOT satisfy this requirement. Find the single most natural moment already in the story for it — wherever food, its origin, a delivery, or a visit is already part of the scene — and have that scene's narration_intent call for naming Fresh-CAN there directly, the way a real person would actually say it out loud in that moment. The difference from reciting the mission statement or forcing the vehicle in: this is ONE specific, natural mention of the name, grounded in the story's own real details, never a slogan, statistic, or pitch stated on top of the scene. Never write a scene whose subject is the brand's logo, wordmark, or any graphic/text reveal — no visual_description should ask for the logo to be drawn, shown, or transitioned to; an AI image or video model cannot reproduce the real logo accurately, so the Fresh-CAN connection belongs entirely in the spoken narration above, never as a visual logo or brand-graphic shot. How visually and narratively present Fresh-CAN is beyond that one required mention should scale with the role you classified during planning, not be the same for every idea. For a background, supporting, or enabler role — the idea has only a loose or everyday connection to groceries — keep Fresh-CAN's presence subtle: the required spoken mention above is enough, connected through the story's own food, people, community, or access details; do not force the vehicle, the logo, or the app into the visuals just because the brand is being credited in narration. For a subject or hero role — the idea is directly about Fresh-CAN, its mission, or its service — stronger, more direct branding is earned and appropriate: the vehicle can be a real visual presence across multiple scenes, and narration can speak about Fresh-CAN more directly, still as part of a genuine story, never as a recited pitch. Every added character, object, location, action, or brand element must have a narrative reason for being there, at any role level — never a random Fresh-CAN truck, a random food prop, a generic cinematic shot with nothing to do with the story, an unrelated character or location, branding beyond what the role above earns, or a surreal element with no narrative justification. The finished video should make it obvious both why it belongs on Fresh-CAN's own social media and why the user's original creative idea is still fully recognizable in it — neither should come at the other's expense. When Fresh-CAN's vehicle, app, or other real assets appear in a scene, describe them only as already true per the brand facts above — never invent a new logo, redesign the vehicle's shape or colors, invent a product or service Fresh-CAN doesn't actually offer, or add an app feature that isn't real. The app's UI is only ever deep maroon and white, never any other screen color. Use an existing asset because this specific scene's idea genuinely calls for it, never merely because it exists. Voice: Warm, hopeful, community-driven — never corporate. Highlight real people, local farmers, and communities; frame technology as serving people, not the other way around. Write in third person only — never "we", "our", or "us"; always "Fresh-CAN", "the app", or "the team". Use Canadian spellings (neighbourhood, colour, organise, prioritise, centre, realise). Never name, reference, hint at, or compare to any other retailer or product, positively or negatively — no competitor names, ever. Never name a specific Canadian city, town, neighbourhood, or province as a setting or example (e.g. Toronto, Vancouver, Ontario) — "Canada" is the only place name to use. Leave the reader feeling hopeful, not lectured. Avoid these overused phrases: seamlessly, effortlessly, revolutionize, game-changer, cutting-edge, innovative solution, in today's world, imagine a world where.

You are a video scriptwriter and shot planner. Produce a short-form marketing video script AND its scene-by-scene shot plan in ONE response. Script type: SOLUTION.

Respond with strictly valid JSON matching this exact shape (the core fields — script, visual_description, duration_seconds, scenes, and each scene's scene_number/visual_description/shot_notes/narration_intent/target_duration_seconds — are required; the additional planning fields below are optional but strongly encouraged whenever you have a real, specific answer for them — never pad one with a generic placeholder just to fill it in):
{
  "script": string (the full narration/voiceover text, human-readable, in English, for internal review only),
  "visual_description": string (one-paragraph overview of the video's overall visual concept),
  "duration_seconds": number (total estimated runtime, summing the scenes below),
  "story": { "hook": string, "arc": string, "resolution": string, "cta": string or null } (a compact summary of your planning above — the same hook/arc/payoff structure, not new content),
  "look": { "time_of_day": string, "lighting": string, "palette": string, "style_direction": string, "camera_language": string } (the visual mood/style for the WHOLE video, deferential to whatever the scene idea itself already implies — this replaces guessing a default mood per image later),
  "cast_bible": [ { "id": string (short, stable, e.g. "mother"), "role": string, "age_range": string, "appearance": string (specific and unambiguous enough that a different artist working from this text alone, with no image reference, would draw the same individual every time — always state apparent gender, ethnicity/skin tone, exact hair color/texture/style, and build or facial structure; never a generic phrase like "kind-looking" or "friendly" that could describe many different people. State skin tone in absolute terms with the apparent heritage (e.g. "deep brown skin, West African heritage"), never "light" or "medium" alone, and add face shape, facial hair or none, and hair length; real renders drew the same person with a different skin tone and face each scene when this was vague), "wardrobe": string (ONE fixed outfit worn in every scene of the video, naming each garment with its exact color, e.g. "olive-green zip hoodie, dark-wash jeans, white sneakers" — never just "a hoodie", never a change of outfit), "distinguishing_details": string } ] (one entry per named or recurring person in the story — locked physical descriptions to reuse VERBATIM in every scene that person appears in, the backbone of keeping them looking the same scene to scene; omit entirely for a video with no recurring named people),
  "locations": [ { "id": string, "description": string, "continuity_details": string } ] (one entry per distinct place the story visits, if it revisits any; omit for a single-location or single-shot video),
  "scenes": [
    {
      "scene_number": number (1-indexed, sequential, no gaps),
      "beat": string (this scene's narrative job — e.g. "hook", "build", "turn", "payoff", "close", or another word that fits better),
      "visual_description": string (what the camera shows — the subject's own action plus any natural ambient motion already implied by the setting, e.g. wind moving leaves or fabric, light shifting — specific enough to generate an image from. Ground it in this scene's own story beat and purpose from your planning above: what specifically happens, in what environment, and how it connects to the scene immediately before it — never a generic or purposeless shot),
      "shot_notes": string (cinematographic direction for this exact shot: angle, framing, distance and depth of field. THE CAMERA NEVER MOVES — every shot is locked-off and static, so write "static", never a pan, tilt, track, follow, dolly, zoom, push-in, orbit or handheld move: the video model scrolls, repeats and morphs the background whenever the camera travels. Be concrete — e.g. "static low-angle wide shot, shallow depth of field, soft window light" or "static medium close-up on the subject, background held steady" — never just "cinematic" or "dynamic shot". Choose the angle and framing that serve THIS scene's specific purpose in the story, not decoration for its own sake),
      "narration_intent": string (the SEMANTIC content this scene's narration should convey — describe the idea in plain terms, NEVER write it as a finished sentence in any one language, since this gets independently localized into actual EN or FR wording by a later step),
      "target_duration_seconds": number (this scene's planned runtime budget),
      "cast_present": string[] (the cast_bible ids of every recurring person who VISUALLY appears in this scene, if any — include them even when this scene is set at a different location or in a different setting than where they last appeared; never drop a recurring person from this list just because the scene changed location, that is exactly when losing their locked appearance is most noticeable. [] or omit only if the video has no cast_bible or genuinely no cast_bible person is shown in this scene. Every cast_bible person your visual_description shows or mentions, in any role (guest, neighbour, passenger, customer), is listed here, so a scene never has a person in it who is missing from this list),
      "props_present": string[] (visually significant objects this scene establishes or carries forward),
      "unit_presence": "none" | "background" | "featured" (is Fresh-CAN's physical unit the subject of this scene, plausibly present in the background, or absent — an honest per-scene read, never a default. Choose "background" or "featured" for every scene that shows a person arriving at, shopping in, or heading away from the unit with their groceries: the scene is drawn from the unit's reference image, and a scene marked "none" has no vehicle reference, so the image model invents its own vehicle. Choose "none" for scenes where the unit plays no part in what is shown, such as a home kitchen or a phone screen. Whenever the unit appears, even as "background", it fills at least a third of the frame width so its wordmark reads cleanly — a small or distant unit gets its wordmark garbled by the video model, so either make it large or choose "none"),
      "unit_presence_rationale": string (one sentence, honest and specific to this scene, never boilerplate — why you chose that unit_presence value; omit only if unit_presence is "none"),
      "unit_view": "side" | "rear34" | "rear" (which face of the unit the shot frames, so the image is built from the matching real photo; omit when unit_presence is "none" or the setting is not exterior. "rear" or "rear34" for a scene where a customer stands BESIDE the unit scanning the QR panel or waiting to go in; the door is always shown closed with nobody in or at the doorway; "side" for every other unit scene, including a customer who has finished shopping and is leaving with groceries, or the unit parked or in the background. The unit has no door anywhere except its rear),
      "app_on_screen": "none" | "background" | "featured" (is a person shown using the Fresh-CAN app on a phone in this scene — searching for a unit, scanning the entry QR code; "featured" when the phone screen is a focal point, "background" when it is merely visible, "none" otherwise — an honest per-scene read, never a default. When not "none", describe the phone screen in visual_description only as a simple maroon-and-white screen),
      "setting": "exterior" | "interior" | "unrelated" (unrelated for a setting that has nothing to do with the unit at all, e.g. a home kitchen),
      "contains_food": boolean (does this scene show food, produce, or packaged groceries),
      "is_final_scene": boolean (true only for the actual last scene),
      "visual_state": { "people": number, "hands": string (who this scene's visible hands belong to, e.g. "the woman only" or "none visible" — never a hand with no owner), "objects": string[] (visually significant physical objects in frame, a few words each), "new_entities": string[] (the subset of objects genuinely new in THIS scene) } (keep this extremely compact — a few short words per field, omit a field or leave an array empty rather than pad it)
    }
  ]
}
Produce between 4 and 10 scenes whose target_duration_seconds are whole numbers (4-8 seconds each — use enough scenes that none needs more than 8; long single shots loop and drift) that sum to EXACTLY 32 seconds — that is the requested runtime, not a guideline. Plan the story to fit it: a scene's narration is written to its own target_duration_seconds later, so make the total right here by giving fewer or shorter beats to a story that needs more room, never by planning a longer total than requested. Never truncate a scene's narration_intent, or drop a scene's idea early, just to make the numbers add up — adjust the number of scenes instead.

The overall video and every individual scene must read as a genuine story or moment from real life — natural pacing, real stakes or feeling — never scripted ad copy, a corporate promo, or a polished commercial, even though it is being produced for marketing use. Every scene's setting must also be physically plausible and safe — an ordinary real-world place the action could actually happen (a sidewalk, porch, kitchen table, park, community space, or similar) — never an implausible or unsafe arrangement like people gathered or eating in the middle of an active road, unless the scene idea itself explicitly calls for that exact setup. Tell any enter-shop-leave journey as a cut: one scene ends with the customer outside beside the unit, the next scene opens inside it, and the following scene opens outside with the customer already carrying their groceries. Every scene is wholly inside or wholly outside, and the crossing itself (a door opening or closing, stepping through, climbing in or out) happens between scenes. This holds even when the scene idea words a beat as "walks out" or "rushes inside": keep that beat's meaning and tell it as the cut. Narration must never describe anyone entering, exiting, stepping into or out of, climbing into or out of, or walking through the door of the unit or vehicle — the picture never shows that crossing, so the words must not either. Say that a person arrives at the unit, is shopping, or heads home with their groceries; never that they "enter", "step in", "walk out", "come out of" or "exit" it. Every person in a scene's cast_present must be clearly visible on screen in that scene's visual_description — never swap them for unnamed extras, and never reduce them to hands or a first-person view. When the unit appears, give it a clear, square-on, well-lit view large enough for its side wordmark to read cleanly, or leave it out of that scene; never a tiny, distant, or partly hidden unit. Avoid close-ups of product labels and bags — wherever packaging appears it carries no readable text. Shoot it like a well-made short film, not a slideshow of plain snapshots: vary shot types scene to scene (wide, medium, close-up, low-angle, over-the-shoulder) and give each one deliberate framing in shot_notes — every shot is locked-off and static, never a pan or track: the video model repeats and morphs a scrolling background, so the subject does the moving, not the camera. Keep each action small enough for ONE locked frame (reaching, holding, looking, a few steps in place) — never a long walk toward or away from the camera — this is a production-quality bar every scene should meet, never a directive on what mood or overall style to use, which stays entirely up to the scene idea. If the idea above is brief, expand it creatively into specific, vivid visual detail — concrete actions, objects, and environment — but every detail must still serve that exact idea, never a generic or unrelated addition. Do not invent a prop, vehicle, building, or person that serves no purpose in the story — every significant visual element must have a clear reason to exist; if removing it would not harm the story, do not add it. Maintain natural continuity across scenes that share the same moment, characters, or place — the same people, their clothing, and the setting should carry between consecutive scenes describing that same moment, unless the story moves somewhere new — each scene's visual_state should reflect this too: carry forward the previous scene's people/objects/location unless the story genuinely moves on, and only list something under new_entities when this scene's own action introduces it or it's a natural background element, never invented just to make the scene visually interesting. Where your planning above chose a visual motif, let it recur across multiple scenes rather than appearing once and being forgotten — that repetition is what makes the video read as one connected piece rather than a set of unrelated shots. The FINAL scene must land the video on a genuine sense of closure, not cut off mid-action — its action should resolve into a settled, natural concluding beat (a finished gesture, a held look, a moment landing) appropriate to the story's own scale, never a big staged finale or a jump straight from motion to black. Every scene must still serve the creative idea given at the very start of this prompt — never drift into generic brand, mission, or food-desert messaging unless that idea itself genuinely calls for it, and never force the vehicle into a scene it does not genuinely fit. The vehicle appearing in one scene is never a reason to carry it into a later scene — only include it again if that later scene's own idea genuinely calls for it too.

Before returning your answer, silently verify: is the original creative idea still recognizable in what you wrote? Is there a clear, coherent story rather than a string of unrelated shots? Does every scene serve a purpose? Is Fresh-CAN's presence natural for the role you classified, not forced? Did you avoid drawing the logo or inventing brand assets? Is the story visually and physically logical? Does it land on a memorable, satisfying ending? If not, revise your answer before returning it — only the final JSON is returned, never this checklist.
```

### A2. generate_script — user
```
Topic: test 2
Category: Behind the Mobile Unit
Audience: General public
Script type: SOLUTION
```

### A3. character ref (nano-banana-2)
- reference image: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/truck_exterior_side_clean.png
```
A clean, well-lit reference photo of the Fresh-CAN branded vehicle. The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The cab is plain white and unbranded; all branding is on the container only. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR panel beside the door. The front face and both side panels are solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass double door flush at bumper height, reached straight from the ground — which is the only entrance and the only place customers are ever served. Never place the Fresh-CAN wordmark or logo on any other vehicle or object. Exactly one "Fresh CAN" wordmark total, on the side panels only, as described above — no second or duplicate wordmark, decal, or graphic anywhere else on the vehicle. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Camera positioned directly to the side of the truck, a full profile view of the whole container and the white cab: both side panels are one solid, unbroken corrugated maroon wall carrying a single "Fresh CAN" wordmark — reproduce that exact wordmark faithfully, once. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

### A4.1 scene 1 still — attempt 1
- Layer-2: unit_presence=featured, unit_view=side, setting=exterior, app=none, food=false, cast=["resident"]
- reference image sent: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/character-ref.png
- length: 2992 chars
```
Scene 1: Daylight outside the residential building. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears Recurring people, each the exact same individual with the same face, hair and clothing in every scene: the Resident discovering convenient (Woman of South Asian heritage with warm, wearing Olive-green hip-length jacket, cream). Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The cab is plain white and unbranded; all branding is on the container only. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR panel beside the door. The front face and both side panels are solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass double door flush at bumper height, reached straight from the ground — which is the only entrance and the only place customers are ever served. Never place the Fresh-CAN wordmark or logo on any other vehicle or object. Use the reference photo only as a guide for the vehicle's shape, structure, and color — never as a literal photo to copy. Do not reuse its background, framing, composition, or people; build a new scene instead. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

#### attempt 2 (after validator rejection) — same prompt + correction appended
```
Scene 1: Daylight outside the residential building. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears Recurring people, each the exact same individual with the same face, hair and clothing in every scene: the Resident discovering convenient (Woman of South Asian heritage with warm, wearing Olive-green hip-length jacket, cream). Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The cab is plain white and unbranded; all branding is on the container only. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR panel beside the door. The front face and both side panels are solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass double door flush at bumper height, reached straight from the ground — which is the only entrance and the only place customers are ever served. Never place the Fresh-CAN wordmark or logo on any other vehicle or object. Use the reference photo only as a guide for the vehicle's shape, structure, and color — never as a literal photo to copy. Do not reuse its background, framing, composition, or people; build a new scene instead. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

### A4.2 scene 2 still — attempt 1
- Layer-2: unit_presence=featured, unit_view=side, setting=exterior, app=none, food=false, cast=["resident"]
- reference image sent: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/character-ref.png
- length: 2987 chars
```
Scene 2: Another day, in precisely the same forecourt composition, with slightly softer daylight. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low Recurring people, each the exact same individual with the same face, hair and clothing in every scene: the Resident discovering convenient (Woman of South Asian heritage with warm, wearing Olive-green hip-length jacket, cream). Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The cab is plain white and unbranded; all branding is on the container only. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR panel beside the door. The front face and both side panels are solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass double door flush at bumper height, reached straight from the ground — which is the only entrance and the only place customers are ever served. Never place the Fresh-CAN wordmark or logo on any other vehicle or object. Use the reference photo only as a guide for the vehicle's shape, structure, and color — never as a literal photo to copy. Do not reuse its background, framing, composition, or people; build a new scene instead. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

### A4.3 scene 3 still — attempt 1
- Layer-2: unit_presence=featured, unit_view=side, setting=exterior, app=none, food=false, cast=["resident"]
- reference image sent: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/character-ref.png
- length: 2989 chars
```
Scene 3: Early evening at the same forecourt. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an Recurring people, each the exact same individual with the same face, hair and clothing in every scene: the Resident discovering convenient (Woman of South Asian heritage with warm, wearing Olive-green hip-length jacket, cream). Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The cab is plain white and unbranded; all branding is on the container only. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR panel beside the door. The front face and both side panels are solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass double door flush at bumper height, reached straight from the ground — which is the only entrance and the only place customers are ever served. Never place the Fresh-CAN wordmark or logo on any other vehicle or object. Use the reference photo only as a guide for the vehicle's shape, structure, and color — never as a literal photo to copy. Do not reuse its background, framing, composition, or people; build a new scene instead. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

### A4.4 scene 4 still — attempt 1
- Layer-2: unit_presence=none, unit_view=undefined, setting=exterior, app=featured, food=false, cast=["resident"]
- reference image sent: (none — text-to-image)
- length: 2741 chars
```
Scene 4: Beside the building's cream-brick wall in the same forecourt, with the store outside this tighter frame. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Her face and upper body remain clearly visible as she looks down at her phone and makes two measured taps. The phone displays only a simple deep-maroon-and-white screen; the tote hangs from her forearm. Recurring people, each the exact same individual with the same face, hair and clothing in every scene: the Resident discovering convenient groceries (30–35, Woman of South Asian heritage with warm brown, wearing Olive-green hip-length jacket, cream crew-neck). Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. The phone showing the Fresh-CAN app must be clearly visible and in focus in the frame. Fresh-CAN app phone screens are ONLY maroon (#6B1A1A) and white: white background, maroon header, buttons, icons and QR code; no other colors, gradients or dark mode; little text. One screen, on the phone's front only. This scene does not involve the Fresh-CAN unit — do not include it, its logo, or any Fresh-CAN branding anywhere in this image. Photorealistic. Absolutely no text, no words, no letters, no captions, no titles, no logos, no watermarks, no typography anywhere in the image — pure photography only.
```

### A4.5 scene 5 still — attempt 1
- Layer-2: unit_presence=featured, unit_view=rear34, setting=exterior, app=background, food=false, cast=["resident"]
- reference image sent: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/truck_exterior_rear34_clean_2.png
- length: 3143 chars
```
Scene 5:  Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. Fresh-CAN app phone screens are ONLY maroon (#6B1A1A) and white: white background, maroon header, buttons, icons and QR code; no other colors, gradients or dark mode; little text. One screen, on the phone's front only. The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The cab is plain white and unbranded; all branding is on the container only. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR panel beside the door. The front face and both side panels are solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass double door flush at bumper height, reached straight from the ground — which is the only entrance and the only place customers are ever served. Never place the Fresh-CAN wordmark or logo on any other vehicle or object. Use the reference photo only as a guide for the vehicle's shape, structure, and color — never as a literal photo to copy. Do not reuse its background, framing, composition, or people; build a new scene instead. Reference photo: Camera positioned behind and to the side of the truck, a rear three-quarter view: the glass double door and one small white square QR panel to its right are on the rear face only (the rear face carries no wordmark), while the long side panel stays solid maroon with a single "Fresh CAN" wordmark and no opening of any kind. The rear door stays closed and nobody stands in or at the doorway. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

### A4.6 scene 6 still — attempt 1
- Layer-2: unit_presence=featured, unit_view=undefined, setting=interior, app=none, food=true, cast=["resident"]
- reference image sent: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/brand-assets/freshcan_interior_1.png
- length: 2989 chars
```
Scene 6: The cut reveals the resident already shopping inside the same unit, with no doorway or threshold in view. Woman of South Asian heritage with warm brown skin, an oval face, dark brown Recurring people, each the exact same individual with the same face, hair and clothing in every scene: the Resident discovering convenient (Woman of South Asian heritage with warm, wearing Olive-green hip-length jacket, cream). Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Any food, produce, or packaged groceries must look clean, fresh, tidy, and appetizing — no dirt, bruising, wilting, mold, spills, or clutter. Never render food looking dirty, rotten, messy, or unappetizing. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. The interior of the Fresh-CAN mobile grocery store: a narrow aisle inside the shipping container with light grey wood-look laminate flooring and bright overhead fluorescent lighting. Black wire shelving units on one side of the aisle, stocked with bagged snacks and packaged groceries. Black-framed glass-door refrigerated cases on the other side, each topped with a deep maroon (#6B1A1A) header sign bearing a white "Fresh [maple leaf icon] CAN" wordmark, stocked with beverages and fresh salad containers (plain, unlettered). A stainless steel prep counter and sink — a fixed utility fitting, never a checkout or point-of-sale — at the far end of the aisle, with no door in view. The scene takes place INSIDE the store, never outside it. Use the reference photo only as a guide for the vehicle's shape, structure, and color — never as a literal photo to copy. Do not reuse its background, framing, composition, or people; build a new scene instead. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

### A4.7 scene 7 still — attempt 1
- Layer-2: unit_presence=featured, unit_view=side, setting=exterior, app=none, food=true, cast=["resident"]
- reference image sent: https://jbrktjnscnzmhwupojiu.supabase.co/storage/v1/object/public/freshcan-videos/d289e3af-d6c8-47ad-8180-cee11f1ddf5a/character-ref.png
- length: 2989 chars
```
Scene 7: Outside again, the resident is already Recurring people, each the exact same individual with the same face, hair and clothing in every scene: the Resident discovering convenient (Woman of South Asian heritage with warm, wearing Olive-green hip-length jacket, cream). Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Any food, produce, or packaged groceries must look clean, fresh, tidy, and appetizing — no dirt, bruising, wilting, mold, spills, or clutter. Never render food looking dirty, rotten, messy, or unappetizing. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The cab is plain white and unbranded; all branding is on the container only. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR panel beside the door. The front face and both side panels are solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass double door flush at bumper height, reached straight from the ground — which is the only entrance and the only place customers are ever served. Never place the Fresh-CAN wordmark or logo on any other vehicle or object. Use the reference photo only as a guide for the vehicle's shape, structure, and color — never as a literal photo to copy. Do not reuse its background, framing, composition, or people; build a new scene instead. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

#### attempt 2 (after validator rejection) — same prompt + correction appended
```
Scene 7: Outside again, the resident is already Recurring people, each the exact same individual with the same face, hair and clothing in every scene: the Resident discovering convenient (Woman of South Asian heritage with warm, wearing Olive-green hip-length jacket, cream). Visual look shared by every scene of this video: Two successive daytime passes followed by one continuous early-evening visit.; Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery. lighting; palette: The unit's existing maroon exterior, warm neutral building surfaces, an olive jacket, and colourful fresh produce and; Understated observational short film with natural gestures, uncluttered compositions and no promotional graphics or feel. Any food, produce, or packaged groceries must look clean, fresh, tidy, and appetizing — no dirt, bruising, wilting, mold, spills, or clutter. Never render food looking dirty, rotten, messy, or unappetizing. Show only the people, objects, and setting this scene describes or clearly implies, in a physically plausible and safe setting (never, e.g., people eating in the middle of a road). Every visible hand belongs to one of those people, with natural anatomy; skin looks real. Reflections show only that same real person and setting, never an extra or ghostly figure. Premium photorealistic commercial photography: crisp natural detail, true-to-life skin/food/fabric texture, natural camera depth of field and lighting — never oversharpened, plastic/CGI-looking, or oversaturated. Composed as one single vertical 9:16 portrait photograph, composed for that tall frame. The Fresh-CAN mobile grocery store: a white box truck with a deep maroon (#6B1A1A) steel cargo container mounted on back. The cab is plain white and unbranded; all branding is on the container only. The white "Fresh [maple leaf icon] CAN" wordmark, never distorted, appears once, centered, on each of the two side panels — nowhere else on the vehicle. The front face (where it meets the cab) and the rear face are both plain maroon with no wordmark; the rear face carries only one small white square QR panel beside the door. The front face and both side panels are solid, unbroken maroon steel; the rear face holds the vehicle's only opening — a black-frame glass double door flush at bumper height, reached straight from the ground — which is the only entrance and the only place customers are ever served. Never place the Fresh-CAN wordmark or logo on any other vehicle or object. Use the reference photo only as a guide for the vehicle's shape, structure, and color — never as a literal photo to copy. Do not reuse its background, framing, composition, or people; build a new scene instead. Photorealistic. Keep the vehicle's real signage/logo exactly as shown in the reference photo, unaltered. The only lettering in frame is the vehicle's own signage; packaging, labels, and shopping bags have blank fronts — pure photography only.
```

### A5.1 scene 1 clip (Seedance 1.5 Pro) — duration requested 4s, aspect 9:16, reference = approved still
- stored motion line: Over four seconds, the woman takes two small steps left across the foreground, turning her head toward the building as her tote swings gently. She stays outside the doorway; everything else holds still.
```
Over four seconds, the woman takes two small steps left across the foreground, turning her head toward the building as her tote swings gently. She stays outside the doorway; everything else holds still. Locked-off, static camera. Only the movement above occurs; everything else holds perfectly still, with a fixed background and steady lighting. The reference frame is the source of truth: every person, limb, and object stays exactly as shown. Everyone and everything stays on the ground. Everyone stays on one side of the doorway for the whole clip, exactly as in the reference frame. One continuous single-take shot. Packaging, labels, and bags have blank fronts. Photorealistic footage with natural color and lighting. Keep the frame's Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery., Two successive daytime passes followed by one continuous early-evening visit. lighting and color steady for the whole shot. The vehicle keeps the reference frame's exact silhouette: white cab, flat-topped maroon container. Keep the brand wordmark identical and legible in every frame. Self-serve and cashierless: customers pick up their own items from the shelves inside; all goods stay in the store.
```

### A5.2 scene 2 clip (Seedance 1.5 Pro) — duration requested 4s, aspect 9:16, reference = approved still
- stored motion line: (none)
```
Another day, in precisely the same forecourt composition, with slightly softer daylight. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain Animate this as three distinct layers: the subject's own action described above; any natural ambient motion already implied by the setting — wind moving hair, fabric, or leaves, water, shifting light — where every motion has a real cause: produce, goods and other solid objects at rest stay still unless a visible hand, wind, or other real force moves them; and camera motion as a separate layer on top of those two — follow whatever camera direction is given above (pans, tilts, tracking, slow dolly, rack focus) with smooth, real-camera motion. The subject and environment supply the actual motion; the camera adds a layer on top. One smooth, continuous take with a grounded, documentary-style camera. The reference frame is the source of truth — every person, limb, and object stays exactly as shown; the shot holds exactly what the frame holds. Everyone and everything stays on the ground. Everyone stays on one side of the doorway for the whole clip, exactly as in the reference frame. One continuous single-take shot. Packaging, labels, and bags have blank fronts. Keep textures, packaging details, and lighting steady across every frame, with natural, smooth motion blur. The background stays fixed; each motion plays out once. Rendered as premium, photorealistic cinematic smartphone footage: natural color, crisp realistic detail, natural skin, lighting and motion blur — polished commercial quality with balanced color and true-to-life sharpness. Keep the frame's Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery., Two successive daytime passes followed by one continuous early-evening visit. lighting and color steady for the whole shot. The vehicle keeps the reference frame's exact silhouette: white cab, flat-topped maroon container. Keep the brand wordmark identical and legible in every frame. Self-serve and cashierless: customers pick up their own items from the shelves inside; all goods stay in the store.
```

### A5.3 scene 3 clip (Seedance 1.5 Pro) — duration requested 4s, aspect 9:16, reference = approved still
- stored motion line: In the first two seconds, she takes one small step and stops, then turns her head toward the store with quiet curiosity. She holds her attentive gaze for the remaining two seconds; everything else holds still.
```
In the first two seconds, she takes one small step and stops, then turns her head toward the store with quiet curiosity. She holds her attentive gaze for the remaining two seconds; everything else holds still. Locked-off, static camera. Only the movement above occurs; everything else holds perfectly still, with a fixed background and steady lighting. The reference frame is the source of truth: every person, limb, and object stays exactly as shown. Everyone and everything stays on the ground. Everyone stays on one side of the doorway for the whole clip, exactly as in the reference frame. One continuous single-take shot. Packaging, labels, and bags have blank fronts. Photorealistic footage with natural color and lighting. Keep the frame's Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery., Two successive daytime passes followed by one continuous early-evening visit. lighting and color steady for the whole shot. The vehicle keeps the reference frame's exact silhouette: white cab, flat-topped maroon container. Keep the brand wordmark identical and legible in every frame. Self-serve and cashierless: customers pick up their own items from the shelves inside; all goods stay in the store.
```

### A5.4 scene 4 clip (Seedance 1.5 Pro) — duration requested 6s, aspect 9:16, reference = approved still
- stored motion line: Over six seconds, she keeps her gaze on the phone and makes two measured taps with her index finger, lifting it slightly between taps. Everything else holds still.
```
Over six seconds, she keeps her gaze on the phone and makes two measured taps with her index finger, lifting it slightly between taps. Everything else holds still. Locked-off, static camera. Only the movement above occurs; everything else holds perfectly still, with a fixed background and steady lighting. The reference frame is the source of truth: every person, limb, and object stays exactly as shown. Everyone and everything stays on the ground. Everyone stays on one side of the doorway for the whole clip, exactly as in the reference frame. One continuous single-take shot. Packaging, labels, and bags have blank fronts. Photorealistic footage with natural color and lighting. Keep the frame's Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery., Two successive daytime passes followed by one continuous early-evening visit. lighting and color steady for the whole shot. Any phone screen showing the Fresh-CAN app stays strictly maroon (#6B1A1A) and white in every frame — white background, maroon header, buttons and icons. The phone has one screen, on its front only; its plain back faces what is scanned. Self-serve and cashierless: customers pick up their own items from the shelves inside; all goods stay in the store.
```

### A5.5 scene 5 clip (Seedance 1.5 Pro) — duration requested 4s, aspect 9:16, reference = approved still
- stored motion line: Over four seconds, she gently extends her phone a little toward the rear reader, then holds it steady without stepping forward. She remains outside, the rear doors stay fully closed, and everything else holds still.
```
Over four seconds, she gently extends her phone a little toward the rear reader, then holds it steady without stepping forward. She remains outside, the rear doors stay fully closed, and everything else holds still. Locked-off, static camera. Only the movement above occurs; everything else holds perfectly still, with a fixed background and steady lighting. The reference frame is the source of truth: every person, limb, and object stays exactly as shown. Everyone and everything stays on the ground. Everyone stays on one side of the doorway for the whole clip, exactly as in the reference frame. One continuous single-take shot. Packaging, labels, and bags have blank fronts. Photorealistic footage with natural color and lighting. Keep the frame's Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery., Two successive daytime passes followed by one continuous early-evening visit. lighting and color steady for the whole shot. The vehicle keeps the reference frame's exact silhouette: white cab, flat-topped maroon container. Keep the brand wordmark identical and legible in every frame. Any phone screen showing the Fresh-CAN app stays strictly maroon (#6B1A1A) and white in every frame — white background, maroon header, buttons and icons. The phone has one screen, on its front only; its plain back faces what is scanned. Self-serve and cashierless: customers pick up their own items from the shelves inside; all goods stay in the store.
```

### A5.6 scene 6 clip (Seedance 1.5 Pro) — duration requested 5s, aspect 9:16, reference = approved still
- stored motion line: Over five seconds, she glances down at her shopping bag and gently lowers the container in her right hand into it, releasing it to settle inside. Everything else holds still.
```
Over five seconds, she glances down at her shopping bag and gently lowers the container in her right hand into it, releasing it to settle inside. Everything else holds still. Locked-off, static camera. Only the movement above occurs; everything else holds perfectly still, with a fixed background and steady lighting. The reference frame is the source of truth: every person, limb, and object stays exactly as shown. Everyone and everything stays on the ground. Everyone stays on one side of the doorway for the whole clip, exactly as in the reference frame. One continuous single-take shot. Packaging, labels, and bags have blank fronts. Photorealistic footage with natural color and lighting. Keep the frame's Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery., Two successive daytime passes followed by one continuous early-evening visit. lighting and color steady for the whole shot. The vehicle keeps the reference frame's exact silhouette: white cab, flat-topped maroon container. Keep the brand wordmark identical and legible in every frame. Self-serve and cashierless: customers pick up their own items from the shelves inside; all goods stay in the store.
```

### A5.7 scene 7 clip (Seedance 1.5 Pro) — duration requested 5s, aspect 9:16, reference = approved still
- stored motion line: Over the first three seconds, she lowers her raised foot to settle outside the door and turns her head slightly toward the store with a satisfied smile. She holds the relaxed pose for the final two seconds; everything else holds still.
```
Over the first three seconds, she lowers her raised foot to settle outside the door and turns her head slightly toward the store with a satisfied smile. She holds the relaxed pose for the final two seconds; everything else holds still. Locked-off, static camera. Only the movement above occurs; everything else holds perfectly still, with a fixed background and steady lighting. The reference frame is the source of truth: every person, limb, and object stays exactly as shown. Everyone and everything stays on the ground. Everyone stays on one side of the doorway for the whole clip, exactly as in the reference frame. One continuous single-take shot. Packaging, labels, and bags have blank fronts. Photorealistic footage with natural color and lighting. Keep the frame's Natural daylight for the repeated passes; soft dusk with practical store and building illumination for the discovery., Two successive daytime passes followed by one continuous early-evening visit. lighting and color steady for the whole shot. The vehicle keeps the reference frame's exact silhouette: white cab, flat-topped maroon container. Keep the brand wordmark identical and legible in every frame. Self-serve and cashierless: customers pick up their own items from the shelves inside; all goods stay in the store. This is the FINAL shot — ease subject and camera motion into a settled, held final beat so the ending does not get cut off mid-motion.
```

### A6. localize_script — system
```
Fresh-CAN is a Canadian company operating autonomous, cashierless mobile grocery stores — each a self-contained, walk-in store built inside a converted shipping container mounted on a box truck — bringing fresh fruit, vegetables, and everyday food staples directly to streets and communities across Canada. Customers find the nearest unit through the free Fresh-CAN app; on a first visit they register and link a payment card, and on every visit after that they simply scan their app QR code to enter, take what they need off the shelves, and walk out. In-store AI, cameras, and shelf sensors register what was taken, and the linked card is charged automatically — no cashier, no checkout counter, no till, no queue. Voice: Warm, hopeful, community-driven — never corporate. Highlight real people, local farmers, and communities; frame technology as serving people, not the other way around. Write in third person only — never "we", "our", or "us"; always "Fresh-CAN", "the app", or "the team". Use Canadian spellings (neighbourhood, colour, organise, prioritise, centre, realise). Never name, reference, hint at, or compare to any other retailer or product, positively or negatively — no competitor names, ever. Never name a specific Canadian city, town, neighbourhood, or province as a setting or example (e.g. Toronto, Vancouver, Ontario) — "Canada" is the only place name to use. Leave the reader feeling hopeful, not lectured. Avoid these overused phrases: seamlessly, effortlessly, revolutionize, game-changer, cutting-edge, innovative solution, in today's world, imagine a world where.

You are localizing a video's narration into English. You will be given a list of scenes, each with a "narration_intent" (the SEMANTIC content that scene's narration should convey — not literal wording) and a target_duration_seconds budget. Write the actual narration wording in English for each scene, writing to fill close to its FULL target duration, and every scene's narration_text MUST have between its given min_words and max_words words (a hard requirement, not a suggestion; a scene with previous_narration_off_length must be rewritten to fit that band (longer or shorter), still faithful to its narration_intent) — real measured narration audio for this pipeline runs at roughly 2.65 words per second (multiply that rate by target_duration_seconds for the word count to aim for), noticeably faster than a slow, deliberate voiceover pace. Aim for the middle of the min_words-max_words band and never exceed max_words: a finished video's length is the SUM of its scenes' real narration lengths, so narration that runs long makes the whole video longer than the length that was requested, and narration that runs short makes it shorter — both are real problems, not cosmetic ones. Narration must never describe anyone entering, exiting, stepping into or out of, climbing into or out of, or walking through the door of the unit or vehicle — the picture never shows that crossing, so the words must not either. Say that a person arrives at the unit, is shopping, or heads home with their groceries; never that they "enter", "step in", "walk out", "come out of" or "exit" it. Each scene also carries "on_screen" (what the viewer sees); narration must agree with it, describing only what that scene shows or the idea it carries. The creator's own idea for this video is: "A resident walks past a FreshCAN mini-market unit every day without noticing it. One evening, they stop, scan the QR code, and discover how easy it is to shop for everyday essentials right in their building. Show the maroon unit, the doors opening, colorful products on the shelves, and the resident leaving with a few groceries. A simple, modern marketing video focused on convenience and everyday discovery.". Narration stays faithful to it, and any action it rules out (for example "no scanning") never appears in the wording. Write it as natural spoken narration for a real story, never as scripted ad copy or a voiceover that sounds like a commercial. The one exception: if a narration_intent explicitly calls for naming Fresh-CAN (or otherwise references the brand by name), the localized English wording MUST include that name literally, spoken naturally — never paraphrase, translate, soften, or drop it for sounding too promotional; that specific mention is a deliberate, required part of the story, not the generic ad-copy pattern this rule exists to avoid elsewhere. Write the name exactly as "Fresh-CAN", as a plain standalone name: never possessive ("Fresh-CAN's"), never plural, never run into the next word. Speech-to-text hears a possessive plus the next word as a different word. Respond with strictly valid JSON: { "scenes": [ { "scene_number": number, "narration_text": string } ] }, exactly one entry per scene given, in the same order, using the given scene_number values unchanged.
```

### A6. localize_script — user (JSON)
```json
[
 {
  "scene_number": 1,
  "narration_intent": "Establish the resident's daily habit of passing the same maroon grocery unit without noticing it.",
  "on_screen": "Daylight outside the residential building. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. She takes two ordinary steps across the pedestrian foreground, looking towards her building rather than the maroon truck-mounted container store beside it. The unit's broad side occupies at least half the frame, unobstructed and clearly lit.",
  "target_duration_seconds": 4,
  "min_words": 10,
  "max_words": 11
 },
 {
  "scene_number": 2,
  "narration_intent": "Reinforce that the unit has become an unnoticed part of her everyday routine.",
  "on_screen": "Another day, in precisely the same forecourt composition, with slightly softer daylight. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. She repeats the same two-step pass, gaze still directed towards the building. The stationary maroon unit remains large, square-on and unobstructed beside her.",
  "target_duration_seconds": 4,
  "min_words": 10,
  "max_words": 11
 },
 {
  "scene_number": 3,
  "narration_intent": "Mark the evening change in attention and explicitly name Fresh-CAN aloud as the store that finally catches her eye.",
  "on_screen": "Early evening at the same forecourt. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. This time she stops after one step and turns her head towards the maroon store, her expression shifting from routine distraction to quiet curiosity. The unit's side fills half the frame, illuminated clearly against the dusk.",
  "target_duration_seconds": 4,
  "min_words": 10,
  "max_words": 11
 },
 {
  "scene_number": 4,
  "narration_intent": "Explain that this first visit requires registration in the free Fresh-CAN app and linking a payment card before using the app QR code at the reader.",
  "on_screen": "Beside the building's cream-brick wall in the same forecourt, with the store outside this tighter frame. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Her face and upper body remain clearly visible as she looks down at her phone and makes two measured taps. The phone displays only a simple deep-maroon-and-white screen; the tote hangs from her forearm.",
  "target_duration_seconds": 6,
  "min_words": 14,
  "max_words": 16
 },
 {
  "scene_number": 5,
  "narration_intent": "Clarify that scanning her app QR code identifies her for access, rather than paying for groceries.",
  "on_screen": "At the rear of the parked maroon unit. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Standing beside the rear reader, clearly away from the doorway, she holds her phone towards it to scan her app QR code. The visible phone screen is simple deep maroon and white. The rear door stays fully closed throughout the shot, and nobody occupies the doorway.",
  "target_duration_seconds": 4,
  "min_words": 10,
  "max_words": 11
 },
 {
  "scene_number": 6,
  "narration_intent": "Convey the pleasant discovery of colourful everyday essentials and fresh local apples, selected normally without individual item scanning.",
  "on_screen": "The cut reveals the resident already shopping inside the same unit, with no doorway or threshold in view. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. Beside shelves of colourful everyday groceries, she selects a fresh apple and places it in her open tote, where a plain milk carton and wrapped loaf of bread are already visible. Her phone is put away. No individual item scanning occurs, and all packaging has no readable text.",
  "target_duration_seconds": 5,
  "min_words": 12,
  "max_words": 13
 },
 {
  "scene_number": 7,
  "narration_intent": "Resolve the visit with a few groceries already in hand, explain the automatic charge to her linked card after shopping, and emphasise that home is immediately beside the store.",
  "on_screen": "Outside again, the resident is already carrying her filled tote; the crossing has happened entirely between scenes. Woman of South Asian heritage with warm brown skin, an oval face, dark brown eyes, no facial hair, and black, straight, shoulder-length hair tied in a low ponytail; average height and slim build. She wears an olive-green hip-length jacket, cream crew-neck shirt, dark-indigo straight-leg jeans and white low-top trainers, with small silver stud earrings and a plain beige canvas grocery tote. A milk carton and wrapped bread sit visibly at the tote's opening, with the apples inside. She takes one short step towards her building entrance, settles beside it and gives the nearby store a small, satisfied glance. The maroon unit's side occupies half the frame, clearly illuminated; the building entrance is immediately beside her.",
  "target_duration_seconds": 5,
  "min_words": 12,
  "max_words": 13
 }
]
```

### A7. Image validator system prompts (per scene)


- scene 1: unit_presence=featured, unit_view=side

- scene 2: unit_presence=featured, unit_view=side

- scene 3: unit_presence=featured, unit_view=side

- scene 4: unit_presence=none, unit_view=undefined

- scene 5: unit_presence=featured, unit_view=rear34

- scene 6: unit_presence=featured, unit_view=undefined

- scene 7: unit_presence=featured, unit_view=side

```
(example: scene 5, rear34)
You are a visual QA checker for AI-generated marketing images. Each rejection triggers a paid regeneration, so only report defects a typical viewer would clearly notice. Check ONLY for: an extra person not implied by the scene, a hand or arm that clearly belongs to no visible or implied person (disembodied, floating, or coming out of an impossible place), duplicate or malformed limbs on one person, a floating or impossible object, a required subject missing entirely, or an obviously illogical scene, or a collage / split-screen / stacked multi-panel layout (the image must be ONE single continuous photograph). NOT defects: hands or arms of a visible person, or hands implied by the described action (holding, tapping, picking up, cooking, reading, eating, first-person or over-the-shoulder framing) even when the rest of the body is cropped out of frame; any person the scene describes (e.g. a vendor, a friend); and any stylistic, lighting, or composition preference. Respond with strictly valid JSON: { "issues": [ { "text": string, "severity": "blocking" | "minor", "confidence": "high" | "medium" | "low" } ] } — an empty array when there are no defects. "text" is one short, specific phrase (e.g. "disembodied hand floating above the counter"), never a generic verdict. Use "blocking" only for a defect that would make the image unusable in a professional ad; use "high" confidence only when the defect is unambiguous, not merely possible. ALSO report as blocking any clearly legible real third-party brand name or logo (on packaging, clothing, vehicles or signs) other than Fresh-CAN; blurred, tiny or invented-looking text is not a defect. Use the text "legible third-party brand name or logo". ALSO, when the white box truck with a maroon cargo container appears: report as blocking a door, hatch, service window, vent or any other opening on the truck's LONG side panel (the long face carrying the "Fresh CAN" wordmark) or on its front face, and a "Fresh CAN" wordmark appearing more than once on one side panel. The truck's REAR face holds its only opening, a black-frame glass double door: that door, and the rear face next to the long side in a three-quarter view, are normal and must NOT be reported. Use the text "door or opening drawn on the truck's side or front". This scene is planned as a view of the truck's REAR: the rear glass double door, and the small white QR panel beside it, are expected and must NOT be reported.
```

### A8. Clip validator system prompt
```
You are a strict visual QA reviewer for short AI-generated video clips. Image 1 is the SOURCE STILL the clip was animated from. The remaining images are frames sampled from the finished clip, in time order (early, middle, late). Compare each frame to the still and the scene description. Report ONLY defects the video model introduced that the still does not have: (1) more distinct people than the still shows, a person appearing, walking in, or a ghostly or blurred duplicate figure — use the text "extra or duplicated person in the clip"; (2) anyone stepping out of, emerging from, entering, or standing in the doorway of the white box truck with the maroon container, or its door swinging open or closed when the still shows it otherwise — use the text "someone crossing or emerging from the unit, or its door swinging open"; (3) a new significant object (a cup, box, bag, tool) in someone's hands or the scene that the still and description do not show — use the text "new object that is not in the source still"; (4) the truck or its container clearly changing shape or size, or its "Fresh CAN" wordmark turning into clearly misspelled or garbled letters where it was legible in the still — use the text "truck or wordmark morphing or garbled". Ignore ordinary subject motion, camera-consistent changes of pose, expression and lighting, motion blur on a moving limb, anything described in the scene description, and small or distant text that was never legible. Respond with strictly valid JSON: { "issues": [ { "text": string, "severity": "blocking" | "minor", "confidence": "high" | "medium" | "low" } ] } — an empty array when there are no defects. Use "blocking" only for a defect that would make the clip unusable in a professional ad, and "high" confidence only when the defect is unambiguous in the frames, not merely possible.
```

### A9. Clip motion writer system prompt (model gpt-6.1-sol)
```
You write the motion prompt for an image-to-video model. The model already sees the attached still frame, so describe only what moves, never what the image looks like. Write ONE or TWO plain sentences (under 260 characters): one or two small, concrete, natural actions of the people or things already visible in the frame (a gesture, a head turn, a step, a breath, a smile), plus light ambient motion only if the frame already implies it (a breeze in hair or leaves). Then say everything else holds still. Pace the actions to the clip length. Mention only people and objects that are visible in the frame, and keep everyone on the same side of any door or doorway they are on in the frame. Keep the camera out of it: it is locked off. Leave reflections and anything not in the frame out. Reply with the sentences only: no quotes, no labels.
```

---

## C. Findings from this data

1. **The scene-still prompts were truncated by the 2995-char budget (`PROMPT_LIMITS.sceneImage`).** Rebuilt from the stored data: shot notes were dropped in all 7 scenes; scene descriptions were cut to 485/480/482/970/**9**/419/275 chars of 677/640/654/700/696/776/845; scene 5 had an EMPTY scene block (no description, no cast, no shot notes) and its prompt was still 3143 chars because fixed text alone exceeds the cap. Scene 7 was cut at "Outside again, the resident is already". Cast text shrank to a compact form in scenes 2, 6, 7. The fixed boilerplate (look clause, quality floor, unit branding block, reference-photo clause) takes ~2000+ chars.
2. The look clause is garbled by field truncation ("...colourful fresh produce and; Understated ... or feel.").
3. Validator only ran on stills for unit-structure/extra-person/collage issues; scene 2's missing legs, scene 5's crop and scene 7's cube-shaped unit passed (validationIssues empty).
4. Clip validator flagged scenes 5 and 7 ("crossing or emerging from the unit") but both clips were kept.
5. Scene 1 clip motion line said "two small steps left"; the video shows her walking toward the camera.
6. ElevenLabs per-scene durationMs (4400, ..., 5600) are estimates; AssemblyAI later overwrote them with real lengths (3388 ... 4813 ms).
7. Scenes 1 and 7 retry (attempt 2) was NOT edit-mode: the failed step output had only `issues` (no rejectedImageUrl), so the correction text was appended to a from-scratch prompt.
