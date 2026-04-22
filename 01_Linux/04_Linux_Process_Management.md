# 04 — Process Management

## 1. Viewing Processes

```bash
# Snapshot of all processes
ps aux
# USER   PID  %CPU  %MEM   VSZ   RSS  TTY  STAT  START   TIME  COMMAND
# root     1   0.0   0.1  ...         ?    Ss    Apr01   0:03  /sbin/init

# ps field meanings:
# PID   = Process ID
# PPID  = Parent Process ID
# %CPU  = CPU usage
# %MEM  = Memory usage (% of RAM)
# VSZ   = Virtual memory size (KB)
# RSS   = Resident Set Size — actual RAM used (KB)
# STAT  = Process state
# S     = Sleeping, R = Running, Z = Zombie, D = Uninterruptible sleep
# T     = Stopped, W = Swapping, < = High priority, N = Low priority
# s     = Session leader, l = Multi-threaded, + = Foreground

# Common ps patterns
ps aux | grep nginx                          # find nginx processes
ps aux | grep -v grep | grep java            # exclude grep itself
ps -ef                                       # full format with PPID
ps -ef | grep "[p]ayment"                    # [] trick avoids self-match
ps -u appuser                               # processes by user
ps -p 1234                                   # specific PID
ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem   # custom output, sorted

# Show process tree
pstree
pstree -p           # with PIDs
pstree -u           # with users
pstree 1234         # tree rooted at PID 1234
```

---

## 2. top and htop

```bash
# top — real-time process monitor
top
top -u appuser     # filter by user
top -p 1234,5678   # watch specific PIDs
top -b -n 1        # batch mode, 1 iteration (good for scripts)
top -b -n 1 | head -20 > /tmp/top-snapshot.txt

# top interactive keys:
# q     quit
# k     kill process (enter PID)
# r     renice (change priority)
# P     sort by CPU
# M     sort by memory
# T     sort by time
# 1     toggle per-CPU display
# H     toggle threads
# u     filter by user
# f     field management
# s     change refresh interval

# htop — enhanced (install: apt install htop)
htop
htop -u appuser
htop -p 1234

# htop keys:
# F5    tree view
# F6    sort by
# F9    kill
# F10   quit
# Space mark process
# U     show user processes
```

### Reading top Header

```
top - 14:32:15 up 10 days, 3:22,  2 users,  load average: 0.52, 0.48, 0.44
Tasks: 223 total,   1 running, 222 sleeping,   0 stopped,   0 zombie
%Cpu(s):  5.2 us,  1.1 sy,  0.0 ni, 93.5 id,  0.1 wa,  0.0 hi,  0.1 si
MiB Mem:  15.5 total,   2.1 free,   8.3 used,   5.1 buff/cache
MiB Swap:  2.0 total,   1.8 free,   0.2 used.   6.5 avail Mem

# Load average: 1-min, 5-min, 15-min averages
# Rule: load avg / CPU cores > 1.0 means system is overloaded
# us=user, sy=system, id=idle, wa=iowait (disk), si=software interrupts

# wa (iowait) > 20% → disk bottleneck
# sy (system) > 20% → kernel overhead
# us (user) > 80%   → application CPU-bound
```

---

## 3. Signals and kill

```bash
# List all signals
kill -l

# Common signals:
# SIGTERM (15) — graceful shutdown (default)
# SIGKILL (9)  — force kill (cannot be caught/ignored)
# SIGHUP  (1)  — reload config (many daemons use this)
# SIGINT  (2)  — interrupt (Ctrl+C)
# SIGSTOP (19) — pause process
# SIGCONT (18) — resume paused process
# SIGQUIT (3)  — quit with core dump

# Kill by PID
kill 1234                 # SIGTERM (graceful)
kill -15 1234             # explicit SIGTERM
kill -9 1234              # SIGKILL (force)
kill -1 1234              # SIGHUP (reload)
kill -SIGTERM 1234        # by name

# Kill by process name
killall nginx             # kill all processes named nginx
killall -9 java
pkill nginx               # kill by pattern
pkill -u appuser          # kill all processes by user
pkill -f "python manage.py"   # match full command line

# Kill by port
fuser -k 8080/tcp         # kill process using port 8080
lsof -ti:8080 | xargs kill -9

# Real-Time Scenario: Graceful reload of nginx config
sudo kill -HUP $(cat /var/run/nginx.pid)
# or
sudo nginx -s reload
```

