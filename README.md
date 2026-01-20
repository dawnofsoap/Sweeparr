# Sweeparr

**Sweep away old, unwatched, and unwanted media from your library.**

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Docker](https://img.shields.io/badge/Docker-Coming%20Soon-blue?logo=docker)](https://hub.docker.com)

---

## 🚧 Coming Soon

Sweeparr is a containerized media library cleanup application with a modern web GUI inspired by Radarr and Sonarr. It helps manage and clean up media libraries by identifying and removing unwatched, unwanted, or stale content based on configurable rules.

### Planned Features

- 🎨 **Modern Web GUI** — Radarr/Sonarr-style interface with dark theme
- 🎯 **Visual Rule Builder** — Drag-and-drop rule creation with AND/OR logic
- 📺 **Jellyfin & Emby Support** — Primary focus on non-Plex media servers
- 🔗 **\*arr Integration** — Connect to Radarr, Sonarr, and more
- 📊 **Statistics Integration** — Jellystat, Tautulli support for watch history
- 🗑️ **"Leaving Soon" Collections** — Warn users before media removal
- 🛡️ **Safety First** — Dry-run mode, grace periods, and undo capabilities
- 🐳 **Docker-First** — Built for containerized deployments

### Why Sweeparr?

| Feature | Maintainerr | Janitorr | Sweeparr |
|---------|:-----------:|:--------:|:--------:|
| Modern Web GUI | ✅ | ❌ | ✅ |
| Jellyfin/Emby | ❌ | ✅ | ✅ |
| Plex | ✅ | ❌ | 🔜 |
| Visual Rule Builder | ✅ | ❌ | ✅ |
| Disk Space Awareness | ❌ | ✅ | ✅ |

### Similar Projects

- [Maintainerr](https://github.com/jorenn92/Maintainerr) — Plex-focused media cleanup with polished UI
- [Janitorr](https://github.com/Schaka/janitorr) — Jellyfin/Emby cleanup via YAML configuration

Sweeparr aims to bring a modern GUI experience to Jellyfin and Emby users.

---

## Tech Stack

- **Backend:** Node.js / TypeScript
- **Frontend:** React / TailwindCSS
- **Database:** SQLite (PostgreSQL optional)
- **Deployment:** Docker

---

## Status

🔨 **In Development** — Not yet ready for use.

Star the repo to follow progress!

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
