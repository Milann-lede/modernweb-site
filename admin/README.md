# ModernWeb Dashboard — Documentation

## 📋 Vue d'ensemble

Le dashboard ModernWeb est un outil d'administration interne permettant de gérer :
- **Les projets** affichés sur le site public
- **Les briefs clients** (PDF de définition de projet)
- **Les avis clients** (lecture seule)
- **Les paramètres** (changement de mot de passe)

## 🔐 Authentification

### Accès
- **Email** : le compte administrateur créé dans votre projet Supabase
- **URL** : `/admin/login.html`

### Mot de passe initial
Le mot de passe doit être configuré via Supabase Auth Dashboard :
1. Aller sur https://supabase.com/dashboard
2. Sélectionner le projet ModernWeb
3. Authentication → Users
4. Créer l'utilisateur ou réinitialiser le mot de passe

### Sécurité
- Session gérée par Supabase Auth
- Tokens JWT sécurisés
- Protection des routes côté client et serveur (RLS)
- Seul l'email autorisé peut accéder au dashboard

## 🗄️ Configuration Supabase

### Tables requises

Exécuter le script SQL dans `admin/sql/setup.sql` :

```sql
-- Créer les tables
- projects (gestion des projets)
- client_briefs (métadonnées des PDF)
- admin_settings (paramètres)
```

### Storage Buckets

Créer manuellement dans Supabase Storage :
1. `project-images` — Public, pour les images des projets
2. `client-briefs` — Privé, pour les PDF clients

### Row Level Security (RLS)

Les politiques RLS sont définies dans le script SQL :
- **projects** : lecture publique (publiés), écriture authentifiée
- **client_briefs** : accès authentifié uniquement
- **admin_settings** : accès authentifié uniquement

## 📁 Structure des fichiers

```
/admin/
├── index.html          # Dashboard principal
├── login.html          # Page de connexion
├── css/
│   ├── admin.css       # Styles globaux du dashboard
│   ├── login.css       # Styles page login
│   └── dashboard.css   # Styles spécifiques dashboard
├── js/
│   ├── admin-auth.js   # Module authentification
│   ├── admin-toast.js  # Notifications toast
│   ├── admin-projects.js # Gestion des projets
│   ├── admin-briefs.js # Gestion des PDF
│   ├── admin-reviews.js # Affichage des avis
│   ├── dashboard.js    # Script principal
│   └── login.js        # Script page login
└── sql/
    └── setup.sql       # Script création tables
```

## 🎯 Fonctionnalités

### Gestion des projets
- ✅ Ajouter un projet
- ✅ Modifier un projet
- ✅ Supprimer un projet (avec confirmation)
- ✅ Filtrer par statut/catégorie
- ✅ Recherche textuelle
- ✅ Upload d'images
- ✅ Génération automatique du slug

### Champs projet
| Champ | Type | Description |
|-------|------|-------------|
| name | string | Nom du projet (requis) |
| slug | string | URL-friendly (auto-généré) |
| client_type | enum | particulier / professionnel |
| category | enum | nature / tech / gaming / construction / autre |
| short_description | text | Description courte |
| full_description | text | Description détaillée |
| technologies | array | Liste des technologies |
| project_date | date | Date du projet |
| status | enum | draft / in_progress / completed / published |
| thumbnail_url | url | Image principale |
| external_link | url | Lien vers le site |
| is_featured | boolean | Mise en avant |

### Gestion des briefs
- ✅ Liste des briefs reçus
- ✅ Téléchargement des PDF
- ✅ Changement de statut (nouveau → consulté → archivé)
- ✅ Filtrage et recherche

### Paramètres
- ✅ Changement de mot de passe
- ✅ Informations du compte

## 🔗 Intégration site public

Le service `js/projects-service.js` permet d'afficher les projets sur le site :

```javascript
// Récupérer les projets publiés
const projects = await ProjectsService.getPublishedProjects();

// Récupérer les projets mis en avant
const featured = await ProjectsService.getFeaturedProjects();

// Générer le HTML d'une carte
const html = ProjectsService.renderProjectCard(project);
```

## 🚀 Déploiement

1. Exécuter le script SQL dans Supabase
2. Créer les buckets Storage
3. Créer l'utilisateur admin dans Supabase Auth
4. Déployer les fichiers sur le serveur
5. Tester la connexion sur `/admin/login.html`

## ⚠️ Notes importantes

- Le dashboard n'est pas indexé (robots noindex)
- Les briefs PDF sont stockés de manière privée
- Les projets en mode "brouillon" ne sont pas visibles sur le site public
- La déconnexion supprime la session locale et Supabase
