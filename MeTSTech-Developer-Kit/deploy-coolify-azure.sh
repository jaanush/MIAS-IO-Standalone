#!/bin/bash
set -euo pipefail

# ============================================================
# deploy-coolify-azure.sh -- Automatisk deploy till Coolify
# ============================================================
#
# OVERSIKT
# --------
# Deployar en app fran lokal mapp till Coolify (neptun-servern)
# via Azure DevOps Git som mellanhand.
#
# Flode:
#   1. Skapar Azure DevOps-repo (om det inte finns)
#   2. Pushar lokal kod till Azure DevOps via HTTPS+PAT
#   3. Skapar eller uppdaterar app i Coolify (nixpacks build)
#   4. Satter Traefik-labels (routing + ev. basic auth)
#   5. Satter extra miljovariabler (runtime + byggtid)
#   6. Skapar PostgreSQL-databas om NEEDS_DB=true
#   7. Triggar deploy och vantar pa att den ska bli klar
#   8. Verifierar container-status + HTTP-svar
#
# KRAV
# ----
#   - source .coolify-env innan du kor (eller satt env-variabler manuellt)
#   - FortiClient VPN aktiv (for atkomst till neptun.oborgen.ztna:8000)
#   - Python 3 installerat (for JSON-hantering)
#   - openssl installerat (for basic auth-hash)
#
# ANVANDNING
# ----------
# Kor via per-app deploy-skript i varje appmapp:
#   bash Primlix/deploy.sh
#   bash "Code review/deploy-frontend.sh"
#   bash "Code review/deploy-backend.sh"
#   bash teams-presence-board/deploy.sh
#
# Eller direkt med env-variabler:
#   APP_NAME=minapp APP_PORT=3000 AZURE_REPO=minapp \
#   bash deploy-coolify-azure.sh
#
# VARIABLER
# ---------
# APP_NAME          Unikt appnamn -> container-namn och subdoman
# APP_PORT          Port appen lyssnar pa (3000=Next.js, 8000=FastAPI, 3001=Express)
# APP_SUBDIR        Undermapp i repot om appen inte ligger i roten (t.ex. "backend")
# DOMAIN            Fullstandig doman (lamna tomt -> auto: APP_NAME.metstech.se)
# NEEDS_DB          "true" for att skapa PostgreSQL-databas (DATABASE_URL satts auto)
# DB_TYPE           Databastyp: postgresql, redis, mariadb, mongodb (default: postgresql)
# BASIC_AUTH        "true" for att aktivera HTTP Basic Auth via Traefik
# APP_ENV_VARS      Runtime env-variabler: "KEY1=VAL1 KEY2=VAL2" (inga mellanslag i varden)
# APP_ENV_VARS_BUILD Byggtids-variabler (t.ex. NEXT_PUBLIC_API_URL=https://...)
# AZURE_REPO        Repo-namn i Azure DevOps (default: APP_NAME)
#
# KANDA BEGRANSNINGAR
# -------------------
# - SSH (port 22) till ssh.dev.azure.com ar blockerat fran neptun -> anvands HTTPS+PAT
# - Coolify /applications/public parsar HTTPS-URL:er fel -> patchas efterat
# - Databaser skapas via /databases/{type} (INTE /databases)
# - Docker coolify-natverket ska INTE ha IPv6 (orsakar ParseAddr-fel i Docker 27.0.3)
# - prisma/seed.ts med `create` (ej upsert) for relationsdata behover koras manuellt
#   EN gang via: docker exec <container> npx tsx prisma/seed.ts
#
# SERVER-INFO
# -----------
# Coolify:  http://neptun.oborgen.ztna:8000  (kraver FortiClient)
# SSH:      ssh -i ~/.ssh/neptun_key admin_mets@neptun-ssh.oborgen.ztna
# ============================================================

# === APP-KONFIGURATION (andra per projekt, eller satt som env-variabler) ===
APP_NAME="${APP_NAME:-minapp}"       # Unikt namn -> blir subdoman
APP_PORT="${APP_PORT:-3000}"         # 3000=Next.js, 4173=Vite preview, 3001=Express
APP_SUBDIR="${APP_SUBDIR:-}"         # Undermapp om appen inte ligger i rot
DOMAIN="${DOMAIN:-}"                 # Lamna tomt -> auto: APP_NAME.neptunus.metstech.se

# === DATABAS ===
NEEDS_DB="${NEEDS_DB:-false}"        # "true" for databas
DB_TYPE="${DB_TYPE:-postgresql}"     # postgresql, redis, mariadb, mongodb
DB_MIGRATE_CMD="${DB_MIGRATE_CMD:-}" # Kors i containern efter deploy. Auto-satts om Prisma detekteras.

# === BASIC AUTH ===
BASIC_AUTH="${BASIC_AUTH:-false}"

# === EXTRA MILJOVARIABLER (valfritt) ===
APP_ENV_VARS="${APP_ENV_VARS:-}"
APP_ENV_VARS_BUILD="${APP_ENV_VARS_BUILD:-}"

# === SAKERHET (las fran miljovariabler) ===
BASIC_AUTH_USER="${BASIC_AUTH_USER:-}"
BASIC_AUTH_PASS="${BASIC_AUTH_PASS:-}"

