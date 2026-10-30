# ModernWeb

Website of **ModernWeb**, a web agency based in Lille (France): service presentation, project showcase, customer reviews, contact and project-brief forms, and a private admin dashboard.

Production site: [modernweb.fr](https://modernweb.fr)

> **License:** all rights reserved. The source is public for viewing only. See [License](#license).

## Table of contents

- [Overview](#overview)
- [Preview](#preview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Usage](#usage)
- [Available scripts](#available-scripts)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Overview

ModernWeb is a multi-page website with no build step: static HTML, CSS and vanilla JavaScript on the front end, a small PHP API for e-mail and analytics endpoints, and Supabase as the data backend for projects, reviews and the admin area. It is served by Apache (see `.htaccess`).

## Preview

<!-- TODO: add screenshots, e.g. ![Home page](docs/screenshots/home.png) -->
_Screenshots to be added._

## Features

| Area | What it does |
| --- | --- |
| Public pages | Home, services, portfolio (`realisations`), reviews, about, contact, legal notice, privacy policy |
| Project brief | Multi-step form (`definir-mon-projet`) to describe a project |
| Contact | Contact form handled by the PHP API (`api/send-contact.php`) |
| Reviews | Customer review submission (EmailJS) and display (Supabase) |
| Portfolio | Projects loaded from Supabase and shown on the home and portfolio pages |
| Cookie consent | Consent banner (`js/cookie-consent.js`) |
| Analytics | Custom page-view tracker stored in Supabase (`js/analytics-tracker.js`) |
| Admin dashboard | Private area (`/admin`) to manage projects, briefs and reviews, with analytics views |
| Server hardening | Security headers, rate limiting, input validation and security logging in `api/` |
| PWA metadata | `manifest.json` |

## Tech stack

- **Front end:** HTML5, CSS3, vanilla JavaScript
- **Back end:** PHP (mail endpoints, analytics API, security middleware)
- **Database / auth:** [Supabase](https://supabase.com) (via `@supabase/supabase-js` loaded from CDN)
- **E-mail:** PHP `mail()` and [EmailJS](https://www.emailjs.com)
- **Web server:** Apache (`.htaccess`)
- **Tooling:** Python + [Pillow](https://python-pillow.org) for image optimization (`python/optimize_images.py`)
- **Third-party assets:** Font Awesome and Google Fonts (CDN)

## Project structure

```text
.
├── index.html
├── manifest.json
├── .htaccess              # Apache rules, security headers
├── .env.example           # Server environment variables (placeholders)
├── admin/                 # Private dashboard (login, projects, briefs, reviews, analytics)
├── api/                   # PHP endpoints and security helpers
│   ├── send-contact.php
│   ├── send-email.php
│   ├── analytics.php
│   ├── rate-limiter.php
│   ├── security-headers.php
│   ├── security-logger.php
│   └── security-middleware.php
├── css/                   # Stylesheets
├── js/                    # Front-end scripts
│   └── config.example.js  # Template for js/config.js
├── pages/                 # Secondary pages
├── email_templates/       # HTML e-mail template
├── images/
├── python/                # Image optimization script
├── SECURITY.md
└── LICENSE
```

## Getting started

**Prerequisites:** PHP 8+ (to run the API locally), a Supabase project, an EmailJS account. Python 3 with Pillow is only needed for image optimization.

1. Clone the repository:

   ```bash
   git clone https://github.com/Milann-lede/modernweb-site.git
   cd modernweb-site
   ```

2. Create the front-end configuration from the template:

   ```bash
   cp js/config.example.js js/config.js
   ```

3. Fill in `js/config.js` with your own EmailJS and Supabase (anon key) values.
4. Start a local server:

   ```bash
   php -S localhost:8000
   ```

5. Open <http://localhost:8000>.

Notes: `.htaccess` rules only apply under Apache, and `mail()` usually fails on a local machine.

## Configuration

**Front end** — `js/config.js` (git-ignored, created from `js/config.example.js`):

| Key | Description |
| --- | --- |
| `EMAILJS_CONFIG.*` | EmailJS public keys, service IDs and template IDs (contact and reviews) |
| `SUPABASE_CONFIG.URL` | Your Supabase project URL |
| `SUPABASE_CONFIG.KEY` | Your Supabase **anon** key. Never use a `service_role` key in the browser |

**Server** — environment variables, see `.env.example`:

| Variable | Description |
| --- | --- |
| `DASHBOARD_API_KEY_HASH` | SHA-256 hash of the API key protecting `api/analytics.php`. If unset, access is denied |

Set it in Apache, for example with `SetEnv DASHBOARD_API_KEY_HASH <hash>`. Generate a hash with:

```bash
php -r "echo hash('sha256', 'YOUR_LONG_RANDOM_KEY');"
```

The recipient address is hard-coded in `api/send-contact.php` and `api/send-email.php`; change it for your own deployment.

Supabase tables and Row Level Security policies are **not** included in this repository.

## Usage

- Public site: open `index.html` through the local server.
- Admin dashboard: `/admin/login.html`, authenticated through Supabase Auth with an account you create in your own Supabase project.

## Available scripts

There is no `package.json`. The only script is the image optimizer:

```bash
pip install Pillow
python python/optimize_images.py
```

It resizes oversized images and converts them to WebP. Check the script header for its options before running it.

## Security

- Secrets and `.env*` files are git-ignored; only placeholder files (`.env.example`, `js/config.example.js`) are tracked.
- The Supabase key used in the browser must be the public **anon** key, with data access restricted by Row Level Security.
- This repository was scanned with [gitleaks](https://github.com/gitleaks/gitleaks) before publication and no leak was reported.
- Security design notes are in [SECURITY.md](SECURITY.md).
- To report a vulnerability, contact the address in the [Contact](#contact) section rather than opening a public issue.

## Contributing

This project is published for viewing and is not currently seeking contributions. If you want to suggest a fix:

1. Open an issue to discuss it first.
2. Fork the repository and create a branch (`git checkout -b fix/short-description`).
3. Make your changes and test them locally.
4. Open a pull request describing the change.

Contributions do not grant any right to reuse the project beyond what the license allows.

## License

All rights reserved. © 2026 Milann Lede. See [LICENSE](LICENSE). No permission is granted to copy, modify, redistribute or reuse the code, design, texts or images without written authorization.

## Contact

- Website: [modernweb.fr](https://modernweb.fr)
- E-mail: contact@modernweb.fr
