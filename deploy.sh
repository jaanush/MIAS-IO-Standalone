#!/bin/bash
# Deploy till Coolify via Azure DevOps — MASTER TEMPLATE
# Kor: bash deploy.sh [--app-dir /stig/till/app]
#
# Hanterar bade nya appar och befintliga.
# Kraver: .deploy-env med hemligheter (se deploy-env.example)
#
# Kan styras via miljovariabler (anvands av deploy-multi.sh):
#   DEPLOY_APP_NAME, DEPLOY_APP_PORT, DEPLOY_NEEDS_DB, DEPLOY_DB_TYPE,
#   DEPLOY_BASIC_AUTH, DEPLOY_DB_MIGRATE_CMD, DEPLOY_AZURE_REPO,
#   DEPLOY_APP_ENV_VARS, DEPLOY_APP_ENV_VARS_BUILD
#
# Senast uppdaterad: 2026-03-12
# Andringslogg:
#   - Argument-parsning: --app-dir (for multi-app deploy, t.ex. monorepo)
#   - DEPLOY_* miljovariabler for att overstyra all konfiguration
#   - DNS hanteras av IT via wildcard (*.neptun.ztna)
#   - Prisma auto-migration med Prisma 7-flaggor (--from-migrations, --to-schema)
#   - Auto-detektering av Prisma for DB_MIGRATE_CMD
#   - Traefik-labels-verifiering efter deploy
#   - Smart container restart (bara DB-appar)
#   - Windows-saker openssl (JSON.stringify)
set -euo pipefail

# --- Argument-parsning ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_WORK_DIR="$SCRIPT_DIR"   # Standardvarde: samma katalog som scriptet

while [[ $# -gt 0 ]]; do
    case $1 in
        --app-dir) APP_WORK_DIR="$(cd "$2" && pwd)"; shift 2 ;;
        *) shift ;;
    esac
done

# =============================================
# KONFIGURATION (andra per app)
# =============================================
# Varje varde kan overstyras med DEPLOY_* miljovariabel (se deploy-multi.sh)
APP_NAME="${DEPLOY_APP_NAME:-io}"    # Unikt namn -> containernamn + subdoman
APP_PORT="${DEPLOY_APP_PORT:-3000}"          # Port appen lyssnar pa (Next.js=3000, FastAPI=8000, Vite=4173)
NEEDS_DB="${DEPLOY_NEEDS_DB:-true}"         # "true" om du behover PostgreSQL
DB_TYPE="${DEPLOY_DB_TYPE:-postgresql}"      # postgresql / redis / mariadb / mongodb
BASIC_AUTH="${DEPLOY_BASIC_AUTH:-false}"     # "true" for HTTP Basic Auth (losenordsskydd)
DB_MIGRATE_CMD="${DEPLOY_DB_MIGRATE_CMD:-}" # Kors i containern efter deploy (auto-satts om Prisma detekteras)

# Miljo: demo / staging / prod
DEPLOY_ENV="${DEPLOY_ENV:-demo}"

# Azure DevOps — points directly at the main MIAS-IO repo
AZURE_ORG="metstechnology"
AZURE_PROJECT="MIAS-IO"
AZURE_REPO="${DEPLOY_AZURE_REPO:-${AZURE_REPO:-MIAS-IO}}"

# Coolify (andra normalt inte dessa)
COOLIFY_URL="http://coolify.neptun.ztna:8000"
COOLIFY_PROJECT_UUID="0ff286d9-378a-4eb1-a021-0fd077d77700"
COOLIFY_SERVER_UUID="lo0c04ssg0wksokscok0ck00"

# --- Automatisk miljo-mappning (harleds fran DEPLOY_ENV) ---
case "$DEPLOY_ENV" in
    demo)
        COOLIFY_ENVIRONMENT="demos"
        DOMAIN="${APP_NAME}.demo.neptun.ztna"
        ;;
    staging)
        COOLIFY_ENVIRONMENT="staging"
        DOMAIN="${APP_NAME}.staging.neptun.ztna"
        ;;
    prod|production)
        COOLIFY_ENVIRONMENT="production"
        DOMAIN="${APP_NAME}.prod.neptun.ztna"
        ;;
    *)
        echo "FEL: Okand miljo: $DEPLOY_ENV (tillatna: demo, staging, prod)"
        exit 1
        ;;
esac

# Extra env-variabler (runtime)
APP_ENV_VARS="${DEPLOY_APP_ENV_VARS:-}"
# Extra env-variabler (byggtid)
APP_ENV_VARS_BUILD="${DEPLOY_APP_ENV_VARS_BUILD:-}"

