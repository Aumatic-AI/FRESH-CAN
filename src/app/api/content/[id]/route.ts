import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  // Next.js 15+ makes `params` a Promise — this handles both old and new versions safely
  const params = await Promise.resolve((context as { params: unknown }).params) as { id: string }
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Missing content id' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { error } = await supabase
    .from('generated_content')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}