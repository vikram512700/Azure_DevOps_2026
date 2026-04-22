# 10 — Real-World Linux DevOps Scenarios

## 1. Production Incident: Server Out of Disk Space

```bash
# Alert fires: "Disk 98% full on prod-app-01"
# Step 1: Identify the full partition
df -h
# /dev/xvda1  50G  49G  100M  98% /

# Step 2: Find what's eating space
du -sh /var/log/* | sort -h | tail -10
du -sh /opt/* | sort -h | tail -5
du -sh /home/* | sort -h | tail -5
du -sh /tmp/* 2>/dev/null | sort -h | tail -5

# Step 3: Find and handle large files
find /var/log -name "*.log" -size +500M -type f
# /var/log/payment-service/app.log  2.1G

# Quick relief: truncate (not delete — process still has it open)
> /var/log/payment-service/app.log
# OR
truncate -s 0 /var/log/payment-service/app.log

# Step 4: Clean Docker artifacts (common culprit)
docker system df
docker system prune -a                # remove unused images, stopped containers
docker volume prune                   # remove unused volumes

# Step 5: Clear journal
sudo journalctl --vacuum-size=500M

# Step 6: Compress old logs
find /var/log -name "*.log" -mtime +3 -not -name "*.gz" | xargs gzip

# Step 7: Fix root cause — configure logrotate
cat > /etc/logrotate.d/payment-service << 'EOF'
/var/log/payment-service/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        kill -HUP $(cat /var/run/payment-service.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
EOF
sudo logrotate -f /etc/logrotate.d/payment-service    # force run to test
```

---

## 2. Production Incident: Server High CPU / Hung Process

```bash
# Alert: CPU at 100% on prod-api-02
# Step 1: Quick identification
uptime                                 # load average
top -b -n 1 -o %CPU | head -15        # top CPU consumers

# Step 2: Identify the process
ps aux --sort=-%cpu | head -10
# java  12345  99.9  15.0  ...  payment-service

# Step 3: Check what the process is doing
strace -p 12345 -e trace=all -c sleep 10    # what syscalls?
lsof -p 12345 | head -20                     # what files?
cat /proc/12345/status                        # kernel view
cat /proc/12345/wchan                         # what kernel fn is it waiting on

# Step 4: JVM thread dump (Java-specific)
kill -3 12345              # print thread dump to stdout/log
kill -QUIT 12345           # same

# Step 5: Check for zombie processes
ps aux | grep 'Z'
# If zombie: kill parent process

# Step 6: Graceful restart if app is stuck
sudo systemctl restart payment-service
# Verify it came back
systemctl is-active payment-service
curl -sf http://localhost:3000/health && echo "OK"

# Step 7: Check for runaway cron job
crontab -l
sudo crontab -l
cat /etc/cron.d/*
journalctl -u cron --since "1 hour ago"
```

---

## 3. Production Incident: Out of Memory / OOM Kill

```bash
# App keeps getting killed, or system unresponsive
# Step 1: Check OOM events
dmesg -T | grep -i "oom\|killed process"
grep -i "out of memory" /var/log/syslog | tail -20

# Example OOM output:
# [Apr 22 14:23:11] Out of memory: Kill process 12345 (java) score 850
# [Apr 22 14:23:11] Killed process 12345 (java) total-vm:4096MB, anon-rss:3800MB

# Step 2: Check current memory state
free -h
vmstat 1 5
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|Cached|SwapTotal|SwapFree"

# Step 3: Find what's consuming memory
ps aux --sort=-%mem | head -10
smem -t -k | sort -k4 -rn | head -10      # USS (actual unique mem)

# Step 4: Add swap as temporary relief
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h

# Step 5: Tune OOM behavior
# OOM score adjustment — negative = less likely to be killed
echo -1000 | sudo tee /proc/$(pgrep payment-service)/oom_score_adj
# -1000 = never kill, 1000 = kill first

# Step 6: Set memory limits for service
sudo systemctl edit payment-service
```
```ini
[Service]
MemoryMax=2G
MemoryHigh=1.8G
```
```bash
sudo systemctl daemon-reload && sudo systemctl restart payment-service
```

