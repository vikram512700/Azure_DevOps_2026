# 🐧 01 — Linux Basics

## 📌 1. Linux Filesystem Hierarchy

```
/                   Root of everything
├── bin/            Essential binaries (ls, cp, mv) — symlink to /usr/bin on modern distros
├── sbin/           System binaries (fdisk, ifconfig) — symlink to /usr/sbin
├── etc/            Configuration files (nginx, ssh, fstab)
├── home/           User home directories (/home/vikram)
├── root/           Root user's home
├── var/            Variable data: logs (/var/log), spool, cache
├── tmp/            Temporary files (cleared on reboot)
├── usr/            User programs and libraries
│   ├── bin/        User commands
│   ├── lib/        Libraries
│   └── local/      Locally installed software
├── opt/            Optional/third-party software (Splunk, Oracle)
├── proc/           Virtual FS — kernel and process info (/proc/cpuinfo)
├── sys/            Virtual FS — hardware/kernel devices
├── dev/            Device files (disks, terminals)
├── mnt/            Temporary mount points
├── media/          Removable media mounts
├── boot/           Kernel and bootloader (vmlinuz, grub)
├── lib/            Shared libraries (symlink to /usr/lib)
└── run/            Runtime data (PIDs, sockets) — cleared on reboot
```

______________________________________________________________________

## 📌 2. Navigation

```bash
# Where am I?
pwd

# List files
ls                      # basic
ls -l                   # long format
ls -lh                  # human-readable sizes
ls -la                  # include hidden files
ls -lt                  # sort by modification time (newest first)
ls -lS                  # sort by size (largest first)
ls -lR                  # recursive
ls -1                   # one file per line

# Change directory
cd /etc/nginx           # absolute path
cd ..                   # one level up
cd ../..                # two levels up
cd ~                    # home directory
cd -                    # previous directory (toggle)
cd $HOME                # same as ~

# Tree view (install: apt install tree)
tree                    # current dir
tree -L 2               # max 2 levels deep
tree -a                 # include hidden
tree -d                 # directories only
tree -h                 # human-readable sizes

# Print path of a command
which nginx
which python3
whereis nginx           # binary, man page, source
type ls                 # shows if alias/builtin/binary
```

______________________________________________________________________

## 📌 3. File Operations

```bash
# Create files
touch app.log           # create empty / update timestamp
touch file{1..5}.txt    # create file1.txt through file5.txt

# Create directories
mkdir logs
mkdir -p /opt/app/config/certs     # create full path (-p = parents)
mkdir -p project/{src,tests,docs}  # create multiple subdirs

# Copy
cp file.txt backup.txt
cp -r src/ dst/                   # recursive (directories)
cp -p file.txt /backup/           # preserve permissions, timestamps
cp -u src/* dst/                  # copy only newer files
cp -v file.txt /backup/           # verbose

# Move / Rename
mv old.txt new.txt                # rename
mv file.txt /var/app/             # move
mv -i file.txt /var/app/          # prompt before overwrite
mv -n file.txt /var/app/          # never overwrite

# Delete
rm file.txt
rm -r directory/                  # recursive (directories)
rm -f file.txt                    # force (no prompt)
rm -rf /tmp/build/                # force recursive (USE WITH CAUTION)
rm -i file.txt                    # interactive (prompt)

# Safe delete alias (recommended for production)
alias rm='rm -i'

# Links
ln target.txt hardlink.txt        # hard link
ln -s /opt/app/bin/start.sh /usr/local/bin/start  # symbolic link
readlink -f symlink               # resolve symlink to real path
```

### 🔹 Real-Time Scenario: Setting up application directory structure

```bash
APP="payment-service"
VERSION="2.4.1"

# Create structured app directories
sudo mkdir -p /opt/${APP}/{bin,config,logs,data,tmp}
sudo mkdir -p /etc/${APP}
sudo mkdir -p /var/log/${APP}

# Create versioned deploy and symlink
sudo mkdir -p /opt/${APP}/releases/${VERSION}
sudo ln -sfn /opt/${APP}/releases/${VERSION} /opt/${APP}/current

# Set ownership
sudo chown -R appuser:appgroup /opt/${APP}
sudo chown -R appuser:appgroup /var/log/${APP}

ls -la /opt/${APP}/
```

______________________________________________________________________

## 📌 4. Viewing and Editing Files

