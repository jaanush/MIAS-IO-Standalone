#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  deploy-multi.sh  –  Deployer backend + frontend             ║
# ║                                                              ║
# ║  Lagg den har filen bredvid deploy.sh:                       ║
# ║    min-app/                                                  ║
# ║      deploy.sh              ← master deploy-script           ║
# ║      deploy-multi.sh        ← DEN HAR FILEN                 ║
# ║      .deploy-env            ← tokens (aldrig committa)       ║
# ║      backend/               ← backend-repo/katalog           ║
# ║      frontend/              ← frontend-repo/katalog          ║
# ║                                                              ║
# ║  Kor: bash deploy-multi.sh                                  ║
# ╚══════════════════════════════════════════════════════════════╝
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SH="$SCRIPT_DIR/deploy.sh"

# =============================================
# STIG-KONFIGURATION  (andra dessa)
# =============================================
# Absoluta eller relativa stigar till respektive repo.
# Standardvarden antar att repos ligger i underkataloger:
#
#   min-app/
#     backend/              ← backend-repo
#     frontend/             ← frontend-repo
#     deploy.sh             ← master deploy-script
#     deploy-multi.sh       ← den har filen
#     .deploy-env           ← tokens
#
BACKEND_DIR="${BACKEND_DIR:-$(cd "$SCRIPT_DIR/backend"  && pwd)}"
FRONTEND_DIR="${FRONTEND_DIR:-$(cd "$SCRIPT_DIR/frontend" && pwd)}"

# Miljo: demo / staging / prod (propageras till deploy.sh)
DEPLOY_ENV="${DEPLOY_ENV:-demo}"
export DEPLOY_ENV

# =============================================
# BACKEND-KONFIGURATION
# =============================================
BACKEND_APP_NAME="ANDRA-MIG-Backend"
BACKEND_PORT="3001"
BACKEND_AZURE_REPO=""            # Lammna tom -> anvander APP_NAME
BACKEND_NEEDS_DB="true"
BACKEND_DB_MIGRATE_CMD=""        # Lammna tom -> auto-detect Prisma
BACKEND_BASIC_AUTH="false"

# Runtime-miljovariabler som backend-appen behover:
# Format: "NYCKEL1=varde1 NYCKEL2=varde2"
# Obs: DATABASE_URL satts automatiskt av deploy.sh nar NEEDS_DB=true
BACKEND_ENV_VARS=""
BACKEND_ENV_VARS_BUILD=""

# =============================================
# FRONTEND-KONFIGURATION
# =============================================
FRONTEND_APP_NAME="ANDRA-MIG"
FRONTEND_PORT="4173"             # Vite preview-port
FRONTEND_AZURE_REPO=""           # Lammna tom -> anvander APP_NAME
FRONTEND_NEEDS_DB="false"
FRONTEND_BASIC_AUTH="false"

# Backend-URL som frontend behover kanna till:
# Bygg-tid (inbakas i Vite-bundle):
FRONTEND_API_URL="https://${BACKEND_APP_NAME}.${DEPLOY_ENV}.neptun.ztna"
FRONTEND_ENV_VARS=""
FRONTEND_ENV_VARS_BUILD="VITE_API_URL=${FRONTEND_API_URL}"

# =============================================
# HELPERS
# =============================================
log()     { echo -e "\033[0;32m[OK]\033[0m $1"; }
warn()    { echo -e "\033[1;33m[!]\033[0m $1"; }
fail()    { echo -e "\033[0;31m[X]\033[0m $1"; exit 1; }
section() {
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    printf  "║  %-44s║\n" "$1"
    echo "╚══════════════════════════════════════════════╝"
}

# Kontrollera att deploy.sh finns
[ -f "$DEPLOY_SH" ] || fail "Kan inte hitta deploy.sh i $SCRIPT_DIR"
[ -x "$DEPLOY_SH" ] || chmod +x "$DEPLOY_SH"

# =============================================
# STEG 1: BACKEND
# =============================================
section "1/2  Deployer backend: $BACKEND_APP_NAME"

