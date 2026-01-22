# Sweeparr: Features & Rules Specification

## Project Overview

A containerized media library cleanup application with a modern web GUI similar to Radarr/Sonarr. This application helps manage and clean up media libraries by identifying and removing unwatched, unwanted, or stale content based on configurable rules.

---

## Competitive Analysis

### Maintainerr (Plex-focused)
- **Strengths**: Polished Overseerr-style UI, sophisticated rule builder, Plex collection integration, "Leaving Soon" collections, community rule sharing
- **Weaknesses**: Plex-only ecosystem, no Jellyfin/Emby support
- **Tech Stack**: Node.js, TypeScript, React frontend

### Janitorr (Jellyfin/Emby-focused)
- **Strengths**: Disk space-aware deletion, tag-based schedules, Jellystat integration, season-by-season removal, lightweight
- **Weaknesses**: No GUI (YAML config only), configuration-heavy, limited rule flexibility
- **Tech Stack**: Kotlin, Spring Boot, JVM/Native images

### Gap Analysis - Our Opportunity
| Feature | Maintainerr | Janitorr | Our App |
|---------|-------------|----------|---------|
| Modern Web GUI | ✅ | ❌ | ✅ |
| Plex Support | ✅ | ❌ | ✅ |
| Jellyfin/Emby Support | ❌ | ✅ | ✅ |
| Visual Rule Builder | ✅ | ❌ | ✅ |
| Disk Space Awareness | ❌ | ✅ | ✅ |
| Multiple *arr Instances | ✅ | ✅ | ✅ |
| Dry-Run Mode | Limited | ✅ | ✅ |
| API-First Design | Limited | ❌ | ✅ |

---

## Core Features

### 1. Integration Support

#### Media Servers (Primary Focus: Jellyfin/Emby)
- [ ] Jellyfin ⭐ (Primary)
- [ ] Emby ⭐ (Primary)
- [ ] Plex Media Server (Future consideration)

#### *arr Applications
- [ ] Radarr (movies) - multiple instance support
- [ ] Sonarr (TV shows) - multiple instance support
- [ ] Lidarr (music) - future consideration

#### Request Management
- [ ] Overseerr
- [ ] Jellyseerr
- [ ] Ombi (future consideration)

#### Statistics/History Tracking
- [ ] Tautulli (Plex)
- [ ] Jellystat (Jellyfin)
- [ ] Streamystats (alternative)

#### Storage Monitoring
- [x] Local Path Monitoring
- [x] SMB/CIFS Share Monitoring (via mount point)
- [x] NFS Share Monitoring (via mount point)
- [x] TrueNAS API Integration (ZFS pools/datasets)
- [x] Threshold-based Alerts
- [x] Auto-cleanup Trigger Option

#### Download Clients (for queue cleanup - future)
- [ ] qBittorrent
- [ ] Deluge
- [ ] Transmission

---

### 2. Rule Engine

#### Rule Builder Features
- Visual drag-and-drop rule builder (similar to Overseerr/Maintainerr)
- AND/OR logic operators between rules
- Section grouping for complex rule sets
- Rule templates and presets
- Import/Export rules as YAML or JSON
- Community rule sharing

#### Rule Parameters - Media Server

| Parameter | Description | Data Type |
|-----------|-------------|-----------|
| Date Added | When media was added to server | Date |
| Last Viewed Date | Most recent watch date | Date |
| View Count | Number of times watched | Number |
| Viewed By | List of users who watched | List[String] |
| User Rating | User's personal rating | Number (1-10) |
| Audience Rating | External rating (IMDB, TMDB, etc.) | Number |
| Resolution | Video quality (4K, 1080p, 720p, etc.) | String |
| Bitrate | Media file bitrate | Number |
| Codec | Video/Audio codec | String |
| File Size | Size of media file(s) | Number |
| Genres | Media genres | List[String] |
| Collections | Collections media belongs to | List[String] |
| Release Date | Original release date | Date |
| People | Actors, directors, etc. | List[String] |

#### Rule Parameters - *arr Applications

| Parameter | Description | Data Type |
|-----------|-------------|-----------|
| Date Added | When added to *arr | Date |
| Download Date | When grabbed/downloaded | Date |
| Monitored Status | Is media monitored | Boolean |
| Tags | Applied tags | List[String] |
| Quality Profile | Assigned quality profile | String |
| Root Folder | Storage location | String |
| Availability | Download availability status | String |
| Custom Formats | Applied custom formats | List[String] |
| Upgrade Until | Quality upgrade cutoff | String |

#### Rule Parameters - TV Shows (Sonarr-specific)

| Parameter | Description | Data Type |
|-----------|-------------|-----------|
| Season Count | Total seasons | Number |
| Episode Count | Total episodes | Number |
| Missing Episodes | Count of missing episodes | Number |
| Watched Seasons | Seasons fully watched | Number |
| Series Status | Continuing/Ended | String |
| Network | Broadcasting network | String |
| Next Air Date | Next episode air date | Date |

#### Rule Parameters - Request Apps

