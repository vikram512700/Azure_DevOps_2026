# 06 — Storage & Filesystem Management

## 1. Disk Usage and Space

```bash
# Disk space by filesystem
df -h                         # human-readable (GB/MB)
df -H                         # powers of 1000 instead of 1024
df -i                         # inode usage
df -T                         # include filesystem type
df -h /var                    # specific mount point

# Directory / file sizes
du -sh /var/log               # total size of directory
du -sh *                      # size of each item in current dir
du -sh /opt/* | sort -h       # sorted by size
du -h --max-depth=1 /var      # one level deep
du -h --max-depth=2 /         # two levels from root

# Find top 10 largest directories
du -h / 2>/dev/null | sort -rh | head -10

# Find top 10 largest files
find / -type f -exec du -h {} + 2>/dev/null | sort -rh | head -10

# Quick disk full diagnosis
df -h                         # which partition is full?
du -sh /var/log/*             # which logs are huge?
du -sh /home/*                # which users?
find /var/log -name "*.log" -size +100M  # log files > 100MB

# Real-Time Scenario: Disk is 95% full in production
df -h                         # identify full partition
du -sh /var/log/* | sort -h   # find the culprit
find /var/log -name "*.log" -mtime +30 | xargs gzip   # compress old logs
journalctl --vacuum-size=500M  # trim systemd journal
find /tmp -mtime +7 -delete    # clear old tmp files
docker system prune -a         # clear unused Docker images/containers
```

______________________________________________________________________

## 2. Block Devices and Partition Info

```bash
# List all block devices
lsblk
lsblk -f                      # with filesystem type and UUID
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,UUID

# Detailed disk info
sudo fdisk -l                  # list all disks and partitions
sudo fdisk -l /dev/sda         # specific disk

# Partition table
sudo parted /dev/sda print
sudo parted -l                 # all disks

# Disk model, size, speed
sudo hdparm -I /dev/sda        # IDE/ATA
sudo smartctl -i /dev/sda      # SMART info (install: smartmontools)
sudo smartctl -a /dev/sda      # SMART health report

# Identify device type
cat /sys/block/sda/queue/rotational   # 0=SSD, 1=HDD

# UUID of devices
blkid
blkid /dev/sda1
```

______________________________________________________________________

## 3. Partitioning with fdisk / parted

```bash
# fdisk — MBR/GPT partitioning (interactive)
sudo fdisk /dev/sdb
# n = new partition
# p = primary
# w = write changes
# q = quit without saving
# d = delete partition
# l = list partition types
# t = change type (82=swap, 83=Linux, 8e=LVM)

# parted — GPT + scriptable
sudo parted /dev/sdb -- mklabel gpt
sudo parted /dev/sdb -- mkpart primary ext4 1MiB 100%
sudo parted /dev/sdb -- set 1 lvm on         # mark as LVM

# Create filesystem on partition
sudo mkfs.ext4 /dev/sdb1
sudo mkfs.xfs  /dev/sdb1
sudo mkfs.xfs  -f /dev/sdb1   # force (already has FS)
sudo mkswap    /dev/sdb2       # create swap

# Real-Time Scenario: Add a new EBS volume to EC2
# After attaching EBS in AWS Console:
lsblk                               # identify new disk (e.g., /dev/xvdf or /dev/nvme1n1)
sudo mkfs.ext4 /dev/xvdf            # create filesystem
sudo mkdir -p /data
sudo mount /dev/xvdf /data

# Make it persistent (/etc/fstab)
sudo blkid /dev/xvdf                # get UUID
echo "UUID=xxxx-xxxx  /data  ext4  defaults,nofail  0  2" | sudo tee -a /etc/fstab
sudo mount -a                       # verify no errors
df -h /data
```

______________________________________________________________________

## 4. Mounting and /etc/fstab

```bash
# Mount manually
sudo mount /dev/sdb1 /mnt/data
sudo mount -t ext4 /dev/sdb1 /mnt/data
sudo mount -o ro /dev/sdb1 /mnt/data      # read-only
sudo mount -o remount,rw /mnt/data        # remount as rw

# Unmount
sudo umount /mnt/data
sudo umount -l /mnt/data          # lazy unmount (when busy)
sudo fuser -m /mnt/data           # who's using this mount?

# Mount all filesystems in /etc/fstab
sudo mount -a

# /etc/fstab format:
# <device> <mountpoint> <fstype> <options> <dump> <pass>
# UUID=xxx  /data  ext4  defaults,nofail  0  2
# UUID=xxx  swap   swap  sw               0  0

# Common mount options:
# defaults     = rw, suid, exec, auto, nouser, async
# noatime      = don't update access time (performance)
# nodiratime   = don't update dir access time
# nofail       = don't fail boot if device missing (cloud VMs)
# ro           = read-only
# rw           = read-write
# exec/noexec  = allow/deny script execution
# suid/nosuid  = allow/deny SUID bits
# user/nouser  = allow/deny user mounts

# View mounted filesystems
mount | column -t
cat /proc/mounts
findmnt                            # tree format
findmnt -t ext4,xfs               # filter by type
```

______________________________________________________________________

## 5. LVM — Logical Volume Manager

LVM adds a virtualization layer between disks and filesystems, enabling resizing, snapshots, and spanning disks.

```
Physical Disks → Physical Volumes (PV) → Volume Groups (VG) → Logical Volumes (LV) → Filesystem
```

