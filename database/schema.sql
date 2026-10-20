
-- TrustVault database schema
-- PostgreSQL 18+

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('admin', 'owner', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    storage_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    sha256 CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE document_permissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    permission VARCHAR(10) NOT NULL
        CHECK (permission IN ('read', 'edit')),
    granted_by BIGINT NOT NULL REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE UNIQUE INDEX one_active_permission_per_user_document
    ON document_permissions (document_id, user_id)
    WHERE revoked_at IS NULL;

CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
    target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    outcome VARCHAR(10) NOT NULL
        CHECK (outcome IN ('success', 'denied', 'failure')),
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    request_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX documents_owner_idx
    ON documents (owner_id);

CREATE INDEX documents_category_idx
    ON documents (category);

CREATE INDEX documents_created_at_idx
    ON documents (created_at);

CREATE INDEX permissions_user_document_idx
    ON document_permissions (user_id, document_id);

CREATE INDEX audit_logs_time_idx
    ON audit_logs (occurred_at DESC);

CREATE INDEX audit_logs_actor_idx
    ON audit_logs (actor_user_id, occurred_at DESC);

CREATE INDEX audit_logs_document_idx
    ON audit_logs (document_id, occurred_at DESC);
