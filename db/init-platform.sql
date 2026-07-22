CREATE SCHEMA IF NOT EXISTS uns_registry;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SET search_path TO uns_registry;

CREATE TYPE asset_level AS ENUM (
    'enterprise',
    'site',
    'area',
    'equipment',
    'subsystem'
);

CREATE TYPE signal_data_type AS ENUM ('float', 'integer');

CREATE TYPE agg_type AS ENUM (
    'sum',
    'avg',
    'min',
    'max',
    'count',
    'weighted_avg',
    'custom'
);

CREATE TABLE asset_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level asset_level NOT NULL,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL DEFAULT '',
    description TEXT,
    descriptive JSONB NOT NULL DEFAULT '{}',
    analytical JSONB NOT NULL DEFAULT '{}',
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_level ON asset_templates(level);

CREATE TABLE template_children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_template_id UUID NOT NULL REFERENCES asset_templates(id) ON DELETE CASCADE,
    child_template_id UUID NOT NULL REFERENCES asset_templates(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_optional BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT uq_template_child UNIQUE (parent_template_id, child_template_id)
);

CREATE INDEX idx_tpl_children_parent ON template_children(parent_template_id);

CREATE TABLE template_informational (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES asset_templates(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT '',
    data_type signal_data_type NOT NULL,
    range_min DOUBLE PRECISION,
    range_max DOUBLE PRECISION,
    agg_type agg_type,
    source_field VARCHAR(100),
    category VARCHAR(50),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    chart_type VARCHAR(20) NOT NULL DEFAULT 'time_series',
    chart_window VARCHAR(10) NOT NULL DEFAULT '24h',
    chart_thresholds BOOLEAN NOT NULL DEFAULT false,
    aliases_es TEXT[] DEFAULT '{}',
    aliases_en TEXT[] DEFAULT '{}',
    description_es TEXT,
    description_en TEXT,

    CONSTRAINT uq_template_info_field UNIQUE (template_id, name),
    CONSTRAINT valid_agg_source CHECK (
        (agg_type IS NULL)
        OR (agg_type = 'custom' AND source_field IS NULL)
        OR (agg_type != 'custom' AND source_field IS NOT NULL)
    )
);

CREATE INDEX idx_tpl_info_template ON template_informational(template_id);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    template_id UUID REFERENCES asset_templates(id) ON DELETE SET NULL,
    asset_level asset_level NOT NULL,
    name VARCHAR(100) NOT NULL,
    uns_path VARCHAR(500) NOT NULL UNIQUE,
    descriptive JSONB NOT NULL DEFAULT '{}',
    analytical JSONB NOT NULL DEFAULT '{}',
    scada_available BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_parent CHECK (
        (asset_level = 'enterprise' AND parent_id IS NULL)
        OR (asset_level != 'enterprise' AND parent_id IS NOT NULL)
    ),
    CONSTRAINT uq_child_name UNIQUE (parent_id, name)
);

CREATE INDEX idx_assets_parent ON assets(parent_id);
CREATE INDEX idx_assets_level ON assets(asset_level);
CREATE INDEX idx_assets_template ON assets(template_id);
CREATE INDEX idx_assets_uns_path ON assets(uns_path);
CREATE INDEX idx_assets_active ON assets(is_active) WHERE is_active = true;

CREATE TABLE asset_informational (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT '',
    data_type signal_data_type NOT NULL,
    range_min DOUBLE PRECISION,
    range_max DOUBLE PRECISION,
    agg_type agg_type,
    source_field VARCHAR(100),
    category VARCHAR(50),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    chart_type VARCHAR(20) NOT NULL DEFAULT 'time_series',
    chart_window VARCHAR(10) NOT NULL DEFAULT '24h',
    chart_thresholds BOOLEAN NOT NULL DEFAULT false,
    aliases_es TEXT[] DEFAULT '{}',
    aliases_en TEXT[] DEFAULT '{}',
    description_es TEXT,
    description_en TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_info_field_per_asset UNIQUE (asset_id, name),
    CONSTRAINT valid_agg_source CHECK (
        (agg_type IS NULL)
        OR (agg_type = 'custom' AND source_field IS NULL)
        OR (agg_type != 'custom' AND source_field IS NOT NULL)
    )
);

CREATE INDEX idx_asset_info_asset ON asset_informational(asset_id);
CREATE INDEX idx_asset_info_name ON asset_informational(name);
CREATE INDEX idx_asset_info_category ON asset_informational(category);
CREATE INDEX idx_asset_info_active ON asset_informational(is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_templates_updated_at
    BEFORE UPDATE ON asset_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE FUNCTION notify_asset_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    IF TG_OP = 'DELETE' THEN
        payload := json_build_object(
            'operation', 'DELETE',
            'id', OLD.id,
            'uns_path', OLD.uns_path,
            'asset_level', OLD.asset_level
        );
    ELSE
        payload := json_build_object(
            'operation', TG_OP,
            'id', NEW.id,
            'uns_path', NEW.uns_path,
            'asset_level', NEW.asset_level
        );
    END IF;
    PERFORM pg_notify('asset_changes', payload::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asset_notify
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW EXECUTE FUNCTION notify_asset_change();

CREATE OR REPLACE FUNCTION notify_informational_change()
RETURNS TRIGGER AS $$
DECLARE
    parent_path VARCHAR;
    parent_level uns_registry.asset_level;
    affected_asset_id UUID;
BEGIN
    affected_asset_id := COALESCE(NEW.asset_id, OLD.asset_id);
    SELECT uns_path, asset_level INTO parent_path, parent_level
    FROM uns_registry.assets WHERE id = affected_asset_id;
    PERFORM pg_notify('asset_changes', json_build_object(
        'operation', 'FIELD_' || TG_OP,
        'id', affected_asset_id,
        'uns_path', parent_path,
        'asset_level', parent_level
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_informational_notify
    AFTER INSERT OR UPDATE OR DELETE ON asset_informational
    FOR EACH ROW EXECUTE FUNCTION notify_informational_change();