---

## 4. Process Priority (nice / renice)

```bash
# Nice values: -20 (highest priority) to 19 (lowest priority)
# Default: 0.  Negative values require root.

# Start with specific priority
nice -n 10 /opt/app/run-backup.sh     # low priority background job
nice -n -5 critical-process           # higher priority (root only)

# Change priority of running process
renice 10 -p 1234                     # by PID
renice 15 -u backupuser               # all processes by user
renice -5 -g appgroup                 # all processes in group (root)

# View priority in ps
ps -eo pid,ni,pri,cmd | grep java
```

---

## 5. Background & Foreground Jobs

```bash
# Run in background
long-running-command &
nohup /opt/app/server.sh &              # immune to HUP (survives logout)
nohup /opt/app/server.sh > app.log 2>&1 &   # capture output

# List background jobs
jobs
jobs -l          # with PIDs

# Bring to foreground
fg               # most recent
fg %2            # job number 2

# Send to background (after Ctrl+Z to suspend)
Ctrl+Z           # suspend foreground job
bg               # resume in background
bg %2            # resume job 2 in background

# Disown — detach job from shell (survives logout)
disown -h %1     # -h = don't send HUP on logout

# screen / tmux — persistent sessions (survive disconnection)
screen -S mysession               # new named session
screen -ls                        # list sessions
screen -r mysession               # reattach
Ctrl+A, D                         # detach

tmux new -s deploy                # new session
tmux ls                           # list
tmux attach -t deploy             # attach
Ctrl+B, D                         # detach
```

---

## 6. systemctl & systemd

```bash
# Service management
sudo systemctl start   nginx
sudo systemctl stop    nginx
sudo systemctl restart nginx        # stop then start
sudo systemctl reload  nginx        # reload config (no downtime)
sudo systemctl enable  nginx        # enable on boot
sudo systemctl disable nginx        # disable on boot
sudo systemctl status  nginx        # check status

# Multi-service
sudo systemctl restart nginx mysql redis

# View service file location
sudo systemctl cat nginx

# Enable AND start
sudo systemctl enable --now nginx

# Disable AND stop
sudo systemctl disable --now nginx

# Check all failed services
systemctl --failed
systemctl list-units --state=failed

# List all units
systemctl list-units
systemctl list-units --type=service
systemctl list-units --type=service --state=running

# Reload systemd after editing unit files
sudo systemctl daemon-reload

# Mask a service (prevent start even manually)
sudo systemctl mask nginx
sudo systemctl unmask nginx
```

### Writing a Custom systemd Service

```ini
# /etc/systemd/system/payment-service.service
[Unit]
Description=Payment Service
Documentation=https://wiki.company.com/payment-service
After=network.target mysql.service redis.service
Requires=mysql.service

[Service]
Type=simple
User=payment-svc
Group=payment-svc
WorkingDirectory=/opt/payment-service
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/etc/payment-service/env
ExecStart=/usr/bin/node /opt/payment-service/src/index.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=payment-service
LimitNOFILE=65536
LimitNPROC=4096
# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/var/log/payment-service /var/run/payment-service

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now payment-service
sudo systemctl status payment-service
```

---

## 7. journalctl — systemd Log Viewer

```bash
# View all logs
journalctl

# Follow live (like tail -f)
journalctl -f
journalctl -fu payment-service      # follow specific service

# Specific service logs
journalctl -u nginx
journalctl -u nginx --since today
journalctl -u nginx --since "1 hour ago"
journalctl -u nginx --since "2024-04-20 10:00" --until "2024-04-20 11:00"

# By priority
journalctl -p err                   # errors and above
journalctl -p warning               # warnings and above
journalctl -u nginx -p err

# Reverse order (newest first)
journalctl -u nginx -r

# Last N lines
journalctl -u nginx -n 50

# Since last boot
journalctl -u nginx -b

# From two boots ago
journalctl -u nginx -b -1

# Disk usage by journal
journalctl --disk-usage

# Vacuum old logs
sudo journalctl --vacuum-size=500M   # keep only 500MB
sudo journalctl --vacuum-time=30d    # keep only last 30 days

# Export logs for analysis
journalctl -u nginx --since today --output=json | jq '.MESSAGE' | head -20
```

---

## 8. cron — Scheduled Jobs

