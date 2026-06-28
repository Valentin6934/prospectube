import type { ReactNode } from 'react'
import Link from 'next/link'
import LegalFooter from '@/components/LegalFooter'
import styles from './LegalPage.module.css'

export function Placeholder({ children }: { children: ReactNode }) {
  return <span className={styles.placeholder}>{children}</span>
}

export default function LegalPage({
  title,
  introduction,
  children,
}: {
  title: string
  introduction: string
  children: ReactNode
}) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo}>Prospect<span>Tube</span></Link>
          <Link href="/" className={styles.back}>Retour à l’accueil</Link>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.intro}>
          <h1>{title}</h1>
          <p>{introduction}</p>
        </div>
        <article className={styles.document}>{children}</article>
      </div>

      <LegalFooter />
    </main>
  )
}
