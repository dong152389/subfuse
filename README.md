<!-- markdownlint-disable MD033 MD041 -->
<div align="center">
  <p><img src="docs/assets/logo.png" alt="SubFuse" width="96"></p>
  <h1>SubFuse</h1>
  <p>
    <img src="https://img.shields.io/badge/platform-Linux%20%2B%20Docker-lightgrey.svg" alt="Platform: Linux + Docker">
    <img src="https://img.shields.io/badge/version-0.0.1-green.svg" alt="Version 0.0.1">
    <a href="https://subfuse.org"><img src="https://img.shields.io/badge/app-subfuse.org-brightgreen.svg" alt="Online app"></a>
    <a href="https://docs.subfuse.org"><img src="https://img.shields.io/badge/docs-subfuse.org-blue.svg" alt="Documentation"></a>
    <img src="https://img.shields.io/badge/image-GHCR-blue.svg" alt="GHCR image">
  </p>
  <p><strong><a href="README.md">English</a> | <a href="README-CN.md">中文</a></strong></p>
</div>
<!-- markdownlint-enable MD033 MD041 -->

**SubFuse** is a modern **Clash/Mihomo subscription conversion, enhancement, and multi-user management platform**.

This project is a deep secondary development based on SubBoost. In addition to robust subscription conversion, chained proxies, precise routing, and batch node management, it introduces **a complete multi-user system, email and GitHub OAuth authentication, tiered resource quotas, VIP membership management, and a dedicated admin operations dashboard**.

---

## 🌟 Secondary Development Highlights

Compared with the single-user / single-admin architecture of the original project, SubFuse adds comprehensive SaaS-oriented multi-user operations and security controls:

### 1. 👥 Multi-User System & Diverse Authentication
- **User Registration & Password Management**: Allows users to self-register accounts, change passwords, and manage personal subscriptions independently.
- **Email Verification System**: Passwordless login via email verification code, registration verification, and secure password reset.
- **Email Domain Whitelist**: Admins can restrict registrations to specific email domain suffixes (e.g. `@gmail.com,@company.com`), preventing automated bot signups and enabling private team setups.
- **GitHub OAuth 2.0 Login**: One-click login with GitHub credentials, plus account binding and unbinding support in user settings.
- **Unified Responsive Login Interface**: Seamlessly integrates username/password, email code, and GitHub OAuth, optimized for both desktop and mobile devices.

### 2. 👑 Tiered Resource Quota Control
Provides built-in tiered quota enforcement across **Free Users / VIP Members / System Administrators**:

| Resource Quota Item | Free User (Default) | VIP Member | System Administrator |
| :--- | :---: | :---: | :---: |
| **Max Subscriptions** | 1 | 50 | Unlimited (9999) |
| **Max Nodes Per Subscription** | 200 | 2,000 | 10,000 |
| **Max Import Sources (Per Type)** | 1 | 50 | Unlimited (9999) |
| **Custom Templates** | 0 | 50 | Unlimited (9999) |
| **User Badge** | Default | 👑 VIP Badge | 🛡️ Administrator Badge |
| **Admin Operations Dashboard** | No Access | No Access | Full Access |

- The user settings panel displays real-time resource quota usage with clear upgrade hints.

### 3. 💎 VIP Membership Lifecycle Management
- **Flexible Expiration Options**: Admins can grant VIP status for 30 days, 90 days, 180 days, 1 year, or lifetime.
- **Graceful Auto-Downgrade**: When VIP expires, user accounts automatically fall back to free quotas without breaking existing configurations.

### 4. 🛡️ Dedicated Admin Operations Dashboard (`/dashboard/admin`)
- **Operations Metrics Overview**: Real-time stats on **Total Users**, **VIP Members**, **Banned Accounts**, and **Active Users Today**.
- **User Lifecycle Management**:
  - Full-text search and role filters (All / Admin / VIP / User / Banned).
  - Create users manually, reset passwords, update roles, and safely delete accounts.
