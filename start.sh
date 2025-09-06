#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
shopt -s nullglob

# Unified FKS master script: monitor (Rust) + service orchestration
# Subcommands:
#   monitor  (build & run fks_master)
#   services (start/stop/status etc.)
#   all      (default alias -> services start all)

# -------------- Styling / logging --------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ts() { date +'%Y-%m-%d %H:%M:%S'; }
log() { # Write logs to stderr so command substitution on stdout stays clean
    local lvl="$1"; shift; local msg="$*"; local col="$NC"; case "$lvl" in INFO) col="$BLUE";; OK) col="$GREEN";; WARN) col="$YELLOW";; ERR) col="$RED";; esac; echo -e "${col}[$(ts)] [$lvl]${NC} $msg" >&2; }

trap 'log ERR "Aborted at line $LINENO"' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# After repository flattening all service directories (fks_*) live directly under the parent directory of this script.
ROOT_DIR="$(dirname "$SCRIPT_DIR")"   # .../fks
# Single direct root (parent of this script) unless overridden
SERVICE_ROOT="${FKS_SERVICES_ROOT:-$ROOT_DIR}"
[[ "${FKS_DEBUG:-0}" == "1" ]] && log INFO "Service root: $SERVICE_ROOT"
cd "$SCRIPT_DIR"

# -------------- Globals / defaults --------------
DRY_RUN="${DRY_RUN:-0}"
FORCE_REMOVE=0
REMOVE_VOLUMES=0
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-60}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-5}
INCLUDE_GPU=0   # Enabled by --gpu flag
INTERACTIVE=0   # Enabled by --interactive flag
PREBUILD=${FKS_PREBUILD:-1}   # Build images first (default on). Disable with --no-prebuild or FKS_PREBUILD=0
AFTER_PREBUILD=0              # Internal flag to skip --build on up after prebuild
BUILD_PARALLEL=${FKS_BUILD_PARALLEL:-1}
ALLOW_UNPREFIXED=${FKS_ALLOW_UNPREFIXED:-1}  # Allow discovery of directories without fks_ prefix
FKS_DOCKER_USER="${FKS_DOCKER_USER:-nuniesmith}"
FKS_DOCKER_REPO="${FKS_DOCKER_REPO:-fks}"
PUSH_ENABLED=${FKS_PUSH:-1}   # Push images after successful build (optional)
PUSH_PARALLEL=${FKS_PUSH_PARALLEL:-1}
PUSH_TAG="${FKS_IMAGE_TAG:-latest}"
SINGLE_REPO_PUSH="${FKS_SINGLE_REPO:-1}"   # When 1, push all images to single repo <user>/<repo>:<service>-<tag>
STRICT_PORT_MODE="${FKS_STRICT_PORT:-0}"   # When 1, abort start on detected host port conflicts
PORT_REMAP_SPEC="${FKS_PORT_REMAPPINGS:-}"  # Manual remaps: svc1:NEWPORT,svc2:NEWPORT
AUTO_REMAP="${FKS_AUTO_REMAP:-0}"          # When 1, auto-pick next free port on conflict (override compose)

