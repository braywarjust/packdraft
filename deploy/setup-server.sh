#!/usr/bin/env bash
# One-time setup for a fresh Oracle Cloud "Always Free" Ubuntu server (24.04, Ampere or AMD).
# Run it on the server, as the default "ubuntu" user:
#
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/setup-server.sh -o setup.sh   (or paste it)
#   bash setup.sh git@github.com:<you>/<repo>.git <your-domain>
#
# <your-domain> can be a free sslip.io name made from the server's public IP, e.g. 129-146-12-34.sslip.io.
# It installs Node 24, Caddy (automatic HTTPS) and sqlite3, opens ports 80/443, clones the repo, builds the app and
# runs it as a systemd service that restarts on crash and on reboot.
set -euo pipefail
REPO="${1:?usage: setup-server.sh <git repo url> <domain>}"
DOMAIN="${2:?usage: setup-server.sh <git repo url> <domain>}"
APP=/opt/packdraft

echo "==> Packages"
sudo apt-get update -y
sudo apt-get install -y git curl sqlite3 debian-keyring debian-archive-keyring apt-transport-https netfilter-persistent
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt-get update -y && sudo apt-get install -y caddy

echo "==> Firewall (Oracle's Ubuntu images block everything but SSH by default)"
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport $p -m state --state NEW -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p tcp --dport $p -m state --state NEW -j ACCEPT
done
sudo netfilter-persistent save

echo "==> Deploy key for GitHub"
if [ ! -f ~/.ssh/id_ed25519 ]; then ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C "packdraft-server"; fi
ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
echo
echo "Add this key to your GitHub repo (Settings > Deploy keys > Add deploy key, read-only is fine):"
echo
cat ~/.ssh/id_ed25519.pub
echo
read -rp "Press Enter once the deploy key is added... "

echo "==> App"
sudo mkdir -p "$APP" && sudo chown "$USER" "$APP"
[ -d "$APP/.git" ] || git clone "$REPO" "$APP"
mkdir -p "$APP/data.nosync"   # the repo's data -> data.nosync link points here; the database lives in it
cd "$APP"
npm ci
npm run build

echo "==> Service"
sudo cp deploy/packdraft.service /etc/systemd/system/packdraft.service
sudo sed -i "s/__USER__/$USER/" /etc/systemd/system/packdraft.service
sudo systemctl daemon-reload
sudo systemctl enable --now packdraft
# Let the GitHub deploy (deploy.sh) restart the app without a password prompt.
echo "$USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart packdraft, /usr/bin/systemctl stop packdraft, /usr/bin/systemctl start packdraft" | sudo tee /etc/sudoers.d/packdraft >/dev/null

echo "==> HTTPS"
sed "s/__DOMAIN__/$DOMAIN/" deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy

echo
echo "Done. PackDraft is starting at https://$DOMAIN"
echo "Next: copy your data over from your Mac with deploy/push-data.sh (see DEPLOY.md)."
