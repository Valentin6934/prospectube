export const PROSPECT_SCORE_THRESHOLDS = {
  exceptional: 90,
  excellent: 80,
  good: 65,
  medium: 50,
} as const

export const PROSPECT_SCORE_LEVELS = [
  {
    min: PROSPECT_SCORE_THRESHOLDS.exceptional,
    max: 100,
    label: 'Prospect exceptionnel',
    description: 'profil prioritaire avec de nombreux signaux favorables',
  },
  {
    min: PROSPECT_SCORE_THRESHOLDS.excellent,
    max: PROSPECT_SCORE_THRESHOLDS.exceptional - 1,
    label: 'Excellent',
    description: 'profil tres interessant a contacter',
  },
  {
    min: PROSPECT_SCORE_THRESHOLDS.good,
    max: PROSPECT_SCORE_THRESHOLDS.excellent - 1,
    label: 'Bon',
    description: 'profil pertinent',
  },
  {
    min: PROSPECT_SCORE_THRESHOLDS.medium,
    max: PROSPECT_SCORE_THRESHOLDS.good - 1,
    label: 'Moyen',
    description: 'potentiel a verifier',
  },
  {
    min: 0,
    max: PROSPECT_SCORE_THRESHOLDS.medium - 1,
    label: 'Faible',
    description: 'peu de signaux favorables',
  },
] as const

export const PROSPECT_SCORE_SIGNALS = [
  'coordonnees publiques : email, Instagram, TikTok, Twitch ou site web',
  'taille de chaine, notamment les audiences entre 10k et 1M abonnes',
  'activite : plus de 100 videos publiees',
  'performances : plus de 1M vues et ratio vues/abonnes superieur a 20',
  'anciennete : chaine de moins de 5 ans',
  'description suffisamment detaillee',
] as const

export const PROSPECT_SCORE_EXPLANATION =
  "Le Prospect Score estime le potentiel commercial d'une chaine a partir de signaux publics comme son activite, sa taille, ses performances et la presence de coordonnees. Il ne signifie pas que le createur recherche actuellement un prestataire : il aide simplement a identifier les profils les plus interessants a contacter."

export const PROSPECT_SCORE_TRANSPARENCY_NOTE =
  'Le score mesure un potentiel de prospection, pas un besoin confirme, une reponse garantie ou une opportunite certaine.'
