# 09 — Linux Security Hardening

## 1. SSH Hardening

```bash
# /etc/ssh/sshd_config — production hardening
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo vim /etc/ssh/sshd_config
```

```ini
# /etc/ssh/sshd_config — hardened configuration

# Change default port (security through obscurity)
Port 2222

# Listen only on specific interface
ListenAddress 10.0.1.100

# Protocol version
Protocol 2

# Authentication
PermitRootLogin no                    # never allow root SSH
PasswordAuthentication no             # SSH keys only
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes

# Key algorithms (restrict to strong ones)
HostKey /etc/ssh/ssh_host_ed25519_key
HostKey /etc/ssh/ssh_host_rsa_key
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com

# Session limits
LoginGraceTime 30
MaxAuthTries 3
MaxSessions 4
MaxStartups 10:30:60

# Access control
AllowGroups ssh-users devops
DenyUsers *bad* *test* guest
AllowTcpForwarding no             # disable unless needed
X11Forwarding no
AgentForwarding no

# Keep-alive
ClientAliveInterval 300
ClientAliveCountMax 2

# Logging
LogLevel VERBOSE                  # log key fingerprints

# Disable forwarding features
GatewayPorts no
PermitTunnel no
```

```bash
# Validate config and restart
sudo sshd -t                        # test config syntax
sudo systemctl reload sshd

# Generate strong server host key if needed
sudo ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N ""
```

______________________________________________________________________

## 2. fail2ban — Brute Force Protection

```bash
# Install
sudo apt install fail2ban

# /etc/fail2ban/jail.local (override defaults without editing jail.conf)
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 3
banaction = iptables-multiport
backend = systemd
ignoreip = 127.0.0.1/8 10.0.0.0/8 192.168.0.0/16

[sshd]
enabled  = true
port     = 2222
logpath  = %(sshd_log)s
maxretry = 3
bantime  = 24h

[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log

[nginx-limit-req]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 2
EOF

sudo systemctl enable --now fail2ban

# Status and management
sudo fail2ban-client status
sudo fail2ban-client status sshd       # view banned IPs for sshd
sudo fail2ban-client set sshd unbanip 1.2.3.4   # unban an IP
sudo fail2ban-client reload

# Monitor bans in real-time
sudo tail -f /var/log/fail2ban.log
```

______________________________________________________________________

## 3. Firewall Hardening (Default Deny)

```bash
# UFW — default deny, allow only needed ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 10.0.0.0/8 to any port 2222 proto tcp    # SSH only from internal
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from 10.0.1.0/24 to any port 5432 proto tcp   # PostgreSQL internal only
sudo ufw enable
sudo ufw status verbose

# Log denied connections
sudo ufw logging medium

# iptables — explicit default deny ruleset
sudo iptables -F                          # flush
sudo iptables -P INPUT   DROP             # default deny input
sudo iptables -P FORWARD DROP             # default deny forward
sudo iptables -P OUTPUT  ACCEPT           # allow output

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT
# Allow established connections
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# Allow SSH from management network only
sudo iptables -A INPUT -s 10.0.0.0/8 -p tcp --dport 2222 -j ACCEPT
# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
# Log dropped packets
sudo iptables -A INPUT -j LOG --log-prefix "iptables-dropped: " --log-level 4
# Save
sudo iptables-save > /etc/iptables/rules.v4
```

______________________________________________________________________

## 4. SELinux (RHEL/CentOS/Amazon Linux)

