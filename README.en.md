<div align="center">
  <img src="./docs/assets/tradequill-brand-mark.svg" width="132" alt="TradeQuill logo">

  <h1>TradeQuill</h1>

  <p>
    A local-first desktop workspace for individual foreign trade professionals on Windows and macOS.<br>
    Organize customer records, business follow-ups, and local data in one place.
  </p>

  <p>
    <a href="#current-scope">Scope</a> ·
    <a href="#development-environment">Quick start</a> ·
    <a href="#project-structure">Structure</a> ·
    <a href="#local-data">Local data</a> ·
    <a href="#security-and-extension-boundaries">Security</a> ·
    <a href="DESIGN.md">Design</a> ·
    <a href="CONTRIBUTING.md">Contributing</a> ·
    <a href="CHANGELOG.md">Changelog</a> ·
    <a href="#license">License</a>
  </p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-APACHE%202.0-06b6d4?style=for-the-badge&amp;labelColor=525252" alt="License: Apache 2.0"></a>
    <img src="https://img.shields.io/badge/VERSION-0.1.0-0284c7?style=for-the-badge&amp;labelColor=525252" alt="Version: 0.1.0">
    <img src="https://img.shields.io/badge/STATUS-IN%20DEVELOPMENT-16a34a?style=for-the-badge&amp;labelColor=525252" alt="Status: In development">
  </p>
  <p>
    <img src="https://img.shields.io/badge/DESKTOP-macOS%20%7C%20Windows-a3aab8?style=for-the-badge&amp;labelColor=525252" alt="Desktop platforms: macOS and Windows">
    <img src="https://img.shields.io/badge/STACK-Tauri%20%7C%20React-06b6d4?style=for-the-badge&amp;labelColor=525252" alt="Stack: Tauri and React">
    <img src="https://img.shields.io/badge/DATA-Local%20%7C%20SQLite-6366f1?style=for-the-badge&amp;labelColor=525252" alt="Data: Local SQLite">
  </p>

  <p>
    <a href="README.md"><code>简体中文</code></a> · <strong>English</strong>
  </p>
</div>

## Current scope

TradeQuill now provides its first complete local workflow: customer records, inquiry capture with four-dimensional combined filtering, quote history, sample progress history, follow-up calendar, today/overdue lists, and a daily system reminder. The detailed behavior is documented in [the customer workflow](docs/customer-workflow.md) (Chinese). Product records and the lightweight knowledge library add parameters, MOQ, lead time, text/FAQ entries, previewed TXT/Markdown/text-PDF imports, local search, and version management. See [the catalog workflow](docs/catalog-workflow.md) (Chinese).

Data import/export and full backups remain clearly labeled placeholders. The first version does not integrate AI, cloud synchronization, telemetry, or remote fonts, and it requires no database server. The app does not run in the background after it is fully closed, so reminders are recalculated when it is opened again.

Suppliers, structured quotations/PDF, orders, cost/profit calculations and period reports share the product catalog. See [commerce workflow](docs/commerce-workflow.md).

## Development environment

