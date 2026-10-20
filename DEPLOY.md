# Putting PackDraft online (Oracle Cloud free server)

PackDraft runs on a free Oracle Cloud server, always on, at an HTTPS address you can share with your friends. The code
lives on GitHub; every push to `main` goes live by itself in a couple of minutes. Your database (accounts, PINs,
leagues, teams, logos, Pack Points, slabs, chat) lives only on the server, never in GitHub.

## 1. GitHub repo (5 minutes)

1. On github.com, create a **new private repository** (no README, no .gitignore). Copy its SSH or HTTPS URL.
2. Send the URL to Claude. It adds it as `origin` and pushes the code.

## 2. Oracle Cloud server (15 minutes)

1. Sign up at <https://www.oracle.com/cloud/free/>. They ask for a card to verify you; the Always Free tier doesn't charge it.
   Pick a home region close to you (it can't be changed later).
2. Console > **Compute > Instances > Create instance**:
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Ampere VM.Standard.A1.Flex**, 2 OCPUs and 12 GB memory (inside the free allowance). If Ampere is out of
     capacity in your region, try again later or pick another availability domain; the tiny AMD shape (1 GB) is too
     small to build the app.
   - SSH keys: "Generate a key pair for me", and **download the private key** (or paste your own public key).
   - Create. Copy the instance's **public IP address**.
3. Open the web ports: on the instance page, click its **subnet > Default security list > Add ingress rules**:
   source `0.0.0.0/0`, TCP, destination ports `80,443`.

## 3. Set the server up (10 minutes)

From your Mac's Terminal (replace the key path and IP):

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<IP>
```

On the server, run the setup script with your repo URL and a domain. A free domain that works with HTTPS right away is
your IP with dashes plus `.sslip.io`, for example `129-146-12-34.sslip.io`:

```bash
curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/setup-server.sh -o setup.sh   # public repos
# for a private repo, paste deploy/setup-server.sh into setup.sh with nano instead
bash setup.sh git@github.com:<you>/<repo>.git <IP-with-dashes>.sslip.io
```

It pauses once to show a **deploy key**: add it in GitHub (repo Settings > Deploy keys > Add deploy key), press Enter.
When it finishes, `https://<IP-with-dashes>.sslip.io` shows PackDraft (empty until step 4).

## 4. Move your data over (2 minutes)

Back on your Mac, in the PackDraft folder:

```bash
bash deploy/push-data.sh ubuntu@<IP>
```

(Add `-i` key options to `~/.ssh/config` first, or run `ssh-add ~/Downloads/ssh-key-*.key`.) This copies every account
and PIN, league and team settings, logos, Pack Points, slabs, chat and uploads, plus the login secret so nobody has to
sign in again. From then on the server is the real copy: use the live site, not `localhost`.

## 5. Auto-deploy on push (5 minutes)

1. Make a key just for GitHub, on your Mac: `ssh-keygen -t ed25519 -N "" -f ~/.ssh/packdraft_deploy`
2. Put its public half on the server: `ssh-copy-id -i ~/.ssh/packdraft_deploy.pub ubuntu@<IP>`
3. In GitHub: repo **Settings > Secrets and variables > Actions > New repository secret**, add:
   - `ORACLE_HOST`: the server IP
   - `ORACLE_USER`: `ubuntu`
   - `ORACLE_SSH_KEY`: the whole contents of `~/.ssh/packdraft_deploy` (the private key)

Now every push to `main` runs `.github/workflows/deploy.yml`: it backs up the database, pulls the code, builds and
restarts. Watch it under the repo's **Actions** tab. To deploy by hand: `ssh ubuntu@<IP> bash /opt/packdraft/deploy/deploy.sh`.

## Day to day

- Logs: `ssh ubuntu@<IP> journalctl -u packdraft -f`
- Restart: `ssh ubuntu@<IP> sudo systemctl restart packdraft`
- Backups: every deploy keeps a copy of the database in `/opt/packdraft/data.nosync/backups` (last 14).
  Pull one to your Mac: `scp ubuntu@<IP>:/opt/packdraft/data.nosync/packdraft-nba.db ~/Desktop/`
- Oracle may reclaim Always Free instances that sit nearly idle for a long time; PackDraft's background ESPN sync keeps it busy enough.
