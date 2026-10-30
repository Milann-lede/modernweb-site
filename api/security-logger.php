<?php
/**
 * File: api/security-logger.php
 * Description: Logger de sécurité pour la journalisation des événements de sécurité.
 * Enregistre les tentatives d'attaque, violations CORS, rate limiting, etc.
 * Format JSON pour exploitation par SIEM.
 * 
 * Standards: OWASP ASVS 7.1, NIST SP 800-92
 * Path: /api/security-logger.php
 * Author: ModernWeb
 * Last Updated: 2026-01-22
 */

/**
 * Classe SecurityLogger
 * Journalisation structurée des événements de sécurité
 */
class SecurityLogger
{
    // Répertoire des logs (relatif à la racine du site)
    private static $logDir = null;
    
    // Niveaux de log disponibles
    const LEVELS = ['DEBUG', 'INFO', 'WARNING', 'CRITICAL'];

    /**
     * Initialise le répertoire de logs
     * Crée le dossier et le .htaccess de protection si nécessaire
     */
    private static function init(): void
    {
        if (self::$logDir !== null) {
            return;
        }

        // Chemin absolu vers le dossier logs
        self::$logDir = dirname(__DIR__) . '/logs';

        // Créer le répertoire si inexistant
        if (!is_dir(self::$logDir)) {
            @mkdir(self::$logDir, 0750, true);
        }

        // S'assurer que le .htaccess existe pour protéger les logs
        $htaccessPath = self::$logDir . '/.htaccess';
        if (!file_exists($htaccessPath)) {
            $htaccessContent = <<<HTACCESS
# Deny access to log files
# Protection des fichiers de logs contre l'accès public
# Standard: OWASP ASVS 7.3.1

<IfModule mod_authz_core.c>
    Require all denied
</IfModule>

<IfModule !mod_authz_core.c>
    Order allow,deny
    Deny from all
</IfModule>
HTACCESS;
            @file_put_contents($htaccessPath, $htaccessContent);
        }
    }

    /**
     * Enregistre un événement de sécurité
     * 
     * @param string $eventType Type d'événement (ex: AUTH_FAILURE, RATE_LIMIT_EXCEEDED)
     * @param array $data Données contextuelles
     * @param string $level Niveau de criticité (DEBUG, INFO, WARNING, CRITICAL)
     * @return bool Succès de l'écriture
     */
    public static function log(string $eventType, array $data = [], string $level = 'INFO'): bool
    {
        self::init();

        // Valider le niveau
        if (!in_array($level, self::LEVELS, true)) {
            $level = 'INFO';
        }

        // Construire l'entrée de log au format JSON (SIEM-compatible)
        $logEntry = [
            'timestamp' => date('c'), // ISO 8601
            'level' => $level,
            'event' => $eventType,
            'ip' => self::getClientIP(),
            'user_agent' => mb_substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 200),
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'Unknown',
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown',
            'data' => $data
        ];

        // Nom du fichier de log (un par mois)
        $logFile = self::$logDir . '/security_' . date('Y-m') . '.log';

        // Écriture atomique avec verrouillage
        $jsonLine = json_encode($logEntry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        
        $result = @file_put_contents($logFile, $jsonLine, FILE_APPEND | LOCK_EX);

        // Pour les événements critiques, envoyer aussi en error_log
        if ($level === 'CRITICAL') {
            error_log("[SECURITY CRITICAL] $eventType - IP: " . self::getClientIP());
        }

        return $result !== false;
    }

    /**
     * Log d'un échec d'authentification
     * 
     * @param string $email Email tenté (masqué pour la vie privée)
     * @param string $reason Raison de l'échec
     */
    public static function logAuthFailure(string $email, string $reason = 'Invalid credentials'): void
    {
        // Masquer partiellement l'email pour la vie privée
        $maskedEmail = self::maskEmail($email);
        
        self::log('AUTH_FAILURE', [
            'email' => $maskedEmail,
            'reason' => $reason
        ], 'WARNING');
    }