| Parameter | Description | Data Type |
|-----------|-------------|-----------|
| Requested By | Username of requester | String |
| Request Date | When requested | Date |
| Approval Date | When approved | Date |
| Request Count | Times requested | Number |
| Is Requested | Has active request | Boolean |

#### Rule Parameters - Statistics (Tautulli/Jellystat)

| Parameter | Description | Data Type |
|-----------|-------------|-----------|
| Total Plays | All-time play count | Number |
| Last Played | Most recent play date | Date |
| Total Watch Time | Cumulative watch duration | Duration |
| Unique Viewers | Number of different users | Number |
| Completed Plays | Full watches (>90%) | Number |
| Average Watch Percentage | Typical completion rate | Percentage |

#### Rule Actions (Comparison Operators)

| Operator | Description | Applicable Types |
|----------|-------------|------------------|
| equals | Exact match | All |
| not equals | Not matching | All |
| contains | Contains value | Text, List |
| not contains | Doesn't contain | Text, List |
| contains (partial) | Partial match | Text, List |
| bigger/greater than | Greater than | Number, Date |
| smaller/less than | Less than | Number, Date |
| before | Date before | Date |
| after | Date after | Date |
| in last X days | Within recent period | Date |
| in next X days | Within upcoming period | Date |
| is empty | No value | All |
| is not empty | Has value | All |

---

### 3. Collection Management

#### Collection Features
- Auto-create collections from rule matches
- "Leaving Soon" feature (symlink-based library folders)
  - ✅ Automatic symlink management for movies and TV shows
  - ✅ Configurable folder paths for Movies and TV Shows
  - ✅ Symlinks point to original media files (no file moving)
  - ✅ Add symlink folders as libraries in Jellyfin/Emby
  - ✅ Auto-sync on configurable intervals
  - ✅ Manual sync trigger with status feedback
  - ✅ Automatic library refresh after sync
  - ✅ Cross-platform symlink support (junction on Windows)
- Display collections on media server home screen
- Manual add/remove items from collections
- Exclude items from all collections
- Sync collections with media server

#### Collection Actions
- [ ] Delete from disk
- [ ] Unmonitor in *arr
- [ ] Unmonitor and delete in *arr
- [ ] Delete season only (TV)
- [ ] Keep minimum episodes (for ongoing shows)
- [ ] Clear from request app
- [ ] Add to exclusion list
- [ ] Move to different quality profile
- [ ] Add/Remove tags

---

### 4. Scheduling & Automation

#### Scheduled Tasks
- Rule evaluation interval (default: 8 hours)
- Collection action interval (default: 12 hours)
- Media server sync interval
- Statistics refresh interval

#### Automation Features
- [ ] Grace period before deletion (configurable days)
- [ ] Disk space threshold triggers (delete when X% full)
- [ ] Priority-based deletion (lowest priority first)
- [ ] Quiet hours (no deletions during specified times)
- [ ] User notification before deletion

---

### 5. Safety Features

#### Protection Mechanisms
- [ ] Dry-run mode (enabled by default)
- [ ] Recycle bin integration (soft delete)
- [ ] Tag-based exclusion (e.g., `cleanup_keep` tag)
- [ ] Favorited items protection
- [ ] Recently added grace period
- [ ] Minimum retention period
- [ ] Confirmation required for bulk actions
- [ ] Undo last action (within time window)

#### Logging & Auditing
- [ ] Detailed action logs
- [ ] Before/After snapshots
- [ ] Activity timeline
- [ ] Export audit logs
- [ ] Configurable log retention

---

### 6. Web GUI Design (Radarr/Sonarr Style)

#### Navigation Structure
```
├── Dashboard (Overview, stats, quick actions)
├── Media (Library browser with filters)
├── Rules
│   ├── Active Rules
│   ├── Rule Builder
│   └── Community Rules
├── Collections
│   ├── Active Collections
│   └── Collection History
├── Activity
│   ├── Queue
│   ├── History
│   └── Logs
├── Settings
│   ├── Media Servers
│   ├── *arr Connections
│   ├── Request Apps
│   ├── Statistics Apps
│   ├── General
│   ├── UI
│   └── Security
└── System
    ├── Status
    ├── Tasks
    ├── Backup
    └── Updates
```

#### UI Components (Following *arr Design Language)
- Dark theme by default with light option
- Sidebar navigation
- Card-based media display with posters
- Modal forms for editing
- Toast notifications for actions
- Progress indicators for long operations
- Responsive design (desktop-first, mobile-friendly)
- Keyboard shortcuts

#### Dashboard Widgets
- Storage usage chart
- Storage threshold alerts
- Recent activity feed
- Rule execution status
- Pending deletions counter
- Integration health status
- Quick stats (total media, watched %, etc.)

---

### 7. API Design

#### REST API Endpoints
```
/api/v1/media          - Media library operations
/api/v1/rules          - Rule CRUD operations
/api/v1/collections    - Collection management
/api/v1/settings       - Configuration management
/api/v1/system         - System status and health
/api/v1/history        - Action history
/api/v1/tasks          - Scheduled task management
```

