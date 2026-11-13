<!-- markdownlint-disable MD033 MD041 -->
<div align="center">
  <p><img src="docs/assets/logo.png" alt="SubFuse" width="96"></p>
  <h1>SubFuse</h1>
  <p>
    <img src="https://img.shields.io/badge/platform-Linux%20%2B%20Docker-lightgrey.svg" alt="平台：Linux + Docker">
    <img src="https://img.shields.io/badge/version-0.0.1-green.svg" alt="版本 0.0.1">
    <a href="https://subfuse.org"><img src="https://img.shields.io/badge/app-subfuse.org-brightgreen.svg" alt="在线入口"></a>
    <a href="https://docs.subfuse.org"><img src="https://img.shields.io/badge/docs-subfuse.org-blue.svg" alt="文档"></a>
    <img src="https://img.shields.io/badge/image-GHCR-blue.svg" alt="GHCR 镜像">
  </p>
  <p><strong><a href="README.md">English</a> | <a href="README-CN.md">中文</a></strong></p>
</div>
<!-- markdownlint-enable MD033 MD041 -->

**SubFuse** 是一个现代化的 **Clash/Mihomo 订阅转换、聚合增强与多用户运营管理平台**。

本项目基于 SubBoost 进行深度二次开发，不仅继承了其强大的订阅转换、链式代理、精确分流及节点管理能力，更全面升级为具备**多用户体系、邮件与 GitHub 认证、VIP 会员与配额分级管控、独立管理员运营后台**的综合服务平台。

---

## 🌟 二开增强特性 (Secondary Development)

相比原版单用户/单管理员架构，SubFuse 二开版本加入了完整的 SaaS 化多用户运营与安全管控支持：

### 1. 👥 完善的多用户与多方式认证体系
- **开放注册与密码管理**：支持普通用户自主注册账号、修改密码及独立管理个人订阅数据。
- **邮件验证码体系**：支持免密邮箱验证码快速登录、注册校验及安全找回密码。
- **邮箱域名白名单限制**：管理员可在后台配置允许注册的邮箱域名后缀（如 `@gmail.com,@company.com`），有效遏制恶意机器人批量注册，支持私有化受限场景。
- **GitHub OAuth 2.0 授权登录**：支持通过 GitHub 一键登录，用户中心支持自由绑定/解绑 GitHub 账号。
- **统一响应式登录面板**：深度整合账号密码、邮箱验证码与第三方 OAuth，自动适配暗黑主题与移动端设备。

### 2. 👑 精细化用户配额分级体系
内置 **普通用户 / VIP 会员 / 系统管理员** 三层配额控制机制，防范服务器资源滥用：

| 资源配额项 | 普通用户 (Free) | VIP 会员 (VIP) | 系统管理员 (Admin) |
| :--- | :---: | :---: | :---: |
| **订阅数量上限** | 1 个 | 50 个 | 无限制 (9999) |
| **单订阅节点上限** | 200 个 | 2,000 个 | 10,000 个 |
| **外部源导入限制 (单类型)** | 1 个 | 50 个 | 无限制 (9999) |
| **自定义模板数量** | 0 个 | 50 个 | 无限制 (9999) |
| **专属身份标识** | 默认徽章 | 👑 黄金 VIP 徽章 | 🛡️ 管理员标识 |
| **后台管理权限** | 无 | 无 | 完整权限 |

- 用户设置中心实时展示配额占用与额度上限，超限时智能提示升级。

### 3. 💎 VIP 会员全生命周期管理
- **灵活期限设置**：管理员可一键为指定用户授予 VIP 身份，支持 30 天、90 天、半年、1 年及永久会员等多种预设或自定义时长。
- **到期自动平滑降级**：会员到期后自动调整为普通用户配额，已生成的历史配置安全保留。

### 4. 🛡️ 独立管理员综合运营后台 (`/dashboard/admin`)
- **多维数据看板**：实时掌控运营概况，汇总 **总用户数**、**VIP 会员数**、**已封禁用户数** 和 **今日活跃用户数**。
- **全功能用户生命周期管理**：
  - 用户全量检索与角色筛选（全部 / 管理员 / VIP / 普通用户 / 封禁账号）。
  - 后台直接创建用户、重置用户登录密码、调整用户角色。
  - 用户一键删除与数据级联清理。
