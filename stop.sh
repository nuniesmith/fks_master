#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
shopt -s nullglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"   # .../fks
SERVICE_ROOT="${FKS_SERVICES_ROOT:-$ROOT_DIR}"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ts(){ date +'%Y-%m-%d %H:%M:%S'; }
log(){ local lvl="$1"; shift; local msg="$*"; local col="$NC"; case "$lvl" in INFO) col="$BLUE";; OK) col="$GREEN";; WARN) col="$YELLOW";; ERR) col="$RED";; esac; echo -e "${col}[$(ts)] [$lvl]${NC} $msg" >&2; }

MODE="stop"   # stop | down
FORCE_REMOVE=0
REMOVE_VOLUMES=0
INCLUDE_GPU=0
PARALLEL=${FKS_PARALLEL:-0}
DRY_RUN=${DRY_RUN:-0}

DEFAULT_GPU_SERVICES=(fks_transformer fks_training)
if [[ -n "${FKS_GPU_SERVICES:-}" ]]; then
    GPU_SERVICES=(${FKS_GPU_SERVICES//,/ })
else
    GPU_SERVICES=(${DEFAULT_GPU_SERVICES[@]})
fi

# Dynamically extract ORDER_SEQUENCE from start.sh to avoid drift
extract_order_sequence(){
    local file="$SCRIPT_DIR/start.sh"
    [[ -f "$file" ]] || return 1
    # Use awk to capture between ORDER_SEQUENCE=( and matching )
    awk '/^ORDER_SEQUENCE=\(/ {flag=1;next} flag { if ($0 ~ /^\)/){flag=0;exit} gsub(/#.*$/,""); for(i=1;i<=NF;i++){ if($i!="" ) print $i } }' "$file" | sed 's/[()\r\n]//g' | sed 's/\\//g'
}
ORDER_SEQUENCE=($(extract_order_sequence || true))
if [[ ${#ORDER_SEQUENCE[@]} -eq 0 ]]; then
    # Fallback minimal ordering if parsing failed
    ORDER_SEQUENCE=(fks_config fks_data fks_auth fks_engine fks_api fks_master fks_web fks_nginx)
    log WARN "Fallback ORDER_SEQUENCE used (could not parse from start.sh)"
fi

usage(){ cat <<'EOF'
Usage: ./stop.sh [options] [services...]

Stops services in reverse dependency order (default: full ORDER_SEQUENCE reversed).

Options:
    --down               Use 'docker compose down' instead of 'stop'
    --force              (with --down) force remove containers afterwards (fallback cleanup)
    --volumes            (with --down) remove named volumes (dangerous)
    --gpu                Include GPU services in actions (they are excluded by default)
    --parallel           Stop in parallel (best-effort, may break strict ordering)
    --dry-run            Show what would happen
    -h|--help|help       Show this help

Args:
    services...          Optional explicit list. Order will still honor dependency reverse ordering.

Env:
    FKS_SERVICES_ROOT    Override root scan directory (default parent of this script)
    FKS_GPU_SERVICES     Override GPU service list (space or comma separated)
    FKS_PARALLEL=1       Parallel stopping
    DRY_RUN=1            Dry-run mode

Behavior:
    1. Discovers services with docker-compose.yml under root.
    2. Builds ordered list (intersection of parsed ORDER_SEQUENCE & discovered).
    3. Filters GPU services unless --gpu used.
    4. If user supplied service names, list is restricted to those (and still reversed).
    5. Executes stop/down in reverse order for dependency safety.
EOF
}

is_gpu_service(){ local s="$1"; local g; for g in "${GPU_SERVICES[@]}"; do [[ "$g" == "$s" ]] && return 0; done; return 1; }

compose_bin(){ if command -v docker-compose >/dev/null 2>&1; then echo docker-compose; else echo docker compose; fi }

SERVICES_FOUND=()
declare -A SERVICE_PATHS=()
discover_services(){
    SERVICES_FOUND=(); SERVICE_PATHS=()
    local d n
    [[ -d "$SERVICE_ROOT" ]] || { log WARN "Missing service root $SERVICE_ROOT"; return; }
    for d in "$SERVICE_ROOT"/fks_*; do
        [[ -d "$d" ]] || continue
        n=$(basename "$d")
        [[ -f "$d/docker-compose.yml" ]] || continue
        SERVICE_PATHS[$n]="$d"; SERVICES_FOUND+=("$n")
    done
}

service_exists(){ [[ -n "${SERVICE_PATHS[$1]:-}" ]]; }

resolve_target_set(){
    local user_list=("$@")
    local ordered=() s
    if [[ ${#user_list[@]} -gt 0 ]]; then
        # Only keep those in ORDER_SEQUENCE intersection for deterministic ordering
        for s in "${ORDER_SEQUENCE[@]}"; do
            local u
            for u in "${user_list[@]}"; do
                [[ "$s" == "$u" && -n "${SERVICE_PATHS[$s]:-}" ]] && ordered+=("$s")
            done
        done
    else
        for s in "${ORDER_SEQUENCE[@]}"; do service_exists "$s" && ordered+=("$s"); done
        # Append stray discovered services not in ORDER_SEQUENCE
        local seen o
        for s in "${SERVICES_FOUND[@]}"; do
            seen=0; for o in "${ORDER_SEQUENCE[@]}"; do [[ "$o" == "$s" ]] && { seen=1; break; }; done
            [[ $seen -eq 0 ]] && ordered+=("$s")
        done
    fi
    echo "${ordered[*]}"
}

stop_one(){
    local svc="${1:-}" mode="${2:-stop}" files=(docker-compose.yml)
    if [[ -z "$svc" ]]; then
        log WARN "stop_one called without service name (skipping)"
        return 0
    fi
    local dir="${SERVICE_PATHS[$svc]:-}"
    [[ -d "$dir" ]] || { log WARN "Skip missing dir $svc"; return 0; }
    if [[ "${USE_SHARED:-0}" == "1" && -f "$dir/docker-compose.shared.yml" ]]; then
        files+=(docker-compose.shared.yml)
    fi
    local cmd=("$(compose_bin)") f
    for f in "${files[@]}"; do cmd+=( -f "$f" ); done
    if [[ "$mode" == down ]]; then
        cmd+=( down )
    else
        cmd+=( stop )
    fi
    # Join list for consistent output regardless of IFS
    local joined_files="$(printf '%s ' "${files[@]}")"
    log INFO "${mode^^} $svc (${joined_files% })"
    if [[ $DRY_RUN == 1 ]]; then
        log WARN "Dry-run: ${cmd[*]}"
        return 0
    fi
    ( cd "$dir" && ${cmd[@]} >/dev/null 2>&1 ) || log WARN "$svc: ${mode} command non-zero"
}

main(){
    local args=() svc
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --down) MODE=down; shift;;
            --force) FORCE_REMOVE=1; shift;;
            --volumes) REMOVE_VOLUMES=1; shift;;
            --gpu|--GPU) INCLUDE_GPU=1; shift;;
            --parallel) PARALLEL=1; shift;;
            --dry-run) DRY_RUN=1; shift;;
            -h|--help|help) usage; exit 0;;
            -*) log ERR "Unknown option $1"; usage; exit 1;;
            *) args+=("$1"); shift;;
        esac
    done

    discover_services
    local target; target=$(resolve_target_set "${args[@]}")
    # Filter GPU unless included
    local final=() skipped=() t
    for t in $target; do
        if is_gpu_service "$t" && [[ $INCLUDE_GPU -eq 0 ]]; then
            skipped+=("$t")
            continue
        fi
        final+=("$t")
    done
    if [[ ${#final[@]} -eq 0 ]]; then
        log WARN "No services to stop"
        exit 0
    fi
    [[ ${#skipped[@]} -gt 0 ]] && log INFO "GPU excluded: ${skipped[*]} (add --gpu to include)"

    # Reverse order for stopping
    local rev=() i
    for ((i=${#final[@]}-1;i>=0;i--)); do rev+=("${final[$i]}"); done
    # Ensure space-separated output (override IFS locally)
    local sequence_line="$(IFS=' '; printf '%s ' "${rev[@]}")"
    log INFO "Stopping (${MODE}) sequence: ${sequence_line% }"

    if [[ $PARALLEL -eq 1 ]]; then
        log WARN "Parallel stop may violate dependency order"
        local pids=() r
        for r in "${rev[@]}"; do stop_one "$r" "$MODE" & pids+=("$!"); done
        for p in "${pids[@]}"; do wait "$p" || true; done
    else
        local r
        for r in "${rev[@]}"; do stop_one "$r" "$MODE"; done
    fi

    if [[ "$MODE" == down ]]; then
        if [[ $FORCE_REMOVE -eq 1 ]]; then
            log INFO "Force removing lingering containers (prefix fks_)"
            [[ $DRY_RUN == 1 ]] || docker ps -a --format '{{.Names}}' | grep -E '^fks_' | xargs -r docker rm -f || true
        fi
        if [[ $REMOVE_VOLUMES -eq 1 ]]; then
            log WARN "Removing volumes (prefix fks_)"
            [[ $DRY_RUN == 1 ]] || docker volume ls -q | grep -E '^fks_' | xargs -r docker volume rm || true
        fi
    fi
    log OK "Shutdown complete (${MODE})"
}

main "$@"
