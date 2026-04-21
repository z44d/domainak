#!/usr/bin/env bash

set -euo pipefail

APP_NAME="Domainak"
INSTALL_DIR="${HOME}/.domainak"
ENV_FILE="${INSTALL_DIR}/.env"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yaml"
NGINX_FILE="${INSTALL_DIR}/nginx.conf"
REPO_OWNER="${DOMAINAK_REPO_OWNER:-z44d}"
REPO_NAME="${DOMAINAK_REPO_NAME:-domainak}"
REPO_REF="${DOMAINAK_REPO_REF:-main}"
RAW_BASE_URL="${DOMAINAK_RAW_BASE_URL:-https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_REF}}"

if [[ -t 0 ]]; then
  INPUT_DEVICE="/dev/stdin"
elif [[ -r /dev/tty ]]; then
  INPUT_DEVICE="/dev/tty"
else
  INPUT_DEVICE="/dev/stdin"
fi

color() {
  local code="$1"
  printf '\033[%sm' "$code"
}

RESET="$(color 0)"
BOLD="$(color 1)"
DIM="$(color 2)"
RED="$(color 31)"
GREEN="$(color 32)"
YELLOW="$(color 33)"
BLUE="$(color 34)"
MAGENTA="$(color 35)"
CYAN="$(color 36)"

print_line() {
  printf '%b\n' "$1"
}

print_header() {
  local title="$1"
  local subtitle="$2"
  printf '\n%b%s%b\n' "$BOLD$CYAN" "$title" "$RESET"
  printf '%b%s%b\n\n' "$DIM" "$subtitle" "$RESET"
}

print_step() {
  printf '%b->%b %s\n' "$BLUE" "$RESET" "$1"
}

print_success() {
  printf '%bOK%b %s\n' "$GREEN" "$RESET" "$1"
}

print_warn() {
  printf '%b!!%b %s\n' "$YELLOW" "$RESET" "$1"
}

print_error() {
  printf '%bXX%b %s\n' "$RED" "$RESET" "$1" >&2
}

trim() {
  local value="$1"
  value="${value#${value%%[![:space:]]*}}"
  value="${value%${value##*[![:space:]]}}"
  printf '%s' "$value"
}

escape_env_value() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//\$/\\\$}"
  value="${value//\`/\\\`}"
  printf '%s' "$value"
}

write_env_line() {
  local key="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    printf '%s=\n' "$key"
    return
  fi

  case "$value" in
    *[[:space:]#]* | *'"'* | *"'"* )
      printf '%s="%s"\n' "$key" "$(escape_env_value "$value")"
      ;;
    *)
      printf '%s=%s\n' "$key" "$value"
      ;;
  esac
}

load_existing_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    return
  fi

  while IFS='=' read -r raw_key raw_value || [[ -n "$raw_key$raw_value" ]]; do
    local key value
    key="$(trim "$raw_key")"
    value="$raw_value"

    [[ -z "$key" ]] && continue
    [[ "${key#\#}" != "$key" ]] && continue

    value="$(trim "$value")"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
      value="${value//\\\"/\"}"
      value="${value//\\\$/\$}"
      value="${value//\\\`/\`}"
      value="${value//\\\\/\\}"
    fi

    case "$key" in
      TUNNEL_TOKEN) TUNNEL_TOKEN_DEFAULT="$value" ;;
      DOMAINS) DOMAINS_DEFAULT="$value" ;;
      POSTGRES_PASSWORD) POSTGRES_PASSWORD_DEFAULT="$value" ;;
      POSTGRES_USER) POSTGRES_USER_DEFAULT="$value" ;;
      POSTGRES_DB) POSTGRES_DB_DEFAULT="$value" ;;
      POSTGRES_URL) POSTGRES_URL_DEFAULT="$value" ;;
      GITHUB_CLIENT_ID) GITHUB_CLIENT_ID_DEFAULT="$value" ;;
      GITHUB_CLIENT_SECRET) GITHUB_CLIENT_SECRET_DEFAULT="$value" ;;
      ADMIN_IDS) ADMIN_IDS_DEFAULT="$value" ;;
      WEBSITE_URL) WEBSITE_URL_DEFAULT="$value" ;;
      JWT_SECRET) JWT_SECRET_DEFAULT="$value" ;;
    esac
  done < "$ENV_FILE"
}

prompt_value() {
  local var_name="$1"
  local label="$2"
  local default_value="$3"
  local required="$4"
  local secret="$5"
  local hint="$6"
  local value prompt suffix

  while true; do
    printf '\n%b%s%b\n' "$BOLD$MAGENTA" "$label" "$RESET"
    if [[ -n "$hint" ]]; then
      printf '%b%s%b\n' "$DIM" "$hint" "$RESET"
    fi

    if [[ -n "$default_value" ]]; then
      if [[ "$secret" == "true" ]]; then
        suffix=" [press Enter to keep current value]"
      else
        suffix=" [default: $default_value]"
      fi
    else
      suffix=""
    fi

    prompt="Enter value${suffix}: "

    if [[ "$secret" == "true" ]]; then
      IFS= read -r -s -p "$prompt" value < "$INPUT_DEVICE"
      printf '\n'
    else
      IFS= read -r -p "$prompt" value < "$INPUT_DEVICE"
    fi

    if [[ -z "$value" ]]; then
      value="$default_value"
    fi

    if [[ "$required" == "true" && -z "$value" ]]; then
      print_warn "This value is required. Please enter something."
      continue
    fi

    printf -v "$var_name" '%s' "$value"
    return
  done
}

