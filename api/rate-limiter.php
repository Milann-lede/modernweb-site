<?php
/**
 * File: api/rate-limiter.php
 * Description: Rate limiting par IP basé sur des fichiers temporaires.
 * À inclure dans les endpoints PHP via require_once.
 * Path: /api/rate-limiter.php
 * Author: ModernWeb
 * Last Updated: 2026-02-10
 */

/**
 * Vérifie si une IP a dépassé la limite de requêtes.
 * 
 * @param string $endpoint Identifiant de l'endpoint (ex: 'send-contact', 'analytics')
 * @param int $maxRequests Nombre max de requêtes autorisées
 * @param int $windowSeconds Fenêtre de temps en secondes
 * @return bool true si la requête est autorisée, false si limite atteinte
 */
function checkRateLimit(string $endpoint, int $maxRequests = 10, int $windowSeconds = 300): bool {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $safeIp = preg_replace('/[^a-zA-Z0-9\.\:]/', '_', $ip);
    $safeEndpoint = preg_replace('/[^a-zA-Z0-9\-]/', '_', $endpoint);
    
    $rateLimitDir = sys_get_temp_dir() . '/mw_ratelimit';
    if (!is_dir($rateLimitDir)) {
        @mkdir($rateLimitDir, 0755, true);
    }
    
    $filePath = $rateLimitDir . '/' . $safeEndpoint . '_' . $safeIp . '.json';
    
    $now = time();
    $requests = [];
    
    // Lire les requêtes existantes
    if (file_exists($filePath)) {
        $content = @file_get_contents($filePath);
        if ($content) {
            $requests = json_decode($content, true) ?: [];
        }
    }
    
    // Filtrer les requêtes dans la fenêtre de temps
    $requests = array_filter($requests, function($timestamp) use ($now, $windowSeconds) {
        return ($now - $timestamp) < $windowSeconds;
    });
    
    // Vérifier la limite
    if (count($requests) >= $maxRequests) {
        return false; // Limite atteinte
    }
    
    // Ajouter la requête actuelle
    $requests[] = $now;
    
    // Sauvegarder
    @file_put_contents($filePath, json_encode(array_values($requests)), LOCK_EX);
    
    return true; // Autorisé
}

/**
 * Envoie une réponse 429 Too Many Requests et arrête l'exécution.
 */
function respondRateLimited(): void {
    http_response_code(429);
    header('Retry-After: 60');
    echo json_encode([
        'success' => false,
        'error' => 'Trop de requêtes. Réessayez dans quelques minutes.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
