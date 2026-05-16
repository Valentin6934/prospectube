export const FAKE_CHANNELS = [
  { id: '1', name: 'PixelForge', subs: '87K', subsNum: 87000, niche: 'Gaming', lang: 'Français', freq: '3x/semaine', email: 'pixelforge@gmail.com', desc: 'Gaming FPS & RPG, montage dynamique avec beaucoup d\'effets visuels et transitions rapides.', avatar: 'PF', color: '#4F46E5' },
  { id: '2', name: 'TechXpro', subs: '234K', subsNum: 234000, niche: 'Tech', lang: 'Français', freq: '2x/semaine', email: 'contact@techxpro.fr', desc: 'Reviews tech et tutoriels programmation, style épuré et professionnel.', avatar: 'TX', color: '#0891B2' },
  { id: '3', name: 'MoneyMindset FR', subs: '145K', subsNum: 145000, niche: 'Finance', lang: 'Français', freq: '1x/semaine', email: 'contact@moneymindset.fr', desc: 'Investissement et liberté financière, audience très engagée et premium.', avatar: 'MM', color: '#D97706' },
  { id: '4', name: 'GamerzOne', subs: '412K', subsNum: 412000, niche: 'Gaming', lang: 'Français', freq: '5x/semaine', email: 'gameone@pro.fr', desc: 'Live gaming & highlights, montages rapides et rythmés, gros potentiel viral.', avatar: 'GZ', color: '#DC2626' },
  { id: '5', name: 'CodePulse', subs: '62K', subsNum: 62000, niche: 'Tech', lang: 'Français', freq: '2x/mois', email: 'codepulse@dev.fr', desc: 'Tutoriels dev web, cible développeurs juniors et reconversion pro.', avatar: 'CP', color: '#7C3AED' },
  { id: '6', name: 'FitLife FR', subs: '198K', subsNum: 198000, niche: 'Fitness', lang: 'Français', freq: '4x/semaine', email: 'fitlife@sport.fr', desc: 'Coaching sportif et nutrition, audience très fidèle et motivée.', avatar: 'FL', color: '#16A34A' },
  { id: '7', name: 'VoyageurLibre', subs: '321K', subsNum: 321000, niche: 'Voyage', lang: 'Français', freq: '1x/semaine', email: 'contact@voyageurlibre.com', desc: 'Voyages en solo et vlogs immersifs, contenu très cinématique.', avatar: 'VL', color: '#0284C7' },
  { id: '8', name: 'BeautyByLea', subs: '156K', subsNum: 156000, niche: 'Beauté', lang: 'Français', freq: '3x/semaine', email: 'lea@beautybyleafr.com', desc: 'Tutoriels maquillage et skincare, partenariats marques nombreux.', avatar: 'BL', color: '#DB2777' },
  { id: '9', name: 'ChefMaison', subs: '89K', subsNum: 89000, niche: 'Cuisine', lang: 'Français', freq: '2x/semaine', email: 'chef@maisonrecettes.fr', desc: 'Recettes faciles et rapides, ambiance chaleureuse et authentique.', avatar: 'CM', color: '#EA580C' },
  { id: '10', name: 'MindsetPro', subs: '275K', subsNum: 275000, niche: 'Lifestyle', lang: 'Français', freq: '2x/semaine', email: 'contact@mindsetpro.fr', desc: 'Développement personnel et productivité, contenu très inspirant.', avatar: 'MP', color: '#9333EA' },
  { id: '11', name: 'GamingEnglish', subs: '1.2M', subsNum: 1200000, niche: 'Gaming', lang: 'Anglais', freq: '7x/semaine', email: 'gaming@english.gg', desc: 'Top gaming channel, massive audience, high production value needed.', avatar: 'GE', color: '#1D4ED8' },
  { id: '12', name: 'TechReviewsES', subs: '445K', subsNum: 445000, niche: 'Tech', lang: 'Espagnol', freq: '3x/semaine', email: 'tech@reviewses.com', desc: 'Reviews tecnología en español, audiencia latinoamericana muy activa.', avatar: 'TR', color: '#B45309' },
  { id: '13', name: 'FinanzasSimples', subs: '187K', subsNum: 187000, niche: 'Finance', lang: 'Espagnol', freq: '2x/semaine', email: 'finanzas@simples.es', desc: 'Educación financiera en español, crecimiento muy rápido.', avatar: 'FS', color: '#047857' },
  { id: '14', name: 'MusicVibes', subs: '534K', subsNum: 534000, niche: 'Musique', lang: 'Anglais', freq: '4x/semaine', email: 'music@vibesyt.com', desc: 'Music production and beats, huge community of music lovers.', avatar: 'MV', color: '#7C3AED' },
  { id: '15', name: 'EduFrance', subs: '93K', subsNum: 93000, niche: 'Éducation', lang: 'Français', freq: '3x/semaine', email: 'contact@edufrance.fr', desc: 'Cours en ligne gratuits, maths et sciences, audience lycéens/étudiants.', avatar: 'EF', color: '#0369A1' },
]

export function filterChannels(niche: string, language: string, subsMin: number, subsMax: number) {
  return FAKE_CHANNELS.filter(ch => {
    const nicheMatch = !niche || ch.niche.toLowerCase().includes(niche.toLowerCase())
    const langMatch = !language || ch.lang.toLowerCase().includes(language.toLowerCase())
    const subsMatch = ch.subsNum >= subsMin && ch.subsNum <= subsMax
    return nicheMatch && langMatch && subsMatch
  })
}
