# 03 — User & Group Management

## 1. Key System Files

```
/etc/passwd   – User accounts (username:x:UID:GID:comment:home:shell)
/etc/shadow   – Encrypted passwords (readable only by root)
/etc/group    – Group definitions (groupname:x:GID:members)
/etc/gshadow  – Encrypted group passwords
/etc/sudoers  – Sudo configuration (edit with visudo)
/etc/login.defs – Default settings for useradd, password policy
/etc/skel/    – Template files copied to new user homes
```

```bash
# Inspect key files
cat /etc/passwd | grep -v "nologin\|false" | cut -d: -f1  # real users
cat /etc/group | grep devops
grep "^vikram" /etc/passwd
# vikram:x:1001:1001:Vikram Akula:/home/vikram:/bin/bash
# field: name:password:UID:GID:comment:home:shell
```

---

## 2. User Management

```bash
# Create user (interactive home dir, shell defaults)
sudo useradd vikram

# Create user with full options
sudo useradd \
  -m \                          # create home directory
  -d /home/vikram \             # home directory path
  -s /bin/bash \                # shell
  -c "Vikram Akula, DevOps" \   # comment/GECOS
  -G devops,docker,sudo \       # secondary groups
  -u 1500 \                     # specific UID
  vikram

# adduser (Debian/Ubuntu — interactive, more user-friendly)
sudo adduser vikram

# Set or change password
sudo passwd vikram
echo "vikram:NewP@ss123" | sudo chpasswd    # non-interactive (use in scripts)

# Change user attributes
sudo usermod -s /bin/zsh vikram             # change shell
sudo usermod -c "Lead DevOps Engineer" vikram   # change comment
sudo usermod -d /home/vikram_new -m vikram  # move home directory
sudo usermod -l newname vikram              # rename user
sudo usermod -aG docker vikram             # add to group (-a = append, IMPORTANT)
sudo usermod -G devops,ops vikram          # set groups (REPLACES existing secondary groups)
sudo usermod -L vikram                     # lock account
sudo usermod -U vikram                     # unlock account

# Delete user
sudo userdel vikram                        # keep home dir
sudo userdel -r vikram                     # remove home + mail spool

# Show user info
id vikram
# uid=1001(vikram) gid=1001(vikram) groups=1001(vikram),27(sudo),998(docker)

getent passwd vikram                       # query user database
finger vikram                              # detailed info (if installed)
```

### System (Service) Users

```bash
# Create a system user for running a service (no login, no home)
sudo useradd \
  -r \                          # system account (UID < 1000)
  -s /sbin/nologin \            # prevent login
  -d /var/lib/payment-service \ # home for data
  -c "Payment Service User" \
  -M \                          # don't create home
  payment-svc

# Verify
id payment-svc
grep payment-svc /etc/passwd
```

---

## 3. Group Management

```bash
# Create group
sudo groupadd devops
sudo groupadd -g 2000 ops        # specific GID

# Modify group
sudo groupmod -n ops-team ops    # rename group
sudo groupmod -g 2001 ops-team   # change GID

# Delete group
sudo groupdel ops-team

# Add user to group
sudo usermod -aG docker vikram   # -a = append (don't remove from other groups!)
sudo gpasswd -a vikram devops    # alternative

# Remove user from group
sudo gpasswd -d vikram devops

# Set group administrator
sudo gpasswd -A vikram devops    # vikram can manage devops group

# List all members of a group
getent group docker
grep "^docker" /etc/group

# Show groups a user belongs to
groups vikram
id -Gn vikram
```

---

## 4. Switching Users

```bash
# Switch to root
su -                    # full root login shell (reads root's environment)
su                      # switch to root without full login environment

# Switch to another user
su - vikram             # full login shell as vikram
su vikram               # switch without login environment

# Run command as another user
su -c "systemctl restart nginx" root

# sudo — run as root (or another user)
sudo command
sudo -u appuser /opt/app/bin/reload.sh
sudo -i                 # open root login shell
sudo -s                 # open root shell (current env)

# Check who you are
whoami
id
who                     # logged-in users
w                       # detailed who + what they're doing
last                    # login history
last -n 10 vikram       # last 10 logins for vikram
lastb                   # failed logins (bad logins)
lastlog                 # last login for all users
```

---

## 5. Password Policy

```bash
# /etc/login.defs — system-wide defaults
sudo vim /etc/login.defs
# PASS_MAX_DAYS   90     # password expires after 90 days
# PASS_MIN_DAYS   7      # minimum days between changes
# PASS_WARN_AGE   14     # warning 14 days before expiry

# chage — password aging (per user)
sudo chage -l vikram               # view password aging info
sudo chage -M 90 vikram            # max 90 days
sudo chage -m 7  vikram            # min 7 days between changes
sudo chage -W 14 vikram            # warn 14 days before expiry
sudo chage -E 2024-12-31 vikram    # account expiry date
sudo chage -d 0 vikram             # force password change on next login

# pam_pwquality — password complexity (Ubuntu/RHEL)
sudo vim /etc/security/pwquality.conf
# minlen = 12
# dcredit = -1     (require at least 1 digit)
# ucredit = -1     (require at least 1 uppercase)
# lcredit = -1     (require at least 1 lowercase)
# ocredit = -1     (require at least 1 special char)
# maxrepeat = 3

# Lock / unlock account
sudo passwd -l vikram    # lock
sudo passwd -u vikram    # unlock
sudo usermod -L vikram   # lock (alternative)
sudo usermod -U vikram   # unlock (alternative)
```

