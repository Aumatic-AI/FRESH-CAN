import { describe, it, expect, vi } from 'vitest'
import { OpenAIScriptGenerator, OpenAIImageValidator, OpenAIClipValidator, CLIP_ISSUE_PEOPLE, CLIP_VALIDATION_SYSTEM_PROMPT } from './openai'
import { ProviderCallError } from './types'

function mockFetch(response: Partial<Response> & { jsonBody?: unknown; textBody?: string }) {
  return vi.fn(async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonBody,
    text: async () => response.textBody ?? '',
  })) as unknown as typeof fetch
}

describe('OpenAIScriptGenerator', () => {
  it('sends the system/user prompt and returns raw + parsed JSON content', async () => {
    const fetchImpl = mockFetch({
      jsonBody: { choices: [{ message: { content: '{"title":"hello"}' } }] },
    })
    const gen = new OpenAIScriptGenerator('test-key', fetchImpl)
    const result = await gen.generate({ systemPrompt: 'sys', userPrompt: 'user' })

    expect(result.raw).toBe('{"title":"hello"}')
    expect(result.parsed).toEqual({ title: 'hello' })

    const [url, options] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    const body = JSON.parse(options.body as string)
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'user' },
    ])
    // Forces the API to guarantee a bare JSON object — the actual fix for a
    // live failure where the model prefaced JSON with conversational text,
    // which stripCodeFence's anchored regex can't recover from (see its
    // own doc comment) since it only strips a fence wrapping the ENTIRE
    // response.
    expect(body.response_format).toEqual({ type: 'json_object' })
  })

  it('returns parsed: null when content is not valid JSON', async () => {
    const fetchImpl = mockFetch({
      jsonBody: { choices: [{ message: { content: 'not json' } }] },
    })
    const gen = new OpenAIScriptGenerator('test-key', fetchImpl)
    const result = await gen.generate({ systemPrompt: 'sys', userPrompt: 'user' })

    expect(result.raw).toBe('not json')
    expect(result.parsed).toBeNull()
  })

  it('parses JSON wrapped in a ```json Markdown code fence (real gpt-4o-mini behavior)', async () => {
    const fenced = '```json\n{"post_title":"hello"}\n```'
    const fetchImpl = mockFetch({
      jsonBody: { choices: [{ message: { content: fenced } }] },
    })
    const gen = new OpenAIScriptGenerator('test-key', fetchImpl)
    const result = await gen.generate({ systemPrompt: 'sys', userPrompt: 'user' })

    expect(result.raw).toBe(fenced)
    expect(result.parsed).toEqual({ post_title: 'hello' })
  })

  it('parses JSON wrapped in a bare ``` code fence (no "json" language tag)', async () => {
    const fenced = '```\n{"post_title":"hello"}\n```'
    const fetchImpl = mockFetch({
      jsonBody: { choices: [{ message: { content: fenced } }] },
    })
    const gen = new OpenAIScriptGenerator('test-key', fetchImpl)
    const result = await gen.generate({ systemPrompt: 'sys', userPrompt: 'user' })

    expect(result.parsed).toEqual({ post_title: 'hello' })
  })

  it('throws ProviderCallError on a non-ok HTTP response', async () => {
    const fetchImpl = mockFetch({ ok: false, status: 429, textBody: 'rate limited' })
    const gen = new OpenAIScriptGenerator('test-key', fetchImpl)

    await expect(gen.generate({ systemPrompt: 'sys', userPrompt: 'user' })).rejects.toThrow(
      ProviderCallError,
    )
  })

  it('throws ProviderCallError when the response has no message content', async () => {
    const fetchImpl = mockFetch({ jsonBody: { choices: [{}] } })
    const gen = new OpenAIScriptGenerator('test-key', fetchImpl)

    await expect(gen.generate({ systemPrompt: 'sys', userPrompt: 'user' })).rejects.toThrow(
      ProviderCallError,
    )
  })
})

