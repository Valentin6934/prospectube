import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPlanName, isPro } from '@/lib/plan'
import MainAppNav from '@/components/MainAppNav'
import LegalFooter from '@/components/LegalFooter'
import styles from './home.module.css'

export const dynamic = 'force-dynamic'

type Activity = {
  id: string
  icon: string
  title: string
  detail: string
  date: Date
}

function firstName(name: string | null, email: string) {
  const rawName = name?.trim().split(/\s+/)[0] || email.split('@')[0] || 'vous'
  return rawName.charAt(0).toUpperCase() + rawName.slice(1)
}

function relativeDate(date: Date) {
  const elapsed = Math.max(0, Date.now() - date.getTime())
  const minutes = Math.floor(elapsed / 60000)
  const hours = Math.floor(elapsed / 3600000)
  const days = Math.floor(elapsed / 86400000)

  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  if (hours < 24) return `il y a ${hours} h`
  if (days < 7) return `il y a ${days} jour${days > 1 ? 's' : ''}`

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date)
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams?: { success?: string; canceled?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true, plan: true },
  })
  if (!user) redirect('/login')

  const [
    searchCount,
    favoriteCount,
    campaignCount,
    campaignProspectCount,
    recentSearches,
    recentFavorites,
    recentCampaigns,
    recentGeneratedCampaigns,
  ] = await Promise.all([
    prisma.search.count({ where: { userId: user.id } }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.campaign.count({ where: { userId: user.id } }),
    prisma.campaignProspect.count({ where: { campaign: { userId: user.id } } }),
    prisma.search.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, niche: true, language: true, createdAt: true },
    }),
    prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.campaign.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.campaignProspect.findMany({
      where: { campaign: { userId: user.id }, generatedBody: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
  ])

  const activities: Activity[] = [
    ...recentSearches.map(item => ({
      id: `search-${item.id}`,
      icon: '🔍',
      title: 'Nouvelle recherche',
      detail: `${item.niche} · ${item.language}`,
      date: item.createdAt,
    })),
    ...recentFavorites.map(item => ({
      id: `favorite-${item.id}`,
      icon: '⭐',
      title: 'Favori ajouté',
      detail: item.name,
      date: item.createdAt,
    })),
    ...recentCampaigns.map(item => ({
      id: `campaign-${item.id}`,
      icon: '📧',
      title: 'Nouvelle campagne',
      detail: item.name,
      date: item.createdAt,
    })),
    ...recentGeneratedCampaigns.map(item => ({
      id: `campaign-message-${item.id}`,
      icon: '✨',
      title: 'Message préparé',
      detail: item.name,
      date: item.createdAt,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5)

  const savedProspects = favoriteCount + campaignProspectCount
  const plan = getPlanName(user.plan)

  const stats = [
    { icon: '🔍', label: 'Recherches', value: searchCount, accent: styles.violet },
    { icon: '⭐', label: 'Favoris', value: favoriteCount, accent: styles.amber },
    { icon: '📧', label: 'Campagnes', value: campaignCount, accent: styles.cyan },
    { icon: '👥', label: 'Prospects sauvegardés', value: savedProspects, accent: styles.green },
  ]

  const quickActions = [
    { href: '/favorites', icon: '⭐', title: 'Mes favoris', text: 'Retrouver les prospects retenus' },
    { href: '/campaigns', icon: '📧', title: 'Mes campagnes', text: 'Préparer les prises de contact' },
    { href: '/history', icon: '📁', title: 'Historique', text: 'Revoir les recherches sauvegardées' },
  ]

  return (
    <main className={styles.page}>
      <MainAppNav plan={plan} active="home" />

      <div className={styles.container}>
        <header className={styles.welcome}>
          <div>
            <p className={styles.eyebrow}>Vue d’ensemble</p>
            <h1>Bonjour {firstName(user.name, user.email)}</h1>
            <p>Votre prochaine liste de prospects commence par une cible claire.</p>
          </div>
          <div className={styles.currentPlan}>
            <span>Plan actuel</span>
            <strong>{plan}</strong>
            {!isPro(plan) && <Link href="/pro">Voir le Plan Pro</Link>}
          </div>
        </header>

        {searchParams?.success === 'pro' && (
          <div className={styles.billingSuccess}>
            ✓ Paiement validé. Votre plan Pro est en cours d’activation.
          </div>
        )}
        {searchParams?.canceled === 'true' && (
          <div className={styles.billingCanceled}>
            Paiement annulé. Votre plan Gratuit reste actif.
          </div>
        )}

        <section className={styles.searchHero} aria-labelledby="new-search-title">
          <div className={styles.searchHeroIcon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M10.8 18.2a7.4 7.4 0 1 0 0-14.8 7.4 7.4 0 0 0 0 14.8Z" stroke="currentColor" strokeWidth="2" />
              <path d="m16.2 16.2 4.4 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M8.4 10.6h4.8M10.8 8.2V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div className={styles.searchHeroContent}>
            <p className={styles.eyebrow}>Commencer</p>
            <h2 id="new-search-title">Trouver des créateurs actifs</h2>
            <p>
              Définissez une niche, une langue et une taille de chaîne. ProspectTube classe ensuite les profils
              selon leur activité récente et leur potentiel pour vos services.
            </p>
            <div className={styles.searchHeroMeta} aria-label="Filtres disponibles">
              <span>Niche</span>
              <span>Langue</span>
              <span>Abonnés min/max</span>
            </div>
          </div>
          <Link href="/dashboard" className={styles.searchHeroButton}>
            Définir ma cible
          </Link>
        </section>

        <section className={styles.statsGrid} aria-label="Statistiques">
          {stats.map(stat => (
            <div key={stat.label} className={`${styles.statCard} ${stat.accent}`}>
              <div className={styles.statIcon}>{stat.icon}</div>
              <div>
                <strong>{stat.value.toLocaleString('fr-FR')}</strong>
                <span>{stat.label}</span>
              </div>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Derniers mouvements</p>
              <h2>Activité récente</h2>
            </div>
            <Link href="/history">Voir l’historique</Link>
          </div>
          <div className={styles.activityPanel}>
            {activities.length > 0 ? activities.map(activity => (
              <div key={activity.id} className={styles.activityRow}>
                <span className={styles.activityIcon}>{activity.icon}</span>
                <div className={styles.activityContent}>
                  <strong>{activity.title}</strong>
                  <span>{activity.detail}</span>
                </div>
                <time dateTime={activity.date.toISOString()}>{relativeDate(activity.date)}</time>
              </div>
            )) : (
              <div className={styles.emptyState}>
                Votre activité apparaîtra ici après votre première recherche.
              </div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Raccourcis</p>
              <h2>Actions rapides</h2>
            </div>
          </div>
          <div className={styles.actionsGrid}>
            {quickActions.map(action => (
              <Link href={action.href} key={action.href} className={styles.actionCard}>
                <span className={styles.actionIcon}>{action.icon}</span>
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.text}</p>
                </div>
                <span className={styles.arrow}>→</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
      <LegalFooter />
    </main>
  )
}