# GPU intensive services (excluded from default 'all' unless --gpu)
DEFAULT_GPU_SERVICES=(transformer training fks_transformer fks_training)
push_images(){
    local list=("$@")
    local user="${FKS_DOCKER_USER:-}"      # e.g. docker hub username / org namespace
    local repo="${FKS_DOCKER_REPO:-}"      # e.g. base repo prefix (fks)
    local registry="${FKS_DOCKER_REGISTRY:-${FKS_IMAGE_REGISTRY:-docker.io}}"
    if [[ -z "$user" || -z "$repo" ]]; then
        log ERR "Cannot push: need FKS_DOCKER_USER and FKS_DOCKER_REPO"
        return 1
    fi
    if [[ ${#list[@]} -eq 0 ]]; then
        log WARN "push_images: empty list"
        return 0
    fi
    if [[ $DRY_RUN == 1 ]]; then
        log WARN "Dry-run: skipping push phase"
        return 0
    fi
    if [[ "$SINGLE_REPO_PUSH" == "1" ]]; then
        log INFO "Pushing ${#list[@]} image(s) to single repo mode: $registry/$user/$repo:<service>-$PUSH_TAG parallel=$PUSH_PARALLEL"
    else
        log INFO "Pushing ${#list[@]} image(s) to multi repo mode: $registry/$user (pattern: $user/$repo-<service>:$PUSH_TAG) parallel=$PUSH_PARALLEL"
    fi
    local failures=() jobs=() s
    _push_one(){
        local s="$1"; local dir="${SERVICE_PATHS[$s]:-}"; [[ -d "$dir" ]] || { log WARN "Skip push (missing dir) $s"; return 0; }
        local project="$(basename "$dir")"
        local explicit_image=""
        if grep -E '^[[:space:]]*image:' "$dir/docker-compose.yml" >/dev/null 2>&1; then
            explicit_image=$(grep -E '^[[:space:]]*image:' "$dir/docker-compose.yml" | head -1 | sed 's/^[[:space:]]*image:[[:space:]]*//')
        fi
        local local_ref=""
        if [[ -n "$explicit_image" ]]; then
            if docker image inspect "$explicit_image" >/dev/null 2>&1; then
                local_ref="$explicit_image"
            elif docker image inspect "${explicit_image}:latest" >/dev/null 2>&1; then
                local_ref="${explicit_image}:latest"
            fi
        fi
        if [[ -z "$local_ref" ]]; then
            # Try compose project naming patterns
            # Candidate image name patterns (broad to catch various build/tag styles)
            local candidates=(
                "${project}_${s}:${PUSH_TAG}"    # compose v2 default underscore + custom tag
                "${project}_${s}:latest"          # compose v2 default underscore latest
                "${project}-${s}:${PUSH_TAG}"    # legacy hyphen custom tag
                "${project}-${s}:latest"          # legacy hyphen latest
                "${s}:${PUSH_TAG}"                # plain service name custom tag (manual build)
                "${s}:latest"                     # plain service name latest (manual build)
            )
            local c
            for c in "${candidates[@]}"; do
                if docker image inspect "$c" >/dev/null 2>&1; then local_ref="$c"; break; fi
            done
            # If still not found and service isn't prefixed, attempt fks_ prefixed variants
            if [[ -z "$local_ref" && "$s" != fks_* ]]; then
                local pref="fks_${s}"
                local alt_candidates=(
                    "${project}_${pref}:${PUSH_TAG}"
                    "${project}_${pref}:latest"
                    "${project}-${pref}:${PUSH_TAG}"
                    "${project}-${pref}:latest"
                    "${pref}:${PUSH_TAG}"
                    "${pref}:latest"
                )
                for c in "${alt_candidates[@]}"; do
                    if docker image inspect "$c" >/dev/null 2>&1; then local_ref="$c"; break; fi
                done
            fi
        fi
        if [[ -z "$local_ref" ]]; then
            if [[ "${FKS_DEBUG:-0}" == "1" ]]; then
                log WARN "No local image found for $s (candidates tried: ${candidates[*]} ${alt_candidates:-})"
            else
                log WARN "No local image found for $s (skip)"
            fi
            return 0
        fi
    # Standard naming convention: <registry>/<user>/<repo>-<service>:<tag>
    local target
    # Use base (unprefixed) service name in final tag label to keep <service>-<tag> consistent
    local base_name="$s"
    if [[ "$base_name" == fks_* ]]; then base_name="${base_name#fks_}"; fi
    if [[ "$SINGLE_REPO_PUSH" == "1" ]]; then
        # Consolidated single repository: <registry>/<user>/<repo>:<service>-<tag>
        target="${registry}/${user}/${repo}:${base_name}-${PUSH_TAG}"
    else
        # Legacy per-service repo naming: <registry>/<user>/<repo>-<service>:<tag>
        target="${registry}/${user}/${repo}-${base_name}:${PUSH_TAG}"
    fi
        log INFO "TAG $local_ref -> $target"
        if ! docker tag "$local_ref" "$target" >/dev/null 2>&1; then
            log WARN "Tag failed: $s"
            return 1
        fi
        log INFO "PUSH $target"
        if ! docker push "$target" >/dev/null; then
            log WARN "Push failed: $s"
            return 1
        fi
        log OK "Pushed $target"
    }
    if [[ $PUSH_PARALLEL -eq 1 ]]; then
        for s in "${list[@]}"; do _push_one "$s" & jobs+=("$!"); done
        local pid
        for pid in "${jobs[@]}"; do if ! wait "$pid"; then failures+=("pid:$pid"); fi; done
    else
        for s in "${list[@]}"; do _push_one "$s" || failures+=("$s"); done
    fi
    if [[ ${#failures[@]} -gt 0 ]]; then
        log ERR "Push failures: ${failures[*]}"
        return 1
    fi
    log OK "Push phase complete"
}
if [[ -n "${FKS_GPU_SERVICES:-}" ]]; then
    GPU_SERVICES=(${FKS_GPU_SERVICES//,/ }) # commas -> spaces
else
    GPU_SERVICES=(${DEFAULT_GPU_SERVICES[@]})
fi

is_gpu_service(){ local s="$1" base="${1#fks_}"; local g; for g in "${GPU_SERVICES[@]}"; do [[ "$g" == "$s" || "$g" == "$base" ]] && return 0; done; return 1; }

# Explicit ordered startup sequence (supersedes tier grouping for build_order_all)
# Rationale: dependency-aware linear ordering provided by user.
ORDER_SEQUENCE=(
    # 1. Orchestrator / control plane first so it can observe subsequent startups
    master
    # 2. Configuration generator (produces env & manifests consumed by others)
    config
    # 3. Auth boundary early so tokens/validation ready for downstream services
    auth
    # 4. Node mesh foundation (fast rust/node graph) before execution layer
    nodes
    # 5. Low-latency execution service atop node network
    execution
    # 6. Core data ingestion so engine & ML layers have sources
    data
    # 7. Engine orchestrates logic (after data + execution + nodes)
    engine
    # 8-9. ML / GPU related (can be excluded by default) training then transformer
    training
    transformer
    # 10. Worker / task scheduler (depends on engine, transformer outputs)
    worker
    # 11. Public API facade
    api
    # 12. Analytics / tooling (non-critical)
    analyze
    docs
    # 13-14. UI and ingress last
    web
    nginx
)

declare -A HEALTH_ENDPOINTS=(
    [config]="http://localhost:8002/health" [fks_config]="http://localhost:8002/health"
    [auth]="http://localhost:4100/health" [fks_auth]="http://localhost:4100/health"
    [api]="http://localhost:8000/health" [fks_api]="http://localhost:8000/health"
    [docs]="http://localhost:8040/health" [fks_docs]="http://localhost:8040/health"
    [engine]="http://localhost:4300/health" [fks_engine]="http://localhost:4300/health"
    [nginx]="http://localhost/" [fks_nginx]="http://localhost/"
    [master]="http://localhost:3030/health" [fks_master]="http://localhost:3030/health"
    [worker]="http://localhost:4600/health" [fks_worker]="http://localhost:4600/health"
    [web]="http://localhost:8080/health" [fks_web]="http://localhost:8080/health"
    [data]="http://localhost:4200/health" [fks_data]="http://localhost:4200/health"
    [transformer]="http://localhost:4500/health" [fks_transformer]="http://localhost:4500/health"
    [training]="http://localhost:8005/health" [fks_training]="http://localhost:8005/health"
    [execution]="http://localhost:4700/health" [fks_execution]="http://localhost:4700/health"
    [analyze]="http://localhost:4802/health" [fks_analyze]="http://localhost:4802/health"
    [nodes]="http://localhost:5000/health" [fks_nodes]="http://localhost:5000/health"
    [ninja]="http://localhost:4900/health" [fks_ninja]="http://localhost:4900/health"
)

IFS=',' read -r -a EXCLUDES <<< "${FKS_EXCLUDE_SERVICES:-}"

is_excluded(){ local svc="$1"; for e in "${EXCLUDES[@]}"; do [[ -n "$e" && "$e" == "$svc" ]] && return 0; done; return 1; }

SERVICES_FOUND=()
declare -A SERVICE_PATHS=()
discover_services(){
    SERVICES_FOUND=()
    SERVICE_PATHS=()
    local root d n base
    root="$SERVICE_ROOT"
    [[ -d "$root" ]] || { log WARN "Service root missing: $root"; return; }
    [[ "${FKS_DEBUG:-0}" == "1" ]] && log INFO "Scan root: $root"
    # 1. Prefixed discovery (canonical)
    for d in "$root"/fks_*; do
        [[ -d "$d" ]] || continue
        n=$(basename "$d")
        base="${n#fks_}"
        [[ -f "$d/docker-compose.yml" ]] || continue
        is_excluded "$n" && continue
        SERVICE_PATHS[$n]="$d"
        SERVICE_PATHS[$base]="$d"
        if ! printf '%s\n' "${SERVICES_FOUND[@]}" | grep -qx "$base"; then
            SERVICES_FOUND+=("$base")
        fi
    done
    # 2. Optional unprefixed discovery (current repo layout) guarded by flag
    if [[ $ALLOW_UNPREFIXED -eq 1 ]]; then
        for d in "$root"/*; do
            [[ -d "$d" ]] || continue
            n=$(basename "$d")
            # Skip already captured prefixed dirs and internal folders (master script dir itself etc.)
            [[ "$n" == fks_* ]] && continue
            [[ "$n" == "master" ]] && continue
            [[ -f "$d/docker-compose.yml" ]] || continue
            # Provide dual mapping so both 'api' and 'fks_api' work.
            base="$n"
            local prefixed="fks_${n}"
            # Exclusion can target either form; check both
            if is_excluded "$n" || is_excluded "$prefixed"; then continue; fi
            # Do not overwrite an existing mapping coming from a real prefixed directory
            if [[ -z "${SERVICE_PATHS[$base]:-}" && -z "${SERVICE_PATHS[$prefixed]:-}" ]]; then
                SERVICE_PATHS[$base]="$d"
                SERVICE_PATHS[$prefixed]="$d"
                if ! printf '%s\n' "${SERVICES_FOUND[@]}" | grep -qx "$base"; then
                    SERVICES_FOUND+=("$base")
                fi
            fi
        done
    fi
    if [[ "${FKS_DEBUG:-0}" == "1" ]]; then
        log INFO "Discovered services (count=${#SERVICES_FOUND[@]}): ${SERVICES_FOUND[*]}"
        local k
        for k in "${SERVICES_FOUND[@]}"; do
            log INFO " - $k => ${SERVICE_PATHS[$k]}"
        done
    fi
}
service_exists(){ local t="$1"; [[ -n "${SERVICE_PATHS[$t]:-}" ]]; }

# -------------- Health check --------------
check_health(){
    local svc="$1" url="$2"
    if [[ -z "$url" ]]; then
        if [[ "${FKS_SUPPRESS_HEALTH_WARN:-0}" == "1" ]]; then
            [[ "${FKS_DEBUG:-0}" == "1" ]] && log INFO "$svc no health endpoint (suppressed)"
        else
            log WARN "$svc no health endpoint"
        fi
        return 0
    fi
    local attempts=$((HEALTH_CHECK_TIMEOUT/HEALTH_CHECK_INTERVAL))
    log INFO "Health: $svc -> $url"
    for ((i=1;i<=attempts;i++)); do
        if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
            log OK "$svc healthy"
            return 0
        fi
        sleep "$HEALTH_CHECK_INTERVAL"
    done
    log WARN "$svc health timeout (${HEALTH_CHECK_TIMEOUT}s)"
    return 1
}

# -------------- Docker helpers --------------
compose_bin(){ if command -v docker-compose >/dev/null 2>&1; then echo docker-compose; else echo docker compose; fi }
ensure_network(){
    if docker network inspect fks_net >/dev/null 2>&1; then
        log INFO "Network fks_net exists"
    else
        log INFO "Creating network fks_net"
        docker network create fks_net >/dev/null 2>&1 || log WARN "Race: network already created"
    fi
}

# Extract host port numbers from a compose file (best-effort; ignores env-substitution & ranges)
extract_host_ports(){
    local file="$1"; [[ -f "$file" ]] || return 0
    # Grep lines like - "4800:4800" or - 8080:80
    grep -E '^[[:space:]]*-+ *"?[0-9]+:[0-9]+' "$file" 2>/dev/null | \
        sed -E 's/^[[:space:]]*-+ *"?([0-9]+):[0-9]+.*$/\1/' | tr '\n' ' '
}

# Check if a host port is already bound by an existing container (docker perspective)
port_in_use(){
    local port="$1"
    # Look for mappings like 0.0.0.0:4800-> or :::4800->
    docker ps --format '{{.Names}} {{.Ports}}' | grep -E "(:|::)$port->" || true
}

# Quick check if a host port is available (listens on 0.0.0.0)
port_available(){
    local p="$1"
    if port_in_use "$p" >/dev/null; then return 1; fi
    # Also check local sockets (ss or netstat)
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | awk 'NR>1 {sub(/.*:/,"",$4); print $4}' | grep -qx "$p" && return 1
    elif command -v netstat >/dev/null 2>&1; then
        netstat -ltn 2>/dev/null | awk 'NR>2 {sub(/.*:/,"",$4); print $4}' | grep -qx "$p" && return 1
    fi
    return 0
}

# Parse manual remap specification
get_manual_remap(){
    local svc="$1" pair
    IFS=',' read -r -a _pairs <<< "$PORT_REMAP_SPEC"
    for pair in "${_pairs[@]}"; do
        [[ -z "$pair" ]] && continue
        if [[ "$pair" == "$svc:"* ]]; then
            echo "${pair#*:}"
            return 0
        fi
    done
    return 1
}

# Find first free port >= base (bounded attempts)
allocate_host_port(){
    local base="$1" attempt=0 p
    p=$base
    while (( attempt < 50 )); do
        if port_available "$p"; then echo "$p"; return 0; fi
        p=$((p+1)); attempt=$((attempt+1))
    done
    return 1
}

# Write a temporary override compose file for port remap
generate_override(){
    local svc="$1" host_port="$2" container_port="$3" outfile="$4"
    cat >"$outfile" <<EOF_OVERRIDE
services:
  $svc:
    ports:
      - "${host_port}:${container_port}"
EOF_OVERRIDE
}

start_service(){
    # Defensive: avoid unbound variable issues under set -u by separating assignments
    local svc="${1:-}"
    if [[ -z "$svc" ]]; then
        log ERR "start_service called without service name"
        return 1
    fi
    local dir="${SERVICE_PATHS[$svc]:-}"
    # Fallback: if alias given but path missing, try with fks_ prefix
    if [[ -z "$dir" && -n "${SERVICE_PATHS[fks_${svc}]:-}" ]]; then
        dir="${SERVICE_PATHS[fks_${svc}]}"
    fi
    local url="${HEALTH_ENDPOINTS[$svc]:-}"
    if [[ ! -d "$dir" ]]; then
        log ERR "Missing dir $dir"
        return 1
    fi
    if [[ ! -f "$dir/docker-compose.yml" ]]; then
        log WARN "$svc missing docker-compose.yml"
        return 0
    fi
    cd "$dir" || return 1
    local files=(docker-compose.yml)
    if [[ "${USE_SHARED:-0}" == "1" && -f docker-compose.shared.yml ]]; then
        files+=(docker-compose.shared.yml)
    fi
    local cmd
    cmd=("$(compose_bin)")
    local f
    for f in "${files[@]}"; do cmd+=( -f "$f" ); done
    cmd+=( up -d )
    if [[ $AFTER_PREBUILD -eq 0 ]]; then
        # No prebuild done, include --build to ensure image freshness
        cmd+=( --build )
    fi
    log INFO "Starting $svc (${files[*]})"
    # Pre-start host port conflict detection
    local host_ports; host_ports=$(extract_host_ports "docker-compose.yml" || true)
    local override_file="" new_host_port="" container_port="" manual_remap="" conflict_ports=()
    if [[ -n "$host_ports" ]]; then
        local hp conflict=0
        for hp in $host_ports; do
            local owners
            owners=$(port_in_use "$hp" | awk '{print $1}' | paste -sd, - || true)
            if [[ -n "$owners" ]]; then
                # If an existing container for this service already uses it, consider ok.
                if ! echo "$owners" | grep -qw "$svc"; then
                    log WARN "$svc host port $hp already in use by container(s): $owners"
                    conflict=1
                    conflict_ports+=("$hp")
                fi
            fi
        done
        if [[ $conflict -eq 1 ]]; then
            # Manual remap takes precedence
            if manual_remap=$(get_manual_remap "$svc" 2>/dev/null); then
                new_host_port="$manual_remap"
            elif [[ "$AUTO_REMAP" == "1" ]]; then
                # Use first conflicting port as base
                local base_port="${conflict_ports[0]}"
                if new_host_port=$(allocate_host_port "$base_port" 2>/dev/null); then
                    log INFO "$svc auto-remap: $base_port -> $new_host_port"
                else
                    log WARN "$svc auto-remap failed to find free port near $base_port"
                fi
            fi
            if [[ -n "$new_host_port" ]]; then
                # Determine container port (assume same as first mapping's right side)
                local first_map
                first_map=$(grep -E '^[[:space:]]*-+ *"?[0-9]+:[0-9]+' docker-compose.yml | head -1 | sed -E 's/^[[:space:]]*-+ *"?([0-9]+):([0-9]+).*/\1:\2/')
                container_port=${first_map##*:}
                override_file=".fks_port_override_${svc}.yml"
                generate_override "$svc" "$new_host_port" "$container_port" "$override_file"
                files+=("$override_file")
                log INFO "$svc applying port override -> $new_host_port:$container_port (file=$override_file)"
                # Update health endpoint if known
                if [[ -n "${HEALTH_ENDPOINTS[$svc]:-}" ]]; then
                    local hp_url="${HEALTH_ENDPOINTS[$svc]}"
                    if [[ "$hp_url" =~ ^http://localhost:([0-9]+)/ ]]; then
                        local orig_port="${BASH_REMATCH[1]}"
                        HEALTH_ENDPOINTS[$svc]="${hp_url//:$orig_port/:$new_host_port}"
                        url="${HEALTH_ENDPOINTS[$svc]}"
                        log INFO "$svc health endpoint remapped to $url"
                    fi
                fi
            elif [[ "$STRICT_PORT_MODE" == "1" ]]; then
                log ERR "Aborting $svc start due to port conflict(s) and no remap (STRICT_PORT_MODE=1)"
                cd "$SCRIPT_DIR" || true
                return 1
            fi
        fi
    fi
    if [[ "$DRY_RUN" == "1" ]]; then
        log WARN "Dry-run skip"
    else
    if ! ${cmd[@]}; then
            local rc=$?
            # Attempt targeted diagnostics for common failures (ports)
            if [[ -n "$host_ports" ]]; then
                local hp
                for hp in $host_ports; do
                    local owners
                    owners=$(port_in_use "$hp" | awk '{print $1}' | paste -sd, - || true)
                    if [[ -n "$owners" ]]; then
                        log WARN "Post-failure: host port $hp currently owned by: $owners"
                    fi
                done
            fi
            log ERR "docker compose up failed for $svc (exit=$rc)"
            cd "$SCRIPT_DIR" || true
            return $rc
        fi
    fi
    check_health "$svc" "$url" || true
}

stop_all(){ log INFO "Stopping services"; discover_services; for ((i=${#SERVICES_FOUND[@]}-1;i>=0;i--)); do local s="${SERVICES_FOUND[$i]}"; local d="${SERVICE_PATHS[$s]:-}"; [[ -f "$d/docker-compose.yml" ]] || continue; log INFO "Down $s"; ( cd "$d" && $(compose_bin) down >/dev/null 2>&1 || true ); done; log OK "All stopped"; }

check_prereqs(){ for b in docker curl; do command -v "$b" >/dev/null 2>&1 || { log ERR "Missing dependency: $b"; exit 1; }; done; docker info >/dev/null 2>&1 || { log ERR "Docker daemon not running"; exit 1; }; }

build_order_all(){
    local ordered=() s o seen
    if [[ ${#ORDER_SEQUENCE[@]} -gt 0 ]]; then
        for s in "${ORDER_SEQUENCE[@]}"; do service_exists "$s" && ordered+=("$s"); done
        for s in "${SERVICES_FOUND[@]}"; do
            seen=0
            for o in "${ORDER_SEQUENCE[@]}"; do [[ "$o" == "$s" ]] && { seen=1; break; }; done
            [[ $seen -eq 0 ]] && ordered+=("$s")
        done
    else
        # No explicit order: just use discovery order
        ordered=("${SERVICES_FOUND[@]}")
    fi
    echo "${ordered[*]}"
}

resolve_set(){
    local mode="$1"; shift || true
    case "$mode" in
        core)
            # Define essential baseline services (exclude optional GPU / analyze / ui ingress components)
            local essentials=(fks_master fks_config fks_auth fks_nodes fks_execution fks_data fks_engine fks_worker fks_api)
            local out=() s
            for s in "${essentials[@]}"; do service_exists "$s" && out+=("$s"); done
            if [[ ${#out[@]} -gt 0 ]]; then
                local _oldifs="$IFS"; IFS=' '; local _joined="${out[*]}"; IFS="$_oldifs"; echo "$_joined"
            fi
            ;;
        all) build_order_all ;;
        gpu)
            local out=() s
            for s in "${GPU_SERVICES[@]}"; do service_exists "$s" && out+=("$s"); done
            echo "${out[*]}" ;;
        list) echo "${SERVICES_FOUND[*]}" ;;
        custom)
            local out=() s
            for s in "$@"; do service_exists "$s" && out+=("$s"); done
            echo "${out[*]}" ;;
        *) resolve_set custom "$mode" "$@" ;;
    esac
}

start_services(){
    discover_services
    local sel="${1:-all}"; shift || true
    # If the first token accidentally included the subcommand 'services', treat as custom list
    if [[ "$sel" == "services" ]]; then
        sel="custom"
    fi
    local resolved; resolved=$(resolve_set "$sel" "$@")
    # Replace any newlines (shouldn't happen now) with spaces
    resolved=${resolved//$'\n'/ }
    # Split resolved (space delimited) irrespective of global IFS (newline+tab)
    local arr=()
    if [[ -n "$resolved" ]]; then
        local OLD_IFS="$IFS"
        IFS=' '
        # shellcheck disable=SC2206
        arr=($resolved)
        IFS="$OLD_IFS"
    fi
    # Determine unknowns (requested minus resolved)
    local requested=( )
    if [[ "$sel" == "custom" ]]; then
        requested=( "$@" )
    elif [[ "$sel" != "all" && "$sel" != "core" && "$sel" != "list" ]]; then
        requested=( "$sel" "$@" )
    elif [[ "$sel" == "core" ]]; then
        requested=( "${CORE_SERVICES[@]}" )
    fi
    local unknown=()
    if [[ ${#requested[@]} -gt 0 ]]; then
        local r found
        for r in "${requested[@]}"; do
            found=0
            for s in "${arr[@]}"; do [[ "$s" == "$r" ]] && { found=1; break; }; done
            [[ $found -eq 0 ]] && ! is_excluded "$r" && unknown+=("$r")
        done
    fi
    if [[ ${#unknown[@]} -gt 0 ]]; then
        log WARN "Skipping unknown (no compose): ${unknown[*]}"
    fi
    if [[ "${FKS_DEBUG:-0}" == "1" ]]; then
        log INFO "Debug: sel=$sel requested=${requested[*]} resolved=${arr[*]} SERVICES_FOUND=${SERVICES_FOUND[*]}"
    fi
    if [[ ${#arr[@]} -eq 0 ]]; then
        log WARN "No services matched selection '$sel'"
        return 0
    fi
    # Exclude GPU services from 'all' unless explicitly included
    if [[ "$sel" == "all" && $INCLUDE_GPU -eq 0 ]]; then
        local filtered=() skipped=() s
        for s in "${arr[@]}"; do
            if is_gpu_service "$s"; then
                skipped+=("$s")
            else
                filtered+=("$s")
            fi
        done
        if [[ ${#skipped[@]} -gt 0 ]]; then
            log INFO "Excluding GPU services (use --gpu to include): ${skipped[*]}"
        fi
        arr=("${filtered[@]}")
        if [[ ${#arr[@]} -eq 0 ]]; then
            log WARN "All selected services are GPU and were excluded without --gpu"
            return 0
        fi
    fi
    check_prereqs; if [[ "${FKS_SKIP_NETWORK_CREATE:-0}" != "1" ]]; then ensure_network; else log INFO "Skipping network creation (FKS_SKIP_NETWORK_CREATE=1)"; fi
    # Optional pre-build phase
    if [[ $PREBUILD -eq 1 ]]; then
        if ! build_services "${arr[@]}"; then
            log ERR "Aborting startup due to build failure(s)"
            # Attempt to stop any partial containers (defensive)
            if docker ps --format '{{.Names}}' | grep -q '^fks_'; then
                log INFO "Stopping any started containers after failed build"
                stop_all || true
            fi
            return 1
        fi
        AFTER_PREBUILD=1
        if [[ $PUSH_ENABLED -eq 1 ]]; then
            if ! push_images "${arr[@]}"; then
                log WARN "Continuing despite push failures"
            fi
        fi
    fi
    local IFS=' '
    log INFO "Selection ($sel): ${arr[*]}"
    if [[ "${FKS_PARALLEL:-0}" == "1" ]]; then
        log INFO "Parallel start enabled (${#arr[@]} services)"
        local pids=() s
        for s in "${arr[@]}"; do
            [[ -z "${s:-}" ]] && continue
            ( start_service "$s" ) &
            pids+=("$!")
        done
        local pid
        for pid in "${pids[@]}"; do
            wait "$pid" || true
        done
        log OK "Started ${#arr[@]} service(s) (parallel)"
    else
        local s
        for s in "${arr[@]}"; do
            [[ -z "${s:-}" ]] && continue
            start_service "$s" || true
        done
        log OK "Started ${#arr[@]} service(s)"
    fi
}

# -------------- Build (pre-build images) --------------
build_services(){
    local list=("$@")
    if [[ ${#list[@]} -eq 0 ]]; then
        log WARN "build_services: empty list"
        return 0
    fi
    log INFO "Pre-building ${#list[@]} service image(s) (parallel=${BUILD_PARALLEL})"

    # Auto-build shared nginx base image if nginx included and base tag missing
    ensure_nginx_base_image(){
        local base_tag="shared/nginx:1.27.1-alpine"
        local want=0 s
        for s in "${list[@]}"; do
            [[ "$s" == "nginx" || "$s" == "fks_nginx" ]] && { want=1; break; }
        done
        [[ $want -eq 0 ]] && return 0
        if ! docker image inspect "$base_tag" >/dev/null 2>&1; then
            log INFO "Base image $base_tag missing; building via nginx/scripts/build-all.sh"
            if [[ -d "$ROOT_DIR/nginx/scripts" && -x "$ROOT_DIR/nginx/scripts/build-all.sh" ]]; then
                ( cd "$ROOT_DIR/nginx" && ./scripts/build-all.sh 1.27.1 ) || log WARN "Failed to build base nginx image"
            else
                log WARN "Cannot auto-build base nginx image (script missing)"
            fi
        else
            log INFO "Base image $base_tag present"
        fi
    }
    ensure_nginx_base_image || true
    if [[ $DRY_RUN == 1 ]]; then
        log WARN "Dry-run: skipping docker compose build"
        return 0
    fi
    local failures=() s
    if [[ $BUILD_PARALLEL -eq 1 ]]; then
        local tmpdir
        tmpdir=$(mktemp -d 2>/dev/null || mktemp -d -t fks_build)
        local jobs=()
        for s in "${list[@]}"; do
            local dir="${SERVICE_PATHS[$s]:-}"
            [[ -d "$dir" ]] || { log WARN "Skip build (missing dir) $s"; continue; }
            (
                cd "$dir" || exit 0
                local files=(docker-compose.yml)
                if [[ "${USE_SHARED:-0}" == "1" && -f docker-compose.shared.yml ]]; then files+=(docker-compose.shared.yml); fi
                local cmd=("$(compose_bin)") f
                for f in "${files[@]}"; do cmd+=( -f "$f" ); done
                # Build all services in this compose file to avoid alias mismatch (e.g. fks_config vs config)
                cmd+=( build )
                log INFO "BUILD (all services in) $s (${files[*]})"
                if { ${cmd[@]} 2>&1 | sed -u "s/^/[${s}] /"; }; then
                    echo success >"$tmpdir/$s.status"
                    log OK "Built $s"
                else
                    echo fail >"$tmpdir/$s.status"
                    log WARN "Build failed: $s"
                fi
            ) & jobs+=("$!")
        done
        local pid
        for pid in "${jobs[@]}"; do wait "$pid" || true; done
        # Collect results
        for s in "${list[@]}"; do
            if [[ -f "$tmpdir/$s.status" ]] && grep -q fail "$tmpdir/$s.status"; then
                failures+=("$s")
            fi
        done
        rm -rf "$tmpdir" || true
    else
        for s in "${list[@]}"; do
            local dir="${SERVICE_PATHS[$s]:-}"
            [[ -d "$dir" ]] || { log WARN "Skip build (missing dir) $s"; continue; }
            cd "$dir" || continue
            local files=(docker-compose.yml)
            if [[ "${USE_SHARED:-0}" == "1" && -f docker-compose.shared.yml ]]; then files+=(docker-compose.shared.yml); fi
            local cmd=("$(compose_bin)") f
            for f in "${files[@]}"; do cmd+=( -f "$f" ); done
            cmd+=( build )
            log INFO "BUILD (all services in) $s (${files[*]})"
            if { ${cmd[@]} 2>&1 | sed -u "s/^/[${s}] /"; }; then
                log OK "Built $s"
            else
                log WARN "Build failed: $s"
                failures+=("$s")
                # Fail fast in sequential mode
                break
            fi
        done
    fi
    cd "$SCRIPT_DIR" || true
    if [[ ${#failures[@]} -gt 0 ]]; then
        log ERR "Pre-build failures: ${failures[*]}"
        return 1
    fi
    log OK "Pre-build phase complete"
}

# -------------- Interactive Menu --------------
interactive_menu(){
    discover_services
    local base_order; base_order=$(build_order_all)
    local preselected=() s
    for s in $base_order; do
        if is_gpu_service "$s" && [[ $INCLUDE_GPU -eq 0 ]]; then
            continue
        fi
        preselected+=("$s")
    done
    local selected_map=()
    for s in "${preselected[@]}"; do selected_map+=("$s=1"); done
    local input
    while true; do
        echo
        log INFO "Interactive Selection: numbers toggle | a=all | g=toggle GPU set | n=none | enter=start | q=quit"
        local idx=1 listed=()
        for s in $base_order; do
            listed+=("$s")
            local mark=" "
            if printf '%s\n' "${selected_map[@]}" | grep -q "^${s}=1$"; then mark="x"; fi
            printf '%2d) [%s] %s\n' "$idx" "$mark" "$s"
            idx=$((idx+1))
        done
        echo -n "Select> "
        read -r input || true
        if [[ -z "$input" ]]; then break; fi
        case "$input" in
            q|Q) log INFO "Quit (no action)"; return 0 ;;
            a|A)
                selected_map=(); for s in $base_order; do selected_map+=("$s=1"); done ;;
            n|N)
                selected_map=() ;;
            g|G)
                local gsvc
                for gsvc in "${GPU_SERVICES[@]}"; do
                    local present=0
                    if printf '%s\n' "${selected_map[@]}" | grep -q "^${gsvc}=1$"; then present=1; fi
                    if [[ $present -eq 1 ]]; then
                        local tmp=() kv
                        for kv in "${selected_map[@]}"; do [[ "$kv" != "${gsvc}=1" ]] && tmp+=("$kv"); done
                        selected_map=("${tmp[@]}")
                    else
                        selected_map+=("${gsvc}=1")
                    fi
                done ;;
            *)
                local tok
                for tok in $input; do
                    if [[ $tok =~ ^[0-9]+$ ]]; then
                        local idx0=$((tok-1))
                        if [[ $idx0 -ge 0 && $idx0 -lt ${#listed[@]} ]]; then
                            local name="${listed[$idx0]}"
                            if printf '%s\n' "${selected_map[@]}" | grep -q "^${name}=1$"; then
                                local tmp=() kv
                                for kv in "${selected_map[@]}"; do [[ "$kv" != "${name}=1" ]] && tmp+=("$kv"); done
                                selected_map=("${tmp[@]}")
                            else
                                selected_map+=("${name}=1")
                            fi
                        fi
                    fi
                done ;;
        esac
    done
    local chosen=()
    for s in $base_order; do
        if printf '%s\n' "${selected_map[@]}" | grep -q "^${s}=1$"; then chosen+=("$s"); fi
    done
    if [[ ${#chosen[@]} -eq 0 ]]; then
        log WARN "No services selected"
        return 0
    fi
    log INFO "Starting selected: ${chosen[*]}"
    start_services custom "${chosen[@]}"
    print_endpoints
}

stop_core(){
    discover_services
    local essentials=(fks_master fks_config fks_auth fks_nodes fks_execution fks_data fks_engine fks_worker fks_api)
    local to_stop=() s
    for s in "${essentials[@]}"; do service_exists "$s" && to_stop+=("$s"); done
    if [[ ${#to_stop[@]} -eq 0 ]]; then
        log WARN "No core services to stop"
        return 0
    fi
    log INFO "Stopping core services: ${to_stop[*]}"
    local svc dir
    for ((i=${#to_stop[@]}-1;i>=0;i--)); do
        svc="${to_stop[$i]}"; dir="${SERVICE_PATHS[$svc]:-}"; [[ -f "$dir/docker-compose.yml" ]] || continue
        log INFO "Down $svc"
        ( cd "$dir" && $(compose_bin) down >/dev/null 2>&1 || true )
    done
    log OK "Core services stopped"
}

# -------------- Status / Endpoints (restored) --------------
status_services(){
    log INFO "Service container status"
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'fks_' || echo 'No FKS containers'
}

print_endpoints(){
    log INFO "Common endpoints"
    echo "Master: http://localhost:3030"
    echo "API:    http://localhost:8000"
    echo "Auth:   http://localhost:4100"
    echo "Config: http://localhost:8002"
    echo "Data:   http://localhost:4200"
    echo "Engine: http://localhost:4300"
    echo "Worker: http://localhost:4600"
    echo "Web:    http://localhost:8080"
    echo "NGINX:  http://localhost:80/"
    echo "Docs:   http://localhost:8040 (list: /docs/list, search: /docs/search?q=term)"
}

# -------------- Monitor (Rust) --------------
monitor_run(){ local HOST="${HOST:-0.0.0.0}" PORT="${PORT:-3030}" CFG="${CONFIG_FILE:-config/monitor.toml}" RLOG="${RUST_LOG:-info}"; log INFO "Monitor start host=$HOST port=$PORT config=$CFG";
    command -v cargo >/dev/null 2>&1 || { log ERR "cargo not installed"; exit 1; };
    [[ -f "$CFG" ]] || log WARN "Config not found: $CFG (using defaults)";
    if [[ ! -f target/release/fks_master ]]; then log INFO "Building master (release)"; cargo build --release >/dev/null; fi
    export RUST_LOG="$RLOG"; log OK "Launching master"; exec ./target/release/fks_master --host "$HOST" --port "$PORT" --config "$CFG"; }

# -------------- Usage --------------
usage(){ cat <<'EOF'
Usage: ./start.sh <subcommand> [options]

Subcommands:
    monitor                 Run Rust monitor (uses env HOST, PORT, CONFIG_FILE)
    services start [set]    Start services: set = all|core|list|custom <svc...>|<svc...>
    services stop           Stop all discovered services
    services stop core      Stop only core services
    services down [--force --volumes]
                                                     Stop & remove containers (and optionally volumes)
    services restart [set]  Restart selected set
    services status         Show running containers
    services list           List discoverable services
    interactive             Interactive selection menu
    order                   Show resolved startup order (after discovery & GPU filtering)
    all                     Alias for 'services start all'
    help                    Show this help

Flags:
        --dry-run               Skip docker compose execution
        --force                 (services down) force removal of containers
        --volumes               (services down) also remove volumes (DANGEROUS)
    --gpu                   Include GPU services with default 'all'
    --interactive           Force interactive selection menu
    --no-prebuild           Disable pre-build step (images built during up)
    --prebuild              Force enable pre-build (default already on)
    --build-parallel        Parallel image builds (export FKS_BUILD_PARALLEL=1 also works)
    --push                  Push images after successful build (uses FKS_DOCKER_USER/FKS_DOCKER_REPO)
    --push-parallel         Parallelize image pushes (or FKS_PUSH_PARALLEL=1)

Environment:
    FKS_EXCLUDE_SERVICES=svc1,svc2   Exclude services
    FKS_SERVICES_ROOT=/path          Override service root (default parent of this script)
    FKS_DEBUG=1                      Verbose debug logging
    FKS_PARALLEL=1                   Start services in parallel
    FKS_SUPPRESS_HEALTH_WARN=1       Suppress missing health endpoint warnings
    USE_SHARED=1                     Include docker-compose.shared.yml overlays
    HEALTH_CHECK_TIMEOUT=60          Seconds overall per service
    HEALTH_CHECK_INTERVAL=5          Poll interval seconds
    DRY_RUN=1                        Global dry-run
    FKS_GPU_SERVICES="svcA svcB"     Override GPU service list (default: fks_transformer fks_training)
    FKS_SKIP_NETWORK_CREATE=1        Don't attempt to create fks_net (assume managed externally)
    (Internal) ORDER_SEQUENCE         Startup order hard-coded in script; modify in start.sh if dependencies change
    FKS_PREBUILD=0/1                 Toggle pre-build globally (default 1)
    FKS_BUILD_PARALLEL=1            Parallel docker compose build phase
    FKS_PUSH=1                      Enable push phase
    FKS_DOCKER_USER=username         Docker Hub username / org (default 'nuniesmith')
    FKS_DOCKER_REPO=basename         Base repo prefix (default 'fks')
    FKS_DOCKER_REGISTRY=registry    Override registry (default docker.io)
    FKS_IMAGE_TAG=tag               Tag for pushed images (default 'latest')
    FKS_PUSH_PARALLEL=1             Parallel pushes
    FKS_SINGLE_REPO=1               Consolidate all images into single repo (<user>/<repo>:<service>-<tag>)
    FKS_PORT_REMAPPINGS="svc:port,..."   Manual host port remaps (e.g. fks_analyze:4802,fks_config:4800)
    FKS_AUTO_REMAP=1               Auto choose next free port if conflict (creates temporary override)

Examples:
    ./start.sh services start core
    FKS_PARALLEL=1 ./start.sh services start core
    ./start.sh services start fks_api fks_web
    ./start.sh services start custom fks_api fks_engine
    USE_SHARED=1 ./start.sh services start fks_api
    ./start.sh monitor
    ./start.sh --gpu            # start all including GPU services
    ./start.sh interactive      # interactive menu
    ./start.sh fks_api          # single service quick start
    ./start.sh --no-prebuild    # skip pre-building images
    FKS_BUILD_PARALLEL=1 ./start.sh  # parallel build then start
    ./start.sh order            # display current startup order
    # Push with defaults (nuniesmith/fks-<service>:latest)
    FKS_PUSH=1 ./start.sh --push
    # Custom tag
    FKS_PUSH=1 FKS_IMAGE_TAG=$(date +%Y%m%d%H%M) ./start.sh --push
    # Override user/repo
    FKS_PUSH=1 FKS_DOCKER_USER=alt FKS_DOCKER_REPO=fks ./start.sh --push
EOF
}

# -------------- Main dispatch --------------
main(){
    local args=() sub=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) DRY_RUN=1; shift;;
            --force) FORCE_REMOVE=1; shift;;
            --volumes) REMOVE_VOLUMES=1; shift;;
            --gpu|--GPU) INCLUDE_GPU=1; shift;;
            --interactive|-i) INTERACTIVE=1; shift;;
            --no-prebuild) PREBUILD=0; shift;;
            --prebuild) PREBUILD=1; shift;;
            --build-parallel) BUILD_PARALLEL=1; shift;;
            --push) PUSH_ENABLED=1; shift;;
            --push-parallel) PUSH_PARALLEL=1; shift;;
            -h|--help|help) usage; return 0;;
            *) args+=("$1"); shift;;
        esac
    done
    sub="${args[0]:-all}"
    if [[ $INTERACTIVE -eq 1 && "$sub" != "monitor" ]]; then
        interactive_menu
        return 0
    fi
    case "$sub" in
        monitor)
            monitor_run
            ;;
        interactive)
            interactive_menu
            ;;
        order)
            discover_services
            local order_list; order_list=$(build_order_all)
            local arr=()
            if [[ -n "$order_list" ]]; then
                local OLD_IFS="$IFS"; IFS=' '; arr=($order_list); IFS="$OLD_IFS"
            fi
            if [[ $INCLUDE_GPU -eq 0 ]]; then
                local filtered=() s
                for s in "${arr[@]}"; do is_gpu_service "$s" && continue; filtered+=("$s"); done
                arr=("${filtered[@]}")
            fi
            log INFO "Startup order (gpu_included=$INCLUDE_GPU): ${arr[*]}"
            ;;
        all)
            start_services all; print_endpoints
            ;;
        services)
            local action="${args[1]:-start}"
            case "$action" in
                start)
                    start_services "${args[@]:2}"; print_endpoints
                    ;;
                stop)
                    if [[ "${args[2]:-}" == core ]]; then stop_core; else stop_all; fi
                    ;;
                down)
                    stop_all
                    if [[ $FORCE_REMOVE -eq 1 ]]; then
                        log INFO "Removing containers (force)"; docker ps -a --format '{{.Names}}' | grep -E '^fks_' | xargs -r docker rm -f || true
                    fi
                    if [[ $REMOVE_VOLUMES -eq 1 ]]; then
                        log WARN "Removing volumes (fks_*)"; docker volume ls -q | grep -E '^fks_' | xargs -r docker volume rm || true
                    fi
                    log OK "Down complete"
                    ;;
                restart)
                    stop_all; sleep 2; start_services "${args[@]:2}"; print_endpoints
                    ;;
                status)
                    status_services
                    ;;
                list)
                    discover_services; echo "${SERVICES_FOUND[*]}"
                    ;;
                *)
                    usage; exit 1
                    ;;
            esac
            ;;
        start)
            local remainder=( "${args[@]:1}" ); start_services "${remainder[@]:-all}"; print_endpoints
            ;;
        stop)
            stop_all
            ;;
        restart)
            local remainder=( "${args[@]:1}" ); stop_all; sleep 2; start_services "${remainder[@]:-all}"; print_endpoints
            ;;
        status)
            status_services
            ;;
        list)
            discover_services; echo "${SERVICES_FOUND[*]}"
            ;;
        *)
            start_services "$sub" "${args[@]:1}"; print_endpoints
            ;;
    esac
}

main "$@"