# === AZURE DEVOPS (fran ~/.coolify-env) ===
AZURE_ORG="${AZURE_ORG:-}"
AZURE_PROJECT="${AZURE_PROJECT:-}"
AZURE_REPO="${AZURE_REPO:-$APP_NAME}"
AZURE_GIT_METHOD="${AZURE_GIT_METHOD:-ssh}"
AZURE_PAT="${AZURE_PAT:-}"

# === COOLIFY (fran ~/.coolify-env) ===
COOLIFY_URL="${COOLIFY_URL:-}"
COOLIFY_TOKEN="${COOLIFY_TOKEN:-}"
COOLIFY_PROJECT_UUID="${COOLIFY_PROJECT_UUID:-}"
COOLIFY_ENVIRONMENT="${COOLIFY_ENVIRONMENT:-demos}"
COOLIFY_SERVER_UUID="${COOLIFY_SERVER_UUID:-}"
COOLIFY_PRIVATE_KEY_UUID="${COOLIFY_PRIVATE_KEY_UUID:-}"

# ============================================================
# HJALPFUNKTIONER
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error(){ echo -e "${RED}[X]${NC} $1"; exit 1; }

# --- api() --- Ratt API-anrop (tolererar enstaka misslyckanden, for polling)
api() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"

    if [ -n "$data" ]; then
        curl -s -X "$method" \
            -H "Authorization: Bearer $COOLIFY_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${COOLIFY_URL}/api/v1${endpoint}"
    else
        curl -s -X "$method" \
            -H "Authorization: Bearer $COOLIFY_TOKEN" \
            "${COOLIFY_URL}/api/v1${endpoint}"
    fi
}

# --- api_checked() --- API-anrop med HTTP-statuskod-kontroll
# Returnerar body pa stdout vid 2xx, skriver felmeddelande vid annat.
# Return code: 0=OK, 1=fel
api_checked() {
    local label="$1" method="$2" endpoint="$3" data="${4:-}"
    local args=(-s --connect-timeout 15 -w "\n%{http_code}" -X "$method"
        -H "Authorization: Bearer $COOLIFY_TOKEN"
        -H "Content-Type: application/json")
    [ -n "$data" ] && args+=(-d "$data")

    local response
    response=$(curl "${args[@]}" "${COOLIFY_URL}/api/v1${endpoint}" 2>/dev/null) || {
        warn "$label: curl misslyckades (natverk/timeout)"
        return 1
    }

    local http_code body_text
    http_code=$(echo "$response" | tail -1)
    body_text=$(echo "$response" | sed '$d')

    case "$http_code" in
        2[0-9][0-9])
            echo "$body_text"
            return 0
            ;;
        401)
            error "$label: 401 Unauthorized -- kontrollera COOLIFY_TOKEN"
            ;;
        *)
            local api_msg
            api_msg=$(echo "$body_text" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('message', d.get('error', '')), end='')
except: pass
" 2>/dev/null || echo "")
            warn "$label: HTTP $http_code${api_msg:+ -- $api_msg}"
            return 1
            ;;
    esac
}

# --- retry() --- Generisk retry-wrapper (ALDRIG oandligt)
retry() {
    local max_attempts=$1 delay=$2 description="$3"
    shift 3
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        if "$@"; then
            return 0
        fi
        if [ $attempt -lt $max_attempts ]; then
            warn "$description: forsok $attempt/$max_attempts misslyckades, vantar ${delay}s..."
            sleep "$delay"
        fi
        attempt=$((attempt + 1))
    done
    warn "$description: alla $max_attempts forsok misslyckades"
    return 1
}

# Hamta och visa build-loggar for en deployment
show_deploy_logs() {
    local dep_uuid="${1:-}"
    [ -z "$dep_uuid" ] && return
    echo ""
    echo -e "${BOLD}${CYAN}--- BUILD-LOGGAR (deployment $dep_uuid) ---${NC}"
    local logs
    logs=$(api GET "/deployments/$dep_uuid" 2>/dev/null || echo "")
    echo "$logs" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    logs = d.get('logs', d.get('log', ''))
    if isinstance(logs, str):
        lines = logs.strip().split('\n')
        for line in lines[-50:]:
            print(line)
    elif isinstance(logs, list):
        for line in logs[-50:]:
            print(line.get('output', str(line)) if isinstance(line, dict) else str(line))
    else:
        print(json.dumps(d, indent=2)[:3000])
except:
    raw = sys.stdin.read() if False else ''
    print(raw[:3000] if raw else '(inga loggar tillgangliga)')
" 2>/dev/null || echo "$logs" | tail -50
    echo -e "${BOLD}${CYAN}--- SLUT PA BUILD-LOGGAR ---${NC}"
}

# Hamta och visa container-loggar
show_container_logs() {
    local app_uuid="${1:-}"
    [ -z "$app_uuid" ] && return
    echo ""
    echo -e "${BOLD}${CYAN}--- CONTAINER-LOGGAR ---${NC}"
    local logs
    logs=$(api GET "/applications/$app_uuid/logs" 2>/dev/null || echo "")
    echo "$logs" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    logs = d.get('logs', d.get('data', d))
    if isinstance(logs, str):
        lines = logs.strip().split('\n')
        for line in lines[-30:]:
            print(line)
    elif isinstance(logs, list):
        for line in logs[-30:]:
            print(line.get('output', line.get('message', str(line))) if isinstance(line, dict) else str(line))
    else:
        print(json.dumps(d, indent=2)[:2000])
except:
    raw = sys.stdin.read() if False else ''
    print(raw[:2000] if raw else '(inga loggar tillgangliga)')
" 2>/dev/null || echo "$logs" | tail -30
    echo -e "${BOLD}${CYAN}--- SLUT PA CONTAINER-LOGGAR ---${NC}"
}

