<?php
require_once __DIR__ . '/security-headers.php';
/**
 * File: api/analytics.php
 * Description: API REST pour le système d'analytics ModernWeb.
 * Utilise SQLite (fichier local) — zéro dépendance externe.
 * Gère : pageviews, sessions, events (INSERT, UPDATE, SELECT).
 * Path: /api/analytics.php
 * Author: ModernWeb
 * Last Updated: 2026-02-09
 */

// ==========================================
// CORS & HEADERS
// ==========================================

// Headers CORS — Origines autorisées
$allowed_origins = [
    'https://modernweb.fr',
    'https://www.modernweb.fr'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$is_allowed = in_array($origin, $allowed_origins);

if ($is_allowed) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

// ==========================================
// RATE LIMITING
// ==========================================

require_once __DIR__ . '/rate-limiter.php';

// ==========================================
// CLÉ API DASHBOARD
// Hash SHA-256 de la clé (la clé en clair n'est pas stockée ici)
// ==========================================

// Défini via la variable d'environnement DASHBOARD_API_KEY_HASH (ex: SetEnv dans Apache).
// Si absente, l'accès est refusé.
define('DASHBOARD_API_KEY_HASH', getenv('DASHBOARD_API_KEY_HASH') ?: '');

/**
 * Vérifie le header Authorization: Bearer <API_KEY>
 */
function verifyDashboardAuth(): bool {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTHORIZATION'] ?? '';
    if (empty($authHeader)) return false;
    
    $parts = explode(' ', $authHeader, 2);
    if (count($parts) !== 2 || strtolower($parts[0]) !== 'bearer') return false;
    
    if (DASHBOARD_API_KEY_HASH === '') return false;

    $keyHash = hash('sha256', $parts[1]);
    return hash_equals(DASHBOARD_API_KEY_HASH, $keyHash);
}

function respondUnauthorized(): void {
    http_response_code(401);
    echo json_encode(['error' => 'Clé API invalide ou manquante'], JSON_UNESCAPED_UNICODE);
    exit;
}

// ==========================================
// BASE DE DONNÉES SQLite
// ==========================================

$dbDir = __DIR__ . '/../data';
$dbPath = $dbDir . '/analytics.sqlite';

// Créer le dossier data s'il n'existe pas
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

try {
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec('PRAGMA foreign_keys = ON');
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "DB connection failed: " . $e->getMessage()]);
    exit;
}

// ==========================================
// CRÉATION DES TABLES (auto au premier appel)
// ==========================================