    /**
     * Log d'une connexion réussie
     * 
     * @param string $email Email de l'utilisateur
     */
    public static function logAuthSuccess(string $email): void
    {
        $maskedEmail = self::maskEmail($email);
        
        self::log('AUTH_SUCCESS', [
            'email' => $maskedEmail
        ], 'INFO');
    }

    /**
     * Log d'une tentative d'injection détectée
     * 
     * @param string $type Type d'injection (XSS, SQL, CRLF, etc.)
     * @param string $field Champ concerné
     * @param string $value Valeur suspecte (tronquée)
     */
    public static function logInjectionAttempt(string $type, string $field, string $value): void
    {
        self::log('INJECTION_ATTEMPT', [
            'type' => $type,
            'field' => $field,
            'value_preview' => mb_substr($value, 0, 100) . (strlen($value) > 100 ? '...' : '')
        ], 'WARNING');
    }

    /**
     * Log d'un dépassement de rate limit
     * 
     * @param string $endpoint Endpoint concerné
     * @param int $count Nombre de requêtes
     */
    public static function logRateLimitExceeded(string $endpoint, int $count): void
    {
        self::log('RATE_LIMIT_EXCEEDED', [
            'endpoint' => $endpoint,
            'request_count' => $count
        ], 'WARNING');
    }

    /**
     * Log d'une détection de brute force
     * 
     * @param string $target Cible (endpoint, email, etc.)
     */
    public static function logBruteForce(string $target): void
    {
        self::log('BRUTE_FORCE_DETECTED', [
            'target' => $target
        ], 'CRITICAL');
    }

    /**
     * Log d'une violation CORS
     * 
     * @param string $origin Origine non autorisée
     */
    public static function logCORSViolation(string $origin): void
    {
        self::log('CORS_VIOLATION', [
            'origin' => $origin
        ], 'WARNING');
    }

    /**
     * Obtient l'IP client réelle
     */
    private static function getClientIP(): string
    {
        $headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR'
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
     * Masque partiellement un email pour la vie privée
     * ex: "test@example.com" -> "t***@e***.com"
     * 
     * @param string $email
     * @return string
     */
    private static function maskEmail(string $email): string
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return '***invalid***';
        }

        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return '***invalid***';
        }

        $local = $parts[0];
        $domain = $parts[1];

        // Masquer la partie locale (garder 1er et dernier caractère)
        $maskedLocal = strlen($local) > 2 
            ? $local[0] . str_repeat('*', strlen($local) - 2) . $local[strlen($local) - 1]
            : str_repeat('*', strlen($local));

        // Masquer le domaine (garder extension)
        $domainParts = explode('.', $domain);
        $extension = array_pop($domainParts);
        $domainName = implode('.', $domainParts);
        $maskedDomain = strlen($domainName) > 1 
            ? $domainName[0] . str_repeat('*', strlen($domainName) - 1) . '.' . $extension
            : '***.' . $extension;

        return $maskedLocal . '@' . $maskedDomain;
    }

    /**
     * Récupère les logs récents (pour dashboard admin)
     * 
     * @param int $limit Nombre d'entrées max
     * @param string $level Filtrer par niveau minimum
     * @return array
     */
    public static function getRecentLogs(int $limit = 100, string $level = 'INFO'): array
    {
        self::init();

        $logFile = self::$logDir . '/security_' . date('Y-m') . '.log';
        
        if (!file_exists($logFile)) {
            return [];
        }

        $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!$lines) {
            return [];
        }

        // Prendre les dernières lignes
        $lines = array_slice($lines, -$limit);
        
        $logs = [];
        $levelIndex = array_search($level, self::LEVELS, true);
        if ($levelIndex === false) {
            $levelIndex = 1; // INFO par défaut
        }

        foreach (array_reverse($lines) as $line) {
            $entry = json_decode($line, true);
            if ($entry) {
                $entryLevelIndex = array_search($entry['level'] ?? 'INFO', self::LEVELS, true);
                if ($entryLevelIndex !== false && $entryLevelIndex >= $levelIndex) {
                    $logs[] = $entry;
                }
            }
        }

        return $logs;
    }
}