# =============================================
# HEMLIGHETER
# =============================================
# .deploy-env letas alltid upp relativt till deploy.sh (inte app-katalogen)
ENV_FILE="$SCRIPT_DIR/.deploy-env"

if [ ! -f "$ENV_FILE" ]; then
    echo "FEL: $ENV_FILE saknas."
    echo ""
    echo "Skapa filen med:"
    echo '  AZURE_PAT="din-azure-pat"'
    echo '  COOLIFY_TOKEN="din-coolify-token"'
    echo ""
    echo "Se deploy-env.example for mall."
    exit 1
fi

source "$ENV_FILE"

if [ -z "${AZURE_PAT:-}" ] || [ -z "${COOLIFY_TOKEN:-}" ]; then
    echo "FEL: AZURE_PAT och COOLIFY_TOKEN maste vara satta i .deploy-env"
    exit 1
fi

# =============================================
# FUNKTIONER
# =============================================
log()  { echo -e "\033[0;32m[OK]\033[0m $1"; }
warn() { echo -e "\033[1;33m[!]\033[0m $1"; }
fail() { echo -e "\033[0;31m[X]\033[0m $1"; exit 1; }

# --- api() --- Ratt API-anrop (tolererar enstaka misslyckanden, for polling)
api() {
    local method=$1 path=$2 body="${3:-}"
    local args=(-s --connect-timeout 15 -X "$method"
        -H "Authorization: Bearer $COOLIFY_TOKEN"
        -H "Accept: application/json"
        -H "Content-Type: application/json")
    [ -n "$body" ] && args+=(-d "$body")
    curl "${args[@]}" "$COOLIFY_URL/api/v1$path"
}

# --- api_checked() --- API-anrop med HTTP-statuskod-kontroll
# Returnerar body pa stdout vid 2xx, skriver felmeddelande vid annat.
# Return code: 0=OK, 1=fel
api_checked() {
    local label=$1 method=$2 path=$3 body="${4:-}"
    local args=(-s --connect-timeout 15 -w "\n%{http_code}" -X "$method"
        -H "Authorization: Bearer $COOLIFY_TOKEN"
        -H "Accept: application/json"
        -H "Content-Type: application/json")
    [ -n "$body" ] && args+=(-d "$body")

    local response
    response=$(curl "${args[@]}" "$COOLIFY_URL/api/v1$path" 2>/dev/null) || {
        warn "$label: curl misslyckades (natverk/timeout)"
        return 1
    }

    # Sista raden ar HTTP-statuskod
    local http_code body_text
    http_code=$(echo "$response" | tail -1)
    body_text=$(echo "$response" | sed '$d')

    case "$http_code" in
        2[0-9][0-9])
            echo "$body_text"
            return 0
            ;;
        401)
            fail "$label: 401 Unauthorized -- kontrollera COOLIFY_TOKEN"
            ;;
        *)
            local api_msg
            api_msg=$(echo "$body_text" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{try{const r=JSON.parse(d.join(''));process.stdout.write(r.message||r.error||'')}catch{}})" 2>/dev/null || echo "")
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

# JSON-helper via node (finns alltid i Node-projekt)
json_get() {
    node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{try{const r=JSON.parse(d.join(''));const v=$1;process.stdout.write(String(v||''))}catch{}})"
}

# Hamta och visa build-loggar for en deployment
show_deploy_logs() {
    local dep_uuid="${1:-}"
    [ -z "$dep_uuid" ] && return
    echo ""
    echo -e "\033[1;36m--- BUILD-LOGGAR (deployment $dep_uuid) ---\033[0m"
    local logs
    logs=$(api GET "/deployments/$dep_uuid" 2>/dev/null || echo "")
    echo "$logs" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
    try{
        const r=JSON.parse(d.join(''));
        const logs=r.logs||r.log||'';
        if(typeof logs==='string'){
            const lines=logs.split('\n');
            lines.slice(-50).forEach(l=>console.log(l));
        }else if(Array.isArray(logs)){
            logs.slice(-50).forEach(l=>console.log(typeof l==='object'?(l.output||JSON.stringify(l)):l));
        }else{console.log(JSON.stringify(r,null,2).slice(0,3000))}
    }catch{console.log(d.join('').slice(0,3000))}
})" 2>/dev/null || echo "$logs" | tail -50
    echo -e "\033[1;36m--- SLUT PA BUILD-LOGGAR ---\033[0m"
}