```bash
# Step 1: Create Physical Volumes
sudo pvcreate /dev/sdb /dev/sdc
sudo pvdisplay
sudo pvs                           # compact view

# Step 2: Create Volume Group
sudo vgcreate data-vg /dev/sdb /dev/sdc
sudo vgdisplay
sudo vgs

# Step 3: Create Logical Volumes
sudo lvcreate -L 50G -n app-lv data-vg          # fixed size
sudo lvcreate -l 100%FREE -n logs-lv data-vg     # all remaining space
sudo lvdisplay
sudo lvs

# Step 4: Create filesystem on LV
sudo mkfs.xfs /dev/data-vg/app-lv
sudo mount /dev/data-vg/app-lv /opt/app

# Extend an LV (online — no downtime!)
sudo lvextend -L +20G /dev/data-vg/app-lv
sudo resize2fs /dev/data-vg/app-lv       # ext4
sudo xfs_growfs /opt/app                 # xfs (must be mounted)

# Extend VG by adding a disk
sudo pvcreate /dev/sdd
sudo vgextend data-vg /dev/sdd

# Reduce LV (DANGEROUS — backup first, ext4 only, must unmount)
sudo umount /opt/app
sudo e2fsck -f /dev/data-vg/app-lv
sudo resize2fs /dev/data-vg/app-lv 30G
sudo lvreduce -L 30G /dev/data-vg/app-lv

# LVM Snapshot (great for backups)
sudo lvcreate -L 5G -s -n app-lv-snap /dev/data-vg/app-lv
sudo mount -o ro /dev/data-vg/app-lv-snap /mnt/snapshot
# ... backup from /mnt/snapshot ...
sudo umount /mnt/snapshot
sudo lvremove /dev/data-vg/app-lv-snap
```

### Real-Time Scenario: Extend the root volume on an EC2 instance

```bash
# 1. Extend EBS volume in AWS Console (no downtime)
# 2. On the instance:
lsblk                              # see new disk size
sudo growpart /dev/nvme0n1 1       # grow partition 1 (growpart utility)
lsblk                              # verify partition is larger

# If ext4:
sudo resize2fs /dev/nvme0n1p1

# If xfs (Amazon Linux 2, default):
sudo xfs_growfs /

df -h /                            # verify expanded
```

______________________________________________________________________

## 6. Swap Management

```bash
# View swap
free -h
swapon --show
cat /proc/swaps

# Create a swap file (when no swap partition)
sudo fallocate -l 4G /swapfile     # create 4GB file
# OR: sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
sudo chmod 600 /swapfile           # secure it
sudo mkswap /swapfile              # format as swap
sudo swapon /swapfile              # enable

# Make persistent
echo "/swapfile  none  swap  sw  0  0" | sudo tee -a /etc/fstab

# Disable swap
sudo swapoff /swapfile
sudo swapoff -a                    # disable all swap

# Swappiness (0-100, lower = use swap less, default 60)
cat /proc/sys/vm/swappiness
sudo sysctl vm.swappiness=10

# Permanent swappiness
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

______________________________________________________________________

## 7. Filesystem Maintenance

```bash
# Check filesystem (must be unmounted or in read-only mode)
sudo fsck /dev/sdb1                  # auto-repair
sudo fsck -n /dev/sdb1               # dry run (no changes)
sudo e2fsck -f /dev/sdb1             # ext4 forced check

# Check ext4 info
sudo tune2fs -l /dev/sda1            # filesystem metadata
sudo tune2fs -c 30 /dev/sda1         # check every 30 mounts
sudo tune2fs -e remount-ro /dev/sda1 # remount ro on error

# XFS tools
sudo xfs_check /dev/sdb1             # check
sudo xfs_repair /dev/sdb1            # repair
sudo xfs_info /dev/sdb1              # info

# Disk performance test
sudo hdparm -Tt /dev/sda             # cached read speed
sudo dd if=/dev/zero of=/tmp/testfile bs=1G count=1 oflag=dsync   # write speed
sudo dd if=/tmp/testfile of=/dev/null bs=1G count=1               # read speed
sudo fio --name=random-write --ioengine=posixaio --rw=randwrite --bs=4k --numjobs=1 --size=1g --iodepth=1
```

______________________________________________________________________

## 8. NFS — Network File System

```bash
# Server setup
sudo apt install nfs-kernel-server
sudo mkdir -p /exports/shared
sudo chown nobody:nogroup /exports/shared

# /etc/exports
echo "/exports/shared 10.0.0.0/24(rw,sync,no_subtree_check)" | sudo tee -a /etc/exports
sudo exportfs -ra              # reload exports
sudo systemctl restart nfs-server
sudo showmount -e localhost    # verify

# Client mount
sudo apt install nfs-common
sudo mount -t nfs 10.0.1.10:/exports/shared /mnt/shared
echo "10.0.1.10:/exports/shared  /mnt/shared  nfs  defaults,nofail  0  0" | sudo tee -a /etc/fstab
```

______________________________________________________________________

## Summary Table

| Command | Purpose |
|---------|---------|
| `df -h` | Disk space by filesystem |
| `du -sh *` | Size of each item |
| `lsblk -f` | Block devices with FS type |
| `blkid` | UUIDs of devices |
| `sudo fdisk -l` | List all disks and partitions |
| `mkfs.ext4 /dev/sdb1` | Create ext4 filesystem |
| `sudo mount /dev/sdb1 /mnt` | Mount a partition |
| `sudo umount /mnt` | Unmount |
| `pvcreate / vgcreate / lvcreate` | LVM setup steps |
| `lvextend + resize2fs/xfs_growfs` | Extend LV online |
| `sudo swapon /swapfile` | Enable swap |
| `xfs_growfs /` | Grow XFS without unmount |
