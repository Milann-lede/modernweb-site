# 🔐 Stratégie de Durcissement Sécurité - ModernWeb

> **Document de référence** pour l'équipe technique.  
> Dernière mise à jour : 22 janvier 2026  
> Standards appliqués : OWASP ASVS v4.0, NIST SP 800-63B, RFC 6797/7034

---

## 📋 Résumé Exécutif

Ce document décrit les mesures de sécurité appliquées au dashboard ModernWeb. L'objectif est de renforcer la sécurité **sans impact fonctionnel** sur l'application existante.

### Principe : Sécurité en Profondeur (Defense in Depth)

Chaque couche ajoute une protection supplémentaire :

```
┌─────────────────────────────────────────┐
│           Navigateur Client             │
│  (CSP meta tags, referrer policy)       │
├─────────────────────────────────────────┤
│           Serveur Apache                │
│  (.htaccess, headers HTTP, mod_security)│
├─────────────────────────────────────────┤
│           Application PHP               │
│  (middleware, validation, rate limiting)│
├─────────────────────────────────────────┤
│           Supabase Backend              │
│  (RLS, Auth, hachage serveur)           │
└─────────────────────────────────────────┘
```

---

## ✅ Mesures Implémentées

### 1. En-têtes HTTP de Sécurité (`.htaccess`)

| Header | Protection | Standard |
|--------|-----------|----------|
| `Strict-Transport-Security` | Force HTTPS, prévient SSL stripping | RFC 6797 |
| `X-Frame-Options: SAMEORIGIN` | Anti-clickjacking | RFC 7034 |
| `X-Content-Type-Options: nosniff` | Prévient MIME sniffing | OWASP |
| `Content-Security-Policy` | Contrôle des sources de contenu | OWASP ASVS 14.4 |
| `Permissions-Policy` | Désactive APIs non utilisées | W3C |
| `Referrer-Policy` | Limite fuite d'informations | W3C |

**Fichier concerné** : [.htaccess](../.htaccess)

### 2. Protection des Fichiers Sensibles

Les fichiers suivants sont bloqués par le serveur :
- `*.sql`, `*.log`, `*.bak`, `*.env`, `*.config`
- `claude.md`, `README.md`, `package.json`
- Dossiers `/sql/`, `/email_templates/`

### 3. Rate Limiting (Anti Brute Force)

**Standard** : OWASP ASVS 2.2.1

| Endpoint | Limite | Fenêtre | Lockout |
|----------|--------|---------|---------|
| `/api/send-email.php` | 10 requêtes | 5 min | HTTP 429 |
| `/api/send-contact.php` | 10 requêtes | 5 min | HTTP 429 |
| Admin login (JS) | 5 tentatives | - | 15 min |

**Implémentation** :
- Côté serveur : Fichiers temporaires par IP (`sys_get_temp_dir()`)
- Côté client : `localStorage` pour le rate limiting login

### 4. Validation des Entrées

**Standard** : OWASP ASVS Section 5

| Type | Protection | Méthode |
|------|-----------|---------|
| Email | Validation format + CRLF injection | `filter_var()` + regex |
| Texte | Échappement HTML | `htmlspecialchars()` |
| Payload | Limite de taille | `strlen() > 50000` |
| JSON | Validation structure | `json_decode()` + `is_array()` |

### 5. CORS Restrictif

**Origines autorisées** (à durcir en production) :
- `https://modernweb.fr`
- `https://www.modernweb.fr`
- `http://localhost:3000` *(dev only)*
- `http://127.0.0.1:5500` *(dev only)*

⚠️ **Action requise** : Retirer les origines localhost en production.

### 6. Journalisation de Sécurité

**Fichier** : [api/security-logger.php](../api/security-logger.php)

**Événements loggés** :
- `AUTH_FAILURE` / `AUTH_SUCCESS`
- `RATE_LIMIT_EXCEEDED`
- `INJECTION_ATTEMPT`
- `CORS_VIOLATION`
- `BRUTE_FORCE_DETECTED`

**Format** : JSON (exploitable par SIEM)

**Emplacement logs** : `/logs/security_YYYY-MM.log`

---

## 🔒 Authentification (Déjà en place)

L'authentification utilise **Supabase Auth** qui gère nativement :

| Aspect | Implémentation | Standard |
|--------|---------------|----------|
| Hachage mot de passe | bcrypt côté serveur (Supabase) | NIST SP 800-63B |
| Session tokens | JWT signé HS256 | RFC 7519 |
| Timeout session | 30 min inactivité (JS) | OWASP ASVS 3.3.1 |
| Whitelist admin | Vérification email côté client + RLS | Defense in depth |

**Note importante** : Le hachage des mots de passe est géré par Supabase. Nous n'avons pas accès aux mots de passe en clair.

---

## ⚠️ Limitations et Points d'Attention

### Ce qui ne peut PAS être vérifié sans accès au serveur :

1. **Configuration PHP** (`php.ini`) :
   - `session.cookie_httponly = On`
   - `session.cookie_secure = On`
   - `session.cookie_samesite = Strict`
   - `expose_php = Off`

2. **Configuration Supabase** :
   - Politiques RLS complètes
   - Configuration Auth (durée tokens, etc.)

3. **Certificat SSL/TLS** :
   - Version TLS 1.2+ requise
   - Configuration cipher suites

### Recommandations serveur (à valider avec l'hébergeur OVH) :

```ini
# php.ini recommandé
session.cookie_httponly = On
session.cookie_secure = On
session.cookie_samesite = Strict
session.use_strict_mode = On
expose_php = Off
display_errors = Off
log_errors = On
```

---

## 📁 Fichiers Créés/Modifiés

| Fichier | Action | Description |
|---------|--------|-------------|
| `.htaccess` | Créé | Configuration Apache sécurisée |
| `api/security-middleware.php` | Créé | Middleware de sécurité réutilisable |
| `api/security-logger.php` | Créé | Journalisation des événements |
| `api/send-email.php` | Modifié | Rate limiting + CORS + validation |
| `admin/index.html` | Modifié | Meta headers sécurité |
| `admin/login.html` | Modifié | Meta headers sécurité |
| `index.html` | Modifié | Meta headers sécurité |

---

## 🚀 Actions Post-Déploiement

### Immédiat (avant mise en prod)

- [ ] Retirer origines localhost du CORS (`api/*.php`, `.htaccess`)
- [ ] Activer redirection HTTPS dans `.htaccess` (décommenter)
- [ ] Vérifier que le dossier `/logs/` est créé et accessible en écriture

### Court terme (< 1 semaine)

- [ ] Vérifier configuration `php.ini` avec OVH
- [ ] Tester rate limiting en conditions réelles
- [ ] Configurer alertes sur logs sécurité

### Moyen terme (< 1 mois)

- [ ] Audit Supabase RLS policies
- [ ] Test de pénétration léger (OWASP ZAP)
- [ ] Durcir CSP progressivement (retirer `unsafe-inline`)

---

## 📊 Matrice des Risques Résiduels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Brute force login | Faible | Moyen | Rate limiting client + serveur |
| XSS stocké | Très faible | Élevé | Échappement systématique |
| CSRF | Faible | Moyen | Origin validation + SameSite cookies |
| Injection SQL | Très faible | Critique | Supabase parameterized queries |
| DoS applicatif | Moyen | Moyen | Rate limiting + payload size |

---

## 📞 Contacts

- **Responsable sécurité** : [À définir]
- **Hébergeur OVH** : Support technique
- **Supabase** : dashboard.supabase.com

---

*Ce document ne garantit pas une sécurité absolue. La sécurité est un processus continu qui nécessite des mises à jour régulières.*
