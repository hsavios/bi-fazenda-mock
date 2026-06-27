-- 00_drop_create_schema.sql
-- Recria o schema agro (destrutivo). Executar apenas no banco agro_fazenda_mock.

DROP SCHEMA IF EXISTS agro CASCADE;

CREATE SCHEMA agro;
SET search_path TO agro, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

COMMENT ON SCHEMA agro IS 'Schema mock agrícola — Fazenda Boa Esperança Agro Ltda.';