---

## 4. Production Incident: Can't SSH Into Server

```bash
# Can't SSH in — what to try (from a different working server)
# If you have console access (AWS EC2 console, VMware console):

# From console — check if sshd is running
systemctl status sshd
systemctl start sshd

# Check if firewall is blocking
sudo ufw status
sudo iptables -L INPUT -n | grep 22

# Check if SSH port changed
ss -tlnp | grep ssh
grep "^Port" /etc/ssh/sshd_config

# Check disk space (sshd can't write to /tmp)
df -h

# Check auth.log for recent failures
tail -50 /var/log/auth.log

# Check if IP is banned
sudo fail2ban-client status sshd | grep "Banned IP"
sudo fail2ban-client set sshd unbanip YOUR_IP

# From AWS: System Manager Session Manager (if SSM agent installed)
aws ssm start-session --target i-0123456789abcdef

# Restore sshd_config from backup if you accidentally broke it
cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
systemctl restart sshd
```

---

## 5. Zero-Downtime Application Deployment

```bash
#!/bin/bash
# Blue-Green deployment on a single server using symlinks + nginx reload
set -euo pipefail

APP="payment-service"
BASE="/opt/$APP"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NEW_RELEASE="$BASE/releases/$TIMESTAMP"
CURRENT="$BASE/current"
NGINX_CONF="/etc/nginx/conf.d/$APP.conf"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# 1. Deploy new version to new release dir
log "Creating release: $NEW_RELEASE"
mkdir -p "$NEW_RELEASE"
rsync -a --delete /tmp/build/$APP/ "$NEW_RELEASE/"

# 2. Link shared resources
ln -sfn "$BASE/shared/.env" "$NEW_RELEASE/.env"

# 3. Install deps and run migrations in NEW release
(cd "$NEW_RELEASE" && npm ci --only=production)
(cd "$NEW_RELEASE" && NODE_PATH="$NEW_RELEASE" node db/migrate.js)
log "Dependencies and migrations complete"

# 4. Start new process on different port
OLD_PORT=3000
NEW_PORT=3001
APP_PID_FILE="/var/run/$APP-new.pid"

NODE_ENV=production PORT=$NEW_PORT \
  nohup node "$NEW_RELEASE/src/index.js" \
  > "$NEW_RELEASE/logs/app.log" 2>&1 &
echo $! > "$APP_PID_FILE"
log "New instance started on port $NEW_PORT (PID: $!)"

# 5. Wait for new instance to be healthy
for i in {1..30}; do
  sleep 2
  if curl -sf "http://localhost:$NEW_PORT/health" &>/dev/null; then
    log "Health check passed on new instance"
    break
  fi
  [[ $i -eq 30 ]] && { log "ERROR: New instance failed health check"; exit 1; }
done

# 6. Switch nginx upstream to new port (zero-downtime)
sed -i "s/proxy_pass http:\/\/localhost:$OLD_PORT/proxy_pass http:\/\/localhost:$NEW_PORT/" "$NGINX_CONF"
sudo nginx -t && sudo nginx -s reload
log "Nginx switched to new instance on port $NEW_PORT"

# 7. Gracefully shutdown old instance
OLD_PID=$(pgrep -f "node.*$OLD_PORT" || true)
if [[ -n "$OLD_PID" ]]; then
  kill -SIGTERM "$OLD_PID"
  sleep 10    # wait for in-flight requests
  kill -9 "$OLD_PID" 2>/dev/null || true
fi

# 8. Switch current symlink
ln -sfn "$NEW_RELEASE" "$CURRENT"
log "Current symlink updated → $NEW_RELEASE"

# 9. Cleanup old releases
ls -t "$BASE/releases" | tail -n +6 | xargs -I{} rm -rf "$BASE/releases/{}"
log "Deployment complete!"
```

---

## 6. Server Capacity Monitoring Script

