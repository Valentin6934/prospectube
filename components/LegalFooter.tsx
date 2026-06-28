import Link from 'next/link'

const LEGAL_LINKS = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/politique-confidentialite', label: 'Confidentialité' },
  { href: '/cgu', label: 'CGU' },
  { href: '/remboursement', label: 'Remboursement' },
  { href: 'mailto:support@prospecttube.com', label: 'Contact' },
]

export default function LegalFooter() {
  return (
    <footer style={{ borderTop: '1px solid rgba(83,58,183,0.2)', padding: '1.5rem 1rem', color: '#6B5F96' }}>
      <div style={{ width: 'min(1100px, 100%)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem' }}>© {new Date().getFullYear()} ProspectTube</span>
          <a href="mailto:support@prospecttube.com" style={{ color: '#8F84B2', textDecoration: 'none', fontSize: '0.72rem' }}>support@prospecttube.com</a>
        </div>
        <nav aria-label="Liens légaux" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {LEGAL_LINKS.map(link => (
            <Link key={link.href} href={link.href} style={{ color: '#8F84B2', textDecoration: 'none', fontSize: '0.75rem' }}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
