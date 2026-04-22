# 🐧 02 — Linux File Permissions

## 📌 1. Understanding Permission Bits

```
-rwxr-xr--  1  vikram  devops  4096  Apr 22  script.sh
│└──┴──┴──     └────┘  └────┘
│  u  g  o     owner   group
│
└─ File type: - = regular file, d = directory, l = symlink,
               b = block device, c = char device, p = pipe, s = socket
```

```
Permission  Symbol  Octal  Meaning on FILE    Meaning on DIRECTORY
Read        r       4      View content       List directory contents
Write       w       2      Modify content     Create/delete files inside
Execute     x       1      Run as program     Enter (cd into) directory
None        -       0      No permission      No permission
```

### 🔹 Octal Examples

```
rwx rwx rwx = 777   (full access — dangerous!)
rwx r-x r-x = 755   (owner full, group/others read+execute — typical binary)
rw- r-- r-- = 644   (owner read+write, group/others read-only — typical file)
rw- rw- r-- = 664   (owner+group read+write, others read-only)
rw- --- --- = 600   (owner read+write only — private keys, .env files)
rwx --x --x = 711   (owner full, others execute-only)
--- --- --- = 000   (nobody can access)
```

______________________________________________________________________

## 📌 2. chmod — Change Permissions

```bash
# Symbolic mode
chmod u+x script.sh            # add execute for owner
chmod g+w file.txt             # add write for group
chmod o-r secret.txt           # remove read from others
chmod a+x script.sh            # add execute for all (a = u+g+o)
chmod u+x,g-w,o-r file.txt     # multiple changes at once
chmod ug=rw,o=r file.txt       # set exact permissions (= replaces)

# Octal mode (most common in DevOps)
chmod 755 script.sh            # rwxr-xr-x
chmod 644 config.conf          # rw-r--r--
chmod 600 ~/.ssh/id_rsa        # rw------- (required for SSH keys!)
chmod 700 ~/.ssh/              # rwx------ (required for .ssh dir!)
chmod 777 /tmp/shared/         # full access (dangerous)
chmod 000 secret.key           # no access

# Recursive
chmod -R 755 /opt/app/
chmod -R 644 /var/www/html/

# Real DevOps: fix SSH key permissions (common issue)
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
chmod 644 ~/.ssh/authorized_keys
chmod 644 ~/.ssh/known_hosts
```

______________________________________________________________________

## 📌 3. chown — Change Ownership

```bash
# Change owner
chown vikram file.txt

# Change owner and group
chown vikram:devops file.txt
chown vikram:devops /opt/app/

# Change group only
chown :devops file.txt
chgrp devops file.txt              # same effect

# Recursive
chown -R appuser:appgroup /opt/app/
chown -R www-data:www-data /var/www/

# Copy ownership from another file
chown --reference=source.txt target.txt

# Real-Time Scenario: New app deployment ownership setup
sudo useradd -r -s /sbin/nologin appuser      # system user, no login
sudo groupadd appgroup
sudo usermod -aG appgroup appuser

sudo chown -R appuser:appgroup /opt/payment-service/
sudo chown -R appuser:appgroup /var/log/payment-service/
sudo chmod -R 750 /opt/payment-service/
sudo chmod -R 770 /var/log/payment-service/
```

______________________________________________________________________

## 📌 4. umask — Default Permission Mask

```bash
# umask defines what permissions are REMOVED from new files
# Default creation: files = 666, directories = 777
# umask 022 → files get 644, directories get 755

# View current umask
umask          # e.g. 0022
umask -S       # symbolic: u=rwx,g=rx,o=rx

# Set umask for session
umask 027      # files=640, dirs=750 (group no write, others nothing)
umask 077      # files=600, dirs=700 (owner only — for home dirs)
umask 022      # default (files=644, dirs=755)

# Set permanently in /etc/profile or /etc/bash.bashrc
echo "umask 027" | sudo tee -a /etc/profile.d/umask.sh

# How umask works:
# New file:  666 - 022 = 644  (rw-r--r--)
# New dir:   777 - 022 = 755  (rwxr-xr-x)
# New file:  666 - 027 = 640  (rw-r-----)
# New dir:   777 - 027 = 750  (rwxr-x---)
```