describe('OpenAIImageValidator', () => {
  const input = { imageUrl: 'https://example.com/scene.png', visualDescription: 'The student taps their phone.' }

  function validatorReturning(content: string) {
    const fetchImpl = mockFetch({ jsonBody: { choices: [{ message: { content } }] } })
    return { validator: new OpenAIImageValidator('test-key', fetchImpl), fetchImpl }
  }

  it('passes when there are no issues, and sends the scene description with the image to gpt-4o', async () => {
    const { validator, fetchImpl } = validatorReturning('{"issues":[]}')
    expect(await validator.validate(input)).toEqual({ pass: true, issues: [] })

    const body = JSON.parse((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.model).toBe('gpt-4o')
    const userContent = body.messages[1].content
    expect(userContent[0].text).toContain('The student taps their phone.')
    expect(userContent[1]).toEqual({ type: 'image_url', image_url: { url: input.imageUrl } })
  })

  it('rejects only on a blocking, high-confidence issue', async () => {
    const { validator } = validatorReturning(
      JSON.stringify({
        issues: [
          { text: 'disembodied hand above the counter', severity: 'blocking', confidence: 'high' },
          { text: 'possible extra finger', severity: 'blocking', confidence: 'medium' },
          { text: 'slightly odd shadow', severity: 'minor', confidence: 'high' },
        ],
      }),
    )
    expect(await validator.validate(input)).toEqual({
      pass: false,
      issues: ['disembodied hand above the counter'],
      ignoredIssues: ['possible extra finger (blocking, medium confidence)', 'slightly odd shadow (minor, high confidence)'],
    })
  })

  it('passes when every reported issue is below the rejection bar', async () => {
    const { validator } = validatorReturning(
      JSON.stringify({ issues: [{ text: 'hand at left edge', severity: 'blocking', confidence: 'low' }] }),
    )
    const result = await validator.validate(input)
    expect(result.pass).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.ignoredIssues).toEqual(['hand at left edge (blocking, low confidence)'])
  })

  it('never rejects on bare-string issues (old response shape, no severity/confidence)', async () => {
    const { validator } = validatorReturning('{"pass":false,"issues":["unexplained hand on the left side of frame"]}')
    const result = await validator.validate(input)
    expect(result.pass).toBe(true)
    expect(result.ignoredIssues).toEqual(['unexplained hand on the left side of frame'])
  })

  it('fails open on an unparseable or malformed response', async () => {
    expect(await validatorReturning('not json').validator.validate(input)).toEqual({ pass: true, issues: [] })
    expect(await validatorReturning('{"pass":false}').validator.validate(input)).toEqual({ pass: true, issues: [] })
  })

  it('throws ProviderCallError on a non-OK response', async () => {
    const fetchImpl = mockFetch({ ok: false, status: 500, textBody: 'boom' })
    await expect(new OpenAIImageValidator('test-key', fetchImpl).validate(input)).rejects.toBeInstanceOf(ProviderCallError)
  })
})

describe('OpenAIClipValidator (finished-clip frame check)', () => {
  const frames = [Buffer.from('f1'), Buffer.from('f2'), Buffer.from('f3')]
  const input = {
    stillUrl: 'https://example.com/still.png',
    frames,
    visualDescription: 'The worker holds an apple beside the unit.',
    expectedPeople: 1,
    unitPresence: 'featured' as const,
  }

  function validatorReturning(content: string) {
    const fetchImpl = mockFetch({ jsonBody: { choices: [{ message: { content } }] } })
    return { validator: new OpenAIClipValidator('test-key', fetchImpl), fetchImpl }
  }

  it('sends the still first, then every frame as a base64 JPEG, with the plan\'s headcount', async () => {
    const { validator, fetchImpl } = validatorReturning('{"issues":[]}')
    expect(await validator.validate(input)).toEqual({ pass: true, issues: [] })
    const body = JSON.parse((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.model).toBe('gpt-4o')
    expect(body.messages[0].content).toBe(CLIP_VALIDATION_SYSTEM_PROMPT)
    const user = body.messages[1].content
    expect(user[0].text).toContain('exactly 1 person')
    expect(user[0].text).toContain('truck is part of this scene')
    expect(user[1]).toEqual({ type: 'image_url', image_url: { url: input.stillUrl } })
    expect(user.slice(2).map((c: { image_url: { url: string } }) => c.image_url.url)).toEqual(
      frames.map((f) => `data:image/jpeg;base64,${f.toString('base64')}`),
    )
  })

  it('rejects only blocking, high-confidence defects', async () => {
    const { validator } = validatorReturning(
      JSON.stringify({
        issues: [
          { text: CLIP_ISSUE_PEOPLE, severity: 'blocking', confidence: 'high' },
          { text: 'slight blur', severity: 'minor', confidence: 'high' },
          { text: 'maybe a bag', severity: 'blocking', confidence: 'low' },
        ],
      }),
    )
    const r = await validator.validate(input)
    expect(r.pass).toBe(false)
    expect(r.issues).toEqual([CLIP_ISSUE_PEOPLE])
    expect(r.ignoredIssues).toHaveLength(2)
  })

  it('fails open: no frames, or an unparseable reply, passes', async () => {
    const { validator, fetchImpl } = validatorReturning('not json')
    expect(await validator.validate(input)).toEqual({ pass: true, issues: [] })
    expect(await validator.validate({ ...input, frames: [] })).toEqual({ pass: true, issues: [] })
    expect((fetchImpl as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1) // the empty-frames call never hit the API
  })

  it('names the four defect classes with the exact texts the retry routing keys on', () => {
    for (const t of [
      'extra or duplicated person in the clip',
      'someone crossing or emerging from the unit, or its door swinging open',
      'new object that is not in the source still',
      'truck or wordmark morphing or garbled',
    ]) {
      expect(CLIP_VALIDATION_SYSTEM_PROMPT).toContain(t)
    }
  })
})
