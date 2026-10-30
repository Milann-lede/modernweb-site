<?php
/**
 * File: api/security-middleware.php
 * Description: Middleware de sécurité réutilisable pour les endpoints API.
 * Fournit rate limiting, validation CORS, protection contre les injections,
 * et intégration avec le logger de sécurité.
 * 
 * Standards: OWASP ASVS v4.0, NIST SP 800-63B
 * Path: /api/security-middleware.php
 * Author: ModernWeb
 * Last Updated: 2026-01-22
 */

// Inclusion du logger de sécurité
require_once __DIR__ . '/security-logger.php';

/**
 * Classe SecurityMiddleware
 * Centralise toutes les protections de sécurité pour les endpoints API
 */
class SecurityMiddleware
{
    // Configuration par défaut
    private static $config = [
        'rate_limit_requests' => 10,        // Nombre de requêtes max
        'rate_limit_window' => 300,         // Fenêtre en secondes (5 min)
        'max_payload_size' => 50000,        // Taille max du payload (50KB)
        'allowed_origins' => [
            'https://modernweb.fr',
            'https://www.modernweb.fr'
        ],
        'lockout_threshold' => 50,          // Seuil pour lockout IP
        'lockout_duration' => 3600,         // Durée lockout (1 heure)
    ];

    /**
     * Exécute toutes les vérifications de sécurité
     * À appeler au début de chaque endpoint API
     * 
     * @param array $customConfig Configuration personnalisée optionnelle
     * @return bool True si toutes les vérifications passent
     */
    public static function run(array $customConfig = []): bool
    {
        // Fusionner la config personnalisée
        $config = array_merge(self::$config, $customConfig);

        // 1. Vérification de la méthode HTTP
        if (!self::checkMethod()) {
            return false;
        }

        // 2. Vérification CORS
        if (!self::checkCORS($config['allowed_origins'])) {
            return false;
        }

        // 3. Rate Limiting
        if (!self::checkRateLimit($config['rate_limit_requests'], $config['rate_limit_window'])) {
            return false;
        }

        // 4. Vérification lockout IP
        if (self::isIPLocked()) {
            self::denyRequest(403, 'Accès temporairement bloqué');
            return false;
        }

        return true;
    }

    /**
     * Vérifie que la méthode HTTP est POST (ou OPTIONS pour preflight)
     */
    public static function checkMethod(): bool
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? '';

