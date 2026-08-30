#!/bin/sh
set -eu
: "${ASTERISK_SIP_SECRET:?ASTERISK_SIP_SECRET is required}"
: "${ASTERISK_ARI_SECRET:?ASTERISK_ARI_SECRET is required}"
install -d -o asterisk -g asterisk -m 0750 /etc/asterisk /var/run/asterisk /var/log/asterisk /var/spool/asterisk /var/cache/asterisk /var/lib/asterisk
for source in /opt/asterisk-template/*.conf; do
  target="/etc/asterisk/$(basename "$source")"
  envsubst < "$source" > "$target"
  chown asterisk:asterisk "$target"
  chmod 0640 "$target"
done
chown -R asterisk:asterisk /var/run/asterisk /var/log/asterisk /var/spool/asterisk /var/cache/asterisk /var/lib/asterisk
exec /usr/sbin/asterisk -f -U asterisk -G asterisk
