#!/bin/bash
# ============================================================
# coolify-manage.sh — Hantera appar i Coolify
# ============================================================
#
# ANVÄNDNING
# ----------
#   source .coolify-env   (eller: cd till mappen, source ./Coolify-MeTSTech-AzureDevOps/.coolify-env)
#   bash coolify-manage.sh <kommando> [appnamn] [argument]
#
# KOMMANDON
# ---------
#   status                        Lista alla appar (namn, status, URL)
#   status <app>                  Detaljstatus + senaste deploys
#   logs <app>                    Container-loggar (senaste 100 rader)
#   build-logs <app>              Build-loggar från senaste deploy
#   envs <app>                    Visa miljövariabler
#   restart <app>                 Starta om container
#   start <app>                   Starta stoppad container
#   stop <app>                    Stoppa container
#   rollback <app> [N]            Rulla tillbaka N deploys (default: 1)
#   promote <app> [--from X --to Y]  Flytta mellan miljöer (default: demos→production)
#   delete <app> [--with-volumes] Ta bort app (kräver bekräftelse)
#   delete-db <app>               Ta bort appens databas (kräver bekräftelse)
#   help                          Visa denna hjälp
#
# FÖRUTSÄTTNINGAR
# ---------------
#   - source .coolify-env (för COOLIFY_URL, COOLIFY_TOKEN)
#   - FortiClient VPN aktiv
#   - Python 3 installerat
# ============================================================

set -euo pipefail

# ============================================================
# KONFIGURATION (läses från .coolify-env)
# ============================================================
COOLIFY_URL="${COOLIFY_URL:-}"
COOLIFY_TOKEN="${COOLIFY_TOKEN:-}"

# ============================================================
# HJÄLPFUNKTIONER
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()   { echo -e "${BLUE}[i]${NC} $1"; }
header() { echo -e "\n${BOLD}${CYAN}$1${NC}"; }

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