- **用户封禁与安全阻断**：
  - 支持一键封禁可疑或违规用户，并可自定义填写封禁原因。
  - 被封禁用户登录及订阅拉取均被实时阻断，并向前台展示管理员填写的封禁说明。
- **可视化系统服务配置**：
  - **SMTP 邮件服务**：可视化配置发信服务器（Host、Port、User、Password、From、SSL/TLS）及邮箱后缀白名单，支持一键发送测试邮件校验连通性。
  - **GitHub OAuth 配置**：可视化配置 Client ID 与 Client Secret，支持授权回调 URL 检测与部署域名自适应提醒。

---

## ⚡ 核心功能与使用场景

除上述二次开发增强功能外，SubFuse 完整保留并优化了核心订阅处理能力：

- **订阅转换**：支持订阅链接、YAML 配置文件、Base64 节点链接及多种单节点格式批量导入。
- **节点管理**：支持批量对节点重命名、删除或配置监听端口。
- **节点筛选**：可在分流组高级模式中按导入源、地区和自定义规则智能筛选节点。
- **链式代理**：一键可视化配置链式代理和 `中转代理组`。
- **精确分流**：内置 30 多个常用代理组和 2000 多条远程规则集供启用。
- **规则管理**：可自由调整规则排序与命中策略，供高级用户深度自定义。
- **防 DNS 泄露**：开箱即用的 `基础和 DNS 配置`，全面防范 DNS 污染与泄露。
- **自动刷新**：定时自动刷新上游订阅，刷新时可智能匹配节点变动。

## 界面展示

<p align="center">
  <img src="docs/assets/screenshot-main.png" alt="SubFuse 可视化配置界面" width="960">
</p>

## 使用和部署

- 在线入口：[无需部署 - 直接使用的公开服务](https://subfuse.org)
- 部署文档：[一键部署 - 拉取镜像构建，速度快配置要求低](https://docs.subfuse.org/deploy/one-click)
- 部署文档：[高级部署 - 编译源码构建，速度慢配置要求高](https://docs.subfuse.org/deploy/advanced)
- 配置教程：[草履虫也能学会的 Clash 配置：UI 界面一键配置精确分流、链式代理](https://ryanvan.com/t/topic/59?u=ryan)

### 快速启动 (Docker Compose)

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

> **首次部署提示**：首次启动后访问站点，系统将引导初始化创建**首位系统超级管理员账号**，随后即可进入 `/dashboard/admin` 配置 SMTP 发信与 GitHub OAuth 服务。

## 开发说明

开发者可以从源码启动本地开发环境：

```bash
npm ci
npm run dev
```

常用检查：

```bash
npm run lint
npm run test:unit
npm run check:local-app
```

## 相关链接

- 在线入口：[https://subfuse.org](https://subfuse.org)
- 部署文档：[https://docs.subfuse.org](https://docs.subfuse.org)
- 发行公告：[docs/release-notes.md](./docs/release-notes.md)
- 更新日志：[https://subfuse.org/faq](https://subfuse.org/faq)
- 论坛反馈：[LINUX DO](https://linux.do/) & [IDC Flare](https://idcflare.com/)

## ⭐轨迹

<a href="https://www.star-history.com/?repos=dong152389%2Fsubfuse&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=dong152389/subfuse&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=dong152389/subfuse&type=date&legend=top-left" />
   <img alt="SubFuse Star 成长轨迹" src="https://api.star-history.com/chart?repos=dong152389/subfuse&type=date&legend=top-left" />
 </picture>
</a>

## 开源许可

SubFuse 公开源码以 [GNU Affero General Public License v3.0 only](./LICENSE) 授权。

如果你修改 SubFuse 并通过网络向用户提供服务，AGPL-3.0 要求你向这些用户提供对应源码。公开源码入口是 [dong152389/subfuse](https://github.com/dong152389/subfuse)。

## 免责声明

本项目不提供任何代理服务，不对第三方订阅内容的可用性与合法性作出保证。
