'use client'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function HomePage() {
  const router = useRouter()
  const { data: session } = useSession()

  const plans = [
    { name: 'Gratuit', price: '0€', period: '/mois', desc: 'Pour démarrer', searches: '5 recherches/mois', results: '3 résultats', emails: false, scraping: false, export: false, cta: 'Commencer gratuitement', featured: false },
    { name: 'Pro', price: '9,90€', period: '/mois', desc: 'Pour les monteurs actifs', searches: '200 recherches/mois', results: '20 résultats', emails: true, scraping: true, export: true, cta: 'Passer au Pro', featured: true },
  ]

  return (
    <main style={{ background: '#0A0812', minHeight: '100vh', color: '#F0EDF8' }}>
      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,8,18,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,58,183,0.25)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.3rem', cursor: 'pointer' }} onClick={() => router.push('/')}>
          Prospect<span style={{ background: 'linear-gradient(135deg,#533AB7,#7B63D3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tube</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {session ? (
            <button onClick={() => router.push('/dashboard/home')} style={{ background: 'linear-gradient(135deg,#533AB7,#7B63D3)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>Dashboard →</button>
          ) : (
            <>
              <button onClick={() => router.push('/login')} style={{ background: 'none', border: '1px solid rgba(83,58,183,0.5)', color: '#A89FCC', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Connexion</button>
              <button onClick={() => router.push('/register')} style={{ background: 'linear-gradient(135deg,#533AB7,#7B63D3)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>Inscription gratuite</button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '6rem 2rem 4rem', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '600px', background: 'radial-gradient(ellipse,rgba(83,58,183,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(83,58,183,0.15)', border: '1px solid rgba(83,58,183,0.4)', color: '#a78bfa', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', marginBottom: '1.5rem' }}>
          ✨ Prospection automatique pour monteurs vidéo
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: '1.25rem', maxWidth: '700px', margin: '0 auto 1.25rem' }}>
          Trouve des clients YouTube<br />
          <span style={{ background: 'linear-gradient(135deg,#533AB7,#7B63D3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>en quelques secondes</span>
        </h1>
        <p style={{ color: '#A89FCC', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Recherche des YouTubeurs par niche, abonnés et langue. Génère des emails de prospection personnalisés par IA et développe ton activité de montage.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/register')} style={{ background: 'linear-gradient(135deg,#533AB7,#7B63D3)', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '10px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(83,58,183,0.4)' }}>
            Commencer gratuitement →
          </button>
          <button onClick={() => router.push('/login')} style={{ background: 'none', color: '#A89FCC', border: '1px solid rgba(83,58,183,0.4)', padding: '14px 32px', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer' }}>
            Se connecter
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginTop: '3rem', flexWrap: 'wrap' }}>
          {[['500+', 'Chaînes indexées'], ['IA', 'Emails personnalisés'], ['2 plans', 'Simples et transparents']].map(([n, l]) => (
            <div key={n} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.8rem', fontWeight: 800 }}>{n}</div>
              <div style={{ color: '#A89FCC', fontSize: '13px' }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: '2rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.5rem' }}>Tarifs simples et transparents</h2>
        <p style={{ color: '#A89FCC', textAlign: 'center', marginBottom: '3rem' }}>Sans engagement, changez de plan à tout moment</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '20px' }}>
          {plans.map(plan => (
            <div key={plan.name} style={{ background: plan.featured ? 'rgba(83,58,183,0.1)' : 'rgba(18,15,30,0.95)', border: `${plan.featured ? '2px' : '1px'} solid ${plan.featured ? '#533AB7' : 'rgba(83,58,183,0.25)'}`, borderRadius: '16px', padding: '2rem', position: 'relative' }}>
              {plan.featured && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#533AB7,#7B63D3)', color: '#fff', padding: '4px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>⭐ Plus populaire</div>}
              <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{plan.name}</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#533AB7', margin: '8px 0 4px' }}>{plan.price}<span style={{ fontSize: '14px', color: '#A89FCC', fontWeight: 400 }}>{plan.period}</span></div>
              <div style={{ color: '#A89FCC', fontSize: '13px', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(83,58,183,0.2)' }}>{plan.desc}</div>
              {[
                ['✓', plan.searches],
                ['✓', plan.results],
                [plan.emails ? '✓' : '–', 'Emails IA personnalisés'],
                [plan.scraping ? '✓' : '–', 'Scraping emails auto'],
                [plan.export ? '✓' : '–', 'Export CSV'],
              ].map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '14px', color: icon === '✓' ? '#F0EDF8' : '#6B5F96' }}>
                  <span style={{ color: icon === '✓' ? '#22c55e' : '#6B5F96' }}>{icon}</span>{label}
                </div>
              ))}
              <button onClick={() => router.push('/register')} style={{ display: 'block', width: '100%', marginTop: '1.5rem', padding: '12px', background: plan.featured ? 'linear-gradient(135deg,#533AB7,#7B63D3)' : 'none', color: plan.featured ? '#fff' : '#A89FCC', border: plan.featured ? 'none' : '1px solid rgba(83,58,183,0.4)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
