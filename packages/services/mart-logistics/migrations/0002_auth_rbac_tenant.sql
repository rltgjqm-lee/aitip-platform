-- AITIP Platform - Auth, RBAC & Multi-Tenant Isolation Migration (0002)
-- Existing tables and UIDs remain untouched (AGENTS.md Rule 2).

PRAGMA foreign_keys = ON;

-- 1. 플랫폼 계정 마스터 (슈퍼관리자 / 마트 관리자 / 피커 / B2B 기관)
CREATE TABLE IF NOT EXISTS platform_users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL
                  CHECK (role IN ('SUPER_ADMIN', 'MART_ADMIN', 'MART_PICKER', 'B2B_ORG')),
    mart_id       TEXT REFERENCES mart_suppliers(id),
    status        TEXT NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE', 'SUSPENDED', 'LOCKED')),
    last_login_at INTEGER,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    CHECK (role = 'SUPER_ADMIN' OR mart_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_platform_users_mart_role ON platform_users (mart_id, role, status);

-- 2. 서버 사이드 세션 저장소 (평문 토큰 미저장, SHA-256 해시만 보관)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL
                CHECK (role IN ('SUPER_ADMIN', 'MART_ADMIN', 'MART_PICKER', 'B2B_ORG')),
    mart_id     TEXT REFERENCES mart_suppliers(id),
    user_agent  TEXT,
    ip_address  TEXT,
    expires_at  INTEGER NOT NULL,
    revoked_at  INTEGER,
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions (expires_at);

-- 3. 보안·운영 감사 로그 (로그인/로그아웃/권한거부/핵심 데이터 변경 추적)
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES platform_users(id),
    mart_id     TEXT,
    action      TEXT NOT NULL,
    target_type TEXT,
    target_id   TEXT,
    detail_json TEXT,
    ip_address  TEXT,
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_audit_mart_time ON auth_audit_logs (mart_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_action_time ON auth_audit_logs (action, created_at DESC);