```bash
# Check SELinux status
sestatus
getenforce                          # Enforcing / Permissive / Disabled

# Modes
sudo setenforce 0                   # Set Permissive (temporarily)
sudo setenforce 1                   # Set Enforcing

# Permanent mode: /etc/selinux/config
# SELINUX=enforcing | permissive | disabled

# View denials
sudo ausearch -m avc -ts today      # today's AVC denials
sudo sealert -a /var/log/audit/audit.log  # human-readable (setroubleshoot)
dmesg | grep -i selinux

# Common SELinux commands
ls -Z /opt/app/                     # show SELinux context
ps -eZ | grep nginx                 # process context
id -Z                               # current user context

# Restore default context
sudo restorecon -Rv /var/www/html/

# Set file context
sudo semanage fcontext -a -t httpd_exec_t "/opt/app/bin(/.*)?"
sudo restorecon -Rv /opt/app/bin/

# Allow nginx to bind to non-standard port
sudo semanage port -a -t http_port_t -p tcp 8080

# Boolean tuning
sudo getsebool -a | grep httpd
sudo setsebool -P httpd_can_network_connect on     # allow nginx to connect outbound
sudo setsebool -P httpd_execmem on                 # allow nginx to exec memory

# Real-Time Scenario: App deployed to /opt but nginx can't serve it
# Step 1: Check denials
sudo ausearch -m avc -ts recent
# avc: denied { read } for ... path="/opt/app/public" tcontext=unconfined_u:object_r:usr_t

# Step 2: Fix context
sudo semanage fcontext -a -t httpd_sys_content_t "/opt/app/public(/.*)?"
sudo restorecon -Rv /opt/app/public/
```

______________________________________________________________________

## 5. AppArmor (Ubuntu/Debian)

```bash
# AppArmor status
sudo aa-status
sudo systemctl status apparmor

# Modes: enforce (block violations) / complain (log only) / disabled

# Set profile mode
sudo aa-enforce  /etc/apparmor.d/usr.sbin.nginx
sudo aa-complain /etc/apparmor.d/usr.sbin.nginx
sudo aa-disable  /etc/apparmor.d/usr.sbin.nginx

# Generate profile for new application
sudo aa-genprof /opt/app/bin/server

# View violations
sudo dmesg | grep -i apparmor
sudo journalctl -u apparmor

# Reload profile after editing
sudo apparmor_parser -r /etc/apparmor.d/usr.sbin.nginx
```

______________________________________________________________________

## 6. auditd — System Auditing

```bash
# Install
sudo apt install auditd audispd-plugins

# Start and enable
sudo systemctl enable --now auditd

# /etc/audit/audit.rules
sudo vim /etc/audit/rules.d/audit.rules
```

```
# /etc/audit/rules.d/hardening.rules

# Immutable (lock rules — requires reboot to change)
-e 2

# Monitor sensitive files
-w /etc/passwd    -p wa -k user-modify
-w /etc/shadow    -p wa -k user-modify
-w /etc/sudoers   -p wa -k sudo-config
-w /etc/ssh/sshd_config -p wa -k ssh-config

# Monitor privileged commands
-a always,exit -F arch=b64 -S execve -F euid=0 -k root-commands

# Monitor unauthorized file access attempts
-a always,exit -F arch=b64 -S open -F exit=-EACCES -k access-denied
-a always,exit -F arch=b64 -S open -F exit=-EPERM  -k access-denied

# Monitor network configuration changes
-w /etc/hosts     -p wa -k network-config
-w /etc/resolv.conf -p wa -k network-config
-w /sbin/iptables -p x  -k firewall

# Monitor cron
-w /etc/cron.d/      -p wa -k cron
-w /etc/cron.daily/  -p wa -k cron
-w /var/spool/cron/  -p wa -k cron
```

```bash
# Load rules
sudo augenrules --load
sudo systemctl restart auditd

# Search audit log
sudo ausearch -k user-modify                     # by key
sudo ausearch -k user-modify -ts today           # today
sudo ausearch -m LOGIN -ts today                 # login events
sudo ausearch -ua vikram -ts today               # by user
sudo ausearch -f /etc/sudoers                    # by file
sudo ausearch -x /usr/bin/sudo                   # by executable

# Generate report
sudo aureport --summary                          # overview
sudo aureport --auth                             # authentication events
sudo aureport --file                             # file access events
sudo aureport --executable                       # program executions
sudo aureport --failed                           # failed events
```

______________________________________________________________________

## 7. System Hardening Checklist