$db->exec("
    CREATE TABLE IF NOT EXISTS pageviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        page_path TEXT NOT NULL,
        page_title TEXT DEFAULT '',
        referrer TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        device_type TEXT DEFAULT 'desktop',
        browser TEXT,
        os TEXT,
        screen_width INTEGER,
        screen_height INTEGER,
        duration INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        visitor_id TEXT NOT NULL,
        first_page TEXT NOT NULL,
        last_page TEXT,
        pages_count INTEGER DEFAULT 1,
        total_duration INTEGER DEFAULT 0,
        referrer TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        device_type TEXT DEFAULT 'desktop',
        browser TEXT,
        os TEXT,
        screen_width INTEGER,
        screen_height INTEGER,
        is_bounce INTEGER DEFAULT 1,
        started_at DATETIME DEFAULT (datetime('now')),
        ended_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        event_data TEXT DEFAULT '{}',
        page_path TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pv_created ON pageviews(created_at);
    CREATE INDEX IF NOT EXISTS idx_pv_session ON pageviews(session_id);
    CREATE INDEX IF NOT EXISTS idx_pv_page ON pageviews(page_path);
    CREATE INDEX IF NOT EXISTS idx_sess_started ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_sess_visitor ON sessions(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_sess_sid ON sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_ev_created ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_ev_name ON events(event_name);
");

// ==========================================
// ROUTING
// ==========================================

$method = $_SERVER["REQUEST_METHOD"];
$action = $_GET['action'] ?? '';

try {
    switch ($action) {

        // ==========================================
        // TRACKER : Enregistrer une page vue
        // POST /api/analytics.php?action=pageview
        // ==========================================
        case 'pageview':
            if ($method !== 'POST') { respond(405, ["error" => "POST required"]); }
            if (!checkRateLimit('analytics-tracker', 60, 60)) { respondRateLimited(); }
            $data = getJSON();
            
            $stmt = $db->prepare("
                INSERT INTO pageviews (session_id, page_path, page_title, referrer, utm_source, utm_medium, utm_campaign, device_type, browser, os, screen_width, screen_height, duration)
                VALUES (:session_id, :page_path, :page_title, :referrer, :utm_source, :utm_medium, :utm_campaign, :device_type, :browser, :os, :screen_width, :screen_height, :duration)
            ");
            $stmt->execute([
                ':session_id'   => $data['session_id'] ?? '',
                ':page_path'    => $data['page_path'] ?? '/',
                ':page_title'   => $data['page_title'] ?? '',
                ':referrer'     => $data['referrer'] ?? null,
                ':utm_source'   => $data['utm_source'] ?? null,
                ':utm_medium'   => $data['utm_medium'] ?? null,
                ':utm_campaign' => $data['utm_campaign'] ?? null,
                ':device_type'  => $data['device_type'] ?? 'desktop',
                ':browser'      => $data['browser'] ?? null,
                ':os'           => $data['os'] ?? null,
                ':screen_width' => $data['screen_width'] ?? null,
                ':screen_height'=> $data['screen_height'] ?? null,
                ':duration'     => $data['duration'] ?? 0,
            ]);

            $id = $db->lastInsertId();
            respond(200, ["success" => true, "id" => (int)$id]);
            break;

        // ==========================================
        // TRACKER : Créer / mettre à jour une session
        // POST /api/analytics.php?action=session
        // ==========================================
        case 'session':
            if ($method !== 'POST') { respond(405, ["error" => "POST required"]); }
            if (!checkRateLimit('analytics-tracker', 60, 60)) { respondRateLimited(); }
            $data = getJSON();
            $sid = $data['session_id'] ?? '';

            // Vérifier si la session existe déjà
            $check = $db->prepare("SELECT id FROM sessions WHERE session_id = :sid");
            $check->execute([':sid' => $sid]);
            $exists = $check->fetch();

            if ($exists) {
                // UPDATE
                $stmt = $db->prepare("
                    UPDATE sessions SET 
                        last_page = :last_page,
                        pages_count = pages_count + 1,
                        is_bounce = 0,
                        ended_at = datetime('now')
                    WHERE session_id = :sid
                ");
                $stmt->execute([
                    ':last_page' => $data['last_page'] ?? $data['first_page'] ?? '/',
                    ':sid'       => $sid,
                ]);
            } else {
                // INSERT
                $stmt = $db->prepare("
                    INSERT INTO sessions (session_id, visitor_id, first_page, last_page, referrer, utm_source, utm_medium, utm_campaign, device_type, browser, os, screen_width, screen_height, is_bounce)
                    VALUES (:session_id, :visitor_id, :first_page, :last_page, :referrer, :utm_source, :utm_medium, :utm_campaign, :device_type, :browser, :os, :screen_width, :screen_height, 1)
                ");
                $stmt->execute([
                    ':session_id'   => $sid,
                    ':visitor_id'   => $data['visitor_id'] ?? '',
                    ':first_page'   => $data['first_page'] ?? '/',
                    ':last_page'    => $data['last_page'] ?? $data['first_page'] ?? '/',
                    ':referrer'     => $data['referrer'] ?? null,
                    ':utm_source'   => $data['utm_source'] ?? null,
                    ':utm_medium'   => $data['utm_medium'] ?? null,
                    ':utm_campaign' => $data['utm_campaign'] ?? null,
                    ':device_type'  => $data['device_type'] ?? 'desktop',
                    ':browser'      => $data['browser'] ?? null,
                    ':os'           => $data['os'] ?? null,
                    ':screen_width' => $data['screen_width'] ?? null,
                    ':screen_height'=> $data['screen_height'] ?? null,
                ]);
            }

            respond(200, ["success" => true]);
            break;

        // ==========================================
        // TRACKER : Mettre à jour la durée (heartbeat)
        // PUT /api/analytics.php?action=heartbeat
        // ==========================================
        case 'heartbeat':
            if ($method !== 'PUT' && $method !== 'POST') { respond(405, ["error" => "PUT/POST required"]); }
            if (!checkRateLimit('analytics-tracker', 60, 60)) { respondRateLimited(); }
            $data = getJSON();

            // Mise à jour pageview
            if (!empty($data['pageview_id'])) {
                $stmt = $db->prepare("UPDATE pageviews SET duration = :dur WHERE id = :id");
                $stmt->execute([':dur' => $data['duration'] ?? 0, ':id' => $data['pageview_id']]);
            }

            // Mise à jour session
            if (!empty($data['session_id'])) {
                $stmt = $db->prepare("
                    UPDATE sessions SET 
                        total_duration = :dur,
                        last_page = :last_page,
                        ended_at = datetime('now')
                    WHERE session_id = :sid
                ");
                $stmt->execute([
                    ':dur'       => $data['duration'] ?? 0,
                    ':last_page' => $data['last_page'] ?? '/',
                    ':sid'       => $data['session_id'],
                ]);
            }

            respond(200, ["success" => true]);
            break;

        // ==========================================
        // TRACKER : Enregistrer un événement
        // POST /api/analytics.php?action=event
        // ==========================================
        case 'event':
            if ($method !== 'POST') { respond(405, ["error" => "POST required"]); }
            if (!checkRateLimit('analytics-tracker', 60, 60)) { respondRateLimited(); }
            $data = getJSON();
            
            $stmt = $db->prepare("
                INSERT INTO events (session_id, event_name, event_data, page_path)
                VALUES (:session_id, :event_name, :event_data, :page_path)
            ");
            $stmt->execute([
                ':session_id'  => $data['session_id'] ?? '',
                ':event_name'  => $data['event_name'] ?? 'unknown',
                ':event_data'  => json_encode($data['event_data'] ?? []),
                ':page_path'   => $data['page_path'] ?? '/',
            ]);

            respond(200, ["success" => true]);
            break;

        // ==========================================
        // DASHBOARD : Récupérer les pageviews
        // GET /api/analytics.php?action=get_pageviews&start=ISO_DATE
        // ==========================================
        case 'get_pageviews':
            if ($method !== 'GET') { respond(405, ["error" => "GET required"]); }
            if (!verifyDashboardAuth()) { respondUnauthorized(); }
            if (!checkRateLimit('analytics-dashboard', 30, 60)) { respondRateLimited(); }
            $start = $_GET['start'] ?? date('Y-m-d', strtotime('-7 days'));

            $stmt = $db->prepare("
                SELECT * FROM pageviews 
                WHERE created_at >= :start 
                ORDER BY created_at ASC
            ");
            $stmt->execute([':start' => $start]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        // ==========================================
        // DASHBOARD : Récupérer les sessions
        // GET /api/analytics.php?action=get_sessions&start=ISO_DATE
        // ==========================================
        case 'get_sessions':
            if ($method !== 'GET') { respond(405, ["error" => "GET required"]); }
            if (!verifyDashboardAuth()) { respondUnauthorized(); }
            if (!checkRateLimit('analytics-dashboard', 30, 60)) { respondRateLimited(); }
            $start = $_GET['start'] ?? date('Y-m-d', strtotime('-7 days'));

            $stmt = $db->prepare("
                SELECT * FROM sessions 
                WHERE started_at >= :start 
                ORDER BY started_at DESC
            ");
            $stmt->execute([':start' => $start]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        // ==========================================
        // DASHBOARD : Récupérer les événements
        // GET /api/analytics.php?action=get_events&start=ISO_DATE
        // ==========================================
        case 'get_events':
            if ($method !== 'GET') { respond(405, ["error" => "GET required"]); }
            if (!verifyDashboardAuth()) { respondUnauthorized(); }
            if (!checkRateLimit('analytics-dashboard', 30, 60)) { respondRateLimited(); }
            $start = $_GET['start'] ?? date('Y-m-d', strtotime('-7 days'));

            $stmt = $db->prepare("
                SELECT * FROM events 
                WHERE created_at >= :start 
                ORDER BY created_at DESC
                LIMIT 200
            ");
            $stmt->execute([':start' => $start]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        // ==========================================
        // DASHBOARD : Données période précédente (comparaison)
        // GET /api/analytics.php?action=get_previous&start=ISO_DATE&end=ISO_DATE&type=pageviews|sessions
        // ==========================================
        case 'get_previous':
            if ($method !== 'GET') { respond(405, ["error" => "GET required"]); }
            if (!verifyDashboardAuth()) { respondUnauthorized(); }
            if (!checkRateLimit('analytics-dashboard', 30, 60)) { respondRateLimited(); }
            $start = $_GET['start'] ?? '';
            $end = $_GET['end'] ?? '';
            $type = $_GET['type'] ?? 'pageviews';

            if ($type === 'sessions') {
                $stmt = $db->prepare("
                    SELECT id, is_bounce, total_duration FROM sessions
                    WHERE started_at >= :start AND started_at < :end
                ");
            } else {
                $stmt = $db->prepare("
                    SELECT id FROM pageviews
                    WHERE created_at >= :start AND created_at < :end
                ");
            }
            $stmt->execute([':start' => $start, ':end' => $end]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        // ==========================================
        // TEST : Vérifier que l'API fonctionne
        // GET /api/analytics.php?action=ping
        // ==========================================
        case 'ping':
            $count = $db->query("SELECT COUNT(*) FROM pageviews")->fetchColumn();
            respond(200, [
                "status"  => "ok",
                "message" => "Analytics API opérationnelle",
                "db"      => "SQLite",
                "pageviews_count" => (int)$count,
                "timestamp"       => date('c')
            ]);
            break;

        // ==========================================
        // STATS : Vue résumée quotidienne
        // GET /api/analytics.php?action=daily_stats&start=ISO_DATE
        // ==========================================
        case 'daily_stats':
            if ($method !== 'GET') { respond(405, ["error" => "GET required"]); }
            if (!verifyDashboardAuth()) { respondUnauthorized(); }
            if (!checkRateLimit('analytics-dashboard', 30, 60)) { respondRateLimited(); }
            $start = $_GET['start'] ?? date('Y-m-d', strtotime('-30 days'));

            $stmt = $db->prepare("
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_pageviews,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    COUNT(DISTINCT page_path) as unique_pages,
                    ROUND(AVG(duration), 0) as avg_duration
                FROM pageviews
                WHERE created_at >= :start
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            ");
            $stmt->execute([':start' => $start]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        default:
            respond(400, ["error" => "Action inconnue. Actions: pageview, session, heartbeat, event, get_pageviews, get_sessions, get_events, get_previous, daily_stats, ping"]);
            break;
    }
} catch (Exception $e) {
    respond(500, ["error" => $e->getMessage()]);
}

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

function getJSON() {
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);
    if (!$data) {
        respond(400, ["error" => "JSON invalide"]);
    }
    return $data;
}

function respond($code, $data) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
