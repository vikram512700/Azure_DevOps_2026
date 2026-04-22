# 07 — Shell Scripting for DevOps

## 1. Script Anatomy & Best Practices

```bash
#!/bin/bash
# ^^^ shebang — always first line, specifies the interpreter

# ─── Script header ───────────────────────────────────────────
set -euo pipefail
# -e  = exit on any error
# -u  = treat unset variables as errors
# -o pipefail = catch failures in pipelines (cmd1 | cmd2 — catch cmd1 fail)

IFS=$'\n\t'
# Safer field separator (avoids word splitting on spaces)

# ─── Constants ───────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="/var/log/myapp/deploy.log"

# ─── Logging ─────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*" | tee -a "$LOG_FILE"; }
warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*" | tee -a "$LOG_FILE" >&2; }
error(){ echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" | tee -a "$LOG_FILE" >&2; exit 1; }
```

______________________________________________________________________

## 2. Variables

```bash
# Basic variables (no spaces around =)
NAME="Vikram"
VERSION=2
PI=3.14

# Use variables (always quote to prevent word splitting)
echo "Hello, $NAME"
echo "Version: ${VERSION}"

# Default values
LOG_LEVEL="${LOG_LEVEL:-INFO}"             # use INFO if LOG_LEVEL unset
OUTPUT_DIR="${1:-/tmp/output}"            # use $1 or /tmp/output
: "${REQUIRED_VAR:?ERROR: REQUIRED_VAR must be set}"  # fail if not set

# Readonly / constants
readonly MAX_RETRIES=3
readonly DB_HOST="prod-db.company.com"

# Environment variables
export APP_ENV="production"               # available to child processes
printenv                                  # list all env vars
printenv APP_ENV
env | grep APP_

# Command substitution
CURRENT_DATE=$(date +%Y-%m-%d)
GIT_SHA=$(git rev-parse --short HEAD)
HOSTNAME=$(hostname -f)
FREE_MEM=$(free -m | awk '/^Mem:/ {print $4}')

# Arithmetic
COUNT=10
TOTAL=$((COUNT * 2 + 5))
let TOTAL=COUNT*2+5       # alternative
echo $((2 ** 10))         # 1024 (power)

# String operations
STR="payment-service-v2.4.1"
echo ${#STR}              # length: 24
echo ${STR^^}             # UPPERCASE
echo ${STR,,}             # lowercase
echo ${STR#payment-}      # remove prefix:  service-v2.4.1
echo ${STR##*-}           # remove longest prefix: v2.4.1
echo ${STR%-*}            # remove suffix: payment-service-v2.4
echo ${STR%%-*}           # remove longest suffix: payment
echo ${STR/service/svc}   # replace first: payment-svc-v2.4.1
echo ${STR//v/V}          # replace all: payment-serVice-V2.4.1
echo ${STR:8:7}           # substring from pos 8, len 7: service
```

______________________________________________________________________

## 3. Arrays

```bash
# Indexed array
SERVERS=("web01" "web02" "web03" "db01")
echo ${SERVERS[0]}          # web01
echo ${SERVERS[@]}          # all elements
echo ${#SERVERS[@]}         # length: 4
echo ${!SERVERS[@]}         # indices: 0 1 2 3

# Append
SERVERS+=("lb01")

# Iterate
for server in "${SERVERS[@]}"; do
  echo "Processing: $server"
done

# Associative array (dictionary — bash 4+)
declare -A CONFIG
CONFIG[host]="prod-db.company.com"
CONFIG[port]="5432"
CONFIG[name]="payments"

echo ${CONFIG[host]}
for key in "${!CONFIG[@]}"; do
  echo "$key = ${CONFIG[$key]}"
done

# Read file into array
mapfile -t LINES < /etc/hosts
for line in "${LINES[@]}"; do echo "$line"; done
```

______________________________________________________________________

## 4. Conditionals