```bash
#!/bin/bash
# Automated hardening checklist
echo "=== System Hardening Audit ==="

check() { echo "$1"; }
warn()  { echo "WARN: $1"; }
fail()  { echo "FAIL: $1"; }

# 1. Root login disabled
[[ $(grep -c "^PermitRootLogin no" /etc/ssh/sshd_config) -gt 0 ]] \
  && check "SSH root login disabled" || fail "SSH root login NOT disabled"

# 2. Password auth disabled
[[ $(grep -c "^PasswordAuthentication no" /etc/ssh/sshd_config) -gt 0 ]] \
  && check "SSH password auth disabled" || fail "SSH password auth NOT disabled"

# 3. Firewall active
systemctl is-active --quiet ufw && check "UFW firewall is active" || fail "UFW is NOT active"

# 4. No empty passwords
awk -F: '($2 == "") {print "FAIL: Empty password:", $1}' /etc/shadow

# 5. No world-writable files in /etc
WORLD_WRITE=$(find /etc -perm -o+w -type f 2>/dev/null)
[[ -z "$WORLD_WRITE" ]] && check "No world-writable files in /etc" || fail "World-writable files in /etc: $WORLD_WRITE"

# 6. Unattended upgrades enabled
systemctl is-active --quiet unattended-upgrades && check "Unattended upgrades active" || warn "Unattended upgrades not active"

# 7. auditd running
systemctl is-active --quiet auditd && check "auditd is running" || warn "auditd is NOT running"

# 8. fail2ban running
systemctl is-active --quiet fail2ban && check "fail2ban is running" || warn "fail2ban is NOT running"

# 9. SUID files
echo "SUID files (review these):"
find / -perm -4000 -type f 2>/dev/null | grep -v -E "/usr/bin/sudo|/usr/bin/passwd|/bin/su"
```

______________________________________________________________________

## 8. Automatic Security Updates

```bash
# Ubuntu — unattended-upgrades
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# /etc/apt/apt.conf.d/50unattended-upgrades
sudo vim /etc/apt/apt.conf.d/50unattended-upgrades
```

```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";     // Don't auto-reboot
Unattended-Upgrade::Mail "devops@company.com";
Unattended-Upgrade::MailOnlyOnError "true";
```

```bash
# Test
sudo unattended-upgrade --dry-run --debug

# RHEL/CentOS — dnf-automatic
sudo dnf install dnf-automatic
sudo vim /etc/dnf/automatic.conf
# apply_updates = yes  (for security only)
sudo systemctl enable --now dnf-automatic-install.timer
```

______________________________________________________________________

## 9. Secrets & Sensitive File Management

```bash
# Never store secrets in scripts — use env vars or secrets managers

# Linux keyring / pass
sudo apt install pass
pass init "vikram@company.com"
pass insert production/db-password
pass show production/db-password

# Environment variable injection (systemd service)
# /etc/payment-service/env (600 permissions, owned by service user)
sudo touch /etc/payment-service/env
sudo chmod 600 /etc/payment-service/env
sudo chown payment-svc:payment-svc /etc/payment-service/env
echo "DB_PASSWORD=secret" | sudo tee /etc/payment-service/env

# Reference in systemd unit:
# EnvironmentFile=/etc/payment-service/env

# AWS Secrets Manager (from EC2)
aws secretsmanager get-secret-value --secret-id prod/payment/db \
  --query SecretString --output text | jq -r .DB_PASSWORD

# HashiCorp Vault (from any host)
export VAULT_TOKEN=$(vault auth -method=aws)
DB_PASSWORD=$(vault kv get -field=password secret/prod/payment/db)
```

______________________________________________________________________

## Summary Hardening Checklist

```
SSH:
  ✓ PermitRootLogin no
  ✓ PasswordAuthentication no
  ✓ Port changed from 22
  ✓ AllowGroups or AllowUsers set
  ✓ MaxAuthTries 3

Firewall:
  ✓ Default deny inbound
  ✓ Only required ports open
  ✓ SSH restricted to management network

Users:
  ✓ No users with empty passwords
  ✓ Password policy enforced (90 days max)
  ✓ Service accounts use nologin shell
  ✓ Root shell disabled for service accounts

Monitoring:
  ✓ auditd running and rules loaded
  ✓ fail2ban protecting SSH
  ✓ Unattended security updates enabled

Filesystem:
  ✓ No world-writable files in /etc /opt /var
  ✓ SUID/SGID binaries audited
  ✓ /tmp has noexec,nosuid mount options
  ✓ Secrets not in scripts (use env files or vaults)
```