# Hamta och visa container-loggar
show_container_logs() {
    local app_uuid="${1:-}"
    [ -z "$app_uuid" ] && return
    echo ""
    echo -e "\033[1;36m--- CONTAINER-LOGGAR ($APP_NAME) ---\033[0m"
    local logs
    logs=$(api GET "/applications/$app_uuid/logs" 2>/dev/null || echo "")
    echo "$logs" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
    try{
        const r=JSON.parse(d.join(''));
        const logs=r.logs||r.data||r;
        if(typeof logs==='string'){
            logs.split('\n').slice(-30).forEach(l=>console.log(l));
        }else if(Array.isArray(logs)){
            logs.slice(-30).forEach(l=>console.log(typeof l==='object'?(l.output||l.message||JSON.stringify(l)):l));
        }else{console.log(JSON.stringify(r,null,2).slice(0,2000))}
    }catch{console.log(d.join('').slice(0,2000))}
})" 2>/dev/null || echo "$logs" | tail -30
    echo -e "\033[1;36m--- SLUT PA CONTAINER-LOGGAR ---\033[0m"
}

# --- trigger_deploy() --- Trigga deploy via API, skriver deployment UUID till stdout
trigger_deploy() {
    local result
    result=$(api_checked "Trigga deploy" GET "/deploy?uuid=$APP_UUID") || return 1
    echo "$result" | json_get 'r.deployments?.[0]?.deployment_uuid'
}

# --- wait_for_deploy() --- Vanta pa att deploy blir klar
# Skriver slutstatus till stdout: finished / failed / cancelled / timeout
wait_for_deploy() {
    local dep_uuid="$1"
    local status=""
    echo -n "Vantar pa deploy..." >&2
    for i in $(seq 1 120); do
        sleep 5
        echo -n "." >&2
        status=$(api GET "/deployments/$dep_uuid" 2>/dev/null | \
            json_get 'r.status' || echo "unknown")

        case "$status" in
            finished) echo "" >&2; log "Deploy klar!" >&2; echo "finished"; return 0 ;;
            failed|cancelled)
                echo "" >&2
                warn "Deploy $status" >&2
                show_deploy_logs "$dep_uuid" >&2
                echo "$status"; return 1 ;;
        esac
    done
    echo "" >&2
    warn "Deploy timeout efter 10 min (status: $status)" >&2
    echo "timeout"
    return 1
}

echo ""
echo "=========================================="
echo "  Deploying: $APP_NAME"
echo "=========================================="

# =============================================
# 1. TESTA COOLIFY (med retry for VPN-flukt)
# =============================================
test_coolify() {
    VERSION=$(api_checked "Coolify-anslutning" GET "/version") || return 1
    log "Ansluten till Coolify $VERSION"
}
retry 3 5 "Coolify-anslutning" test_coolify || fail "Kan inte na Coolify pa $COOLIFY_URL efter 3 forsok"

# =============================================
# 2. PUSH TILL AZURE DEVOPS
# =============================================
echo ""
echo "[1/5] Push till Azure DevOps..."

cd "$APP_WORK_DIR"

# Skapa Azure-repo om den inte finns
AZURE_API="https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis"
REPO_EXISTS=$(curl -s -u ":${AZURE_PAT}" "${AZURE_API}/git/repositories?api-version=7.0" | \
    node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{const r=JSON.parse(d.join(''));const found=(r.value||[]).some(r=>r.name==='$AZURE_REPO');process.stdout.write(found?'yes':'no')})" 2>/dev/null || echo "no")

if [ "$REPO_EXISTS" = "no" ]; then
    log "Skapar Azure-repo: $AZURE_REPO..."
    curl -s -u ":${AZURE_PAT}" -X POST \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"${AZURE_REPO}\"}" \
        "${AZURE_API}/git/repositories?api-version=7.0" > /dev/null
    log "Repo skapat"
else
    log "Repo finns: $AZURE_REPO"
fi

REPO_REMOTE="https://${AZURE_PAT}@dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_git/${AZURE_REPO}"

if [ ! -f ".gitignore" ]; then
    cat > .gitignore << 'GI'
node_modules/
.next/
dist/
.env
.env.local
.env.*.local
.deploy-env
*.log
.DS_Store
GI
fi

if [ ! -d ".git" ]; then
    git init -b main
fi

CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$CURRENT_REMOTE" ]; then
    git remote add origin "$REPO_REMOTE"
elif [ "$CURRENT_REMOTE" != "$REPO_REMOTE" ]; then
    git remote set-url origin "$REPO_REMOTE"
fi

# --- Prisma: generera klient + migration (Prisma 7) ---
if [ -f "prisma/schema.prisma" ]; then
    log "Genererar Prisma-klient..."
    npx prisma generate 2>/dev/null || warn "prisma generate misslyckades (ej kritiskt for push)"

    # Prisma 7: --from-migrations requires a shadow database.
    # Instead of auto-generating migrations at deploy time (risky),
    # we just verify that prisma generate succeeds and rely on
    # migrations being created locally (prisma migrate dev) and committed.
    if [ -d "prisma/migrations" ]; then
        log "Migrationer finns — migrate deploy kors efter deploy"
    else
        warn "Inga migrationer hittade — skapa lokalt med: npx prisma migrate dev"
    fi
