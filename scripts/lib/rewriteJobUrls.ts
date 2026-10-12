// Shared by the one-time blog image scripts: replaces exact URL strings in
// every DB row that can hold a copy of a blog job's image URLs.
import type { SupabaseClient } from '@supabase/supabase-js'

const TEXT_COLUMNS: Record<string, string[]> = {
  generated_content: ['file_url', 'thumbnail_url', 'kie_image_url', 'image_url'],
}
const JSON_COLUMNS: Record<string, string[]> = {
  generated_content: ['output_data'],
  content_drafts: ['draft_data', 'original_data'],
  pipeline_steps: ['input_snapshot', 'output_snapshot'],
}

export async function rewriteJobUrls(
  client: SupabaseClient,
  jobId: string,
  pipelineIds: string[],
  urlMap: Map<string, string>,
  apply: boolean,
): Promise<number> {
  const rewrite = (s: string) => {
    for (const [o, n] of urlMap) s = s.split(o).join(n)
    return s
  }
  const scoped: Record<string, { col: string; ids: string[] }> = {
    generated_content: { col: 'job_id', ids: [jobId] },
    content_drafts: { col: 'job_id', ids: [jobId] },
    pipeline_steps: { col: 'content_pipeline_id', ids: pipelineIds },
  }
  let changes = 0
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
      changes++
      console.log(`${apply ? 'updated' : 'would update'} ${table} ${row.id}: ${Object.keys(patch).join(', ')}`)
    }
  }
  return changes
}
