// One-time helper: copies a blog job's still-live KIE temp images
// (tempfile.aiquickdraw.com, ~1 week lifetime) into the permanent
// `freshcan-videos` bucket and rewrites every DB reference to the new URL.
// Dry run by default; pass --apply to upload and write.
//   npx tsx scripts/backfill-blog-images.ts <job_id> [--apply]
import { createServiceClient } from '../src/server/pipeline/db'
import { SupabaseVideoStorageUploader } from '../src/server/pipeline/adapters/storage'

const TEMP_HOST = 'tempfile.aiquickdraw.com'
const TEXT_COLUMNS: Record<string, string[]> = {
  generated_content: ['file_url', 'thumbnail_url', 'kie_image_url', 'image_url'],
}
const JSON_COLUMNS: Record<string, string[]> = {
  generated_content: ['output_data'],
  content_drafts: ['draft_data', 'original_data'],
  pipeline_steps: ['input_snapshot', 'output_snapshot'],
}

async function main() {
  const jobId = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!jobId || jobId.startsWith('--')) {
    console.error('Usage: npx tsx scripts/backfill-blog-images.ts <job_id> [--apply]')
    process.exit(1)
  }
  const client = createServiceClient()
  const uploader = new SupabaseVideoStorageUploader(client)

  const { data: pipelines, error: pErr } = await client
    .from('content_pipelines').select('id').eq('job_id', jobId)
  if (pErr) throw pErr
  const pipelineIds = (pipelines ?? []).map((p) => p.id)

  const { data: assets, error: aErr } = await client
    .from('content_visual_assets')
    .select('id, asset_type, generation, file_url')
    .in('content_pipeline_id', pipelineIds)
    .in('asset_type', ['hero_image', 'inline_image'])
    .eq('status', 'ready')
  if (aErr) throw aErr

  // old temp URL -> new permanent URL (planned path in dry run)
  const map = new Map<string, string>()
  for (const a of assets ?? []) {
    const old: string = a.file_url ?? ''
    if (!old.includes(TEMP_HOST)) { console.log(`skip ${a.asset_type}: not a temp URL`); continue }
    const head = await fetch(old, { method: 'HEAD' })
    if (!head.ok) { console.log(`skip ${a.asset_type}: ${old} -> ${head.status} (already gone)`); continue }
    const ext = /\.(png|jpe?g|webp)$/i.exec(new URL(old).pathname)?.[1]?.toLowerCase() ?? 'png'
    const kind = a.asset_type === 'hero_image' ? 'hero' : 'inline'
    const path = `${jobId}/blog-${kind}-g${a.generation}.${ext}`
    if (apply) {
      const newUrl = await uploader.uploadFromUrl(path, old)
      const check = await fetch(newUrl, { method: 'HEAD' })
      if (!check.ok) throw new Error(`uploaded file not reachable (${check.status}): ${newUrl}`)
      map.set(old, newUrl)
    } else {
      const { data } = client.storage.from('freshcan-videos').getPublicUrl(path)
      map.set(old, data.publicUrl)
    }
    console.log(`${a.asset_type}\n  old: ${old}\n  new: ${map.get(old)}`)
  }
  if (map.size === 0) { console.log('nothing to do'); return }

  const rewrite = (s: string) => { for (const [o, n] of map) s = s.split(o).join(n); return s }
  let changes = 0
  const report = (table: string, id: string, cols: string[]) => {
    changes++
    console.log(`${apply ? 'updated' : 'would update'} ${table} ${id}: ${cols.join(', ')}`)
  }

  // content_visual_assets.file_url
  for (const a of assets ?? []) {
    const n = map.get(a.file_url)
    if (!n) continue
    if (apply) {
      const { error } = await client.from('content_visual_assets').update({ file_url: n }).eq('id', a.id)
      if (error) throw error
    }
    report('content_visual_assets', a.id, ['file_url'])
  }

  const scoped: Record<string, { col: string; ids: string[] }> = {
    generated_content: { col: 'job_id', ids: [jobId] },
    content_drafts: { col: 'job_id', ids: [jobId] },
    pipeline_steps: { col: 'content_pipeline_id', ids: pipelineIds },
  }
  for (const [table, { col, ids }] of Object.entries(scoped)) {
    const { data: rows, error } = await client.from(table).select('*').in(col, ids)
    if (error) throw error
    for (const row of rows ?? []) {
      const patch: Record<string, unknown> = {}
      for (const c of TEXT_COLUMNS[table] ?? []) {
        if (typeof row[c] === 'string' && rewrite(row[c]) !== row[c]) patch[c] = rewrite(row[c])
      }
      for (const c of JSON_COLUMNS[table] ?? []) {
        if (row[c] == null) continue
        const before = JSON.stringify(row[c])
        const after = rewrite(before)
        if (after !== before) patch[c] = JSON.parse(after)
      }
      if (Object.keys(patch).length === 0) continue
      if (apply) {
        const { error: uErr } = await client.from(table).update(patch).eq('id', row.id)
        if (uErr) throw uErr
      }
      report(table, row.id, Object.keys(patch))
    }
  }
  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${map.size} image(s), ${changes} row(s). ${apply ? '' : 'Re-run with --apply to write.'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