```bash
# Edit crontab for current user
crontab -e

# Edit crontab for specific user
sudo crontab -u appuser -e

# List crontab
crontab -l
sudo crontab -u appuser -l

# Remove crontab
crontab -r

# Cron syntax:
# ┌────────── minute (0-59)
# │ ┌──────── hour (0-23)
# │ │ ┌────── day of month (1-31)
# │ │ │ ┌──── month (1-12 or jan-dec)
# │ │ │ │ ┌── day of week (0-7, 0 and 7 = Sunday)
# │ │ │ │ │
# * * * * *   command

# Examples:
0 2 * * *       /opt/scripts/backup.sh              # Daily at 2 AM
*/15 * * * *    /opt/scripts/health-check.sh        # Every 15 minutes
0 */4 * * *     /opt/scripts/sync.sh                # Every 4 hours
0 9 * * 1-5     /opt/scripts/report.sh              # Weekdays at 9 AM
0 0 1 * *       /opt/scripts/monthly-cleanup.sh     # 1st of each month
@reboot         /opt/app/start.sh                   # On system boot
@daily          /opt/scripts/daily-report.sh        # Daily (midnight)
@weekly         /opt/scripts/weekly-backup.sh       # Weekly (Sunday midnight)

# Redirect output (always!)
0 2 * * * /opt/scripts/backup.sh >> /var/log/backup.log 2>&1

# System-wide cron directories (no crontab needed)
/etc/cron.d/          # custom cron files
/etc/cron.daily/      # scripts run daily
/etc/cron.weekly/     # scripts run weekly
/etc/cron.hourly/     # scripts run hourly
/etc/cron.monthly/    # scripts run monthly

# View cron logs
grep CRON /var/log/syslog
journalctl -u cron
```

### Real-Time Scenario: Production cron jobs

```bash
# /etc/cron.d/payment-service
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=devops-alerts@company.com

# Daily database backup at 1 AM
0 1 * * * appuser /opt/payment-service/bin/backup-db.sh >> /var/log/payment-service/backup.log 2>&1

# SSL certificate renewal check every day at 3 AM
0 3 * * * root /usr/bin/certbot renew --quiet >> /var/log/letsencrypt/renew.log 2>&1

# Log rotation trigger at midnight
0 0 * * * root /usr/sbin/logrotate /etc/logrotate.d/payment-service

# Clean tmp files older than 7 days
0 4 * * * root find /opt/payment-service/tmp -mtime +7 -delete
```

---

## 9. at — One-Time Scheduled Jobs

```bash
# Schedule a one-time job
at 10:30 PM
at 10:30 PM tomorrow
at now + 2 hours
at 2:00 AM Jul 4

# Interactive — type commands, Ctrl+D to save
at 10:00 AM <<EOF
/opt/scripts/deploy-v2.sh >> /var/log/deploy.log 2>&1
EOF

# List pending at jobs
atq

# Remove an at job
atrm 5          # job number from atq

# Real-Time Scenario: Schedule maintenance window
echo "/opt/scripts/maintenance-mode-on.sh" | at 2:00 AM
echo "/opt/scripts/maintenance-mode-off.sh" | at 4:00 AM
```

---

## 10. Process Limits and Resource Control

```bash
# View resource usage of a command
/usr/bin/time -v command            # detailed statistics

# Limit CPU and memory with systemd-run
systemd-run --scope -p CPUQuota=50% -p MemoryLimit=512M /opt/app/run.sh

# cgroups v2 — view limits for a service
cat /sys/fs/cgroup/system.slice/payment-service.service/memory.max
cat /sys/fs/cgroup/system.slice/payment-service.service/cpu.max
```

---

## Summary Table

| Command | Purpose |
|---------|---------|
| `ps aux` | All processes snapshot |
| `top / htop` | Real-time process monitor |
| `kill -15 PID` | Graceful shutdown |
| `kill -9 PID` | Force kill |
| `pkill -f "pattern"` | Kill by command pattern |
| `nice -n 10 cmd` | Start with low priority |
| `renice 10 -p PID` | Change running priority |
| `nohup cmd &` | Run immune to HUP |
| `systemctl status svc` | Service status |
| `journalctl -fu svc` | Follow service logs |
| `crontab -e` | Edit scheduled jobs |
| `systemctl daemon-reload` | Reload after unit file edit |
