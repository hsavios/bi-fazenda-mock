#!/usr/bin/env bash
# Corrige permissões e BOM nos arquivos estáticos do BI (evita nginx 403)
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
BI_DIR="$PROJECT_ROOT/bi"

echo "Removendo BOM de arquivos em bi/ e scripts/..."
find "$PROJECT_ROOT/bi" "$PROJECT_ROOT/scripts" -type f \
    \( -name '*.css' -o -name '*.js' -o -name '*.html' -o -name '*.conf' -o -name '*.sh' \) \
    -exec sed -i '1s/^\xEF\xBB\xBF//' {} + 2>/dev/null || true

echo "Ajustando permissões de leitura em bi/..."
chmod -R a+rX "$BI_DIR"

echo "Verificando index.html..."
if [[ ! -r "$BI_DIR/index.html" ]]; then
    echo "ERRO: bi/index.html não legível" >&2
    exit 1
fi

head -c 6 "$BI_DIR/css/styles.css" | xxd | grep -q '3a72 6f6f 74' && echo "OK: CSS começa com :root" || echo "AVISO: CSS inesperado"
head -c 6 "$BI_DIR/js/app.js" | xxd | grep -q '696d 706f' && echo "OK: app.js começa com import" || echo "AVISO: app.js inesperado"

echo "Concluído. Reinicie o nginx BI se necessário:"
echo "  cd $PROJECT_ROOT && docker compose -f docker-compose.bi.yml restart bi-nginx"