______________________________________________________________________

## 📌 5. Special Permission Bits

### 🔹 SUID (Set User ID) — Bit 4

```bash
# File runs as the file's OWNER, not the user who runs it
# Classic example: /usr/bin/passwd (runs as root to update /etc/shadow)

# Set SUID
chmod u+s /usr/bin/my-utility
chmod 4755 /usr/bin/my-utility     # 4 = SUID bit

# Check for SUID files (security audit)
find / -perm -4000 -type f 2>/dev/null

# SUID appears as 's' in owner's execute position:
ls -l /usr/bin/passwd
# -rwsr-xr-x 1 root root 68208 /usr/bin/passwd
#    ^
#    s = SUID set
```

### 🔹 SGID (Set Group ID) — Bit 2

```bash
# On file: runs as the file's GROUP
# On directory: new files inherit the directory's group (useful for teams)

# Set SGID on a shared directory
chmod g+s /opt/shared/
chmod 2775 /opt/shared/

# Verify
ls -ld /opt/shared/
# drwxrwsr-x 2 root devops 4096 /opt/shared/
#        ^
#        s = SGID set

# Real DevOps: shared project directory for a team
sudo mkdir /opt/project
sudo chown root:devops-team /opt/project
sudo chmod 2775 /opt/project
# Now any file created inside inherits group 'devops-team'
```

### 🔹 Sticky Bit — Bit 1

```bash
# On directory: users can only delete their OWN files
# Classic example: /tmp  — everyone writes but can't delete others' files

# Set sticky bit
chmod +t /tmp/shared/
chmod 1777 /tmp/shared/

# Verify — appears as 't' in others' execute position
ls -ld /tmp
# drwxrwxrwt 18 root root 4096 /tmp
#          ^
#          t = sticky bit set

# Real DevOps: shared upload directory
sudo mkdir /var/uploads
sudo chmod 1777 /var/uploads
```

______________________________________________________________________

## 📌 6. Access Control Lists (ACLs)

ACLs allow fine-grained permissions beyond the basic owner/group/other model.

```bash
# Install ACL tools
sudo apt install acl

# View ACLs
getfacl file.txt
getfacl /var/www/html/

# Set ACL for a specific user
setfacl -m u:vikram:rwx /opt/shared/
setfacl -m u:deployer:rw  config.yml

# Set ACL for a specific group
setfacl -m g:developers:rx /opt/app/
setfacl -m g:ops:rwx /var/log/app/

# Recursive ACL
setfacl -R -m u:vikram:rx /opt/app/

# Default ACL (inherited by new files in directory)
setfacl -d -m u:vikram:rw /opt/shared/

# Remove ACL entry
setfacl -x u:vikram /opt/shared/

# Remove ALL ACLs
setfacl -b file.txt

# Real-Time Scenario: CI/CD user needs read access to app configs
# without adding to admin group
sudo setfacl -m u:jenkins:rx /etc/payment-service/
sudo setfacl -m u:jenkins:r  /etc/payment-service/config.yml
getfacl /etc/payment-service/config.yml
```

______________________________________________________________________

## 📌 7. sudo Configuration