[ -d "$BACKEND_DIR" ] || fail "Backend-katalog hittades inte: $BACKEND_DIR
Tipsa: Satt BACKEND_DIR=/absolut/stig/till/backend"

log "App-katalog: $BACKEND_DIR"

DEPLOY_APP_NAME="$BACKEND_APP_NAME" \
DEPLOY_APP_PORT="$BACKEND_PORT" \
DEPLOY_AZURE_REPO="${BACKEND_AZURE_REPO:-$BACKEND_APP_NAME}" \
DEPLOY_NEEDS_DB="$BACKEND_NEEDS_DB" \
DEPLOY_DB_MIGRATE_CMD="$BACKEND_DB_MIGRATE_CMD" \
DEPLOY_BASIC_AUTH="$BACKEND_BASIC_AUTH" \
DEPLOY_APP_ENV_VARS="$BACKEND_ENV_VARS" \
DEPLOY_APP_ENV_VARS_BUILD="$BACKEND_ENV_VARS_BUILD" \
    bash "$DEPLOY_SH" --app-dir "$BACKEND_DIR"

BACKEND_EXIT=$?

if [ $BACKEND_EXIT -ne 0 ]; then
    warn "Backend-deploy avslutades med fel (kod $BACKEND_EXIT)."
    echo ""
    echo "Vill du fortsatta med frontend-deploy anda? (j/N)"
    read -r CONTINUE
    if [[ ! "$CONTINUE" =~ ^[jJ]$ ]]; then
        fail "Deploy avbruten."
    fi
    warn "Fortsatter med frontend trots backend-fel..."
fi

# =============================================
# STEG 2: FRONTEND
# =============================================
section "2/2  Deployer frontend: $FRONTEND_APP_NAME"

[ -d "$FRONTEND_DIR" ] || fail "Frontend-katalog hittades inte: $FRONTEND_DIR
Tipsa: Satt FRONTEND_DIR=/absolut/stig/till/frontend"

log "App-katalog: $FRONTEND_DIR"
log "Backend-URL (byggtid): $FRONTEND_API_URL"

DEPLOY_APP_NAME="$FRONTEND_APP_NAME" \
DEPLOY_APP_PORT="$FRONTEND_PORT" \
DEPLOY_AZURE_REPO="${FRONTEND_AZURE_REPO:-$FRONTEND_APP_NAME}" \
DEPLOY_NEEDS_DB="$FRONTEND_NEEDS_DB" \
DEPLOY_BASIC_AUTH="$FRONTEND_BASIC_AUTH" \
DEPLOY_APP_ENV_VARS="$FRONTEND_ENV_VARS" \
DEPLOY_APP_ENV_VARS_BUILD="$FRONTEND_ENV_VARS_BUILD" \
    bash "$DEPLOY_SH" --app-dir "$FRONTEND_DIR"

FRONTEND_EXIT=$?

# =============================================
# SAMMANFATTNING
# =============================================
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  MULTI-APP DEPLOY – SAMMANFATTNING          ║"
echo "╠══════════════════════════════════════════════╣"

if [ "${BACKEND_EXIT:-0}" -eq 0 ]; then
    echo "║  Backend:   ✓ OK                             ║"
else
    echo "║  Backend:   ✗ FEL (se loggar ovan)           ║"
fi

if [ "$FRONTEND_EXIT" -eq 0 ]; then
    echo "║  Frontend:  ✓ OK                             ║"
else
    echo "║  Frontend:  ✗ FEL (se loggar ovan)           ║"
fi

echo "╠══════════════════════════════════════════════╣"
echo "║  URLs:                                       ║"
printf "║    %-42s║\n" "BE: https://${BACKEND_APP_NAME}.${DEPLOY_ENV}.neptun.ztna"
printf "║    %-42s║\n" "FE: https://${FRONTEND_APP_NAME}.${DEPLOY_ENV}.neptun.ztna"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Avsluta med fel om nagot misslyckades
if [ "${BACKEND_EXIT:-0}" -ne 0 ] || [ "$FRONTEND_EXIT" -ne 0 ]; then
    exit 1
fi

exit 0
