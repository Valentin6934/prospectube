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
  'vues medianes recentes, signal principal de budget et de traction : 30 points',
  'ratio vues medianes / abonnes, indicateur de croissance potentielle : 20 points',
  'frequence de publication : 15 points',
  'activite recente mesuree depuis la derniere video observee : 15 points',
  'potentiel de delegation du montage selon les formats et la viabilite de l audience : 15 points',
  'adequation au ciblage recherche : 5 points',
] as const

export const PROSPECT_SCORE_EXPLANATION =
  "Le Prospect Score estime le potentiel commercial pour un monteur video a partir de signaux publics recents : vues medianes, traction par rapport aux abonnes, regularite, activite et formats susceptibles d'etre delegues. La contactabilite est mesuree separement et n'augmente jamais le score."

export const PROSPECT_SCORE_TRANSPARENCY_NOTE =
  'Le score mesure un potentiel de prospection, pas un besoin confirme, une reponse garantie ou une opportunite certaine.'