- Node.js 22.12+ (Node.js 22 LTS recommended) and pnpm 11.19.0.
- Rust stable with rustfmt and clippy.
- macOS: Xcode Command Line Tools (`xcode-select --install`).
- Windows: Microsoft C++ Build Tools (Desktop development with C++) and WebView2.
- Native builds on each platform: build Windows installers on Windows and macOS bundles on macOS.
- Cross-platform remote packaging requires an authenticated [GitHub CLI](https://cli.github.com/) (`gh auth login`).

See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for details.

```sh
pnpm install --frozen-lockfile
pnpm desktop:dev
```

`pnpm dev` is only for previewing the interface during development and explicitly reports that it cannot connect to the desktop database. The product is a Tauri desktop application, not a deployed website.

## Common commands

```sh
pnpm typecheck
pnpm format:check
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
pnpm check:rust
pnpm desktop:build
pnpm desktop:build:all
```

`pnpm desktop:build` builds for the current platform and writes bundles under `src-tauri/target/release/bundle/` by default. When you pass `--target <target>`, bundles are written under `src-tauri/target/<target>/release/bundle/`. `pnpm desktop:build:all` triggers the [GitHub Actions packaging workflow](.github/workflows/package.yml), which builds Windows x64, macOS Apple Silicon, and macOS Intel packages in parallel. The command waits for completion and downloads every artifact into `release/<run-id>/`. The current branch must already exist on GitHub.

Remote packages are intended for development validation: Windows packages are unsigned, macOS packages use ad-hoc signing without notarization, and automatic updates or online publishing are not configured.

The Tauri Rust core and frontend API are pinned to the 2.11 series; transitive dependencies are recorded in `Cargo.lock`. When upgrading, validate Tauri core/runtime/macros/build/codegen/utils together. Do not delete the lockfile or upgrade just one of these packages in isolation.

To add shadcn components:

```sh
pnpm exec shadcn add input dialog table
```

## Project structure

- `src/App.tsx`: desktop navigation, home screen, business state loading, and settings.
- `src/components/business/`: customer cards, inquiry/quote/sample forms, follow-up lists, and calendar UI.
- `src/components/catalog/`: product records, knowledge import previews, versions, and local search.
- `src-tauri/src/catalog.rs`: product/document validation, bounded PDF parsing, managed copies, and versions.
- `src/components/ui/`: shadcn component source code, maintained as needed for the project.
- `src/hooks/`: interface state logic.
- `src/lib/workspace.ts` and `src/lib/business.ts`: typed Tauri IPC boundaries; browser previews do not simulate a successful database connection.
- `src-tauri/src/storage.rs`: application directory, transactional SQLite migrations, business validation, and persistence.
- `src-tauri/src/storage/commerce/`: catalogs, quotation revisions, orders, fixed-point calculations and reports.
- `src-tauri/src/quote_pdf.rs`: offline bilingual PDF generation from saved snapshots.
- `src-tauri/src/lib.rs`: asynchronous desktop commands, with disk operations handled by the blocking task pool.
- `.github/workflows/package.yml`: matrix builds and artifact uploads for Windows/macOS installers.
- `scripts/build-desktop-all.mjs`: triggers remote packaging, waits for completion, and downloads every artifact.
- `docs/bootstrap.md`: foundation scope and acceptance criteria (in Chinese).

## Local data

Tauri uses the `com.tradequill.desktop` identifier to determine the application data directory. The settings page displays the actual paths:

- macOS: `~/Library/Application Support/com.tradequill.desktop/`.
- Windows: `%APPDATA%/com.tradequill.desktop/`.

The directory contains `tradequill.sqlite3` and `attachments/`. Schema 4 preserves customers, inquiries, quotes, sample progress, follow-up tasks, and daily reminder records, and adds product records and the lightweight knowledge library. Original document copies, extracted text, and versions are stored in SQLite; deletion clears managed content transactionally. Migrations use transactions and `PRAGMA user_version`; data with a schema version newer than the application supports is rejected rather than overwritten or downgraded. Restarting the application does not clear existing data. The database currently has no application-level encryption.

Theme preferences are stored in the local WebView's localStorage. Business data is accessed in SQLite only through Rust. For a temporary manual backup, fully exit the application and then copy the entire application data directory. Future CSV/Excel exports will not replace a full backup that includes attachments.

## Security and extension boundaries

The production CSP permits only local resources and Tauri IPC. The frontend is not granted arbitrary file access or SQL execution permissions. Future business modules should expose capabilities through explicit Rust commands, without allowing arbitrary SQL or arbitrary file path access from the interface.

The project is hosted at [Bald-M/TRADEQUILL](https://github.com/Bald-M/TRADEQUILL) with cross-platform checks and installer packaging workflows. Release signing, validation on Windows hardware, and production distribution still require further work.

## Contributing

See the [contribution guide](CONTRIBUTING.md) (in Chinese) for the development workflow, validation requirements, and bug reporting guidance.

## License

Licensed under the [Apache License 2.0](LICENSE).