#### API Features
- [ ] OpenAPI/Swagger documentation
- [ ] API key authentication
- [ ] Rate limiting
- [ ] Webhook support for events
- [ ] Bulk operations support

---

### 8. Docker/Container Design

#### Container Specifications
```yaml
# Environment Variables
PUID=1000
PGID=1000
TZ=America/Chicago
CONFIG_PATH=/config
LOG_PATH=/logs
DATA_PATH=/data

# Volumes
/config     - Application configuration and database
/logs       - Log file storage
/data       - Access to media files (for leaving-soon symlinks)

# Ports
8080        - Web UI
8081        - Health check endpoint

# Health Check
/health     - Application health endpoint
```

#### Container Features
- [ ] Multi-arch support (amd64, arm64)
- [ ] Non-root user execution
- [ ] Configurable resource limits
- [ ] SQLite database (default)
- [ ] PostgreSQL support (optional)
- [ ] Redis support for caching (optional)

---

## Technical Stack (Decided)

### Backend
- **Node.js / TypeScript** - Same stack as Maintainerr/Overseerr, enables rapid development
- **Express.js** or **Fastify** for API framework
- **Prisma** or **TypeORM** for database ORM

### Frontend
- **React** with TypeScript (industry standard, same as Overseerr)
- **TailwindCSS** for styling
- **React Query** for API state management
- **Zustand** or **Redux** for global state

### Database
- **SQLite** for single-instance deployments
- **PostgreSQL** for scaling

### Reference Stack Comparison
| App | Backend | Frontend |
|-----|---------|----------|
| Radarr/Sonarr | C# / ASP.NET Core | React |
| Overseerr | Node.js / TypeScript | React + TailwindCSS |
| Maintainerr | Node.js / TypeScript | React |
| **This Project** | Node.js / TypeScript | React + TailwindCSS |

---

## Development Phases

### Phase 1: Foundation
- [ ] Project setup with Docker support
- [ ] Basic API structure
- [ ] Database schema
- [ ] Radarr/Sonarr integration
- [ ] Basic web UI shell

### Phase 2: Core Features
- [ ] Rule engine implementation
- [ ] Plex OR Jellyfin integration (pick one first)
- [ ] Collection management
- [ ] Basic scheduling

### Phase 3: Enhanced Features
- [ ] Second media server support
- [ ] Request app integration (Overseerr/Jellyseerr)
- [ ] Statistics integration (Tautulli/Jellystat)
- [ ] Advanced rule builder UI

### Phase 4: Polish
- [ ] Community rule sharing
- [ ] Notifications (Discord, email, etc.)
- [ ] Advanced disk space management
- [ ] Performance optimization
- [ ] Documentation

---

## Configuration Example

```yaml
# application.yml
server:
  port: 8080
  
database:
  type: sqlite
  path: /config/app.db

media_servers:
  plex:
    enabled: true
    url: http://plex:32400
    token: your-plex-token
  jellyfin:
    enabled: false
    url: http://jellyfin:8096
    api_key: your-jellyfin-key

arr_apps:
  radarr:
    - name: "Radarr"
      url: http://radarr:7878
      api_key: your-radarr-key
  sonarr:
    - name: "Sonarr"
      url: http://sonarr:8989
      api_key: your-sonarr-key

request_apps:
  overseerr:
    enabled: true
    url: http://overseerr:5055
    api_key: your-overseerr-key

statistics:
  tautulli:
    enabled: true
    url: http://tautulli:8181
    api_key: your-tautulli-key

cleanup:
  dry_run: true
  default_grace_days: 30
  exclusion_tag: "cleanup_keep"
  enable_recycle_bin: true
  
scheduling:
  rule_interval_hours: 8
  collection_interval_hours: 12
  
ui:
  theme: dark
  language: en
```

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|------------|
| **Project Name** | **Sweeparr** | Clean, memorable, follows *arr convention |
| Backend | Node.js / TypeScript | Matches Overseerr/Maintainerr stack |
| Frontend | React + TailwindCSS | Industry standard for *arr ecosystem |
| Media Server Focus | Jellyfin / Emby | Gap in market (Maintainerr = Plex only) |
| License | GPL-3.0 | Matches *arr ecosystem |
| Community Features | JSON Import/Export | Simple rule sharing via files |

## Project Name: Sweeparr ✅

**Sweeparr** - Sweep away old, unwatched, and unwanted media from your library.

- Clean and memorable
- Conveys the "sweeping" action of cleanup
- Follows *arr naming convention
- Not taken on GitHub

---

## References

- [Maintainerr Documentation](https://docs.maintainerr.info)
- [Maintainerr GitHub](https://github.com/jorenn92/Maintainerr)
- [Janitorr GitHub](https://github.com/Schaka/janitorr)
- [Radarr GitHub](https://github.com/Radarr/Radarr)
- [Sonarr GitHub](https://github.com/Sonarr/Sonarr)
- [Overseerr GitHub](https://github.com/sct/overseerr)