```bash
# Run a command as root
sudo apt update

# Run as a specific user
sudo -u appuser /opt/app/bin/reload.sh

# Open a root shell
sudo -i         # root shell (interactive login)
sudo -s         # root shell (current env)
sudo su -       # switch to root

# Edit sudoers safely
sudo visudo

# /etc/sudoers examples:
# Allow user full sudo
vikram ALL=(ALL:ALL) ALL

# Allow user specific commands without password
deployer ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
deployer ALL=(ALL) NOPASSWD: /usr/bin/docker pull *

# Allow group sudo
%devops ALL=(ALL:ALL) ALL
%ops    ALL=(ALL) NOPASSWD: /usr/bin/systemctl *

# Allow jenkins to run deploy script only
jenkins ALL=(appuser) NOPASSWD: /opt/app/bin/deploy.sh

# Drop-in sudoers files (preferred over editing main file)
echo "deployer ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart app" \
  | sudo tee /etc/sudoers.d/deployer
sudo chmod 440 /etc/sudoers.d/deployer

# List what sudo can do for current user
sudo -l

# Verify sudoers syntax before saving
sudo visudo -c
```

______________________________________________________________________

## 📌 8. Real-Time Scenarios

### 🔹 Scenario 1: Secure Web Server File Permissions

```bash
# Web files owned by root, readable by www-data
sudo chown -R root:www-data /var/www/html/
sudo find /var/www/html/ -type d -exec chmod 755 {} \;
sudo find /var/www/html/ -type f -exec chmod 644 {} \;

# Upload directory writable by app
sudo chown www-data:www-data /var/www/html/uploads/
sudo chmod 755 /var/www/html/uploads/
```

### 🔹 Scenario 2: Hardening SSH Key Permissions

```bash
# Wrong permissions cause SSH to refuse the key
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/authorized_keys
chmod 644 ~/.ssh/config
chmod 644 ~/.ssh/known_hosts

# On server — authorized_keys must be owned by the user
chown -R $USER:$USER ~/.ssh
```

### 🔹 Scenario 3: Application Runtime Permissions

```bash
# Systemd service runs as 'appuser' — needs access to logs and config
sudo chown -R appuser:appuser /opt/app /var/log/app /run/app
sudo chmod 750 /opt/app
sudo chmod 770 /var/log/app
sudo chmod 640 /etc/app/secrets.conf

# App user needs to bind to port 443
# Instead of running as root, use capabilities
sudo setcap 'cap_net_bind_service=+ep' /opt/app/bin/server
getcap /opt/app/bin/server
```

### 🔹 Scenario 4: Permission Audit Script

```bash
#!/bin/bash
# Audit world-writable files and SUID binaries

echo "=== World-Writable Files ==="
find /etc /opt /var/www -perm -o+w -type f 2>/dev/null

echo "=== SUID Binaries ==="
find / -perm -4000 -type f 2>/dev/null | sort

echo "=== SGID Binaries ==="
find / -perm -2000 -type f 2>/dev/null | sort

echo "=== Files with No Owner ==="
find / -nouser -o -nogroup 2>/dev/null | sort

echo "=== Unprotected Private Keys ==="
find /home /root -name "*.pem" -o -name "id_rsa" -o -name "*.key" 2>/dev/null \
  | while read f; do
      perm=$(stat -c %a "$f")
      if [ "$perm" != "600" ]; then
        echo "WARN: $f has permissions $perm (should be 600)"
      fi
    done
```

______________________________________________________________________

## 📌 Summary Table

| Command | Purpose |
|---------|---------|
| `chmod 755 file` | rwxr-xr-x (executable) |
| `chmod 644 file` | rw-r--r-- (readable) |
| `chmod 600 file` | rw------- (private) |
| `chmod -R 755 dir/` | Recursive permission change |
| `chown user:group file` | Change owner and group |
| `chown -R user /dir` | Recursive ownership change |
| `umask 027` | New files = 640, dirs = 750 |
| `chmod g+s /dir` | SGID — inherit group |
| `chmod +t /dir` | Sticky bit — protect files |
| `getfacl file` | Show ACL entries |
| `setfacl -m u:user:rwx` | Grant ACL to user |
| `sudo visudo` | Edit sudoers safely |
| `sudo -l` | List your sudo permissions |

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
