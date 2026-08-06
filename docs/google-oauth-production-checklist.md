# Checklist Google OAuth Gmail pour la Production

ProspectTube utilise Google uniquement comme intégration Gmail. L’authentification au produit reste assurée par NextAuth Credentials.

## Scopes demandés

- `openid` : associer de façon stable le compte Google autorisé.
- `email` : afficher à l’utilisateur quel compte Gmail est connecté.
- `profile` : lire l’identité minimale renvoyée par Google OpenID Connect.
- `https://www.googleapis.com/auth/gmail.compose` : créer les brouillons Gmail préparés par l’utilisateur.

Le code ne demande ni `https://mail.google.com/`, ni `gmail.readonly`, ni `gmail.modify`. Le scope `gmail.compose` est le scope Gmail minimal compatible avec la création de brouillons et peut nécessiter une vérification Google en tant que scope sensible.

## A. Écran de consentement OAuth

- Choisir l’audience **External** si ProspectTube doit être accessible au public.
- Utiliser le nom d’application **ProspectTube**.
- Renseigner un email d’assistance contrôlé.
- Déclarer le domaine d’accueil utilisé en Production.
- Déclarer les URL publiques de politique de confidentialité et de CGU.
- Vérifier que tous les domaines affichés correspondent au domaine réellement servi.

## B. Audience

- Vérifier si l’application est en mode **Testing** ou **In production**.
- En mode Testing, seuls les comptes ajoutés comme test users peuvent autoriser Gmail.
- Pour un accès public, publier l’application et terminer la procédure de vérification demandée par Google.
- Conserver une liste explicite des test users tant que l’application reste en Testing.

## C. Client OAuth Web

- Vérifier que le client est de type **Web application**.
- Déclarer exactement l’URI de redirection Production : `https://prospectube.vercel.app/api/gmail/callback`.
- Ne conserver une URI Preview que si un parcours Preview distinct est réellement nécessaire. Le code utilise actuellement le callback stable Production pour les Preview.
- Supprimer les anciens domaines devenus obsolètes après validation manuelle.
- Les origines JavaScript autorisées ne sont nécessaires que si un flux OAuth est lancé côté navigateur par le SDK Google ; le flux actuel part d’une route serveur.

## D. Scopes et vérification

- Conserver uniquement les quatre scopes listés ci-dessus.
- Vérifier la classification Google du scope `gmail.compose` au moment de la soumission.
- Préparer une justification : l’utilisateur rédige son message dans ProspectTube, puis demande explicitement la création d’un brouillon Gmail non envoyé.
- Préparer une vidéo montrant la connexion, la rédaction, la création du brouillon et la déconnexion si Google la demande.
- Soumettre l’application à la vérification adaptée avant ouverture publique.

## E. Vérification du domaine

- Vérifier la propriété du domaine avec le compte Google Cloud approprié.
- Assurer la cohérence entre le domaine vérifié, la landing page, la politique de confidentialité, les CGU et l’écran de consentement.

## Diagnostic des blocages publics

- `access_denied` : autorisation annulée par l’utilisateur.
- `redirect_uri_mismatch` : URI exacte absente du client OAuth Web.
- application non vérifiée : consent screen ou scopes pas encore approuvés.
- compte non autorisé : application en Testing et compte absent des test users, ou restriction d’organisation Google Workspace.
- configuration absente : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ou secret de session manquant dans l’environnement.

Ne jamais copier de token, code OAuth, secret client ou URL contenant un code dans un ticket ou un journal.
