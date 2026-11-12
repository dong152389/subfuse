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

**SubFuse** is a **Clash/Mihomo subscription conversion, enhancement, and management** tool. It can convert airport subscriptions and self-hosted nodes into optimized aggregate subscriptions, then update them automatically. With the visual UI, you can configure advanced features such as **chained proxies, precise routing, DNS leak prevention, and multi-subscription aggregation** in one click.

## Highlights & Use Cases

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
