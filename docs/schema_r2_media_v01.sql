-- ============================================================================
-- AITIP Platform Cloudflare D1 & R2 Object Storage Integration Schema v0.1
-- Document Reference: DOC-04 & NextOrders Image Specification
-- TypeID Standard: med_{26-char Crockford Base32} (Total Length: 30 chars)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: media_objects (Cloudflare R2 Object Storage Metadata & CDN Registry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_objects (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    r2_bucket_name TEXT NOT NULL,
    r2_object_key TEXT NOT NULL UNIQUE,
    original_file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    sha256_hash TEXT NOT NULL,
    image_width INTEGER,
    image_height INTEGER,
    variant_type TEXT NOT NULL DEFAULT 'ORIGINAL',
    parent_media_id TEXT,
    cdn_url TEXT NOT NULL,
    upload_status TEXT NOT NULL DEFAULT 'COMPLETED',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,

    -- UID 규칙: med_ + 26자리 Crockford Base32 (소문자 전용, 0-7 시작, 30자 고정)
    CONSTRAINT chk_media_objects_id CHECK (
        length(id) = 30
        AND id GLOB 'med_[0-7]*'
        AND substr(id, 6) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'
    ),

    -- 소유자 엔티티 도메인 제한
    CONSTRAINT chk_media_owner_type CHECK (
        owner_type IN ('STORE', 'PRODUCT', 'BANNER', 'REVIEW', 'DRIVER', 'KITCHEN')
    ),

    -- R2 버킷명 제약조건
    CONSTRAINT chk_media_bucket CHECK (
        r2_bucket_name IN ('aitip-media-prod', 'aitip-media-staging', 'aitip-media-dev')
    ),

    -- 지원 MIME 타입 (WebP 표준 우선)
    CONSTRAINT chk_media_content_type CHECK (
        content_type IN ('image/webp', 'image/jpeg', 'image/png', 'image/svg+xml')
    ),

    -- 파일 크기 양수 검증 (최대 15MB)
    CONSTRAINT chk_media_file_size CHECK (
        file_size_bytes > 0 AND file_size_bytes <= 15728640
    ),

    -- SHA256 체크섬 64자리 소문자 hex
    CONSTRAINT chk_media_sha256 CHECK (
        length(sha256_hash) = 64
        AND sha256_hash NOT GLOB '*[^0-9a-f]*'
    ),

    -- NextOrders 호환 멀티 해상도 파생 규격
    CONSTRAINT chk_media_variant CHECK (
        variant_type IN ('ORIGINAL', 'XL_1920', 'LG_1280', 'MD_960', 'SM_640', 'XS_320', 'THUMB_150')
    ),

    -- 업로드 생명주기 상태
    CONSTRAINT chk_media_status CHECK (
        upload_status IN ('PENDING_UPLOAD', 'PROCESSING', 'COMPLETED', 'FAILED', 'DELETED')
    ),

    -- 파생본일 경우 원본 미디어 참조
    FOREIGN KEY (parent_media_id) REFERENCES media_objects(id) ON DELETE SET NULL
);

-- 검색 성능 최적화 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_media_owner ON media_objects(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_media_hash ON media_objects(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_media_parent ON media_objects(parent_media_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON media_objects(upload_status);
