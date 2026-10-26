# Mettre « Première vente » en ligne sur ton propre site

Ce dossier contient la formation complète, prête à être hébergée :

| Fichier | Rôle |
| --- | --- |
| `index.html` | toute la formation (missions, outils, vidéos, assistant) dans une seule page |
| `kit/` | les fichiers du kit à télécharger (Excel, Word, PDF) |
| `api/assistant.js` | la fonction serveur de l'assistant « Pose ta question » : elle garde ta clé API secrète |
| `package.json` | indique à l'hébergeur d'utiliser Node.js 20 ou plus |
| `api/config.js` | donne à la page l'adresse de ton projet Supabase, pour la connexion |
| `supabase.sql` | crée la table qui garde ta progression, à coller une fois dans Supabase |
| `supabase_equipes.sql` | crée les tables des équipes, à lancer après `supabase.sql` |

## Ce qui marche sur ton site, et ce qui reste dans Claude

| Fonction | Dans Claude | Sur ton site |
| --- | --- | --- |
| Missions, cases à cocher, calculateur, simulateur, échéancier, carnet de bord, vidéos | oui | oui ; chaque personne garde sa progression dans son navigateur |
| Kit à télécharger | oui | oui, en téléchargement direct |
| Assistant « Pose ta question » | oui, avec le compte Claude de chaque personne | oui, avec ta clé Gemini gratuite (ou une clé Claude payante) ; sans clé, il montre les passages de la formation |
| Compte (e-mail et mot de passe), progression sur plusieurs appareils | oui, avec le compte Claude | oui, avec Supabase (gratuit, section plus bas) ; sans Supabase, la progression reste dans le navigateur |
| Équipes d'associés | oui | oui, avec Supabase et `supabase_equipes.sql` (la présence « en ligne » reste réservée à Claude) |

## Mise en ligne gratuite : Vercel + Gemini (recommandé)

Tout est gratuit : l'offre Hobby de Vercel (usage personnel, non commercial ; si une limite est dépassée, la fonction est mise en pause, rien n'est facturé) et l'offre gratuite de l'API Gemini de Google pour l'assistant. Tarifs et limites vérifiés le 26/10/2026 ⏱.

### 1. Crée ta clé Gemini gratuite

1. Va sur Google AI Studio : https://aistudio.google.com/apikey et connecte-toi avec ton compte Google.
2. Accepte les conditions : AI Studio crée un projet et une clé. Sinon, clique sur « Create API key ».
3. Copie la clé et range-la dans ton gestionnaire de mots de passe. N'ajoute **pas** de moyen de paiement : sans facturation activée, tu restes sur l'offre gratuite.

Sur l'offre gratuite, Google peut utiliser les questions envoyées pour améliorer ses produits : n'écris pas d'informations personnelles dans tes questions (l'assistant n'envoie jamais ton adresse ni ton SIRET). L'offre gratuite a un nombre de questions par minute et par jour limité : largement assez pour toi seul ; si la limite du jour est atteinte, l'assistant te le dit et revient le lendemain.

Ne mets jamais cette clé dans `index.html`, dans un e-mail ou sur GitHub : elle se range uniquement dans les variables d'environnement de Vercel (étape 3).

### 2. Envoie la formation sur Vercel (glisser-déposer)

1. Va sur https://vercel.com/drop et crée ton compte gratuit (offre Hobby).
2. Glisse le fichier `premiere-vente.zip` dans la page (ou le dossier décompressé, celui qui contient `index.html`).
3. Donne un nom au projet et clique sur « Deploy ». Vercel te donne ton adresse en `….vercel.app`.

Si tu préfères la ligne de commande : `npx vercel` puis `npx vercel --prod` dans le dossier.

### 3. Ajoute les variables d'environnement

Dans ton projet Vercel, ouvre « Environment Variables », puis pour chaque variable : « Name », « Value », « Save ».

