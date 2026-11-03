// Random-but-stable camera position for the container, chosen in code so every
// video (and every scene in it) sees the container from a different side without
// any extra reference images. The pick is seeded (a pipeline id plus the scene
// number) so a retry of one scene lands on the same view, yet two scenes of one
// video differ: consecutive scene numbers step through the faces. The source
// photo's own view is left out of the faces on purpose (the default photo's view
// is not in the list at all; any other photo names its face and it is skipped), so a scene never reproduces the reference's composition.
// Every face keeps the door end or the wordmark side in sight, so a scan-at-the-
// door beat still works.

/** Keys name a camera face so a reference photo can say which one it already shows. */
export type ContainerFaceKey = 'door-end-straight' | 'long-side-straight' | 'door-end-3q' | 'long-side-3q' | 'plain-end-3q'

const FACES: readonly { key: ContainerFaceKey; text: string }[] = [
  { key: 'door-end-straight', text: 'straight-on to the door end' },
  { key: 'long-side-straight', text: 'straight-on to the long wordmark side' },
  { key: 'door-end-3q', text: 'a three-quarter view of the door end with the long wordmark side receding to its left' },
  { key: 'long-side-3q', text: 'a three-quarter view of the long wordmark side receding toward the plain end' },
  { key: 'plain-end-3q', text: 'a three-quarter view of the plain end with the long wordmark side receding to its right' },
]

const HEIGHTS: readonly string[] = ['a low camera height', 'eye level', 'a raised camera looking slightly down']
const DISTANCES: readonly string[] = ['close, the container filling much of the frame', 'a medium distance', 'a wide view with the container well inside the frame']

function hash(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

/** One sentence naming where the camera stands relative to the container. */
export function pickContainerCamera(
  seed: string,
  sceneNumber = 0,
  opts: { withDistance?: boolean; /** The face the scene's source photo already shows: never chosen. */ avoid?: ContainerFaceKey } = {},
): string {
  const base = hash(seed)
  let at = (base + sceneNumber) % FACES.length
  if (opts.avoid && FACES[at].key === opts.avoid) at = (at + 1) % FACES.length
  const face = FACES[at].text
  const height = HEIGHTS[(Math.floor(base / 7) + sceneNumber * 2) % HEIGHTS.length]
  const parts = [face, height]
  if (opts.withDistance !== false) parts.push(DISTANCES[(Math.floor(base / 13) + sceneNumber) % DISTANCES.length])
  return `${parts.join(', ')}`
}

// A code-chosen setting for the container, used when the plan names none. The reference photos all
// show the same glass office buildings, trees and paved plaza, and a model that is not told otherwise
// copies them. Generic Canadian places only: no city, sign, skyline or readable text.
const SURROUNDINGS: readonly string[] = [
  'a quiet residential street with detached houses and mature trees',
  'the edge of a small neighbourhood park, with grass and a footpath',
  'a corner of a community centre car park with a low hedge',
  'a tree-lined sidewalk beside low-rise brick apartment buildings',
  'a gravel and paving-stone courtyard between townhouses',
  'a grassy verge beside a footpath and a row of young trees',
  'an open paved lot with a low wooden fence and bushes',
]

/** One phrase naming where the container stands (random but stable per scene). */
export function pickContainerSurroundings(seed: string, sceneNumber = 0): string {
  return SURROUNDINGS[(hash(`${seed}:setting`) + sceneNumber * 3) % SURROUNDINGS.length]
}