```bash
# if / elif / else
if [[ $VAR -gt 10 ]]; then
  echo "Greater than 10"
elif [[ $VAR -eq 10 ]]; then
  echo "Equal to 10"
else
  echo "Less than 10"
fi

# Comparison operators
# Numeric:  -eq, -ne, -lt, -le, -gt, -ge
# String:   ==, !=, <, >, -z (empty), -n (not empty)
# File:     -e (exists), -f (file), -d (dir), -r/-w/-x (permissions)

# String comparisons
[[ "$STATUS" == "running" ]]
[[ "$ENV" != "production" ]]
[[ -z "$VAR" ]]              # empty
[[ -n "$VAR" ]]              # not empty

# File checks
[[ -f /etc/nginx/nginx.conf ]]    # is a file
[[ -d /opt/app ]]                 # is a directory
[[ -r /etc/secret.conf ]]         # readable
[[ -x /opt/app/start.sh ]]        # executable
[[ -s /var/log/app.log ]]         # non-empty file
[[ -L /usr/local/bin/app ]]       # is a symlink
[[ /file1 -nt /file2 ]]           # newer than
[[ /file1 -ot /file2 ]]           # older than

# Logical operators
[[ $A -gt 0 && $B -gt 0 ]]       # AND
[[ $A -gt 0 || $B -gt 0 ]]       # OR
[[ ! -f /etc/file ]]              # NOT

# case statement
case "$ENV" in
  production)
    DB_HOST="prod-db.company.com"
    ;;
  staging)
    DB_HOST="staging-db.company.com"
    ;;
  development|dev)
    DB_HOST="localhost"
    ;;
  *)
    echo "Unknown environment: $ENV"
    exit 1
    ;;
esac
```

______________________________________________________________________

## 5. Loops

```bash
# for loop
for i in 1 2 3 4 5; do
  echo "Iteration: $i"
done

# Range (bash 4+)
for i in {1..10}; do echo $i; done
for i in {0..20..2}; do echo $i; done    # step by 2

# C-style for
for ((i=0; i<10; i++)); do
  echo $i
done

# Loop over array
for server in "${SERVERS[@]}"; do
  echo "Checking $server..."
  ssh "$server" "systemctl status nginx"
done

# Loop over files
for file in /var/log/*.log; do
  echo "Processing: $file"
  gzip "$file"
done

# Loop over command output
while IFS= read -r line; do
  echo "Line: $line"
done < /etc/hosts

# while loop
COUNT=0
while [[ $COUNT -lt 5 ]]; do
  echo "Count: $COUNT"
  ((COUNT++))
done

# until loop
until [[ -f /tmp/done.flag ]]; do
  echo "Waiting for job..."
  sleep 5
done

# Loop with break / continue
for i in {1..10}; do
  [[ $i -eq 5 ]] && continue   # skip 5
  [[ $i -eq 8 ]] && break      # stop at 8
  echo $i
done
```

______________________________________________________________________

## 6. Functions

```bash
# Basic function
greet() {
  local name="$1"           # local scope — doesn't leak
  local greeting="${2:-Hello}"
  echo "$greeting, $name!"
}

greet "Vikram"              # Hello, Vikram!
greet "Vikram" "Welcome"   # Welcome, Vikram!

# Return status codes (not values — use echo + $())
is_port_open() {
  local host="$1" port="$2"
  nc -z -w3 "$host" "$port" &>/dev/null
  return $?      # 0 = open, non-zero = closed
}

if is_port_open "db.company.com" 5432; then
  echo "Database port is reachable"
else
  echo "Cannot reach database!"
fi

# Function returning a value
get_version() {
  cat /opt/app/VERSION 2>/dev/null || echo "unknown"
}
VERSION=$(get_version)

# Utility functions for DevOps scripts
log_info()  { echo -e "\e[32m[INFO]\e[0m  $*"; }
log_warn()  { echo -e "\e[33m[WARN]\e[0m  $*" >&2; }
log_error() { echo -e "\e[31m[ERROR]\e[0m $*" >&2; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || log_error "This script must be run as root"
}

require_command() {
  command -v "$1" &>/dev/null || log_error "Required command not found: $1"
}

wait_for_service() {
  local host="$1" port="$2" timeout="${3:-30}"
  local elapsed=0
  until nc -z "$host" "$port" &>/dev/null || [[ $elapsed -ge $timeout ]]; do
    sleep 2
    ((elapsed+=2))
  done
  nc -z "$host" "$port" &>/dev/null || return 1
}
```

