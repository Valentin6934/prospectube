import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return children
}
