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
  'adequation au ciblage et pertinence des metadonnees video recentes : 25 points',
  'activite et regularite recentes : 20 points',
  'vues medianes recentes : 20 points',
  'ratio vues medianes recentes / abonnes : 15 points',
  'engagement recent lorsque disponible : 10 points',
  'potentiel commercial lie a la taille et au rythme de publication : 10 points',
] as const

export const PROSPECT_SCORE_EXPLANATION =
  "Le Prospect Score estime l'adequation commerciale a partir de signaux publics issus d'un echantillon borne de metadonnees video recentes : pertinence thematique, regularite, vues medianes, ratio recent et engagement disponible. La contactabilite est mesuree separement et n'augmente pas le score."

export const PROSPECT_SCORE_TRANSPARENCY_NOTE =
  'Le score mesure un potentiel de prospection, pas un besoin confirme, une reponse garantie ou une opportunite certaine.'