fi

git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null || true
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push --force origin "${CURRENT_BRANCH}:main" 2>/dev/null || git push --force -u origin "${CURRENT_BRANCH}:main"
log "Pushat till Azure DevOps"

GIT_CLONE_URL="https://pat:${AZURE_PAT}@dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_git/${AZURE_REPO}"

# =============================================
# 3. HITTA ELLER SKAPA APP I COOLIFY
# =============================================
echo ""
echo "[2/5] Konfigurerar app i Coolify..."

EXISTING_APP=$(api GET "/applications" | \
    node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{const apps=JSON.parse(d.join(''));const a=apps.find(a=>a.name==='$APP_NAME');if(a)console.log(JSON.stringify({uuid:a.uuid,fqdn:a.fqdn||'',env:a.environment?.name||'unknown'}))})" 2>/dev/null || echo "")

APP_UUID=""
if [ -n "$EXISTING_APP" ]; then
    APP_UUID=$(echo "$EXISTING_APP" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{process.stdout.write(JSON.parse(d.join('')).uuid||'')})" 2>/dev/null)
    EXISTING_FQDN=$(echo "$EXISTING_APP" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{process.stdout.write(JSON.parse(d.join('')).fqdn||'')})" 2>/dev/null)
    EXISTING_ENV=$(echo "$EXISTING_APP" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{process.stdout.write(JSON.parse(d.join('')).env||'')})" 2>/dev/null)

    # Kolla om befintlig app pekar pa en annan doman (= troligen fel app)
    if [ -n "$EXISTING_FQDN" ] && ! echo "$EXISTING_FQDN" | grep -qi "$DOMAIN"; then
        echo ""
        warn "En app med namnet '$APP_NAME' finns redan!"
        warn "  UUID:   $APP_UUID"
        warn "  Doman:  $EXISTING_FQDN"
        warn "  Miljo:  $EXISTING_ENV"
        echo ""
        fail "Appnamnet ar upptaget. Ta bort den befintliga appen i Coolify-dashboard eller valj ett annat APP_NAME."
    fi
fi

if [ -z "$APP_UUID" ]; then
    log "Skapar ny app: $APP_NAME"

    CREATE_PAYLOAD=$(node -e "console.log(JSON.stringify({
        project_uuid:'$COOLIFY_PROJECT_UUID',
        server_uuid:'$COOLIFY_SERVER_UUID',
        environment_name:'$COOLIFY_ENVIRONMENT',
        git_repository:'$GIT_CLONE_URL',
        git_branch:'main',
        build_pack:'dockerfile',
        dockerfile_location:'/Dockerfile',
        name:'$APP_NAME',
        description:'Deployed via deploy.sh',
        domains:'https://$DOMAIN',
        instant_deploy:false,
        ports_exposes:'$APP_PORT'
    }))")

    RESULT=$(api POST "/applications/public" "$CREATE_PAYLOAD")
    APP_UUID=$(echo "$RESULT" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{try{const r=JSON.parse(d.join(''));process.stdout.write(r.uuid||'')}catch{}})" 2>/dev/null)

    if [ -z "$APP_UUID" ]; then
        echo "API-svar: $RESULT"
        fail "Kunde inte skapa app"
    fi

    log "App skapad: $APP_UUID"

    # Patcha git_repository (Coolify parsar HTTPS-URL:er fel via /public)
    retry 2 3 "Patcha git_repository" \
        api_checked "git_repository PATCH" PATCH "/applications/$APP_UUID" "{\"git_repository\":\"$GIT_CLONE_URL\"}" > /dev/null \
        || warn "Kunde inte patcha git_repository -- kontrollera i Coolify-dashboard"
    log "git_repository patchad"
else
    log "App finns: $APP_UUID"
    retry 2 3 "Uppdatera app-config" \
        api_checked "App PATCH" PATCH "/applications/$APP_UUID" "{\"git_repository\":\"$GIT_CLONE_URL\",\"domains\":\"https://$DOMAIN\",\"build_pack\":\"dockerfile\",\"dockerfile_location\":\"/Dockerfile\"}" > /dev/null \
        || warn "Kunde inte uppdatera app-config"
fi

# =============================================
# TRAEFIK LABELS
# =============================================
log "Satter Traefik-labels..."