______________________________________________________________________

## 7. Input / Output & Redirection

```bash
# Redirection
command > output.txt          # stdout to file (overwrite)
command >> output.txt         # stdout to file (append)
command 2> error.txt          # stderr to file
command 2>&1                  # redirect stderr to stdout
command > output.txt 2>&1     # both to file
command &> output.txt         # shorthand for above (bash 4+)
command > /dev/null 2>&1      # discard all output

# Input
command < input.txt
command << 'EOF'              # here document
  multi
  line
  input
EOF
command <<< "single line"     # here string

# Pipes
cmd1 | cmd2                   # stdout of cmd1 → stdin of cmd2
cmd1 |& cmd2                  # stdout+stderr of cmd1 → stdin of cmd2
cmd1 | tee file.txt | cmd2    # write to file AND pipe to next command

# Process substitution
diff <(sort file1.txt) <(sort file2.txt)
diff <(ssh server1 "cat /etc/hosts") <(ssh server2 "cat /etc/hosts")

# Read user input
read -p "Enter server name: " SERVER
read -sp "Enter password: " PASS; echo     # silent input for passwords
read -r -t 30 -p "Proceed? [y/N] " CONFIRM || CONFIRM="N"    # with timeout

# Script arguments
echo "Script name: $0"
echo "First arg:   $1"
echo "All args:    $@"
echo "Arg count:   $#"
shift                          # shift args left ($2 becomes $1, etc.)

# Argument parsing with getopts
while getopts "e:v:h" opt; do
  case "$opt" in
    e) ENV="$OPTARG" ;;
    v) VERSION="$OPTARG" ;;
    h) echo "Usage: $0 -e <env> -v <version>"; exit 0 ;;
    *) echo "Invalid option"; exit 1 ;;
  esac
done
```

______________________________________________________________________

## 8. Error Handling

```bash
#!/bin/bash
set -euo pipefail

# Trap — run cleanup on exit or error
cleanup() {
  local exit_code=$?
  log "Cleaning up..."
  rm -f /tmp/deploy-lock
  [[ $exit_code -ne 0 ]] && log_error "Script failed with exit code $exit_code"
  exit $exit_code
}
trap cleanup EXIT
trap 'log_error "Error on line $LINENO"' ERR

# Check command success
if ! systemctl start payment-service; then
  log_error "Failed to start payment-service"
fi

# Exit codes
command || { echo "Failed"; exit 1; }
command || exit 1              # shorthand

# Retry logic
retry() {
  local retries="${1:-3}"
  local delay="${2:-5}"
  local cmd="${@:3}"
  local count=0

  until $cmd; do
    ((count++))
    if [[ $count -ge $retries ]]; then
      log_error "Command failed after $retries retries: $cmd"
      return 1
    fi
    log_warn "Attempt $count failed. Retrying in ${delay}s..."
    sleep "$delay"
  done
}

retry 3 5 curl -sf https://api.example.com/health
```

______________________________________________________________________

## 9. Complete Real-Time DevOps Scripts

### Deployment Script

