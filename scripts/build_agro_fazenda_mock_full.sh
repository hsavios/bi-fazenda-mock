#!/usr/bin/env bash
# Concatena os arquivos SQL modulares em agro_fazenda_mock_full.sql
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
DB_DIR="$PROJECT_ROOT/database/agro_fazenda_mock"
OUTPUT="$DB_DIR/agro_fazenda_mock_full.sql"

PARTS=(
    "00_drop_create_schema.sql"
    "01_schema.sql"
    "02_seed_master_data.sql"
    "03_seed_operational_data.sql"
    "04_views_kpis.sql"
)

for part in "${PARTS[@]}"; do
    [[ -f "$DB_DIR/$part" ]] || { echo "Arquivo não encontrado: $DB_DIR/$part" >&2; exit 1; }
done

{
    echo "-- agro_fazenda_mock_full.sql"
    echo "-- Gerado automaticamente em $(date -Iseconds)"
    echo "-- NÃO editar manualmente — altere os arquivos modulares e regenere."
    echo ""
    for part in "${PARTS[@]}"; do
        echo "-- >>> BEGIN $part"
        cat "$DB_DIR/$part"
        echo ""
        echo "-- <<< END $part"
        echo ""
    done
} > "$OUTPUT"

echo "Gerado: $OUTPUT ($(wc -l < "$OUTPUT") linhas)"