```bash
#!/bin/bash
# capacity-monitor.sh — send alert if thresholds exceeded
set -euo pipefail

ALERT_EMAIL="devops@company.com"
HOSTNAME=$(hostname -f)
ALERTS=()

# CPU load check
CPU_CORES=$(nproc)
LOAD=$(awk '{print $1}' /proc/loadavg)
LOAD_PER_CPU=$(echo "scale=2; $LOAD / $CPU_CORES" | bc)
if (( $(echo "$LOAD_PER_CPU > 0.8" | bc -l) )); then
  ALERTS+=("HIGH CPU LOAD: load=$LOAD, cores=$CPU_CORES, ratio=$LOAD_PER_CPU")
fi

# Memory check
MEM_TOTAL=$(free -m | awk '/^Mem:/ {print $2}')
MEM_AVAIL=$(free -m | awk '/^Mem:/ {print $7}')
MEM_PCT=$(echo "scale=0; ($MEM_TOTAL - $MEM_AVAIL) * 100 / $MEM_TOTAL" | bc)
if [[ $MEM_PCT -gt 85 ]]; then
  ALERTS+=("HIGH MEMORY: ${MEM_PCT}% used (${MEM_AVAIL}MB available)")
fi

# Disk check
while IFS= read -r line; do
  PCT=$(echo "$line" | awk '{print $5}' | tr -d '%')
  MOUNT=$(echo "$line" | awk '{print $6}')
  if [[ $PCT -gt 85 ]]; then
    ALERTS+=("HIGH DISK: ${PCT}% full on $MOUNT")
  fi
done < <(df -h | grep -v "tmpfs\|Filesystem\|udev")

# Swap check
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
if [[ $SWAP_TOTAL -gt 0 ]]; then
  SWAP_USED=$(free -m | awk '/^Swap:/ {print $3}')
  SWAP_PCT=$(echo "scale=0; $SWAP_USED * 100 / $SWAP_TOTAL" | bc)
  if [[ $SWAP_PCT -gt 50 ]]; then
    ALERTS+=("HIGH SWAP USAGE: ${SWAP_PCT}%")
  fi
fi

# Send alerts
if [[ ${#ALERTS[@]} -gt 0 ]]; then
  BODY="Capacity alerts on $HOSTNAME at $(date):\n\n"
  for alert in "${ALERTS[@]}"; do
    BODY+="  ⚠  $alert\n"
  done
  echo -e "$BODY" | mail -s "ALERT: Capacity Warning on $HOSTNAME" "$ALERT_EMAIL"
  echo "Alerts sent: ${#ALERTS[@]}"
  exit 1
fi

echo "All capacity checks OK"
```

---

## 7. Log Aggregation Pipeline

```bash
# rsyslog — centralized log collection
# On log server (/etc/rsyslog.conf)
# Receive logs over UDP/TCP
sudo vim /etc/rsyslog.conf
# Add:
# module(load="imudp")
# input(type="imudp" port="514")
# module(load="imtcp")
# input(type="imtcp" port="514")
# Store by host
# $template RemoteLogs,"/var/log/remote/%HOSTNAME%/%PROGRAMNAME%.log"
# *.* ?RemoteLogs

# On app servers — forward to log server
echo "*.* @log-server.company.com:514" | sudo tee /etc/rsyslog.d/forward.conf
sudo systemctl restart rsyslog

# Filebeat — ship logs to Elasticsearch (ELK stack)
# /etc/filebeat/filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/payment-service/*.log
    fields:
      service: payment-service
      env: production

output.elasticsearch:
  hosts: ["https://elk.company.com:9200"]
  username: "filebeat"
  password: "${ELASTIC_PASSWORD}"
  ssl.certificate_authorities: ["/etc/pki/ca.crt"]

# Real-time: tail multiple log files across servers
# Using tmux or pssh
for server in web01 web02 web03; do
  ssh "$server" "tail -f /var/log/payment-service/app.log" | \
    sed "s/^/[$server] /" &
done
wait
```

---

## 8. Kernel Tuning for High-Performance Servers

```bash
# /etc/sysctl.conf — kernel parameter tuning
sudo vim /etc/sysctl.conf
```