require_command() {
  command -v "$1" >/dev/null 2>&1
}

download_file() {
  local url="$1"
  local destination="$2"

  if require_command curl; then
    curl -fsSL "$url" -o "$destination"
  elif require_command wget; then
    wget -qO "$destination" "$url"
  else
    print_error "Please install curl or wget first, then rerun this script."
    exit 1
  fi
}

ensure_docker() {
  if require_command docker && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi

  if require_command docker-compose; then
    COMPOSE_CMD=(docker-compose)
    return
  fi

  print_header "Docker Required" "${APP_NAME} runs through Docker Compose."
  print_line "Install Docker Desktop or Docker Engine from: ${BOLD}https://www.docker.com/${RESET}"
  print_line "After Docker is installed and running, rerun this installer."
  exit 1
}

write_env_file() {
  cat > "$ENV_FILE" <<EOF
# Generated by setup.sh for ${APP_NAME}
$(write_env_line TUNNEL_TOKEN "$TUNNEL_TOKEN")
$(write_env_line DOMAINS "$DOMAINS")
$(write_env_line POSTGRES_PASSWORD "$POSTGRES_PASSWORD")
$(write_env_line POSTGRES_USER "$POSTGRES_USER")
$(write_env_line POSTGRES_DB "$POSTGRES_DB")
$(write_env_line POSTGRES_URL "$POSTGRES_URL")
$(write_env_line GITHUB_CLIENT_ID "$GITHUB_CLIENT_ID")
$(write_env_line GITHUB_CLIENT_SECRET "$GITHUB_CLIENT_SECRET")
$(write_env_line ADMIN_IDS "$ADMIN_IDS")
$(write_env_line WEBSITE_URL "$WEBSITE_URL")
$(write_env_line JWT_SECRET "$JWT_SECRET")
EOF
}

download_stack_files() {
  print_step "Downloading deployment files"
  download_file "${RAW_BASE_URL}/docker-compose.yaml" "$COMPOSE_FILE"
  download_file "${RAW_BASE_URL}/nginx.conf" "$NGINX_FILE"
  print_success "Deployment files downloaded into ${INSTALL_DIR}"
}

start_stack() {
  print_step "Starting ${APP_NAME} with Docker Compose"
  (
    cd "$INSTALL_DIR"
    "${COMPOSE_CMD[@]}" up --build -d
  )
  print_success "${APP_NAME} is starting"
}

main() {
  local mode mode_label subtitle

  if [[ -f "$ENV_FILE" ]]; then
    mode="update"
    mode_label="Update"
    subtitle="Existing installation found in ${INSTALL_DIR}. We will refresh files and let you review your settings."
  else
    mode="install"
    mode_label="Install"
    subtitle="One guided setup for macOS and Linux. We will collect your settings, create ${ENV_FILE}, download the stack files, and launch it."
  fi

  print_header "${APP_NAME} ${mode_label}" "$subtitle"

  ensure_docker
  mkdir -p "$INSTALL_DIR"
  load_existing_env

  print_step "Collecting environment variables"

  prompt_value TUNNEL_TOKEN "Cloudflare Tunnel Token" "${TUNNEL_TOKEN_DEFAULT:-}" true true "Required. Get this from Cloudflare Zero Trust > Networks > Tunnels."
  prompt_value DOMAINS "Allowed Domains" "${DOMAINS_DEFAULT:-}" true false "Required. Space-separated domains, for example: example.com demo.example.com"
  prompt_value POSTGRES_PASSWORD "Postgres Password" "${POSTGRES_PASSWORD_DEFAULT:-}" true true "Required. Used by the bundled PostgreSQL container."
  prompt_value POSTGRES_USER "Postgres User" "${POSTGRES_USER_DEFAULT:-domainak}" false false "Optional. Defaults to domainak if left empty the first time."
  prompt_value POSTGRES_DB "Postgres Database" "${POSTGRES_DB_DEFAULT:-domainak}" false false "Optional. Defaults to domainak if left empty the first time."
  prompt_value POSTGRES_URL "External Postgres URL" "${POSTGRES_URL_DEFAULT:-}" false false "Optional. Leave empty to use the bundled PostgreSQL container."
  prompt_value GITHUB_CLIENT_ID "GitHub OAuth Client ID" "${GITHUB_CLIENT_ID_DEFAULT:-}" true false "Required. Create an OAuth app at https://github.com/settings/applications/new"
  prompt_value GITHUB_CLIENT_SECRET "GitHub OAuth Client Secret" "${GITHUB_CLIENT_SECRET_DEFAULT:-}" true true "Required. Hidden while you type."
  prompt_value ADMIN_IDS "Admin GitHub User IDs" "${ADMIN_IDS_DEFAULT:-}" false false "Optional. Comma-separated GitHub numeric user IDs with admin access."
  prompt_value WEBSITE_URL "Public website URL" "${WEBSITE_URL_DEFAULT:-http://localhost:5173}" true false "Required. Must match your GitHub OAuth callback configuration."
  prompt_value JWT_SECRET "JWT Secret" "${JWT_SECRET_DEFAULT:-}" true true "Required. Use a long random secret. Hidden while you type."

  write_env_file
  print_success "Environment file saved to ${ENV_FILE}"

  download_stack_files
  start_stack

  printf '\n'
  print_success "Done. Your files live in ${INSTALL_DIR}"
  print_line "Use ${BOLD}cd ${INSTALL_DIR} && ${COMPOSE_CMD[*]} logs -f${RESET} to watch the services."
}

main "$@"
