'use client'

import TopBar from '@/components/layout/TopBar'
import { PostedSection } from '../library/LibraryContent'

export default function PostedPage() {
  return (
    <div className="space-y-6">
      <TopBar
        title="Posted"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Posted' },
        ]}
      />
      <PostedSection />
    </div>
  )
}