```bash
# View entire file
cat file.txt
cat -n file.txt           # with line numbers
cat -A file.txt           # show special characters (tabs ^I, line endings $)

# View with paging
less file.txt             # scroll forward/backward, search with /
more file.txt             # scroll forward only

# less navigation:
# Space / f    = page forward
# b            = page backward
# /pattern     = search forward
# n / N        = next/previous match
# G            = end of file
# g            = beginning
# q            = quit

# View parts of files
head file.txt             # first 10 lines
head -n 20 file.txt       # first 20 lines
tail file.txt             # last 10 lines
tail -n 20 file.txt       # last 20 lines
tail -f /var/log/app.log  # follow (live stream)
tail -F /var/log/app.log  # follow + reopen if rotated (for log rotation)

# View binary files
xxd file.bin | head
od -c file.bin | head

# Edit files
nano file.txt             # beginner-friendly
vim file.txt              # powerful (production standard)
vi file.txt               # minimal vim

# vim essentials:
# i         insert mode
# Esc       normal mode
# :w        save
# :q        quit
# :wq       save and quit
# :q!       quit without saving
# /pattern  search
# dd        delete line
# yy        yank (copy) line
# p         paste
# u         undo
# Ctrl+r    redo
# :%s/old/new/g   global replace
```

______________________________________________________________________

## 📌 5. Text Processing (DevOps Power Tools)

### 🔹 grep

```bash
# Search for pattern in file
grep "ERROR" /var/log/app.log
grep -i "error" /var/log/app.log          # case insensitive
grep -r "database_url" /etc/             # recursive search
grep -n "error" app.log                  # show line numbers
grep -c "ERROR" app.log                  # count matches
grep -v "DEBUG" app.log                  # invert (exclude matches)
grep -l "ERROR" /var/log/*.log           # show only filenames
grep -A 3 "ERROR" app.log               # 3 lines after match
grep -B 3 "ERROR" app.log               # 3 lines before match
grep -C 3 "ERROR" app.log               # 3 lines around match
grep -E "ERROR|WARN" app.log            # extended regex (OR)
grep -P "\d{3}-\d{4}" contacts.txt      # Perl regex

# Real DevOps use: find all failed requests in nginx log
grep '" 5[0-9][0-9] ' /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

### 🔹 awk

```bash
# Print specific column (field separator default = whitespace)
awk '{print $1}' file.txt         # print first column
awk '{print $1, $3}' file.txt     # print columns 1 and 3
awk -F: '{print $1}' /etc/passwd  # colon as delimiter → print usernames
awk -F, '{print $2}' data.csv     # CSV second column

# Filter rows
awk '$3 > 100 {print $0}' file.txt        # lines where col 3 > 100
awk '/ERROR/ {print $0}' app.log          # lines containing ERROR
awk 'NR==5,NR==10 {print}' file.txt       # lines 5 to 10

# Compute sum
awk '{sum += $4} END {print "Total:", sum}' access.log

# Print last field
awk '{print $NF}' file.txt

# Real DevOps use: extract unique IPs from nginx log
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20
```

### 🔹 sed

```bash
# Replace text (print to stdout)
sed 's/old/new/' file.txt          # first occurrence per line
sed 's/old/new/g' file.txt         # all occurrences
sed 's/old/new/gi' file.txt        # case insensitive

# Edit file in place
sed -i 's/old/new/g' file.txt
sed -i.bak 's/old/new/g' file.txt  # backup original as file.txt.bak

# Delete lines
sed '/pattern/d' file.txt          # delete lines matching pattern
sed '5d' file.txt                  # delete line 5
sed '5,10d' file.txt               # delete lines 5–10

# Print specific lines
sed -n '5,10p' file.txt            # print lines 5–10
sed -n '/start/,/end/p' file.txt   # print between patterns

# Real DevOps use: update config values
sed -i "s/^DB_HOST=.*/DB_HOST=prod-db.company.com/" /etc/app/.env
sed -i "s/^MAX_CONNECTIONS=.*/MAX_CONNECTIONS=200/" /etc/app/config.ini
```

### 🔹 sort, uniq, wc, cut

```bash
# Sort
sort file.txt                      # alphabetical
sort -n file.txt                   # numeric
sort -rn file.txt                  # reverse numeric
sort -k2 file.txt                  # sort by column 2
sort -t: -k3 -n /etc/passwd        # sort by UID (col 3, colon-delimited)
sort -u file.txt                   # sort and remove duplicates

# Unique
uniq file.txt                      # remove adjacent duplicates (sort first!)
uniq -c file.txt                   # count occurrences
uniq -d file.txt                   # only show duplicate lines

# Word/line count
wc -l file.txt                     # line count
wc -w file.txt                     # word count
wc -c file.txt                     # byte count

# Cut fields
cut -d: -f1 /etc/passwd            # usernames (field 1, colon delimiter)
cut -d, -f2,4 data.csv             # fields 2 and 4 from CSV
cut -c1-10 file.txt                # characters 1–10 of each line

# Pipeline: top 10 most common HTTP status codes
cut -d'"' -f3 /var/log/nginx/access.log \
  | awk '{print $1}' \
  | sort | uniq -c | sort -rn | head -10