# --- trigger_deploy() --- Trigga deploy via API, skriver deployment UUID till stdout
trigger_deploy() {
    local result
    result=$(api_checked "Trigga deploy" GET "/deploy?uuid=$APP_UUID") || return 1
    echo "$result" | grep -o '"deployment_uuid":"[^"]*"' | head -1 | cut -d'"' -f4 || echo ""
}

# --- wait_for_deploy() --- Vanta pa att deploy blir klar
wait_for_deploy() {
    local dep_uuid="$1"
    local status=""
    echo "Vantar pa deploy..." >&2
    for i in {1..120}; do   # max 10 minuter
        sleep 5
        status=$(api GET "/deployments/$dep_uuid" 2>/dev/null | \
            grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        case "$status" in
            "finished") log "Deploy klar!" >&2; echo "finished"; return 0 ;;
            "failed"|"cancelled")
                warn "Deploy $status" >&2
                show_deploy_logs "$dep_uuid" >&2
                echo "$status"; return 1 ;;
            *) echo -n "." >&2 ;;
        esac
    done
    echo "" >&2
    warn "Deploy timeout efter 10 min (status: $status)" >&2
    echo "$status"
    return 1
}

# ============================================================
# VALIDERING
# ============================================================

echo "=========================================="
echo "  Deploying: $APP_NAME -> Coolify"
echo "  Source: Azure DevOps ($AZURE_GIT_METHOD)"
echo "=========================================="

[ -z "$COOLIFY_URL" ]          && error "COOLIFY_URL saknas. Kor: source ~/.coolify-env"
[ -z "$COOLIFY_TOKEN" ]        && error "COOLIFY_TOKEN saknas"
[ -z "$COOLIFY_PROJECT_UUID" ] && error "COOLIFY_PROJECT_UUID saknas"
[ -z "$COOLIFY_SERVER_UUID" ]  && error "COOLIFY_SERVER_UUID saknas"
[ -z "$AZURE_ORG" ]            && error "AZURE_ORG saknas"
[ -z "$AZURE_PROJECT" ]        && error "AZURE_PROJECT saknas"
[ -z "$AZURE_PAT" ]            && error "AZURE_PAT saknas. Lagg till i ~/.coolify-env"

# Tillatna miljoer
case "$COOLIFY_ENVIRONMENT" in
    demos|staging|production) ;;
    *) error "Ogiltig miljo: '$COOLIFY_ENVIRONMENT'. Tillatna varden: demos | staging | production" ;;
esac

# Testa Coolify-anslutning med retry for VPN-flukt
test_coolify() {
    VERSION=$(api_checked "Coolify-anslutning" GET "/version") || return 1
    VERSION=$(echo "$VERSION" | tr -d '"')
    log "Ansluten till Coolify $VERSION"
}
retry 3 5 "Coolify-anslutning" test_coolify || error "Kunde inte ansluta till Coolify ($COOLIFY_URL) efter 3 forsok. Kolla URL, token och VPN."

# ============================================================
# 1. SKAPA REPO I AZURE DEVOPS (om det inte finns)
# ============================================================
echo ""
echo "[1/6] Kontrollerar Azure DevOps-repo..."

AZURE_API="https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis"

ALL_REPOS=$(curl -s -u ":${AZURE_PAT}" \
    "${AZURE_API}/git/repositories?api-version=7.1")