```
# Network performance
net.core.somaxconn = 65535                # max listen queue
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_fin_timeout = 15            # reduce TIME_WAIT time
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.ip_local_port_range = 10000 65535   # ephemeral port range
net.ipv4.tcp_tw_reuse = 1                # reuse TIME_WAIT sockets

# File descriptors
fs.file-max = 2097152
fs.nr_open = 2097152

# Virtual memory
vm.swappiness = 10                       # minimize swapping
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.overcommit_memory = 1                 # allow memory overcommit

# For Redis / Elasticsearch
vm.max_map_count = 262144
```

```bash
# Apply without reboot
sudo sysctl -p
sudo sysctl --system

# Set per-process file descriptor limit
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
```

---

## 9. Ansible-Style Ad-Hoc Command Patterns

```bash
# Run command on multiple servers in parallel (without Ansible)
SERVERS="web01 web02 web03 app01 app02"

# Using xargs for parallel execution
echo $SERVERS | tr ' ' '\n' | \
  xargs -P5 -I{} ssh {} "systemctl status nginx | head -3"

# With output label
for srv in $SERVERS; do
  echo "[$srv]:"
  ssh "$srv" "df -h / | tail -1" &
done
wait

# Parallel SSH deployment
deploy_to() {
  local server=$1
  echo "Deploying to $server..."
  ssh "$server" "
    cd /opt/payment-service &&
    git pull --rebase origin main &&
    npm ci --only=production &&
    sudo systemctl restart payment-service
  " && echo "$server: SUCCESS" || echo "$server: FAILED"
}

export -f deploy_to
echo $SERVERS | tr ' ' '\n' | xargs -P3 -I{} bash -c 'deploy_to "$@"' _ {}
```

---

## 10. Linux Commands Cheat Sheet for Interviews

```bash
# ─── Disk Full ────────────────────────────────────────────────
df -h; du -sh /var/log/* | sort -h; find / -size +100M 2>/dev/null

# ─── High CPU ─────────────────────────────────────────────────
uptime; top -b -n1 -o %CPU | head -10; ps aux --sort=-%cpu | head -5

# ─── High Memory ──────────────────────────────────────────────
free -h; ps aux --sort=-%mem | head -5; dmesg | grep -i oom

# ─── Network Issue ────────────────────────────────────────────
ip addr; ip route; ss -tlnp; ping gateway; dig +short google.com

# ─── Port Not Listening ───────────────────────────────────────
ss -tlnp | grep PORT; systemctl status SERVICE; journalctl -u SERVICE -n 50

# ─── Process Won't Start ──────────────────────────────────────
systemctl status SERVICE; journalctl -u SERVICE -n 100; /path/to/binary --debug

# ─── File Permission Issues ───────────────────────────────────
ls -la FILE; stat FILE; id RUNUSER; getfacl FILE

# ─── Cron Not Running ─────────────────────────────────────────
crontab -l; systemctl status cron; grep CRON /var/log/syslog | tail -20

# ─── SSH Connection Refused ───────────────────────────────────
systemctl status sshd; ss -tlnp | grep 22; fail2ban-client status sshd

# ─── Certificate Expiry Check ─────────────────────────────────
echo | openssl s_client -connect domain.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# ─── Find File by Content ─────────────────────────────────────
grep -rl "search_string" /etc/ 2>/dev/null

# ─── Recent System Changes ────────────────────────────────────
last -n 20; journalctl --since "1 hour ago"; rpm -qa --last | head (RHEL)

# ─── Test Connectivity ────────────────────────────────────────
nc -zv HOST PORT; curl -o /dev/null -sw "%{http_code}" http://HOST
```

---

## Summary: The DevOps Linux Mindset

```
When something breaks in production:

1. DON'T PANIC — gather information first
2. Check  → df -h, free -h, uptime, systemctl status
3. Logs   → journalctl -u SERVICE -n 100, dmesg -T | tail
4. Network → ss -tlnp, ping, nc -zv HOST PORT
5. Process → ps aux, top, pgrep, lsof
6. Trace  → strace, ltrace, tcpdump (last resort)
7. Fix    → smallest safe change first
8. Verify → confirm the fix works
9. Document → post-mortem, add monitoring
10. Prevent → logrotate, alerts, automation
```