        // Gestion preflight CORS
        if ($method === 'OPTIONS') {
            http_response_code(200);
            exit;
        }

        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Méthode non autorisée']);
            exit;
        }

        return true;
    }

    /**
     * Vérifie et applique les headers CORS
     * 
     * @param array $allowedOrigins Liste des origines autorisées
     * @return bool
     */
    public static function checkCORS(array $allowedOrigins): bool
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        
        // Headers de base
        header('Content-Type: application/json; charset=UTF-8');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Max-Age: 86400'); // Cache preflight 24h

        if (empty($origin)) {
            // Pas d'origine = requête same-origin ou non-browser
            header('Access-Control-Allow-Origin: *');
            return true;
        }

        if (in_array($origin, $allowedOrigins, true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Vary: Origin');
            return true;
        }

        // Origine non autorisée
        SecurityLogger::log('CORS_VIOLATION', [
            'origin' => $origin,
            'endpoint' => $_SERVER['REQUEST_URI'] ?? 'unknown'
        ]);

        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Origine non autorisée']);
        exit;
    }

    /**
     * Rate Limiting basé sur l'IP
     * Utilise des fichiers temporaires pour la persistance
     * 
     * @param int $maxRequests Nombre max de requêtes
     * @param int $windowSeconds Fenêtre de temps en secondes
     * @return bool
     */
    public static function checkRateLimit(int $maxRequests, int $windowSeconds): bool
    {
        $ip = self::getClientIP();
        $endpoint = basename($_SERVER['PHP_SELF'] ?? 'api');
        $cacheFile = sys_get_temp_dir() . '/mw_ratelimit_' . md5($ip . $endpoint) . '.json';

        $data = ['count' => 0, 'reset_at' => time() + $windowSeconds];

        if (file_exists($cacheFile)) {
            $content = @file_get_contents($cacheFile);
            if ($content) {
                $data = json_decode($content, true) ?: $data;
            }
        }

        // Réinitialiser si la fenêtre est expirée
        if (time() > $data['reset_at']) {
            $data = ['count' => 0, 'reset_at' => time() + $windowSeconds];
        }

        $data['count']++;

        // Sauvegarder le compteur
        @file_put_contents($cacheFile, json_encode($data), LOCK_EX);

        // Vérifier la limite
        if ($data['count'] > $maxRequests) {
            SecurityLogger::log('RATE_LIMIT_EXCEEDED', [
                'ip' => $ip,
                'endpoint' => $endpoint,
                'count' => $data['count'],
                'limit' => $maxRequests
            ]);

            // Vérifier si on doit déclencher un lockout
            if ($data['count'] > self::$config['lockout_threshold']) {
                self::lockIP($ip);
                SecurityLogger::log('BRUTE_FORCE_DETECTED', [
                    'ip' => $ip,
                    'endpoint' => $endpoint,
                    'count' => $data['count']
                ], 'CRITICAL');
            }

            header('Retry-After: ' . ($data['reset_at'] - time()));
            http_response_code(429);
            echo json_encode([
                'success' => false,
                'message' => 'Trop de requêtes. Réessayez dans quelques minutes.',
                'retry_after' => $data['reset_at'] - time()
            ]);
            exit;
        }

        return true;
    }

    /**
     * Valide et décode le payload JSON
     * 
     * @param int $maxSize Taille maximale en octets
     * @return array|null Données décodées ou null si invalide
     */
    public static function getValidatedPayload(int $maxSize = 50000): ?array
    {
        $input = file_get_contents('php://input');

        // Vérifier la taille
        if (strlen($input) > $maxSize) {
            SecurityLogger::log('PAYLOAD_TOO_LARGE', [
                'size' => strlen($input),
                'max' => $maxSize
            ]);
            self::denyRequest(413, 'Payload trop volumineux');
            return null;
        }

        // Décoder JSON
        $data = json_decode($input, true);
        if (!is_array($data)) {
            self::denyRequest(400, 'Données JSON invalides');
            return null;
        }

        return $data;
    }

    /**
     * Valide un email et protège contre les injections CRLF
     * Standard: OWASP ASVS 5.1.3
     * 
     * @param string $email
     * @return string|false Email validé ou false
     */
    public static function validateEmail(string $email)
    {
        // Nettoyer
        $email = trim($email);
        
        // Vérifier les tentatives d'injection CRLF
        if (preg_match('/[\r\n]/', $email)) {
            SecurityLogger::log('INJECTION_ATTEMPT', [
                'type' => 'CRLF',
                'field' => 'email',
                'value' => substr($email, 0, 50) . '...'
            ], 'WARNING');
            return false;
        }

        // Valider le format
        $validated = filter_var($email, FILTER_VALIDATE_EMAIL);
        if (!$validated) {
            return false;
        }

        // Vérifier la longueur
        if (strlen($validated) > 254) {
            return false;
        }

        return $validated;
    }

    /**
     * Échappement HTML sécurisé
     * Standard: OWASP ASVS 5.3.3
     * 
     * @param string $input
     * @param int $maxLength Longueur maximale (0 = illimitée)
     * @return string
     */
    public static function sanitizeText(string $input, int $maxLength = 0): string
    {
        $sanitized = htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        
        if ($maxLength > 0) {
            $sanitized = mb_substr($sanitized, 0, $maxLength, 'UTF-8');
        }

        return $sanitized;
    }

    /**
     * Obtient l'IP client réelle (derrière un proxy)
     * 
     * @return string
     */
    public static function getClientIP(): string
    {
        // Headers de proxy (attention: peuvent être spoofés)
        $headers = [
            'HTTP_CF_CONNECTING_IP',     // Cloudflare
            'HTTP_X_FORWARDED_FOR',      // Proxy standard
            'HTTP_X_REAL_IP',            // Nginx
            'REMOTE_ADDR'                // Fallback
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ips = explode(',', $_SERVER[$header]);
                $ip = trim($ips[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    /**
     * Vérifie si une IP est en lockout
     */
    private static function isIPLocked(): bool
    {
        $ip = self::getClientIP();
        $lockFile = sys_get_temp_dir() . '/mw_lockout_' . md5($ip) . '.lock';

        if (file_exists($lockFile)) {
            $lockTime = (int)file_get_contents($lockFile);
            if (time() < $lockTime) {
                return true;
            }
            // Lockout expiré, supprimer le fichier
            @unlink($lockFile);
        }

        return false;
    }

    /**
     * Bloque une IP pour la durée configurée
     */
    private static function lockIP(string $ip): void
    {
        $lockFile = sys_get_temp_dir() . '/mw_lockout_' . md5($ip) . '.lock';
        $unlockTime = time() + self::$config['lockout_duration'];
        @file_put_contents($lockFile, $unlockTime, LOCK_EX);
    }

    /**
     * Refuse la requête avec un code et message d'erreur
     */
    private static function denyRequest(int $code, string $message): void
    {
        http_response_code($code);
        echo json_encode(['success' => false, 'message' => $message]);
        exit;
    }
}

/**
 * Fonctions utilitaires globales pour compatibilité
 */

/**
 * Valide un email (wrapper)
 */
function validateSecureEmail(string $email)
{
    return SecurityMiddleware::validateEmail($email);
}

/**
 * Sanitize text (wrapper)
 */
function sanitizeSecureText(string $input, int $maxLength = 0): string
{
    return SecurityMiddleware::sanitizeText($input, $maxLength);
}