LABELS_B64=$(node -e "
const uuid='$APP_UUID', domain='$DOMAIN', port='$APP_PORT';
const ba='$BASIC_AUTH'==='true', baUser='${BASIC_AUTH_USER:-}', baPass='${BASIC_AUTH_PASS:-}';
const bt='\`';
const labels=[
    'traefik.enable=true',
    'traefik.http.middlewares.gzip.compress=true',
    'traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https',
    \`traefik.http.routers.http-0-\${uuid}.entryPoints=http\`,
    \`traefik.http.routers.http-0-\${uuid}.middlewares=redirect-to-https\`,
    \`traefik.http.routers.http-0-\${uuid}.rule=Host(\${bt}\${domain}\${bt}) && PathPrefix(\${bt}/\${bt})\`,
    \`traefik.http.routers.http-0-\${uuid}.service=http-0-\${uuid}\`,
    \`traefik.http.routers.https-0-\${uuid}.entryPoints=https\`,
    \`traefik.http.routers.https-0-\${uuid}.rule=Host(\${bt}\${domain}\${bt}) && PathPrefix(\${bt}/\${bt})\`,
    \`traefik.http.routers.https-0-\${uuid}.service=https-0-\${uuid}\`,
    \`traefik.http.routers.https-0-\${uuid}.tls=true\`,
    \`traefik.http.services.http-0-\${uuid}.loadbalancer.server.port=\${port}\`,
    \`traefik.http.services.https-0-\${uuid}.loadbalancer.server.port=\${port}\`,
    'caddy_ingress_network=coolify',
];
if(ba&&baUser&&baPass){
    const {execSync}=require('child_process');
    const hash=execSync('openssl passwd -apr1 ' + JSON.stringify(baPass)).toString().trim();
    const safe=uuid.replace(/-/g,'');
    labels.push(\`traefik.http.middlewares.\${safe}-auth.basicauth.users=\${baUser}:\${hash}\`);
    labels.push(\`traefik.http.routers.https-0-\${uuid}.middlewares=gzip,\${safe}-auth\`);
}else{
    labels.push(\`traefik.http.routers.https-0-\${uuid}.middlewares=gzip\`);
}
console.log(Buffer.from(labels.join('\\n')).toString('base64'));
")

retry 2 3 "Traefik-labels" \
    api_checked "Traefik-labels PATCH" PATCH "/applications/$APP_UUID" "{\"custom_labels\":\"$LABELS_B64\"}" > /dev/null \
    || warn "Kunde inte satta Traefik-labels -- kontrollera i Coolify-dashboard"
log "Traefik-labels satta"

# =============================================
# POST-DEPLOY KOMMANDO (migrationer etc.)
# =============================================

# Auto-detektera Prisma om DB_MIGRATE_CMD inte ar satt manuellt
if [ -z "$DB_MIGRATE_CMD" ] && [ "$NEEDS_DB" = "true" ]; then
    if [ -f "prisma/schema.prisma" ] || [ -f "schema.prisma" ]; then
        DB_MIGRATE_CMD="npx prisma migrate deploy; npx prisma db push --accept-data-loss"
        log "Prisma detekterat -- auto-migration: migrate deploy + db push"
    fi
fi

if [ -n "${DB_MIGRATE_CMD:-}" ]; then
    log "Satter post-deploy kommando: $DB_MIGRATE_CMD"
    MIGRATE_PAYLOAD=$(node -e "console.log(JSON.stringify({
        post_deployment_command: process.argv[1]
    }))" "$DB_MIGRATE_CMD")
    MIGRATE_RESULT=$(api PATCH "/applications/$APP_UUID" "$MIGRATE_PAYLOAD")
    MIGRATE_ERR=$(echo "$MIGRATE_RESULT" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
    try{const r=JSON.parse(d.join(''));
        if(r.message&&r.message.includes('Validation')){process.stdout.write(r.message+': '+JSON.stringify(r.errors||{}))}
        else if(r.error){process.stdout.write(r.error)}
    }catch{}
})" 2>/dev/null || echo "")
    if [ -n "$MIGRATE_ERR" ]; then
        warn "Kunde inte satta post-deploy kommando: $MIGRATE_ERR"
        warn "Migrationer kommer INTE koras automatiskt!"
    else
        log "Migrationer kors automatiskt efter varje deploy"
    fi
fi

# =============================================
# ENV-VARIABLER
# =============================================
if [ -n "$APP_ENV_VARS" ] || [ -n "$APP_ENV_VARS_BUILD" ]; then
    log "Satter miljovariabler..."

    EXISTING_KEYS=$(api GET "/applications/$APP_UUID/envs" | \
        node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{const envs=JSON.parse(d.join(''));(Array.isArray(envs)?envs:[]).forEach(e=>console.log(e.key))})" 2>/dev/null || echo "")

    for KV in $APP_ENV_VARS; do
        KEY="${KV%%=*}"
        VAL="${KV#*=}"
        if echo "$EXISTING_KEYS" | grep -qx "$KEY"; then
            warn "  $KEY redan satt -- hoppar over"
            continue
        fi
        api_checked "Env $KEY" POST "/applications/$APP_UUID/envs" "{\"key\":\"$KEY\",\"value\":\"$VAL\"}" > /dev/null \
            || warn "  Kunde inte satta $KEY"
        log "  Runtime: $KEY"
    done

    for KV in $APP_ENV_VARS_BUILD; do
        KEY="${KV%%=*}"
        VAL="${KV#*=}"
        if echo "$EXISTING_KEYS" | grep -qx "$KEY"; then
            warn "  $KEY redan satt -- hoppar over"
            continue
        fi
        api_checked "Env $KEY (build)" POST "/applications/$APP_UUID/envs" "{\"key\":\"$KEY\",\"value\":\"$VAL\",\"is_build_time\":true}" > /dev/null \
            || warn "  Kunde inte satta $KEY"
        log "  Byggtid: $KEY"
    done
fi

# =============================================
# 4. DATABAS
# =============================================
if [ "$NEEDS_DB" = "true" ]; then
    echo ""
    echo "[3/5] Konfigurerar databas ($DB_TYPE)..."

    DB_NAME="${APP_NAME}-db"

    DB_UUID=$(api GET "/databases" | \
        node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{const dbs=JSON.parse(d.join(''));const db=(Array.isArray(dbs)?dbs:[]).find(d=>d.name==='$DB_NAME');if(db)process.stdout.write(db.uuid)})" 2>/dev/null || echo "")

    if [ -z "$DB_UUID" ]; then
        log "Skapar databas: $DB_NAME"

        DB_RESULT=$(api POST "/databases/$DB_TYPE" "{\"project_uuid\":\"$COOLIFY_PROJECT_UUID\",\"server_uuid\":\"$COOLIFY_SERVER_UUID\",\"environment_name\":\"$COOLIFY_ENVIRONMENT\",\"name\":\"$DB_NAME\",\"instant_deploy\":true}")
        DB_UUID=$(echo "$DB_RESULT" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{try{const r=JSON.parse(d.join(''));process.stdout.write(r.uuid||'')}catch{}})" 2>/dev/null)

        if [ -n "$DB_UUID" ]; then
            log "Databas skapad: $DB_UUID -- vantar pa start..."
            for i in $(seq 1 18); do
                sleep 5
                DB_STATUS=$(api GET "/databases/$DB_UUID" | \
                    node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{try{const r=JSON.parse(d.join(''));process.stdout.write(r.status||'')}catch{}})" 2>/dev/null)
                if [[ "$DB_STATUS" == "running"* ]]; then
                    log "Databas kor"
                    break
                fi
                echo -n "."
            done
            echo ""

            # Konfigurera schemalagd backup (daglig kl 03:00)
            api_checked "Backup-config" POST "/databases/$DB_UUID/backups" \
                "{\"frequency\":\"0 3 * * *\",\"save_s3\":false,\"database_type\":\"$DB_TYPE\"}" > /dev/null 2>&1 && \
                log "Schemalagd backup konfigurerad (daglig kl 03:00)" || \
                log "Backup redan konfigurerad eller ej tillganglig"

            # Hamta DATABASE_URL
            DB_URL=$(api GET "/databases/$DB_UUID" | \
                node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{try{const r=JSON.parse(d.join(''));process.stdout.write(r.internal_db_url||'')}catch{}})" 2>/dev/null)

            if [ -n "$DB_URL" ]; then
                HAS_DB_URL=$(echo "$EXISTING_KEYS" 2>/dev/null | grep -qx "DATABASE_URL" && echo "yes" || echo "no")
                if [ "$HAS_DB_URL" = "no" ]; then
                    api_checked "DATABASE_URL" POST "/applications/$APP_UUID/envs" "{\"key\":\"DATABASE_URL\",\"value\":\"$DB_URL\"}" > /dev/null \
                        || warn "Kunde inte satta DATABASE_URL"
                    log "DATABASE_URL satt"
                else
                    warn "DATABASE_URL redan satt -- hoppar over"
                fi
            else
                warn "Kunde inte hamta DATABASE_URL -- lagg till manuellt i Coolify"
            fi
        else
            warn "Kunde inte skapa databas: $DB_RESULT"
        fi
    else
        log "Databas finns: $DB_UUID"
    fi
else
    echo "[3/5] Ingen databas behovs"
fi

# =============================================
# 5. DEPLOY (med retry)
# =============================================
echo ""
echo "[4/5] Startar deploy..."

# Forsok 1
DEPLOY_UUID=$(trigger_deploy) || fail "Kunde inte trigga deploy"
if [ -z "$DEPLOY_UUID" ]; then
    fail "Kunde inte starta deploy (tomt UUID)"
fi
log "Deploy startad: $DEPLOY_UUID"

DEPLOY_STATUS=$(wait_for_deploy "$DEPLOY_UUID") || true

# Forsok 2 (om forsta misslyckades)
if [ "$DEPLOY_STATUS" != "finished" ]; then
    warn "Forsta deploy misslyckades ($DEPLOY_STATUS). Forsoker igen efter 15s..."
    sleep 15
    DEPLOY_UUID=$(trigger_deploy) || fail "Kunde inte trigga redeploy"
    if [ -z "$DEPLOY_UUID" ]; then
        fail "Kunde inte starta redeploy (tomt UUID)"
    fi
    log "Redeploy startad: $DEPLOY_UUID"
    DEPLOY_STATUS=$(wait_for_deploy "$DEPLOY_UUID") || true
    if [ "$DEPLOY_STATUS" != "finished" ]; then
        fail "Deploy misslyckades efter 2 forsok (status: $DEPLOY_STATUS)"
    fi
fi

# =============================================
# 6. VERIFIERINGSPIPELINE
# =============================================
echo ""
echo "[5/5] Verifierar..."

VERIFY_MIGRATION="skip"
VERIFY_CONTAINER="fail"
VERIFY_HTTP="skip"

# --- Steg 1: Migrering ---
if [ -n "${DB_MIGRATE_CMD:-}" ]; then
    log "Kontrollerar post-deploy-kommando (migrationer)..."
    DEPLOY_LOGS=$(api GET "/deployments/$DEPLOY_UUID" 2>/dev/null || echo "")
    MIGRATION_ISSUES=$(echo "$DEPLOY_LOGS" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
    try{
        const r=JSON.parse(d.join(''));
        const logs=r.logs||r.log||'';
        const lines=logs.split('\n');
        const issues=[];
        // Specifika felmoenster (inte generiskt 'error' som matchar npm warn etc.)
        const hasRealError=lines.some(l=>/Error:|error:|FAILED|ERR!/.test(l)&&/prisma|migrate|database/i.test(l)&&!/npm warn/i.test(l));
        if(hasRealError) issues.push('Prisma/databas-fel i loggarna');
        if(logs.includes('post-deployment command failed')) issues.push('Post-deploy-kommandot misslyckades');
        if(/table.*does not exist/i.test(logs)) issues.push('Databastabeller saknas');
        process.stdout.write(issues.join('; '));
    }catch{}
})" 2>/dev/null || echo "")

    if [ -n "$MIGRATION_ISSUES" ]; then
        warn "Migreringsfel detekterat: $MIGRATION_ISSUES"
        warn "Triggar redeploy for att forsoka igen med migrering..."
        sleep 10
        REDEPLOY_UUID=$(trigger_deploy) || true
        if [ -n "$REDEPLOY_UUID" ]; then
            REDEPLOY_STATUS=$(wait_for_deploy "$REDEPLOY_UUID") || true
            if [ "$REDEPLOY_STATUS" = "finished" ]; then
                # Kontrollera migrering igen
                REDEPLOY_LOGS=$(api GET "/deployments/$REDEPLOY_UUID" 2>/dev/null || echo "")
                REDEPLOY_ISSUES=$(echo "$REDEPLOY_LOGS" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
    try{
        const r=JSON.parse(d.join(''));
        const logs=r.logs||r.log||'';
        const lines=logs.split('\n');
        const issues=[];
        const hasRealError=lines.some(l=>/Error:|error:|FAILED|ERR!/.test(l)&&/prisma|migrate|database/i.test(l)&&!/npm warn/i.test(l));
        if(hasRealError) issues.push('Prisma/databas-fel');
        if(logs.includes('post-deployment command failed')) issues.push('Post-deploy-kommandot misslyckades');
        process.stdout.write(issues.join('; '));
    }catch{}
})" 2>/dev/null || echo "")
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
for i in $(seq 1 12); do
    sleep 5
    CONTAINER_STATUS=$(api GET "/applications/$APP_UUID" | \
        json_get 'r.status' 2>/dev/null || echo "")
    if [[ "$CONTAINER_STATUS" == "running"* ]]; then
        VERIFY_CONTAINER="pass"
        log "Container kor: $CONTAINER_STATUS"
        break
    fi
    echo -n "."
done
echo ""

if [ "$VERIFY_CONTAINER" != "pass" ]; then
    if [ -n "${DB_MIGRATE_CMD:-}" ]; then
        warn "Container inte igang efter 60s (status: $CONTAINER_STATUS). Restart (DB-app, triggar migrering)..."
        api_checked "Container restart" GET "/applications/$APP_UUID/restart" > /dev/null 2>&1 || true
        sleep 15
        CONTAINER_STATUS=$(api GET "/applications/$APP_UUID" | json_get 'r.status' 2>/dev/null || echo "")
        if [[ "$CONTAINER_STATUS" == "running"* ]]; then
            VERIFY_CONTAINER="pass"
            log "Container kor efter restart: $CONTAINER_STATUS"
        else
            VERIFY_CONTAINER="fail"
            warn "Container EJ igang: $CONTAINER_STATUS"
            show_container_logs "$APP_UUID"
        fi
    else
        warn "Container inte igang efter 60s (status: $CONTAINER_STATUS). Hoppar over restart (kan rensa labels)."
        VERIFY_CONTAINER="fail"
        show_container_logs "$APP_UUID"
    fi
fi

# --- Steg 2b: Verifiera Traefik-labels overlevde deploy ---
if [ "$VERIFY_CONTAINER" = "pass" ]; then
    log "Verifierar Traefik-labels..."
    LABELS_OK=$(api GET "/applications/$APP_UUID" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
    try{
        const r=JSON.parse(d.join(''));
        const labels=r.custom_labels||'';
        const decoded=Buffer.from(labels,'base64').toString();
        process.stdout.write(decoded.includes('$DOMAIN')?'ok':'missing');
    }catch{process.stdout.write('missing')}
})" 2>/dev/null || echo "missing")

    if [ "$LABELS_OK" != "ok" ]; then
        warn "Traefik-labels forsvann efter deploy -- re-PATCHar + ny deploy..."
        retry 2 3 "Re-PATCH Traefik-labels" \
            api_checked "Traefik-labels re-PATCH" PATCH "/applications/$APP_UUID" "{\"custom_labels\":\"$LABELS_B64\"}" > /dev/null \
            || warn "Kunde inte re-PATCHa Traefik-labels"
        LABEL_DEPLOY_UUID=$(trigger_deploy) || true
        if [ -n "$LABEL_DEPLOY_UUID" ]; then
            wait_for_deploy "$LABEL_DEPLOY_UUID" || true
        fi
        log "Labels re-applicerade + ny deploy triggad"
    else
        log "Traefik-labels intakta"
    fi
fi

# --- Steg 3: HTTP-healthcheck (3 forsok, 10s backoff) ---
log "HTTP-healthcheck..."
for attempt in 1 2 3; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 -k "https://$DOMAIN" 2>/dev/null || echo "000")

    if [[ "$HTTP_CODE" =~ ^(200|301|302|307|308|401|403)$ ]]; then
        VERIFY_HTTP="pass"
        log "HTTPS svarar: $HTTP_CODE"
        break
    elif [ "$HTTP_CODE" = "000" ]; then
        VERIFY_HTTP="skip"
        if [ $attempt -lt 3 ]; then
            echo -n "  Timeout, forsoker igen om 10s..."
            sleep 10
        else
            warn "HTTPS timeout -- ZTNA-destination konfigurerad for $DOMAIN?"
        fi
    else
        VERIFY_HTTP="fail"
        if [ $attempt -lt 3 ]; then
            warn "HTTP $HTTP_CODE, forsoker igen om 10s..."
            sleep 10
        else
            warn "HTTPS svarar: $HTTP_CODE efter 3 forsok"
            show_container_logs "$APP_UUID"
        fi
    fi
done

# =============================================
# SLUTSTATUS
# =============================================
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
    echo -e "  \033[1;33mDEPLOY SLUTFORD MED VARNINGAR\033[0m"
    echo "=========================================="
else
    echo "=========================================="
    echo -e "  \033[0;31mDEPLOY MISSLYCKADES\033[0m"
    echo "=========================================="
fi

echo ""
echo "  App:     https://$DOMAIN"
echo "  Azure:   https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_git/${AZURE_REPO}"
echo "  Coolify: $COOLIFY_URL"
[ "$NEEDS_DB" = "true" ] && echo "  DB:      ${APP_NAME}-db"
echo ""
echo "  Verifieringsresultat:"
echo "    Migrationer:  $fmt_migration"
echo "    Container:    $fmt_container"
echo "    HTTP-svar:    $fmt_http"
echo ""
echo "=========================================="

if [ "$OVERALL" = "fail" ]; then
    exit 1
else
    exit 0
fi