```bash
#!/bin/bash
set -euo pipefail

APP_NAME="payment-service"
APP_DIR="/opt/${APP_NAME}"
RELEASES_DIR="${APP_DIR}/releases"
SHARED_DIR="${APP_DIR}/shared"
CURRENT_LINK="${APP_DIR}/current"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NEW_RELEASE="${RELEASES_DIR}/${TIMESTAMP}"
ROLLBACK_KEEP=5

log()   { echo "[$(date '+%H:%M:%S')] $*"; }
error() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; exit 1; }

log "Starting deployment of $APP_NAME"

# Validate
[[ -d "$RELEASES_DIR" ]] || error "Releases directory not found: $RELEASES_DIR"
command -v node &>/dev/null || error "node not installed"

# Create release directory
mkdir -p "$NEW_RELEASE"
log "Created release: $NEW_RELEASE"

# Deploy code
rsync -a --exclude='.git' --exclude='node_modules' \
  /tmp/build/${APP_NAME}/ "$NEW_RELEASE/"

# Symlink shared resources
ln -sfn "${SHARED_DIR}/.env"  "${NEW_RELEASE}/.env"
ln -sfn "${SHARED_DIR}/logs"  "${NEW_RELEASE}/logs"

# Install dependencies
(cd "$NEW_RELEASE" && npm ci --only=production)
log "Dependencies installed"

# Run migrations
(cd "$NEW_RELEASE" && node db/migrate.js)
log "Database migrations complete"

# Switch current symlink
ln -sfn "$NEW_RELEASE" "$CURRENT_LINK"
log "Switched current → $NEW_RELEASE"

# Restart service
sudo systemctl restart "${APP_NAME}"
sleep 3
systemctl is-active --quiet "${APP_NAME}" || error "Service failed to start"
log "Service restarted successfully"

# Health check
for i in {1..10}; do
  if curl -sf http://localhost:3000/health &>/dev/null; then
    log "Health check passed"
    break
  fi
  [[ $i -eq 10 ]] && error "Health check failed after 10 attempts"
  sleep 3
done

# Cleanup old releases (keep last 5)
cd "$RELEASES_DIR"
ls -t | tail -n +$((ROLLBACK_KEEP + 1)) | xargs -r rm -rf
log "Cleaned up old releases (keeping $ROLLBACK_KEEP)"

log "Deployment complete: $NEW_RELEASE"
```

### Health Check Script

```bash
#!/bin/bash
SERVICES=("nginx" "payment-service" "redis" "postgresql")
ENDPOINTS=("http://localhost/health" "http://localhost:3000/health")
ALERT_EMAIL="devops@company.com"
FAILED=0

check_service() {
  if ! systemctl is-active --quiet "$1"; then
    echo "CRITICAL: Service $1 is DOWN"
    sudo systemctl restart "$1"
    sleep 5
    if systemctl is-active --quiet "$1"; then
      echo "RECOVERED: Service $1 restarted successfully"
    else
      echo "FAILED: Could not restart $1"
      ((FAILED++))
    fi
  fi
}

check_endpoint() {
  if ! curl -sf --max-time 5 "$1" &>/dev/null; then
    echo "CRITICAL: Endpoint unreachable: $1"
    ((FAILED++))
  fi
}

for svc in "${SERVICES[@]}"; do check_service "$svc"; done
for ep  in "${ENDPOINTS[@]}"; do check_endpoint "$ep"; done

if [[ $FAILED -gt 0 ]]; then
  echo "Health check failed: $FAILED issues" | mail -s "ALERT: Health Check Failed on $(hostname)" "$ALERT_EMAIL"
  exit 1
fi

echo "All checks passed."
```

______________________________________________________________________

## Summary Table

| Concept | Example |
|---------|---------|
| Strict mode | `set -euo pipefail` |
| Default value | `${VAR:-default}` |
| Required var | `${VAR:?error message}` |
| String length | `${#STR}` |
| Substring | `${STR:start:len}` |
| Remove prefix | `${STR#prefix}` |
| Trap on exit | `trap cleanup EXIT` |
| Retry function | `until cmd; do sleep N; done` |
| Array iterate | `for x in "${ARR[@]}"` |
| Silent read | `read -sp "Password: " PASS` |
| Discard output | `cmd > /dev/null 2>&1` |
| Check command exists | `command -v cmd &>/dev/null` |
