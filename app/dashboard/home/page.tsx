import type { CSSProperties } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import HomeSignOutButton from '@/components/HomeSignOutButton'
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

function goalTargets(plan: string) {
  if (plan === 'Agence') return { prospects: 500, emails: 250, campaigns: 30, messages: 200 }
  if (plan === 'Pro') return { prospects: 100, emails: 50, campaigns: 10, messages: 50 }
  return { prospects: 10, emails: 5, campaigns: 2, messages: 5 }
}

export default async function DashboardHomePage() {
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
    favoriteEmailCount,
    campaignEmailCount,
    generatedCampaignCount,
    generatedIndividualCount,
    recentSearches,
    recentFavorites,
    recentCampaigns,
    recentGeneratedCampaigns,
    recentGeneratedIndividuals,
  ] = await Promise.all([
    prisma.search.count({ where: { userId: user.id } }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.campaign.count({ where: { userId: user.id } }),
    prisma.campaignProspect.count({ where: { campaign: { userId: user.id } } }),
    prisma.favorite.count({ where: { userId: user.id, email: { not: null } } }),
    prisma.campaignProspect.count({
      where: { campaign: { userId: user.id }, email: { not: null } },
    }),
    prisma.campaignProspect.count({
      where: { campaign: { userId: user.id }, generatedBody: { not: null } },
    }),
    prisma.emailSent.count({ where: { userId: user.id } }),
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
    prisma.emailSent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, channelName: true, createdAt: true },
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
      title: 'Message IA généré',
      detail: item.name,
      date: item.createdAt,
    })),
    ...recentGeneratedIndividuals.map(item => ({
      id: `message-${item.id}`,
      icon: '✨',
      title: 'Message IA généré',
      detail: item.channelName,
      date: item.createdAt,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5)

  const savedProspects = favoriteCount + campaignProspectCount
  const emailsFound = favoriteEmailCount + campaignEmailCount
  const generatedMessages = generatedCampaignCount + generatedIndividualCount
  const targets = goalTargets(user.plan)

  const stats = [
    { icon: '🔍', label: 'Recherches', value: searchCount, accent: styles.violet },
    { icon: '⭐', label: 'Favoris', value: favoriteCount, accent: styles.amber },
    { icon: '📧', label: 'Campagnes', value: campaignCount, accent: styles.cyan },
    { icon: '👥', label: 'Prospects sauvegardés', value: savedProspects, accent: styles.green },
  ]

  const quickActions = [
    { href: '/dashboard', icon: '🔍', title: 'Nouvelle recherche', text: 'Trouver de nouveaux créateurs' },
    { href: '/favorites', icon: '⭐', title: 'Mes favoris', text: 'Retrouver les prospects retenus' },
    { href: '/campaigns', icon: '📧', title: 'Mes campagnes', text: 'Préparer les prises de contact' },
    { href: '/history', icon: '📁', title: 'Historique', text: 'Revoir les recherches sauvegardées' },
  ]

  const goals = [
    { label: 'Prospects sauvegardés', value: savedProspects, target: targets.prospects, color: '#8b5cf6' },
    { label: 'Emails trouvés', value: emailsFound, target: targets.emails, color: '#22c55e' },
    { label: 'Campagnes créées', value: campaignCount, target: targets.campaigns, color: '#38bdf8' },
    { label: 'Messages IA générés', value: generatedMessages, target: targets.messages, color: '#f59e0b' },
  ]

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/dashboard/home" className={styles.logo}>
            Prospect<span>Tube</span>
          </Link>
          <div className={styles.navActions}>
            <div className={styles.secondaryNav}>
              <Link href="/dashboard/home" aria-current="page">🏠 Accueil</Link>
              <Link href="/favorites">Favoris</Link>
              <Link href="/history">Historique</Link>
              <Link href="/campaigns">Campagnes</Link>
            </div>
            <Link href="/dashboard" className={styles.searchButton}>Nouvelle recherche</Link>
            <span className={styles.planBadge}>Plan {user.plan}</span>
            <HomeSignOutButton className={styles.signOut} />
          </div>
        </div>
      </nav>

      <div className={styles.container}>
        <header className={styles.welcome}>
          <div>
            <p className={styles.eyebrow}>Vue d’ensemble</p>
            <h1>Bonjour {firstName(user.name, user.email)} 👋</h1>
            <p>Voici où en est votre prospection aujourd’hui.</p>
          </div>
          <div className={styles.currentPlan}>
            <span>Plan actuel</span>
            <strong>{user.plan}</strong>
          </div>
        </header>

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

        <section className={styles.lowerGrid}>
          <div className={styles.goalsPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Ce mois-ci</p>
                <h2>Objectifs</h2>
              </div>
            </div>
            <div className={styles.goalsList}>
              {goals.map(goal => {
                const percent = Math.min(100, Math.round((goal.value / goal.target) * 100))
                return (
                  <div key={goal.label} className={styles.goal}>
                    <div className={styles.goalMeta}>
                      <span>{goal.label}</span>
                      <strong>{goal.value} / {goal.target}</strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${percent}%`, background: goal.color } as CSSProperties}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className={styles.tipPanel}>
            <div className={styles.tipIcon}>💡</div>
            <p className={styles.eyebrow}>Conseil du jour</p>
            <h2>Visez les créateurs accessibles</h2>
            <p>
              Les chaînes entre 20 000 et 150 000 abonnés répondent généralement plus souvent
              aux propositions personnalisées.
            </p>
            <Link href="/dashboard">Lancer une recherche →</Link>
          </aside>
        </section>
      </div>
    </main>
  )
}
