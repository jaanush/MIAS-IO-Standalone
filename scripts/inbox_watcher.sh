#!/usr/bin/env bash
# inbox_watcher.sh
#
# Generic file-change watcher. Polls a directory tree every N seconds and
# logs change events. Used by both the MIAS-IO agent and the CODESYS agent
# to monitor the shared MIAS-IO/docs/ folder.
#
# Each agent runs its own instance pointing at the same directory but
# writing to its own log, then reacts to lines its peer generates.
#
# Usage (MIAS-IO side):
#   bash scripts/inbox_watcher.sh \
#     "/c/onedrive/OneDrive - IT Borgen/Dokument/GitHub/MIAS-IO/docs" \
#     "/c/onedrive/OneDrive - IT Borgen/Dokument/GitHub/MIAS-IO/staging/inbox_events.log" \
#     "/c/onedrive/OneDrive - IT Borgen/Dokument/GitHub/MIAS-IO/staging/inbox_watcher.stop"
#
# To stop cleanly: touch the stop-file path.
# To view events: tail -f the log path.

set -u

WATCH_PATH="${1:?watched path required}"
LOG_PATH="${2:?log path required}"
STOP_FILE="${3:?stop-file path required}"
POLL_INTERVAL="${4:-2}"

if [[ ! -d "$WATCH_PATH" ]]; then
    echo "ERR: watched path does not exist: $WATCH_PATH" >&2
    exit 2
fi

mkdir -p "$(dirname "$LOG_PATH")" "$(dirname "$STOP_FILE")"
rm -f "$STOP_FILE"

now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

log() { echo "$(now) $*" >> "$LOG_PATH"; }

log "WATCHER_START path=$WATCH_PATH pid=$$ poll=${POLL_INTERVAL}s"

declare -A LAST_MTIME
while IFS= read -r f; do
    LAST_MTIME["$f"]=$(stat -c %Y "$f" 2>/dev/null || echo 0)
done < <(find "$WATCH_PATH" -type f 2>/dev/null)

while true; do
    if [[ -e "$STOP_FILE" ]]; then
        log "WATCHER_STOP reason=stopfile"
        rm -f "$STOP_FILE"
        break
    fi

    declare -A CURR_MTIME=()
    while IFS= read -r f; do
        CURR_MTIME["$f"]=$(stat -c %Y "$f" 2>/dev/null || echo 0)
    done < <(find "$WATCH_PATH" -type f 2>/dev/null)

    for f in "${!CURR_MTIME[@]}"; do
        if [[ -z "${LAST_MTIME[$f]+x}" ]]; then
            log "Created $f"
        elif [[ "${CURR_MTIME[$f]}" != "${LAST_MTIME[$f]}" ]]; then
            log "Changed $f"
        fi
    done

    for f in "${!LAST_MTIME[@]}"; do
        if [[ -z "${CURR_MTIME[$f]+x}" ]]; then
            log "Deleted $f"
        fi
    done

    LAST_MTIME=()
    for f in "${!CURR_MTIME[@]}"; do
        LAST_MTIME["$f"]="${CURR_MTIME[$f]}"
    done
    unset CURR_MTIME

    sleep "$POLL_INTERVAL"
done

log "WATCHER_EXIT pid=$$"
