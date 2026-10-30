<?php
/**
 * File: api/security-headers.php
 * Description: Headers de sécurité conformes aux recommandations OWASP
 * À inclure dans tous les fichiers PHP publics via require_once
 * Path: /api/security-headers.php
 * Standards: OWASP ASVS 14.4, RFC 6797 (HSTS)
 * Author: ModernWeb
 * Last Updated: 2026-01-22
 */

// =============================================================================
// SECURITY HEADERS (OWASP ASVS 14.4)
// =============================================================================

// Protection contre les attaques de type MIME sniffing
header("X-Content-Type-Options: nosniff");

// Protection contre le clickjacking
header("X-Frame-Options: DENY");

// Protection XSS legacy (navigateurs anciens)
header("X-XSS-Protection: 1; mode=block");

// Contrôle des informations envoyées via Referer
header("Referrer-Policy: strict-origin-when-cross-origin");

// Désactivation des APIs non utilisées
header("Permissions-Policy: geolocation=(), microphone=(), camera=()");

// =============================================================================
// CONTENT SECURITY POLICY (CSP)
// Adapté pour ModernWeb - inclut les CDNs utilisés
// =============================================================================
$csp = [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.emailjs.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://api.emailjs.com",
    "frame-ancestors 'none'"
];
header("Content-Security-Policy: " . implode("; ", $csp));

// =============================================================================
// HSTS (HTTP Strict Transport Security) - RFC 6797
// ATTENTION: Activer UNIQUEMENT en production avec HTTPS configuré
// =============================================================================
// Décommenter la ligne suivante en production avec HTTPS:
// header("Strict-Transport-Security: max-age=31536000; includeSubDomains");

/**
 * Fonction helper pour logger les événements de sécurité
 * @param string $event Type d'événement
 * @param array $context Contexte additionnel
 */
function logSecurityEvent(string $event, array $context = []): void {
    $logEntry = [
        'timestamp' => date('c'),
        'event' => $event,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 200),
        'context' => $context
    ];
    
    // Log vers error_log (en production: envoyer vers SIEM)
    error_log('[SECURITY] ' . json_encode($logEntry));
}
