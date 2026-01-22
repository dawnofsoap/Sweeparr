# Sweeparr

**Sweep away old, unwatched, and unwanted media from your library.**

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Docker](https://img.shields.io/badge/Docker-Available-blue?logo=docker)](https://github.com/dawnofsoap/Sweeparr/pkgs/container/sweeparr)

---

## ⚠️ Development Alpha

**This is an early development release for testing purposes.** Features are incomplete, bugs are expected, and breaking changes will occur. Use at your own risk and do not rely on this for production media management yet.

---

## Overview

Sweeparr is a containerized media library cleanup automation application with a modern web GUI inspired by Radarr and Sonarr. It helps manage and clean up media libraries by identifying and removing unwatched, unwanted, or stale content based on configurable rules.

### Why Sweeparr?

| Feature | Maintainerr | Janitorr | Sweeparr |
|---------|:-----------:|:--------:|:--------:|
| Modern Web GUI | ✅ | ❌ | ✅ |
| Jellyfin/Emby Support | ❌ | ✅ | ✅ |
| Plex Support | ✅ | ❌ | 🔜 |
| Visual Rule Builder | ✅ | ❌ | ✅ |
| Disk Space Awareness | ❌ | ✅ | ✅ |
| TrueNAS Integration | ❌ | ❌ | ✅ |

### Similar Projects

- [Maintainerr](https://github.com/jorenn92/Maintainerr) — Plex-focused media cleanup with polished UI
- [Janitorr](https://github.com/Schaka/janitorr) — Jellyfin/Emby cleanup via YAML configuration

Sweeparr aims to bring a modern GUI experience to Jellyfin and Emby users.

---

## Quick Start

### 1. Create Configuration Files

```bash
# Create directory
mkdir sweeparr && cd sweeparr

# Download example files
curl -O https://raw.githubusercontent.com/dawnofsoap/Sweeparr/development-alpha/docker-compose.example.yml
curl -O https://raw.githubusercontent.com/dawnofsoap/Sweeparr/development-alpha/.env.example

# Copy to active files
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` and adjust settings for your setup:

```bash
# Minimum required changes:
SWEEPARR_PORT=8484
TZ=America/Chicago
CONFIG_PATH=./config
```

### 3. Start Container

```bash
docker-compose up -d
```

### 4. Access Web UI

Open `http://localhost:8484` in your browser.

---

## Configuration

All configuration is managed through environment variables in your `.env` file.

### Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `SWEEPARR_VERSION` | No | `development-alpha` | Docker image tag |
| `SWEEPARR_PORT` | No | `8484` | Web UI port |
| `TZ` | No | `America/Chicago` | Timezone for scheduled tasks and logs |
| `PUID` | No | `1000` | User ID for file permissions |
| `PGID` | No | `1000` | Group ID for file permissions |
| `CONFIG_PATH` | **Yes** | `./config` | Configuration and database storage |
| `LOG_PATH` | No | `./logs` | Application logs |
| `LEAVING_SOON_PATH` | For Leaving Soon | `./leaving-soon` | Symlink destination directory |
| `MEDIA_MOVIES_PATH` | No | — | Movies library path (read-only recommended) |
| `MEDIA_TV_PATH` | No | — | TV library path (read-only recommended) |

### Volume Mounts

| Container Path | Host Variable | Mode | Description |
|----------------|---------------|:----:|-------------|
| `/config` | `CONFIG_PATH` | RW | Configuration files and SQLite database |
| `/logs` | `LOG_PATH` | RW | Application logs |
| `/data/leaving-soon` | `LEAVING_SOON_PATH` | RW | Symlink destination for "Leaving Soon" libraries |
| `/data/media/movies` | `MEDIA_MOVIES_PATH` | RO | Movies library access |
| `/data/media/tv` | `MEDIA_TV_PATH` | RO | TV library access |

### Example .env Configurations

#### Minimal Setup

```bash
SWEEPARR_PORT=8484
TZ=America/Chicago
CONFIG_PATH=./config
```

#### TrueNAS Scale

```bash
SWEEPARR_VERSION=development-alpha
SWEEPARR_PORT=8484
TZ=America/Chicago
PUID=568
PGID=568
CONFIG_PATH=/mnt/tank/apps/sweeparr/config
LOG_PATH=/mnt/tank/apps/sweeparr/logs
LEAVING_SOON_PATH=/mnt/tank/media/leaving-soon
MEDIA_MOVIES_PATH=/mnt/tank/media/movies
MEDIA_TV_PATH=/mnt/tank/media/tv
```

#### Unraid

```bash
SWEEPARR_VERSION=development-alpha
SWEEPARR_PORT=8484
TZ=America/Chicago
PUID=99
PGID=100
CONFIG_PATH=/mnt/user/appdata/sweeparr/config
LOG_PATH=/mnt/user/appdata/sweeparr/logs
LEAVING_SOON_PATH=/mnt/user/media/leaving-soon
MEDIA_MOVIES_PATH=/mnt/user/media/movies
MEDIA_TV_PATH=/mnt/user/media/tv
```

---

## Path Mapping

Sweeparr uses path mappings to translate file paths between different applications. This is essential when containers mount the same physical storage at different paths.

### Understanding Path Mappings

```
Physical Storage: /mnt/tank/media/movies
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
  Radarr             Sweeparr            Jellyfin
  /movies      /data/media/movies      /media/movies
```

### Configuration

Path mappings are configured in the Sweeparr UI under **Settings → Connections**.

#### Arr Apps (Radarr/Sonarr)

Map how Radarr/Sonarr paths translate to Sweeparr paths:

| Arr Path | → | Local Path |
|----------|---|------------|
| `/movies` | → | `/data/media/movies` |
| `/tv` | → | `/data/media/tv` |

#### Media Servers (Jellyfin/Emby)

Map how Sweeparr paths translate to media server paths:

| Local Path | → | Media Server Path |
|------------|---|-------------------|
| `/data/media/movies` | → | `/media/movies` |
| `/data/media/tv` | → | `/media/tv` |

### Leaving Soon Libraries

Configure symlink paths for "Leaving Soon" functionality:

| Setting | Example |
|---------|---------|
| Movies Local Path | `/data/leaving-soon/Movies` |
| Movies Media Path | `/leaving-soon/Movies` |
| TV Local Path | `/data/leaving-soon/TV` |
| TV Media Path | `/leaving-soon/TV` |

---

## Current Features

### ✅ Working

- **Web GUI** — Modern dark-themed interface inspired by Radarr/Sonarr
- **Arr Integration** — Connect multiple Radarr and Sonarr instances
- **Media Server Integration** — Jellyfin and Emby support with library detection
- **Path Mappings** — Centralized configuration for multi-container setups
- **TrueNAS Storage Monitoring** — WebSocket API integration for ZFS pool/dataset monitoring
- **Leaving Soon** — Symlink-based libraries with automatic sync
- **Rule Builder** — Visual rule creation with conditions and logic operators
- **Rule Preview** — Preview which media items match rules before executing
- **Scheduled Tasks** — Configurable task scheduling with cron expressions
- **Real-time Logging** — Live log streaming in the UI
- **Statistics Services** — Jellystat integration for watch history

### 🚧 In Progress

- Rule execution actions (delete, unmonitor, tag)
- Preset rule templates
- Collection management
- Notification services (Discord, Telegram, etc.)

### 🔜 Planned

- Plex support
- Tautulli integration
- Community rule sharing
- Backup/restore functionality

---

## Tech Stack

- **Backend:** Node.js / TypeScript / Express
- **Frontend:** React / TailwindCSS / Vite
- **Database:** SQLite (via Prisma ORM)
- **Container:** Docker (Alpine-based)

---

## API

Sweeparr provides a REST API at `/api/v1/`:

| Endpoint | Description |
|----------|-------------|
| `/api/v1/health` | Health check |
| `/api/v1/setup` | Initial setup status |
| `/api/v1/settings` | Application settings |
| `/api/v1/media-servers` | Media server connections |
| `/api/v1/arr` | Radarr/Sonarr connections |
| `/api/v1/rules` | Rule management |
| `/api/v1/collections` | Collection management |
| `/api/v1/storage-sources` | Storage monitoring |
| `/api/v1/leaving-soon` | Leaving Soon sync |
| `/api/v1/path-mappings` | Path mapping configuration |
| `/api/v1/system` | System info and logs |

---

## Troubleshooting

### Container won't start

Check logs:
```bash
docker logs sweeparr
```

Verify volume permissions:
```bash
ls -la /path/to/config
```

### Can't connect to Radarr/Sonarr

- Ensure the URL is accessible from the container (use container names if on same Docker network)
- Verify API key is correct (Settings → General → API Key in Radarr/Sonarr)
- Check if firewall rules allow container-to-container communication

### Path mappings not working

- Verify all paths exist and are mounted correctly in each container
- Use the "Test Connection" feature in Settings to validate paths
- Check that symlink permissions allow creation in the Leaving Soon directory

### TrueNAS connection issues

- Sweeparr uses WebSocket API (requires TrueNAS SCALE)
- API key must have "Readonly Admin" privileges minimum
- Ensure SSL settings match your TrueNAS configuration

---

## Contributing

This project is in early development. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

---

## Links

- **Repository:** [github.com/dawnofsoap/Sweeparr](https://github.com/dawnofsoap/Sweeparr)
- **Issues:** [github.com/dawnofsoap/Sweeparr/issues](https://github.com/dawnofsoap/Sweeparr/issues)