| Variable | Obligatoire | Valeur |
| --- | --- | --- |
| `GEMINI_API_KEY` | oui (pour l'assistant gratuit) | ta clé Gemini |
| `ASSISTANT_ACCESS_CODE` | fortement conseillé | un code que la page te demandera une fois, par exemple `BOUTIQUE-2026`. Sans code, toute personne qui trouve l'adresse du site peut épuiser ton quota |
| `ALLOWED_ORIGIN` | non | l'adresse exacte de ton site (`https://premiere-vente.vercel.app` par exemple) pour refuser les appels venant d'un autre site |
| `ASSISTANT_MODEL` | non | le modèle utilisé ; par défaut `gemini-3.8-flash` |
| `ANTHROPIC_API_KEY` | non | une clé Claude payante, à la place de Gemini (si les deux sont là, Gemini est utilisé) |

Les variables ne s'appliquent qu'aux nouveaux déploiements : **redéploie** ensuite le projet (onglet des déploiements, « Redeploy »).

### 4. Garde la formation pour toi (gratuit)

Dans les réglages du projet, partie Deployment Protection, active Vercel Authentication : seule une personne connectée à ton compte Vercel peut ouvrir le site.

### 5. Vérifie

1. Ouvre ton adresse et entre ton prénom ;
2. ouvre une mission et clique sur « Pose ta question » ;
3. pose une question : la page te demande le code d'accès une fois, puis la réponse s'écrit avec ses renvois vers les missions ;
4. ouvre la boîte à outils, « Kit à télécharger », et télécharge le classeur Excel.

Si la réponse affiche « L'assistant rédigé n'est pas activé sur ce site », la clé manque : ajoute `GEMINI_API_KEY` puis redéploie.

## Compte et progression sur tous tes appareils (Supabase, gratuit)

Avec Supabase, le site demande un e-mail et un mot de passe ; ta progression, ton carnet, tes notes et Ma boutique sont enregistrés avec ton compte et te suivent sur ton téléphone et ton ordinateur. L'offre gratuite de Supabase suffit largement (0 $ par mois ; un projet gratuit est mis en pause après une semaine sans activité : tu le relances d'un clic depuis le tableau de bord de Supabase, sans rien perdre). Vérifié le 26/10/2026 ⏱.

1. **Crée ton projet** sur https://supabase.com (compte gratuit, offre Free). Choisis une région en Europe et note le mot de passe de la base dans ton gestionnaire de mots de passe.
2. **Crée la table** : dans ton projet, ouvre le SQL Editor, colle tout le contenu de `supabase.sql` et lance-le. Chaque compte ne pourra lire et modifier que ses propres données.
3. **Copie l'adresse et la clé publique** : bouton « Connect » du projet (ou Settings > API Keys). L'adresse ressemble à `https://xxxx.supabase.co` ; la clé publique commence par `sb_publishable_`. Cette clé est faite pour être visible dans une page web. **Ne prends jamais la clé secrète** (`sb_secret_…`).
4. **Indique ton site à Supabase** : page « URL Configuration » (partie Authentication) : mets ton adresse Vercel dans « Site URL », et ajoute `https://ton-site.vercel.app/**` dans « Redirect URLs ». Sans ça, les liens de confirmation et de mot de passe oublié ne ramènent pas sur ton site.
5. **Ajoute deux variables sur Vercel** (« Environment Variables ») puis redéploie :

| Variable | Valeur |
| --- | --- |
| `SUPABASE_URL` | l'adresse du projet (`https://xxxx.supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | la clé publique (`sb_publishable_…`) |

6. **Crée ton compte** : ouvre ton site, « Créer un compte », puis clique sur le lien reçu par e-mail. Ta progression déjà faite dans ce navigateur est reprise dans ton compte.
7. **Ferme les inscriptions** (conseillé, une fois ton compte créé) : dans les réglages d'authentification de Supabase, désactive l'inscription de nouveaux utilisateurs. Personne d'autre ne pourra créer de compte sur ton site.

**Équipes** : lance aussi `supabase_equipes.sql` dans le SQL Editor (si l'éditeur n'accepte qu'une commande à la fois, lance chaque bloc séparé par une ligne vide, dans l'ordre). Chaque associé crée son compte sur le site, puis crée ou rejoint l'équipe avec le code de 6 caractères. Garde les inscriptions ouvertes tant que tes associés n'ont pas créé leur compte. Les membres d'une équipe voient la progression partagée des autres, jamais leur carnet, leurs notes ni Ma boutique ; les nouveautés de l'équipe arrivent en 20 secondes environ.

Mot de passe oublié : bouton « Mot de passe oublié ? » sur l'écran de connexion ; ouvre le lien reçu sur le même appareil, dans le même navigateur. Se déconnecter et changer de mot de passe : page Mon profil.

## Avec une clé Claude (payant, facultatif)

À la place de Gemini, tu peux mettre `ANTHROPIC_API_KEY` (clé de la Claude Console, crédit payé d'avance ; fixe une limite de dépense dans « Spend limits », « Set limit »). Avec Claude Haiku 5.5 (0,10 $ et 0,50 $ par million de tokens, tarif vérifié le 25/10/2026 ⏱), une question rapide coûte un peu moins de 0,001 $.

## La formation reste privée

`index.html` contient la balise `noindex` : les moteurs de recherche n'affichent pas le site. Pour que personne d'autre ne puisse l'ouvrir, active Vercel Authentication (étape 4, gratuit).

## Mettre à jour la formation

Quand la formation évolue, remplace `index.html` et le dossier `kit/` par les nouvelles versions, puis republie (`npx vercel --prod`, ou un nouveau glisser-déposer). Les progressions de tes élèves sont gardées dans leurs navigateurs et ne sont pas effacées.