```

### 🔹 tr, tee, xargs

```bash
# tr — translate/delete characters
tr 'a-z' 'A-Z' < file.txt          # uppercase
tr -d '\r' < windows.txt > unix.txt # remove carriage returns
tr -s ' ' < file.txt                # squeeze multiple spaces to one
echo "hello world" | tr ' ' '_'    # replace spaces with underscores

# tee — write to file AND stdout simultaneously
command | tee output.txt            # overwrite
command | tee -a output.txt         # append
make 2>&1 | tee build.log          # capture stdout + stderr

# xargs — build commands from input
cat file_list.txt | xargs rm        # delete all listed files
find . -name "*.log" | xargs gzip   # compress all log files
cat servers.txt | xargs -I {} ssh {} "systemctl restart nginx"  # run on each server
echo "1 2 3" | xargs -n1 echo       # one argument per invocation
find . -name "*.py" | xargs -P4 pylint  # parallel with 4 workers
```

______________________________________________________________________

## 📌 6. Finding Files

```bash
# find — recursive file search
find /var/log -name "*.log"                      # by name
find /etc -name "*.conf" -type f                 # files only
find /opt -type d -name "releases"               # directories only
find /home -user vikram                          # by owner
find /var -mtime -1                              # modified in last 1 day
find /tmp -mtime +7 -delete                      # delete files older than 7 days
find /opt/app -size +100M                        # files larger than 100MB
find . -perm 777                                 # files with 777 permissions
find . -name "*.sh" -exec chmod +x {} \;         # execute command on results
find . -name "*.log" | xargs grep "CRITICAL"     # grep inside found files
find /etc -name "sshd_config" 2>/dev/null        # suppress permission errors

# locate — fast find (uses database, may be stale)
locate nginx.conf
sudo updatedb                                    # update locate database

# which / whereis
which java
whereis nginx

# Real-Time Scenario: Find and archive logs older than 30 days
find /var/log/app -name "*.log" -mtime +30 -exec gzip {} \;
find /var/log/app -name "*.log.gz" -mtime +90 -delete
```

______________________________________________________________________

## 📌 7. Archiving and Compression

```bash
# tar — tape archive (most common in Linux)
tar -cvf  archive.tar  files/         # create
tar -xvf  archive.tar                 # extract
tar -tvf  archive.tar                 # list contents
tar -cvzf archive.tar.gz  files/      # create + gzip compress
tar -xvzf archive.tar.gz              # extract gzip
tar -cvjf archive.tar.bz2 files/      # create + bzip2 (smaller)
tar -xvjf archive.tar.bz2             # extract bzip2
tar -cvJf archive.tar.xz  files/      # create + xz (smallest)
tar -xvf  archive.tar -C /opt/        # extract to specific dir
tar -cvzf backup.tar.gz --exclude='.git' --exclude='node_modules' .

# gzip / gunzip
gzip file.txt                         # compress (replaces file with file.txt.gz)
gunzip file.txt.gz                    # decompress
gzip -k file.txt                      # keep original
gzip -9 file.txt                      # maximum compression
zcat file.txt.gz                      # view without extracting

# zip / unzip
zip archive.zip file1 file2
zip -r archive.zip directory/
unzip archive.zip
unzip archive.zip -d /target/dir/
unzip -l archive.zip                  # list contents

# Real DevOps Scenario: Daily backup script
BACKUP_DIR="/backup/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/app-config.tar.gz" \
  --exclude='*.log' \
  /etc/app/ /opt/app/config/
echo "Backup size: $(du -sh $BACKUP_DIR)"
```

______________________________________________________________________

## 📌 8. The Help System

```bash
# Manual pages
man ls
man -k "disk usage"          # search man pages by keyword
man 5 crontab                # section 5 (file formats)
# man sections: 1=commands, 2=syscalls, 3=lib, 4=devices, 5=files, 8=admin

# Built-in help
ls --help
git --help
curl --help all | less

# info pages (more detailed)
info coreutils

# tldr — simplified practical examples (install: npm i -g tldr)
tldr tar
tldr find
tldr awk

# apropos — search man page descriptions
apropos firewall
apropos "network interface"
```

______________________________________________________________________

## 📌 Summary Table

| Command | Purpose |
|---------|---------|
| `pwd` | Current directory |
| `ls -lah` | List with details + hidden + human sizes |
| `cd -` | Toggle to previous directory |
| `mkdir -p path/to/dir` | Create full path |
| `cp -rp src/ dst/` | Copy recursive + preserve |
| `ln -s target link` | Create symlink |
| `tail -F app.log` | Follow log with rotation |
| `grep -r "pattern" .` | Recursive search |
| `awk -F: '{print $1}'` | Extract field with delimiter |
| `sed -i 's/old/new/g'` | In-place replace |
| `find / -name "*.conf"` | Find files by name |
| `tar -czf out.tar.gz dir/` | Compress directory |

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
