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

### Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
services:
  sweeparr:
    image: ghcr.io/dawnofsoap/sweeparr:development-alpha
    container_name: sweeparr
    restart: unless-stopped
    ports:
      - "8484:8080"
    environment:
      - TZ=America/Chicago
    volumes:
      # Required: Config and database storage
      - /path/to/config:/config
      
      # Optional: Log storage
      - /path/to/logs:/logs
      
      # Required for Leaving Soon: Symlink destination (READ-WRITE)
      - /path/to/leaving-soon:/data/leaving-soon
      
      # Optional: Media access for direct file operations (READ-ONLY recommended)
      # - /path/to/movies:/data/media/movies:ro
      # - /path/to/tv:/data/media/tv:ro
```

Start the container:

```bash
docker-compose up -d
```

Access the web UI at `http://localhost:8484`

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `TZ` | No | `America/Chicago` | Timezone for scheduled tasks and logs |
| `PUID` | No | `1000` | User ID for file permissions |
| `PGID` | No | `1000` | Group ID for file permissions |
| `PORT` | No | `8080` | Internal container port (rarely needs changing) |
| `NODE_ENV` | No | `production` | Environment mode |
| `DATABASE_URL` | No | `file:/config/sweeparr.db` | SQLite database path |

### Volume Mounts

| Container Path | Required | Mode | Description |
|----------------|:--------:|:----:|-------------|
| `/config` | **Yes** | RW | Configuration files and SQLite database |
| `/logs` | No | RW | Application logs |
| `/data/leaving-soon` | For Leaving Soon | RW | Symlink destination for "Leaving Soon" libraries |
| `/data/media/*` | No | RO | Media file access (if needed for direct operations) |

### Docker Compose Examples

#### Minimal Setup

```yaml
services:
  sweeparr:
    image: ghcr.io/dawnofsoap/sweeparr:development-alpha
    container_name: sweeparr
    restart: unless-stopped
    ports:
      - "8484:8080"
    environment:
      - TZ=America/Chicago
    volumes:
      - ./config:/config
```

#### Full Setup with Leaving Soon

```yaml
services:
  sweeparr:
    image: ghcr.io/dawnofsoap/sweeparr:development-alpha
    container_name: sweeparr
    restart: unless-stopped
    ports:
      - "8484:8080"
    environment:
      # Required
      - TZ=America/Chicago
      
      # Optional: File permissions (match your media stack)
      - PUID=1000
      - PGID=1000
    volumes:
      # Required: Config and database
      - /opt/sweeparr/config:/config
      
      # Optional: Logs
      - /opt/sweeparr/logs:/logs
      
      # Leaving Soon symlink destinations (READ-WRITE)
      - /mnt/media/leaving-soon:/data/leaving-soon
      
      # Media libraries (READ-ONLY for safety)
      - /mnt/media/movies:/data/media/movies:ro
      - /mnt/media/tv:/data/media/tv:ro
```

#### TrueNAS Scale Setup

```yaml
services:
  sweeparr:
    image: ghcr.io/dawnofsoap/sweeparr:development-alpha
    container_name: sweeparr
    restart: unless-stopped
    ports:
      - "8484:8080"
    environment:
      - TZ=America/Chicago
      - PUID=568    # apps user on TrueNAS
      - PGID=568    # apps group on TrueNAS
    volumes:
      # Config on app dataset
      - /mnt/tank/apps/sweeparr/config:/config
      - /mnt/tank/apps/sweeparr/logs:/logs
      
      # Media access (READ-ONLY)
      - /mnt/tank/media/movies:/data/media/movies:ro
      - /mnt/tank/media/tv:/data/media/tv:ro
      
      # Leaving Soon (READ-WRITE for symlinks)
      - /mnt/tank/media/leaving-soon:/data/leaving-soon
```

#### Integration with Existing Media Stack

```yaml
services:
  sweeparr:
    image: ghcr.io/dawnofsoap/sweeparr:development-alpha
    container_name: sweeparr
    restart: unless-stopped
    ports:
      - "8484:8080"
    environment:
      - TZ=America/Chicago
    volumes:
      - sweeparr-config:/config
      - sweeparr-logs:/logs
      - /mnt/media/leaving-soon:/data/leaving-soon
    networks:
      - media-network
    depends_on:
      - jellyfin
      - radarr
      - sonarr

  # Your existing services...
  jellyfin:
    image: jellyfin/jellyfin:latest
    # ... jellyfin config

  radarr:
    image: linuxserver/radarr:latest
    # ... radarr config

  sonarr:
    image: linuxserver/sonarr:latest
    # ... sonarr config

volumes:
  sweeparr-config:
  sweeparr-logs:

networks:
  media-network:
    driver: bridge
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

Path mappings are configured in the Sweeparr UI under **Settings → Path Mappings**.

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

- Ensure the URL is accessible from the container (use container names if on same network)
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
