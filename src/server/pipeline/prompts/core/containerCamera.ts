// Random-but-stable camera position for the container, chosen in code so every
// video (and every scene in it) sees the container from a different side without
// any extra reference images. The pick is seeded (a pipeline id plus the scene
// number) so a retry of one scene lands on the same view, yet two scenes of one
// video differ: consecutive scene numbers step through the faces. The source
// photo's own view (door end with the wordmark side on its right) is left out of
// the faces on purpose, so a scene never reproduces the reference's composition.
// Every face keeps the door end or the wordmark side in sight, so a scan-at-the-
// door beat still works.

const FACES: readonly string[] = [
  'straight-on to the door end',
  'straight-on to the long wordmark side',
  'a three-quarter view of the door end with the long wordmark side receding to its left',
  'a three-quarter view of the long wordmark side receding toward the plain end',
  'a three-quarter view of the plain end with the long wordmark side receding to its right',
]

const HEIGHTS: readonly string[] = ['a low camera height', 'eye level', 'a raised camera looking slightly down']
const DISTANCES: readonly string[] = ['close, the container filling much of the frame', 'a medium distance', 'a wide view with the container well inside the frame']

function hash(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

/** One sentence naming where the camera stands relative to the container. */
export function pickContainerCamera(seed: string, sceneNumber = 0, opts: { withDistance?: boolean } = {}): string {
  const base = hash(seed)
  const face = FACES[(base + sceneNumber) % FACES.length]
  const height = HEIGHTS[(Math.floor(base / 7) + sceneNumber * 2) % HEIGHTS.length]
  const parts = [face, height]
  if (opts.withDistance !== false) parts.push(DISTANCES[(Math.floor(base / 13) + sceneNumber) % DISTANCES.length])
  return `${parts.join(', ')}`
}
