export const FAKE_CHANNELS = [
  { id: '1', name: 'PixelForge', subs: '87K', subsNum: 87000, niche: 'Gaming', lang: 'Français', freq: '3x/semaine', email: 'contact@pixelforge.fr', desc: 'Gaming FPS & RPG, montage dynamique avec beaucoup d\'effets visuels et transitions rapides.', avatar: 'PF', color: '#7B63D3' },
  { id: '2', name: 'TechXpro', subs: '234K', subsNum: 234000, niche: 'Tech', lang: 'Français', freq: '2x/semaine', email: null, desc: 'Reviews tech et tutoriels, style épuré et professionnel, beaucoup de B-roll.', avatar: 'TX', color: '#0F6E56' },
  { id: '3', name: 'MoneyMindset FR', subs: '145K', subsNum: 145000, niche: 'Finance', lang: 'Français', freq: '1x/semaine', email: 'contact@moneymindset.fr', desc: 'Investissement et liberté financière, audience très engagée, format long.', avatar: 'MM', color: '#B45309' },
  { id: '4', name: 'GamerzOne', subs: '412K', subsNum: 412000, niche: 'Gaming', lang: 'Français', freq: '5x/semaine', email: 'gameone@pro.fr', desc: 'Live gaming & highlights, montages rapides rythmés, très grosse communauté.', avatar: 'GZ', color: '#9D1717' },
  { id: '5', name: 'CodePulse', subs: '62K', subsNum: 62000, niche: 'Tech', lang: 'Français', freq: '2x/mois', email: null, desc: 'Tutoriels dev web, cible développeurs juniors, format didactique.', avatar: 'CP', color: '#0C447C' },
  { id: '6', name: 'FitLife FR', subs: '178K', subsNum: 178000, niche: 'Fitness', lang: 'Français', freq: '4x/semaine', email: 'fitlife@gmail.com', desc: 'Workouts et nutrition, style motivant et énergique, beaucoup de before/after.', avatar: 'FL', color: '#166534' },
  { id: '7', name: 'ChefMaison', subs: '95K', subsNum: 95000, niche: 'Cuisine', lang: 'Français', freq: '3x/semaine', email: 'chef@maison.fr', desc: 'Recettes du quotidien, format court et efficace, belle photo food.', avatar: 'CM', color: '#92400E' },
  { id: '8', name: 'VoyageLibre', subs: '320K', subsNum: 320000, niche: 'Voyage', lang: 'Français', freq: '1x/semaine', email: null, desc: 'Vlogs de voyage monde entier, cinématique, beaucoup de drone.', avatar: 'VL', color: '#1E40AF' },
  { id: '9', name: 'MusikProd', subs: '54K', subsNum: 54000, niche: 'Musique', lang: 'Français', freq: '2x/semaine', email: 'musik@prod.fr', desc: 'Production musicale et beatmaking, tutoriels techniques, communauté passionnée.', avatar: 'MP', color: '#6D28D9' },
  { id: '10', name: 'StyleParis', subs: '267K', subsNum: 267000, niche: 'Mode', lang: 'Français', freq: '3x/semaine', email: 'style@paris.fr', desc: 'Mode et lifestyle parisien, contenu très esthétique, brand deals nombreux.', avatar: 'SP', color: '#BE185D' },
  { id: '11', name: 'GamingEnglish', subs: '1.2M', subsNum: 1200000, niche: 'Gaming', lang: 'Anglais', freq: '7x/semaine', email: 'contact@gamingenglish.com', desc: 'Top gaming channel, Fortnite & Minecraft, montage ultra dynamique.', avatar: 'GE', color: '#7B63D3' },
  { id: '12', name: 'TechReviewPro', subs: '890K', subsNum: 890000, niche: 'Tech', lang: 'Anglais', freq: '3x/semaine', email: null, desc: 'Smartphone reviews and unboxings, professional setup, millions of views.', avatar: 'TR', color: '#0F6E56' },
  { id: '13', name: 'FinanceEspanol', subs: '445K', subsNum: 445000, niche: 'Finance', lang: 'Espagnol', freq: '2x/semaine', email: 'finanza@espanol.com', desc: 'Inversiones y libertad financiera, gran audiencia latinoamericana.', avatar: 'FE', color: '#B45309' },
  { id: '14', name: 'EduBrasil', subs: '234K', subsNum: 234000, niche: 'Éducation', lang: 'Portugais', freq: '5x/semaine', email: 'edu@brasil.com', desc: 'Educação e desenvolvimento pessoal, formato dinâmico e envolvente.', avatar: 'EB', color: '#166534' },
  { id: '15', name: 'LifestyleDE', subs: '123K', subsNum: 123000, niche: 'Lifestyle', lang: 'Allemand', freq: '2x/semaine', email: 'lifestyle@de.com', desc: 'Deutsches Lifestyle-Kanal, Reisen und Ernährung, sehr engagierte Community.', avatar: 'LD', color: '#0C447C' },
]

export function filterChannels(niche: string, lang: string, subsMin: number, subsMax: number) {
  return FAKE_CHANNELS.filter(ch => {
    const matchNiche = !niche || ch.niche.toLowerCase().includes(niche.toLowerCase())
    const matchLang = !lang || ch.lang.toLowerCase() === lang.toLowerCase()
    const matchSubs = ch.subsNum >= subsMin && ch.subsNum <= subsMax
    return matchNiche && matchLang && matchSubs
  })
}

export const PLAN_LIMITS = {
  'Gratuit': { searches: 5, results: 3, emailAI: false },
  'Pro': { searches: 200, results: 20, emailAI: true },
  'Agence': { searches: 9999, results: 50, emailAI: true },
}