EXISTING_SSH=$(echo "$ALL_REPOS" | python -c "
import sys, json
repos = json.load(sys.stdin).get('value', [])
for r in repos:
    if r['name'] == '$AZURE_REPO':
        print(r.get('sshUrl', ''))
        break
" 2>/dev/null)

if [ -n "$EXISTING_SSH" ]; then
    log "Repo finns redan: ${AZURE_REPO}"
else
    log "Skapar repo: ${AZURE_REPO}..."
    CREATE_RESULT=$(curl -s -X POST \
        -u ":${AZURE_PAT}" \
        -H "Content-Type: application/json" \
        "${AZURE_API}/git/repositories?api-version=7.1" \
        -d "{\"name\":\"${AZURE_REPO}\"}")

    EXISTING_SSH=$(echo "$CREATE_RESULT" | python -c "
import sys, json
d = json.load(sys.stdin)
if 'id' not in d:
    import sys; print('ERROR: ' + d.get('message', str(d)), file=sys.stderr); exit(1)
print(d.get('sshUrl', ''))
" 2>/tmp/azure_create_err)

    if [ $? -ne 0 ]; then
        error "Kunde inte skapa repo: $(cat /tmp/azure_create_err)"
    fi
    log "Repo skapat: ${AZURE_REPO}"
fi

# ============================================================
# 2. PUSH TILL AZURE DEVOPS
# ============================================================
echo ""
echo "[2/6] Push till Azure DevOps..."

if [ ! -f ".gitignore" ]; then
    cat > .gitignore << 'GI'
node_modules/
.next/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
GI
fi

if [ ! -d ".git" ]; then
    git init -b main
fi

# Push gors alltid via HTTPS+PAT (fran dev-maskin)
REPO_REMOTE="https://${AZURE_PAT}@dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_git/${AZURE_REPO}"

CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$CURRENT_REMOTE" ]; then
    git remote add origin "$REPO_REMOTE"
elif [ "$CURRENT_REMOTE" != "$REPO_REMOTE" ]; then
    warn "Uppdaterar remote: $CURRENT_REMOTE -> $REPO_REMOTE"
    git remote set-url origin "$REPO_REMOTE"
fi

git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null || true
git push origin main 2>/dev/null || git push -u origin main

log "Pushat till Azure DevOps"

# URL som Coolify ska anvanda for att klona (HTTPS med PAT)
GIT_CLONE_URL="https://pat:${AZURE_PAT}@dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_git/${AZURE_REPO}"

# ============================================================
# 3. KOLLA OM APP REDAN FINNS
# ============================================================
echo ""
echo "[3/6] Kollar om appen finns i Coolify..."

APPS=$(api GET "/applications")
APP_UUID=$(echo "$APPS" | python -c "
import sys, json
try:
    apps = json.load(sys.stdin)
    for app in apps if isinstance(apps, list) else []:
        if app.get('name') == '$APP_NAME':
            print(app.get('uuid', ''))
            break
except: pass
" 2>/dev/null || echo "")

# ============================================================
# 4. SKAPA ELLER UPPDATERA APP
# ============================================================
echo ""
echo "[4/6] Konfigurerar app..."

if [ -z "$DOMAIN" ]; then
    SERVER_INFO=$(api GET "/servers/$COOLIFY_SERVER_UUID")
    WILDCARD=$(echo "$SERVER_INFO" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    wc = d.get('wildcard_domain', '') or ''
    if not wc and isinstance(d.get('settings'), dict):
        wc = d['settings'].get('wildcard_domain', '') or ''
    wc = wc.replace('https://', '').replace('http://', '').strip('/')
    print(wc)
except: pass
" 2>/dev/null || echo "")
    if [ -n "$WILDCARD" ]; then
        DOMAIN="${APP_NAME}.${WILDCARD}"
    else
        DOMAIN="${APP_NAME}.metstech.se"
    fi
fi

log "Doman: $DOMAIN"
[ "$BASIC_AUTH" = "true" ] && log "Basic Auth: aktiverad (anvandare: $BASIC_AUTH_USER)"

if [ -z "$APP_UUID" ]; then
    log "Skapar ny app: $APP_NAME"

    CREATE_PAYLOAD=$(
        _PU="$COOLIFY_PROJECT_UUID" \
        _SU="$COOLIFY_SERVER_UUID" \
        _ENV="$COOLIFY_ENVIRONMENT" \
        _REPO="$GIT_CLONE_URL" \
        _NAME="$APP_NAME" \
        _DOMAIN="$DOMAIN" \
        _PORT="$APP_PORT" \
        _SUBDIR="$APP_SUBDIR" \
        python -c "
import json, os
data = {
    'project_uuid': os.environ['_PU'],
    'server_uuid': os.environ['_SU'],
    'environment_name': os.environ['_ENV'],
    'git_repository': os.environ['_REPO'],
    'git_branch': 'main',
    'build_pack': 'nixpacks',
    'name': os.environ['_NAME'],
    'description': 'Deployed via deploy-coolify-azure.sh',
    'domains': 'https://' + os.environ['_DOMAIN'],
    'instant_deploy': False,
    'ports_exposes': os.environ['_PORT']
}
subdir = os.environ.get('_SUBDIR', '')
if subdir:
    data['base_directory'] = subdir
print(json.dumps(data))
")

    RESULT=$(api POST "/applications/public" "$CREATE_PAYLOAD")
    APP_UUID=$(echo "$RESULT" | grep -o '"uuid":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -z "$APP_UUID" ]; then
        warn "API-svar fran Coolify: $RESULT"
        error "Kunde inte skapa app. Se API-svar ovan."
    fi

    log "App skapad: $APP_UUID"

    # Patcha git_repository (Coolify parsar HTTPS-URL:en fel via /public-endpoint)
    GIT_URL_PATCH=$(
        _URL="$GIT_CLONE_URL" \
        python -c "import json,os; print(json.dumps({'git_repository': os.environ['_URL']}))")
    retry 2 3 "Patcha git_repository" \
        api_checked "git_repository PATCH" PATCH "/applications/$APP_UUID" "$GIT_URL_PATCH" > /dev/null \
        || warn "Kunde inte patcha git_repository -- kontrollera i Coolify-dashboard"
    log "git_repository satt till HTTPS-URL"
else
    log "App finns redan: $APP_UUID"
    UPDATE_PATCH=$(
        _URL="$GIT_CLONE_URL" \
        _DOMAIN="$DOMAIN" \
        python -c "import json,os; print(json.dumps({'git_repository': os.environ['_URL'], 'domains': 'https://' + os.environ['_DOMAIN']}))")
    retry 2 3 "Uppdatera app-config" \
        api_checked "App PATCH" PATCH "/applications/$APP_UUID" "$UPDATE_PATCH" > /dev/null \
        || warn "Kunde inte uppdatera app-config"
fi

# ============================================================
# TRAEFIK LABELS (routing + basic auth)
# ============================================================
log "Konfigurerar Traefik-labels..."

LABELS_B64=$(
    _UUID="$APP_UUID" \
    _DOMAIN="$DOMAIN" \
    _PORT="$APP_PORT" \
    _BA_ENABLED="$BASIC_AUTH" \
    _BA_USER="$BASIC_AUTH_USER" \
    _BA_PASS="$BASIC_AUTH_PASS" \
    python -c "
import base64, os, subprocess

uuid   = os.environ['_UUID']
domain = os.environ['_DOMAIN']
port   = os.environ['_PORT']
ba_enabled = os.environ.get('_BA_ENABLED', 'false') == 'true'
ba_user = os.environ.get('_BA_USER', '')
ba_pass = os.environ.get('_BA_PASS', '')
safe   = uuid.replace('-', '')
bt = chr(96)

labels = [
    'traefik.enable=true',
    'traefik.http.middlewares.gzip.compress=true',
    'traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https',
    f'traefik.http.routers.http-0-{uuid}.entryPoints=http',
    f'traefik.http.routers.http-0-{uuid}.middlewares=redirect-to-https',
    f'traefik.http.routers.http-0-{uuid}.rule=Host({bt}{domain}{bt}) && PathPrefix({bt}/{bt})',
    f'traefik.http.routers.http-0-{uuid}.service=http-0-{uuid}',
    f'traefik.http.routers.https-0-{uuid}.entryPoints=https',
    f'traefik.http.routers.https-0-{uuid}.rule=Host({bt}{domain}{bt}) && PathPrefix({bt}/{bt})',
    f'traefik.http.routers.https-0-{uuid}.service=https-0-{uuid}',
    f'traefik.http.routers.https-0-{uuid}.tls.certresolver=letsencrypt',
    f'traefik.http.routers.https-0-{uuid}.tls=true',
    f'traefik.http.services.http-0-{uuid}.loadbalancer.server.port={port}',
    f'traefik.http.services.https-0-{uuid}.loadbalancer.server.port={port}',
    'caddy_ingress_network=coolify',
]

if ba_enabled and ba_user and ba_pass:
    result = subprocess.run(
        ['openssl', 'passwd', '-apr1', ba_pass],
        capture_output=True, text=True
    )
    pw_hash = result.stdout.strip()
    labels.append(f'traefik.http.middlewares.{safe}-auth.basicauth.users={ba_user}:{pw_hash}')
    labels.append(f'traefik.http.routers.https-0-{uuid}.middlewares=gzip,{safe}-auth')
else:
    labels.append(f'traefik.http.routers.https-0-{uuid}.middlewares=gzip')

print(base64.b64encode('\n'.join(labels).encode()).decode())
")

LABELS_PAYLOAD=$(_L="$LABELS_B64" python -c "import json,os; print(json.dumps({'custom_labels': os.environ['_L']}))")
retry 2 3 "Traefik-labels" \
    api_checked "Traefik-labels PATCH" PATCH "/applications/$APP_UUID" "$LABELS_PAYLOAD" > /dev/null \
    || warn "Kunde inte satta Traefik-labels -- kontrollera i Coolify-dashboard"
log "Traefik-labels satta"

# ============================================================
# EXTRA MILJOVARIABLER
# ============================================================
if [ -n "$APP_ENV_VARS" ] || [ -n "$APP_ENV_VARS_BUILD" ]; then
    log "Satter extra miljovariabler..."

    EXISTING_ENVS=$(api GET "/applications/$APP_UUID/envs" 2>/dev/null || echo "[]")
    EXISTING_KEYS=$(echo "$EXISTING_ENVS" | python -c "
import sys, json
try:
    envs = json.load(sys.stdin)
    for e in envs if isinstance(envs, list) else []:
        print(e.get('key', ''))
except: pass
" 2>/dev/null || echo "")

    for KV in $APP_ENV_VARS; do
        KEY="${KV%%=*}"
        VAL="${KV#*=}"
        if echo "$EXISTING_KEYS" | grep -qx "$KEY"; then
            warn "  Runtime: $KEY redan satt i Coolify -- hoppar over"
            continue
        fi
        ENV_P=$(_K="$KEY" _V="$VAL" python -c "
import json, os
print(json.dumps({'key': os.environ['_K'], 'value': os.environ['_V']}))
")
        api_checked "Env $KEY" POST "/applications/$APP_UUID/envs" "$ENV_P" > /dev/null \
            || warn "  Kunde inte satta $KEY"
        log "  Runtime: $KEY"
    done
    for KV in $APP_ENV_VARS_BUILD; do
        KEY="${KV%%=*}"
        VAL="${KV#*=}"
        if echo "$EXISTING_KEYS" | grep -qx "$KEY"; then
            warn "  Byggtid: $KEY redan satt i Coolify -- hoppar over"
            continue
        fi
        ENV_P=$(_K="$KEY" _V="$VAL" python -c "
import json, os
print(json.dumps({'key': os.environ['_K'], 'value': os.environ['_V']}))
")
        api_checked "Env $KEY (build)" POST "/applications/$APP_UUID/envs" "$ENV_P" > /dev/null \
            || warn "  Kunde inte satta $KEY"
        log "  Byggtid: $KEY"
    done
fi

# ============================================================
# 5. DATABAS
# ============================================================
if [ "$NEEDS_DB" = "true" ]; then
    echo ""
    echo "[5/6] Konfigurerar databas ($DB_TYPE)..."

    DB_NAME="${APP_NAME}-db"

    DATABASES=$(api GET "/databases")
    DB_UUID=$(echo "$DATABASES" | python -c "
import sys, json
try:
    dbs = json.load(sys.stdin)
    for db in dbs if isinstance(dbs, list) else []:
        if db.get('name') == '$DB_NAME':
            print(db.get('uuid', ''))
            break
except: pass
" 2>/dev/null || echo "")

    if [ -z "$DB_UUID" ]; then
        log "Skapar databas: $DB_NAME"

        DB_PAYLOAD=$(
            _PU="$COOLIFY_PROJECT_UUID" \
            _SU="$COOLIFY_SERVER_UUID" \
            _ENV="$COOLIFY_ENVIRONMENT" \
            _NAME="$DB_NAME" \
            python -c "
import json, os
print(json.dumps({
    'project_uuid': os.environ['_PU'],
    'server_uuid': os.environ['_SU'],
    'environment_name': os.environ['_ENV'],
    'name': os.environ['_NAME'],
    'instant_deploy': True
}))
")

        DB_RESULT=$(api POST "/databases/$DB_TYPE" "$DB_PAYLOAD")
        DB_UUID=$(echo "$DB_RESULT" | grep -o '"uuid":"[^"]*"' | head -1 | cut -d'"' -f4)

        if [ -n "$DB_UUID" ]; then
            log "Databas skapad: $DB_UUID -- vantar pa start..."

            DB_STARTED=false
            for i in {1..18}; do
                sleep 5
                DB_STATUS=$(api GET "/databases/$DB_UUID" 2>/dev/null | \
                    grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
                if [[ "$DB_STATUS" == "running"* ]]; then
                    log "Databas kor: $DB_STATUS"
                    DB_STARTED=true
                    break
                fi
                echo -n "."
            done
            echo ""

            if [ "$DB_STARTED" = "false" ]; then
                warn "Databas svarar inte efter 90s -- forsoker starta manuellt..."
                api GET "/databases/$DB_UUID/start" > /dev/null 2>&1 || true
                sleep 10
            fi

            DB_INFO=$(api GET "/databases/$DB_UUID")
            DB_URL=$(echo "$DB_INFO" | grep -o '"internal_db_url":"[^"]*"' | cut -d'"' -f4 || echo "")

            if [ -n "$DB_URL" ]; then
                ENV_PAYLOAD=$(
                    _KEY="DATABASE_URL" \
                    _VAL="$DB_URL" \
                    python -c "
import json, os
print(json.dumps({'key': os.environ['_KEY'], 'value': os.environ['_VAL']}))
")
                api_checked "DATABASE_URL" POST "/applications/$APP_UUID/envs" "$ENV_PAYLOAD" > /dev/null \
                    || warn "Kunde inte satta DATABASE_URL"
                log "DATABASE_URL tillagd: ${DB_URL:0:60}..."
            else
                warn "Kunde inte hamta DATABASE_URL -- lagg till manuellt i Coolify-dashboard"
            fi
        else
            warn "Kunde inte skapa databas: $DB_RESULT"
            warn "Lagg till databas manuellt i Coolify-dashboarden och satt DATABASE_URL"
        fi
    else
        log "Databas finns redan: $DB_UUID"
    fi
else
    echo "[5/6] Ingen databas behovs"
fi

# ============================================================
# POST-DEPLOY KOMMANDO (Prisma-migrationer etc.)
# ============================================================

# Auto-detektera Prisma om DB_MIGRATE_CMD inte ar satt manuellt
if [ -z "$DB_MIGRATE_CMD" ] && [ "$NEEDS_DB" = "true" ]; then
    PRISMA_SCHEMA=""
    if [ -n "$APP_SUBDIR" ] && [ -f "$APP_SUBDIR/prisma/schema.prisma" ]; then
        PRISMA_SCHEMA="$APP_SUBDIR/prisma/schema.prisma"
    elif [ -f "prisma/schema.prisma" ]; then
        PRISMA_SCHEMA="prisma/schema.prisma"
    elif [ -f "schema.prisma" ]; then
        PRISMA_SCHEMA="schema.prisma"
    fi
    if [ -n "$PRISMA_SCHEMA" ]; then
        DB_MIGRATE_CMD="npx prisma migrate deploy; npx prisma db push --accept-data-loss"
        log "Prisma detekterat ($PRISMA_SCHEMA) -- auto-migration aktiverad"
    fi
fi

if [ -n "$DB_MIGRATE_CMD" ]; then
    log "Satter post-deploy kommando: $DB_MIGRATE_CMD"
    MIGRATE_PAYLOAD=$(
        _CMD="$DB_MIGRATE_CMD" \
        python -c "
import json, os
print(json.dumps({
    'post_deployment_command': os.environ['_CMD']
}))
")
    MIGRATE_RESULT=$(api PATCH "/applications/$APP_UUID" "$MIGRATE_PAYLOAD")
    MIGRATE_ERR=$(echo "$MIGRATE_RESULT" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if d.get('message', '').startswith('Validation'):
        print(d['message'] + ': ' + json.dumps(d.get('errors', {})))
    elif d.get('error'):
        print(d['error'])
except: pass
" 2>/dev/null || echo "")
    if [ -n "$MIGRATE_ERR" ]; then
        warn "Kunde inte satta post-deploy kommando: $MIGRATE_ERR"
        warn "Migrationer kommer INTE koras automatiskt!"
    else
        log "Migrationer kors automatiskt efter varje deploy"
    fi
fi

# ============================================================
# 6. DEPLOY (med automatisk retry vid misslyckande)
# ============================================================
echo ""
echo "[6/6] Startar deploy..."

# Forsok 1
DEPLOY_UUID=$(trigger_deploy)
if [ -z "$DEPLOY_UUID" ]; then
    error "Kunde inte starta deploy"
fi
log "Deploy startad: $DEPLOY_UUID"

DEPLOY_STATUS=$(wait_for_deploy "$DEPLOY_UUID") || true
echo ""

# Forsok 2 (om forsta misslyckades)
if [ "$DEPLOY_STATUS" != "finished" ]; then
    warn "Forsta deploy misslyckades ($DEPLOY_STATUS). Forsoker igen efter 15s..."
    sleep 15
    DEPLOY_UUID=$(trigger_deploy)
    if [ -n "$DEPLOY_UUID" ]; then
        log "Redeploy startad: $DEPLOY_UUID"
        DEPLOY_STATUS=$(wait_for_deploy "$DEPLOY_UUID") || true
        echo ""
    fi
    if [ "$DEPLOY_STATUS" != "finished" ]; then
        error "Deploy misslyckades efter 2 forsok (status: $DEPLOY_STATUS)"
    fi
fi

# ============================================================
# VERIFIERINGSPIPELINE
# ============================================================
echo ""
echo "Verifierar deployment..."

VERIFY_MIGRATION="skip"
VERIFY_CONTAINER="fail"
VERIFY_HTTP="skip"

# --- Steg 1: Migrering ---
if [ -n "$DB_MIGRATE_CMD" ]; then
    log "Kontrollerar post-deploy-kommando (migrationer)..."
    DEPLOY_LOGS=$(api GET "/deployments/$DEPLOY_UUID" 2>/dev/null || echo "")
    MIGRATION_ISSUES=$(echo "$DEPLOY_LOGS" | python -c "
import sys, json, re
try:
    d = json.load(sys.stdin)
    logs = d.get('logs', '') or d.get('log', '') or ''
    lines = logs.split('\n')
    issues = []
    # Specifika felmoenster (inte generiskt 'error' som matchar npm warn etc.)
    for line in lines:
        if re.search(r'Error:|error:|FAILED|ERR!', line) and re.search(r'prisma|migrate|database', line, re.I) and not re.search(r'npm warn', line, re.I):
            issues.append('Prisma/databas-fel i loggarna')
            break
    if 'post-deployment command failed' in logs.lower():
        issues.append('Post-deploy-kommandot misslyckades')
    if re.search(r'table.*does not exist', logs, re.I):
        issues.append('Databastabeller saknas')
    print('; '.join(issues))
except: pass
" 2>/dev/null || echo "")

    if [ -n "$MIGRATION_ISSUES" ]; then
        warn "Migreringsfel detekterat: $MIGRATION_ISSUES"
        warn "Triggar redeploy for att forsoka igen med migrering..."
        sleep 10
        REDEPLOY_UUID=$(trigger_deploy) || true
        if [ -n "$REDEPLOY_UUID" ]; then
            REDEPLOY_STATUS=$(wait_for_deploy "$REDEPLOY_UUID") || true
            echo ""
            if [ "$REDEPLOY_STATUS" = "finished" ]; then
                REDEPLOY_LOGS=$(api GET "/deployments/$REDEPLOY_UUID" 2>/dev/null || echo "")
                REDEPLOY_ISSUES=$(echo "$REDEPLOY_LOGS" | python -c "
import sys, json, re
try:
    d = json.load(sys.stdin)
    logs = d.get('logs', '') or d.get('log', '') or ''
    lines = logs.split('\n')
    issues = []
    for line in lines:
        if re.search(r'Error:|error:|FAILED|ERR!', line) and re.search(r'prisma|migrate|database', line, re.I) and not re.search(r'npm warn', line, re.I):
            issues.append('Prisma/databas-fel')
            break
    if 'post-deployment command failed' in logs.lower():
        issues.append('Post-deploy-kommandot misslyckades')
    print('; '.join(issues))
except: pass
" 2>/dev/null || echo "")
                if [ -z "$REDEPLOY_ISSUES" ]; then
                    VERIFY_MIGRATION="pass"
                    log "Migrering OK efter redeploy"
                    DEPLOY_UUID="$REDEPLOY_UUID"
                else
                    VERIFY_MIGRATION="fail"
                    warn "Migrering misslyckades aven efter redeploy: $REDEPLOY_ISSUES"
                    show_deploy_logs "$REDEPLOY_UUID"
                fi
            else
                VERIFY_MIGRATION="fail"
                warn "Redeploy for migrering misslyckades"
            fi
        else
            VERIFY_MIGRATION="fail"
            warn "Kunde inte trigga redeploy for migrering"
        fi
    else
        VERIFY_MIGRATION="pass"
        log "Post-deploy-kommando OK"
    fi
fi

# --- Steg 2: Container-status (poll 12x5s = 60s) ---
log "Kontrollerar container-status..."
CONTAINER_STATUS=""
for i in {1..12}; do
    sleep 5
    CONTAINER_STATUS=$(api GET "/applications/$APP_UUID" 2>/dev/null | \
        python -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('status', ''))
except: print('')
" 2>/dev/null || echo "")

    if [[ "$CONTAINER_STATUS" == "running"* ]]; then
        log "Container kor: $CONTAINER_STATUS"
        VERIFY_CONTAINER="pass"
        break
    fi
    echo -n "."
done
echo ""

if [ "$VERIFY_CONTAINER" != "pass" ]; then
    warn "Container inte igang efter 60s (status: $CONTAINER_STATUS). Forsoker restart via API..."
    api_checked "Container restart" GET "/applications/$APP_UUID/restart" > /dev/null 2>&1 || true
    sleep 15
    CONTAINER_STATUS=$(api GET "/applications/$APP_UUID" 2>/dev/null | \
        python -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('status', ''))
except: print('')
" 2>/dev/null || echo "")
    if [[ "$CONTAINER_STATUS" == "running"* ]]; then
        VERIFY_CONTAINER="pass"
        log "Container kor efter restart: $CONTAINER_STATUS"
    else
        VERIFY_CONTAINER="fail"
        warn "Container EJ igang: $CONTAINER_STATUS"
        show_container_logs "$APP_UUID"
    fi
fi

# --- Steg 3: HTTP-healthcheck (3 forsok, 10s backoff) ---
log "HTTP-healthcheck..."
HTTP_CODE="000"
for attempt in 1 2 3; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 10 --max-time 15 -L \
        "https://$DOMAIN" 2>/dev/null)
    [ -z "$HTTP_CODE" ] && HTTP_CODE="000"

    if [[ "$HTTP_CODE" =~ ^(200|301|302|307|308|401|403)$ ]]; then
        VERIFY_HTTP="pass"
        log "URL svarar: HTTP $HTTP_CODE -- https://$DOMAIN"
        break
    elif [ "$HTTP_CODE" = "000" ]; then
        VERIFY_HTTP="skip"
        if [ $attempt -lt 3 ]; then
            echo -n "  Timeout, forsoker igen om 10s..."
            sleep 10
        else
            warn "URL nadd ej (timeout) -- ZTNA-destination ej konfigurerad for $DOMAIN?"
        fi
    else
        VERIFY_HTTP="fail"
        if [ $attempt -lt 3 ]; then
            warn "HTTP $HTTP_CODE, forsoker igen om 10s..."
            sleep 10
        else
            warn "URL svarar HTTP $HTTP_CODE efter 3 forsok"
            show_container_logs "$APP_UUID"
        fi
    fi
done

# ============================================================
# SLUTSTATUS
# ============================================================
echo ""

OVERALL="pass"
[ "$VERIFY_MIGRATION" = "fail" ] && OVERALL="warn"
[ "$VERIFY_CONTAINER" = "fail" ] && OVERALL="fail"
[ "$VERIFY_HTTP" = "fail" ] && OVERALL="warn"

fmt_migration="(ej tillampligt)"
case "$VERIFY_MIGRATION" in
    pass) fmt_migration="OK" ;;
    fail) fmt_migration="MISSLYCKADES" ;;
esac

fmt_container="EJ IGANG"
[ "$VERIFY_CONTAINER" = "pass" ] && fmt_container="Kor"

fmt_http="Hoppades over"
case "$VERIFY_HTTP" in
    pass) fmt_http="OK ($HTTP_CODE)" ;;
    fail) fmt_http="FEL ($HTTP_CODE)" ;;
esac

if [ "$OVERALL" = "pass" ]; then
    echo "=========================================="
    echo "  DEPLOY KLAR!"
    echo "=========================================="
elif [ "$OVERALL" = "warn" ]; then
    echo "=========================================="
    echo -e "  ${YELLOW}DEPLOY SLUTFORD MED VARNINGAR${NC}"
    echo "=========================================="
else
    echo "=========================================="
    echo -e "  ${RED}DEPLOY MISSLYCKADES${NC}"
    echo "=========================================="
fi

echo ""
echo "  App:      https://$DOMAIN"
echo "  Azure:    https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_git/${AZURE_REPO}"
echo "  Coolify:  neptun.oborgen.ztna:8000"
[ "$BASIC_AUTH" = "true" ] && echo "  Auth:     ${BASIC_AUTH_USER} / ${BASIC_AUTH_PASS}"
[ "$NEEDS_DB" = "true" ] && echo "  Databas:  ${APP_NAME}-db"
echo ""
echo "  Verifieringsresultat:"
echo "    Migrationer:  $fmt_migration"
echo "    Container:    $fmt_container"
echo "    HTTP-svar:    $fmt_http"
echo ""
echo "  ZTNA: Lagg till destination i FortiGate"
echo "     Destination host: $DOMAIN"
echo "     Proxy gateway: (samma som 3dcad-portable)"
echo ""
echo "=========================================="

if [ "$OVERALL" = "fail" ]; then
    exit 1
else
    exit 0
fi