---

## 6. SSH Access Control

```bash
# /etc/ssh/sshd_config — restrict SSH access

# Allow only specific users
AllowUsers vikram deployer jenkins

# Allow specific groups
AllowGroups ssh-users devops

# Deny specific users
DenyUsers baduser tempuser

# Deny specific groups
DenyGroups contractors

# Apply changes
sudo systemctl reload sshd

# authorized_keys — per-user SSH key authorization
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Force a command when a key is used (restrict key to one task)
# In authorized_keys:
command="/opt/deploy/run-deploy.sh",no-pty,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA...

# Real-Time Scenario: Create restricted deploy user
sudo useradd -r -s /bin/bash -m -d /home/deployer deployer
sudo mkdir -p /home/deployer/.ssh
echo "ssh-ed25519 AAAA...ci-key" | sudo tee /home/deployer/.ssh/authorized_keys
sudo chown -R deployer:deployer /home/deployer/.ssh
sudo chmod 700 /home/deployer/.ssh
sudo chmod 600 /home/deployer/.ssh/authorized_keys

# Grant deployer only specific sudo commands
echo "deployer ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart app, /usr/bin/docker pull *" \
  | sudo tee /etc/sudoers.d/deployer
sudo chmod 440 /etc/sudoers.d/deployer
```

---

## 7. User Session Limits (PAM / limits.conf)

```bash
# /etc/security/limits.conf
sudo vim /etc/security/limits.conf

# Syntax: <domain> <type> <item> <value>
# domain: username, @group, * (all), or % (groups)
# type:   soft (warning), hard (maximum)

# Examples:
vikram          soft    nofile    4096     # open file descriptors
vikram          hard    nofile    8192
@devops         soft    nproc     1024     # max processes for group
@developers     hard    nproc     2048
*               hard    core      0        # disable core dumps globally
appuser         soft    memlock   unlimited
appuser         hard    memlock   unlimited

# View current limits for running process
cat /proc/$$/limits

# View limits for current session
ulimit -a

# Temporarily increase limits in current session
ulimit -n 65536      # open files
ulimit -u 32768      # user processes
ulimit -c unlimited  # core dumps

# For systemd services — limits in service file
# [Service]
# LimitNOFILE=65536
# LimitNPROC=4096
```

---

## 8. Real-Time Scenarios

### Scenario 1: Onboarding a New DevOps Engineer

```bash
#!/bin/bash
USERNAME="newengineer"
FULL_NAME="New Engineer"
GROUPS="sudo,docker,devops,adm"

# Create user
sudo useradd \
  -m -s /bin/bash \
  -c "$FULL_NAME" \
  -G "$GROUPS" \
  "$USERNAME"

# Set temporary password (must change on first login)
echo "${USERNAME}:TempPass@2024!" | sudo chpasswd
sudo chage -d 0 "$USERNAME"

# Add SSH key
sudo mkdir -p /home/${USERNAME}/.ssh
# (paste their public key)
echo "ssh-ed25519 AAAA...their-key" | sudo tee /home/${USERNAME}/.ssh/authorized_keys
sudo chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}/.ssh
sudo chmod 700 /home/${USERNAME}/.ssh
sudo chmod 600 /home/${USERNAME}/.ssh/authorized_keys

echo "User $USERNAME created. Groups: $GROUPS"
id "$USERNAME"
```

### Scenario 2: Audit All Users with Shell Access

```bash
#!/bin/bash
echo "Users with interactive shell access:"
grep -v "nologin\|/bin/false\|/usr/sbin/nologin" /etc/passwd \
  | awk -F: '{print $1, $3, $7}' \
  | column -t

echo ""
echo "Users with sudo access:"
grep -v "^#" /etc/sudoers | grep -v "^$"
ls /etc/sudoers.d/ | xargs -I{} cat /etc/sudoers.d/{}

echo ""
echo "Recently logged-in users:"
last -n 20 | head -20
```

### Scenario 3: Lock All Unused Service Accounts

```bash
#!/bin/bash
# Find system accounts that still have /bin/bash
SYSTEM_BASH_USERS=$(awk -F: '($3 < 1000 && $7 == "/bin/bash") {print $1}' /etc/passwd)

for user in $SYSTEM_BASH_USERS; do
  echo "Locking system account with bash: $user"
  sudo usermod -L "$user"
  sudo usermod -s /sbin/nologin "$user"
done
```

---

## Summary Table

| Command | Purpose |
|---------|---------|
| `useradd -m -s /bin/bash -G group user` | Create user with home + shell + groups |
| `usermod -aG docker vikram` | Add to group (append) |
| `usermod -L / -U` | Lock / Unlock account |
| `chage -M 90 user` | Set password max age |
| `chage -d 0 user` | Force password change on next login |
| `getent passwd user` | Query user database |
| `id user` | Show UID, GID, groups |
| `groups user` | Show user's groups |
| `who / w` | Currently logged in users |
| `last -n 20` | Login history |
| `lastb` | Failed login attempts |
| `ulimit -a` | Show session limits |
| `sudo visudo` | Safely edit sudoers |