# Slå upp APP_UUID från appnamn
get_app_uuid() {
    local name="$1"
    local uuid
    uuid=$(api GET "/applications" | python -c "
import sys, json
try:
    apps = json.load(sys.stdin)
    for app in (apps if isinstance(apps, list) else []):
        if app.get('name') == '$name':
            print(app.get('uuid', ''))
            break
except: pass
" 2>/dev/null || echo "")
    echo "$uuid"
}

# Verifiera att COOLIFY_URL och COOLIFY_TOKEN är satta
check_env() {
    [ -z "$COOLIFY_URL" ]    && error "COOLIFY_URL saknas. Kör: source .coolify-env"
    [ -z "$COOLIFY_TOKEN" ]  && error "COOLIFY_TOKEN saknas. Kör: source .coolify-env"
}

# Hämta app-UUID, avsluta om ej hittas
require_app() {
    local name="$1"
    local uuid
    uuid=$(get_app_uuid "$name")
    [ -z "$uuid" ] && error "App '$name' hittades inte i Coolify. Kontrollera appnamnet med: bash coolify-manage.sh status"
    echo "$uuid"
}

# Bekräftelseprompt för destruktiva operationer
confirm() {
    local prompt="$1"
    local expected="${2:-}"
    echo -e "${YELLOW}${prompt}${NC}"
    if [ -n "$expected" ]; then
        echo -n "Skriv '$expected' för att bekräfta: "
        read -r input
        [ "$input" != "$expected" ] && { echo "Avbrutet."; exit 0; }
    else
        echo -n "Fortsätt? [y/N]: "
        read -r input
        [[ ! "$input" =~ ^[yY]$ ]] && { echo "Avbrutet."; exit 0; }
    fi
}

# ============================================================
# KOMMANDO: status
# ============================================================
cmd_status() {
    local app_name="${1:-}"

    if [ -z "$app_name" ]; then
        # Lista alla appar
        header "Alla appar i Coolify"
        echo ""

        APPS=$(api GET "/applications")
        echo "$APPS" | python -c "
import sys, json

try:
    apps = json.load(sys.stdin)
    if not isinstance(apps, list):
        print('Inga appar hittades eller oväntat API-svar.')
        sys.exit(0)

    fmt = '{:<30} {:<18} {}'
    print(fmt.format('APP', 'STATUS', 'URL'))
    print('-' * 80)

    for app in sorted(apps, key=lambda x: x.get('name', '')):
        name   = app.get('name', '?')
        status = app.get('status', '?')
        domain = app.get('fqdn') or app.get('domains', '—')
        if isinstance(domain, str):
            domain = domain.replace('https://', '').split(',')[0][:50]
        # Färgkod status
        if status and status.startswith('running'):
            s = '\033[32m' + status + '\033[0m'
        elif status in ('stopped', 'exited'):
            s = '\033[33m' + status + '\033[0m'
        elif 'error' in (status or '') or 'failed' in (status or ''):
            s = '\033[31m' + status + '\033[0m'
        else:
            s = status or '?'
        print(fmt.format(name, s, domain))
except Exception as e:
    print(f'Fel: {e}')
" 2>/dev/null || warn "Kunde inte hämta appar"

    else
        # Detaljstatus för specifik app
        APP_UUID=$(require_app "$app_name")
        header "Status: $app_name"

        APP_INFO=$(api GET "/applications/$APP_UUID")
        echo "$APP_INFO" | python -c "
import sys, json

try:
    app = json.load(sys.stdin)
    print(f\"  Namn:      {app.get('name', '?')}\")
    print(f\"  UUID:      {app.get('uuid', '?')}\")
    print(f\"  Status:    {app.get('status', '?')}\")
    print(f\"  URL:       {app.get('fqdn') or app.get('domains', '—')}\")
    print(f\"  Git-repo:  {app.get('git_repository', '—')}\")
    print(f\"  Branch:    {app.get('git_branch', '—')}\")
    print(f\"  Miljö:     {app.get('environment', {}).get('name', '—') if isinstance(app.get('environment'), dict) else '—'}\")
    print(f\"  Buildpack: {app.get('build_pack', '—')}\")
except Exception as e:
    print(f'Fel: {e}')
"

        echo ""
        echo -e "${BOLD}Senaste deploys:${NC}"
        DEPLOYS=$(api GET "/applications/$APP_UUID/deployments")
        echo "$DEPLOYS" | python -c "
import sys, json

try:
    deploys = json.load(sys.stdin)
    if not isinstance(deploys, list):
        print('  (inga deploys hittades)')
        sys.exit(0)

    fmt = '  {:<4} {:<40} {:<12} {}'
    print(fmt.format('#', 'DEPLOYMENT UUID', 'STATUS', 'TIDPUNKT'))
    print('  ' + '-' * 76)

    for i, d in enumerate(deploys[:10], 1):
        dep_uuid = d.get('deployment_uuid') or d.get('id', '?')
        status   = d.get('status', '?')
        ts       = d.get('created_at') or d.get('updated_at', '—')
        if isinstance(ts, str):
            ts = ts[:19].replace('T', ' ')
        if status == 'finished':
            s = '\033[32m' + status + '\033[0m'
        elif status in ('failed', 'cancelled'):
            s = '\033[31m' + status + '\033[0m'
        else:
            s = status
        print(fmt.format(i, dep_uuid[:36], s, ts))
except Exception as e:
    print(f'  Fel: {e}')
"
    fi
}

# ============================================================
# KOMMANDO: logs
# ============================================================
cmd_logs() {
    local app_name="${1:-}"
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh logs <app>"

    APP_UUID=$(require_app "$app_name")
    header "Container-loggar: $app_name"

    LOGS=$(api GET "/applications/$APP_UUID/logs")
    echo "$LOGS" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    logs = d.get('logs', d.get('data', str(d)))
    if isinstance(logs, str):
        lines = logs.strip().split('\n')
        for line in lines[-100:]:
            print(line)
    else:
        print(logs)
except:
    # Om svaret är ren text
    print(sys.stdin.read() if False else '')
" 2>/dev/null || echo "$LOGS" | tail -100
}

# ============================================================
# KOMMANDO: build-logs
# ============================================================
cmd_build_logs() {
    local app_name="${1:-}"
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh build-logs <app>"

    APP_UUID=$(require_app "$app_name")
    header "Build-loggar: $app_name"

    # Hämta senaste deployment UUID
    DEPLOY_UUID=$(api GET "/applications/$APP_UUID/deployments" | python -c "
import sys, json
try:
    deploys = json.load(sys.stdin)
    if isinstance(deploys, list) and deploys:
        print(deploys[0].get('deployment_uuid') or deploys[0].get('id', ''))
except: pass
" 2>/dev/null || echo "")

    if [ -z "$DEPLOY_UUID" ]; then
        warn "Inga deploys hittades för $app_name"
        return
    fi

    info "Deployment: $DEPLOY_UUID"
    LOGS=$(api GET "/deployments/$DEPLOY_UUID")
    echo "$LOGS" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    logs = d.get('logs', d.get('log', ''))
    if isinstance(logs, str):
        print(logs)
    elif isinstance(logs, list):
        for line in logs:
            print(line.get('output', str(line)) if isinstance(line, dict) else str(line))
    else:
        print(json.dumps(d, indent=2))
except Exception as e:
    print(f'Kunde inte parsa: {e}')
    print(sys.stdin.read() if False else '')
" 2>/dev/null || echo "$LOGS"
}

# ============================================================
# KOMMANDO: envs
# ============================================================
cmd_envs() {
    local app_name="${1:-}"
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh envs <app>"

    APP_UUID=$(require_app "$app_name")
    header "Miljövariabler: $app_name"

    ENVS=$(api GET "/applications/$APP_UUID/envs")
    echo "$ENVS" | python -c "
import sys, json
try:
    envs = json.load(sys.stdin)
    if not isinstance(envs, list):
        envs = envs.get('data', []) if isinstance(envs, dict) else []
    if not envs:
        print('  (inga miljövariabler)')
    else:
        fmt = '  {:<35} {}'
        print(fmt.format('NYCKEL', 'VÄRDE'))
        print('  ' + '-' * 70)
        for e in envs:
            key = e.get('key', '?')
            val = e.get('value', '—')
            is_secret = e.get('is_secret', False)
            if is_secret or any(s in key.upper() for s in ['SECRET', 'PASSWORD', 'TOKEN', 'KEY', 'PASS']):
                val = '***'
            print(fmt.format(key, val))
except Exception as e:
    print(f'Fel: {e}')
" 2>/dev/null
}

# ============================================================
# KOMMANDO: restart / start / stop
# ============================================================
cmd_restart() {
    local app_name="${1:-}"
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh restart <app>"
    APP_UUID=$(require_app "$app_name")
    info "Startar om $app_name..."
    RESULT=$(api GET "/applications/$APP_UUID/restart" 2>/dev/null || \
             api POST "/applications/$APP_UUID/restart" 2>/dev/null || echo "")
    log "Omstart triggered för $app_name"
    info "Kontrollera status om en stund: bash coolify-manage.sh status $app_name"
}

cmd_start() {
    local app_name="${1:-}"
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh start <app>"
    APP_UUID=$(require_app "$app_name")
    info "Startar $app_name..."
    api GET "/applications/$APP_UUID/start" > /dev/null 2>&1 || \
        api POST "/applications/$APP_UUID/start" > /dev/null 2>&1 || true
    log "Start triggered för $app_name"
    info "Kontrollera status om en stund: bash coolify-manage.sh status $app_name"
}

cmd_stop() {
    local app_name="${1:-}"
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh stop <app>"
    APP_UUID=$(require_app "$app_name")
    confirm "Stoppa $app_name? Appen blir otillgänglig."
    info "Stoppar $app_name..."
    api GET "/applications/$APP_UUID/stop" > /dev/null 2>&1 || \
        api POST "/applications/$APP_UUID/stop" > /dev/null 2>&1 || true
    log "$app_name stoppad"
}

# ============================================================
# KOMMANDO: rollback
# ============================================================
cmd_rollback() {
    local app_name="${1:-}"
    local steps="${2:-1}"
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh rollback <app> [N]"

    APP_UUID=$(require_app "$app_name")
    header "Rollback: $app_name (${steps} steg tillbaka)"

    # Hämta deploy-historik
    DEPLOYS=$(api GET "/applications/$APP_UUID/deployments")

    TARGET_UUID=$(echo "$DEPLOYS" | python -c "
import sys, json
steps = $steps
try:
    deploys = json.load(sys.stdin)
    if not isinstance(deploys, list):
        sys.exit(1)
    # Filtrera på lyckade deploys
    finished = [d for d in deploys if d.get('status') == 'finished']
    if len(finished) <= steps:
        print(f'ERROR: Bara {len(finished)} lyckade deploys, kan inte gå {steps} steg tillbaka', file=sys.stderr)
        sys.exit(1)
    target = finished[steps]  # index 0 = nuvarande, steps = target
    print(target.get('deployment_uuid') or target.get('id', ''))
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/tmp/rollback_err)

    if [ $? -ne 0 ]; then
        error "$(cat /tmp/rollback_err)"
    fi

    if [ -z "$TARGET_UUID" ]; then
        error "Kunde inte hitta deployment att rulla tillbaka till"
    fi

    info "Måldeployment: $TARGET_UUID"
    confirm "Rulla tillbaka $app_name ${steps} steg? (kortare avbrott under rebuild)"

    # Trigga redeploy av specifik deployment
    RESULT=$(api GET "/deploy?uuid=$TARGET_UUID")
    NEW_DEPLOY=$(echo "$RESULT" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    deps = d.get('deployments', [d]) if 'deployments' in d else [d]
    print(deps[0].get('deployment_uuid', '') if deps else '')
except: print('')
" 2>/dev/null || echo "")

    if [ -n "$NEW_DEPLOY" ]; then
        log "Rollback startad: $NEW_DEPLOY"
        info "Väntar på deploy..."
        for i in {1..60}; do
            sleep 5
            STATUS=$(api GET "/deployments/$NEW_DEPLOY" 2>/dev/null | \
                python -c "
import sys,json
try: print(json.load(sys.stdin).get('status',''))
except: print('')
" 2>/dev/null || echo "")
            case "$STATUS" in
                "finished") log "Rollback klar!"; echo ""; break ;;
                "failed"|"cancelled") error "Rollback misslyckades: $STATUS" ;;
                *) echo -n "." ;;
            esac
        done
        echo ""
        log "$app_name är nu på version $steps steg tillbaka"
    else
        warn "Kunde inte bekräfta att rollback startade. Kontrollera dashboarden."
        info "Dashboard: neptun.oborgen.ztna:8000 → $app_name → Deployments"
    fi
}

# ============================================================
# KOMMANDO: promote
# ============================================================
cmd_promote() {
    local app_name="${1:-}"
    shift || true
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh promote <app>"

    local from_env="demos"
    local to_env="production"

    # Parsa --from och --to flaggor
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --from) from_env="$2"; shift 2 ;;
            --to)   to_env="$2";   shift 2 ;;
            *) shift ;;
        esac
    done

    header "Promote: $app_name ($from_env → $to_env)"
    warn "Promote triggar en ny deploy av $app_name i miljön '$to_env'."
    warn "Se till att app-konfigurationen (domän, env-variabler) stämmer för $to_env."
    echo ""
    info "Promote görs enklast via deploy-scriptet med rätt miljö:"
    echo ""
    echo "    COOLIFY_ENVIRONMENT=$to_env bash <app-mapp>/deploy.sh"
    echo ""
    confirm "Vill du ändå trigga en redeploy av $app_name i nuvarande konfiguration?"

    APP_UUID=$(require_app "$app_name")
    RESULT=$(api GET "/deploy?uuid=$APP_UUID")
    log "Redeploy triggered"
    info "Övervaka build: bash coolify-manage.sh build-logs $app_name"
}

# ============================================================
# KOMMANDO: delete
# ============================================================
cmd_delete() {
    local app_name="${1:-}"
    local with_volumes=false
    [ "$2" = "--with-volumes" ] && with_volumes=true
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh delete <app>"

    APP_UUID=$(require_app "$app_name")
    warn "Du håller på att PERMANENT ta bort $app_name!"
    warn "All app-konfiguration och deploy-historik raderas. Koden finns kvar i Azure DevOps."
    [ "$with_volumes" = "true" ] && warn "Även Docker-volymer tas bort!"
    echo ""
    confirm "" "$app_name"

    ENDPOINT="/applications/$APP_UUID"
    [ "$with_volumes" = "true" ] && ENDPOINT="${ENDPOINT}?delete_volumes=true"

    RESULT=$(api DELETE "$ENDPOINT")
    # Verifiera att borttagningen lyckades
    echo "$RESULT" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'message' in d:
        print('Coolify: ' + d['message'])
except: pass
" 2>/dev/null || true

    log "$app_name borttagen"
}

# ============================================================
# KOMMANDO: delete-db
# ============================================================
cmd_delete_db() {
    local app_name="${1:-}"
    [ -z "$app_name" ] && error "Ange appnamn: bash coolify-manage.sh delete-db <app>"

    local db_name="${app_name}-db"
    header "Ta bort databas: $db_name"

    DATABASES=$(api GET "/databases")
    DB_UUID=$(echo "$DATABASES" | python -c "
import sys, json
try:
    dbs = json.load(sys.stdin)
    for db in (dbs if isinstance(dbs, list) else []):
        if db.get('name') == '$db_name':
            print(db.get('uuid', ''))
            break
except: pass
" 2>/dev/null || echo "")

    if [ -z "$DB_UUID" ]; then
        error "Databas '$db_name' hittades inte. Kontrollera att appnamnet stämmer."
    fi

    warn "Du håller på att PERMANENT ta bort databasen '$db_name'!"
    warn "ALL DATA RADERAS. Denna åtgärd kan INTE ångras."
    echo ""
    confirm "" "$db_name"

    api DELETE "/databases/$DB_UUID" > /dev/null
    log "Databas $db_name borttagen"
}

# ============================================================
# KOMMANDO: help
# ============================================================
cmd_help() {
    echo ""
    echo -e "${BOLD}coolify-manage.sh — Hantera appar i Coolify${NC}"
    echo ""
    echo -e "${BOLD}ANVÄNDNING:${NC}"
    echo "  bash coolify-manage.sh <kommando> [appnamn] [flaggor]"
    echo ""
    echo -e "${BOLD}KOMMANDON:${NC}"
    printf "  %-35s %s\n" "status" "Lista alla appar"
    printf "  %-35s %s\n" "status <app>" "Detaljstatus + deploy-historik"
    printf "  %-35s %s\n" "logs <app>" "Container-loggar (senaste 100 rader)"
    printf "  %-35s %s\n" "build-logs <app>" "Build-loggar från senaste deploy"
    printf "  %-35s %s\n" "envs <app>" "Visa miljövariabler"
    printf "  %-35s %s\n" "restart <app>" "Starta om container (kort avbrott)"
    printf "  %-35s %s\n" "start <app>" "Starta stoppad container"
    printf "  %-35s %s\n" "stop <app>" "Stoppa container"
    printf "  %-35s %s\n" "rollback <app> [N]" "Rulla tillbaka N deploys (default: 1)"
    printf "  %-35s %s\n" "promote <app> [--from X --to Y]" "Flytta mellan miljöer"
    printf "  %-35s %s\n" "delete <app> [--with-volumes]" "Ta bort app permanent"
    printf "  %-35s %s\n" "delete-db <app>" "Ta bort appens databas permanent"
    printf "  %-35s %s\n" "help" "Visa denna hjälp"
    echo ""
    echo -e "${BOLD}MILJÖER:${NC} demos | staging | production"
    echo ""
    echo -e "${BOLD}EXEMPEL:${NC}"
    echo "  bash coolify-manage.sh status"
    echo "  bash coolify-manage.sh rollback primlix"
    echo "  bash coolify-manage.sh rollback primlix 3"
    echo "  bash coolify-manage.sh promote primlix --from demos --to production"
    echo "  bash coolify-manage.sh logs code-review-api"
    echo "  bash coolify-manage.sh delete old-demo-app"
    echo ""
    echo -e "${BOLD}FÖRUTSÄTTNING:${NC}"
    echo "  source Coolify-MeTSTech-AzureDevOps/.coolify-env"
    echo "  (eller: lägg till i ~/.bashrc)"
    echo ""
}

# ============================================================
# MAIN
# ============================================================
COMMAND="${1:-help}"
shift || true

check_env

case "$COMMAND" in
    status)       cmd_status "$@" ;;
    logs)         cmd_logs "$@" ;;
    build-logs)   cmd_build_logs "$@" ;;
    envs)         cmd_envs "$@" ;;
    restart)      cmd_restart "$@" ;;
    start)        cmd_start "$@" ;;
    stop)         cmd_stop "$@" ;;
    rollback)     cmd_rollback "$@" ;;
    promote)      cmd_promote "$@" ;;
    delete)       cmd_delete "$@" ;;
    delete-db)    cmd_delete_db "$@" ;;
    help|--help|-h) cmd_help ;;
    *)
        error "Okänt kommando: '$COMMAND'. Kör: bash coolify-manage.sh help"
        ;;
esac