- **Account Ban & Security Protection**:
  - Instantly ban abusive users with custom ban reasons.
  - Revokes access immediately; banned users are blocked from logging in or fetching subscriptions with custom ban messages displayed.
- **Visual Service Settings**:
  - **SMTP Email Service**: Configure mail server parameters (host, port, credentials, TLS, allowed domain whitelist) with an integrated test email tool.
  - **GitHub OAuth Settings**: Configure Client ID and Client Secret with automatic callback URL and domain detection hints.

---

## ⚡ Core Features & Use Cases

SubFuse retains and polishes the core subscription engine:

- **Subscription conversion**: Import subscription links, YAML files, node links, and other common formats.
- **Node management**: Rename, delete, or configure listening ports for nodes in batches.
- **Node filtering**: Build `filtered proxy groups` with only selected nodes by source, region, and custom rules.
- **Chained proxies**: Configure chained proxies and `relay proxy groups` visually in one click.
- **Precise routing**: Enable more than 30 common proxy groups and over 2,000 remote rule sets.
- **Rule management**: Reorder rules for deeper customization by advanced users.
- **DNS leak prevention**: The default `basic and DNS configuration` helps prevent DNS leaks.
- **Automatic refresh**: Refresh subscriptions on a schedule and intelligently match nodes during refresh.

## Interface Preview

<p align="center">
  <img src="docs/assets/screenshot-main.png" alt="SubFuse visual configuration interface" width="960">
</p>

## Usage & Deployment

- Online entry: [No deployment required - direct access to the public service](https://subfuse.org)
- Deployment docs: [One-click deployment - pulls an image to build, faster with lower requirements](https://docs.subfuse.org/deploy/one-click)
- Deployment docs: [Advanced deployment - compiles from source, slower with higher requirements](https://docs.subfuse.org/deploy/advanced)
- Configuration guide: [Clash configuration simple enough for a paramecium: configure precise routing and chained proxies from the UI in one click](https://ryanvan.com/t/topic/59?u=ryan)

### Quick Start (Docker Compose)

```yaml
version: '3.8'

services:
  subfuse:
    image: ghcr.io/dong152389/subfuse:latest
    container_name: subfuse
    restart: always
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://subfuse:password@postgres:5432/subfuse
      - ENCRYPTION_KEY=<32-character-random-string>
      - APP_URL=http://your-domain.com
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    container_name: subfuse-postgres
    restart: always
    environment:
      - POSTGRES_DB=subfuse
      - POSTGRES_USER=subfuse
      - POSTGRES_PASSWORD=password
    volumes:
      - subfuse_pgdata:/var/lib/postgresql/data

volumes:
  subfuse_pgdata:
```

> **Initial Setup Note**: Upon first launch, navigate to the web interface to initialize the **first system administrator account**. You can then access `/dashboard/admin` to configure SMTP and GitHub OAuth services.

## Development Notes

Developers can start a local development environment from source:

```bash
npm ci
npm run dev
```

Common checks:

```bash
npm run lint
npm run test:unit
npm run check:local-app
```

## Links

- Online entry: [https://subfuse.org](https://subfuse.org)
- Deployment docs: [https://docs.subfuse.org](https://docs.subfuse.org)
- Release announcements: [docs/release-notes.md](./docs/release-notes.md)
- Changelog: [https://subfuse.org/faq](https://subfuse.org/faq)
- Forum feedback: [LINUX DO](https://linux.do/) & [IDC Flare](https://idcflare.com/).

## Star History

<a href="https://www.star-history.com/?repos=dong152389%2Fsubfuse&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=dong152389/subfuse&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=dong152389/subfuse&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=dong152389/subfuse&type=date&legend=top-left" />
 </picture>
</a>

## License

The public SubFuse source code is licensed under the [GNU Affero General Public License v3.0 only](./LICENSE).

If you modify SubFuse and provide it to users over a network, AGPL-3.0 requires you to offer those users the corresponding source code. The public source entry is [dong152389/subfuse](https://github.com/dong152389/subfuse).

## Disclaimer

This project does not provide any proxy service and makes no guarantee about the availability or legality of third-party subscription content.
