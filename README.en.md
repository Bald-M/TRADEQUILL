# TradeQuill

[简体中文](README.md) | **English**

A local-first desktop workspace for individual foreign trade professionals, built for Windows and macOS.

## Current scope

This is a foundation for further development, featuring Tauri 2, React, TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Radix), theme switching, module navigation, and Rust + SQLite initialization.

Customer management, business management, import/export, and full backups are currently clearly labeled placeholders. Business CRUD operations are not yet implemented. The first version does not integrate AI, cloud synchronization, telemetry, or remote fonts. No database server is required.

## Development environment

- Node.js 22.12+ (Node.js 22 LTS recommended) and pnpm 11.19.0.
- Rust stable with rustfmt and clippy.
- macOS: Xcode Command Line Tools (`xcode-select --install`).
- Windows: Microsoft C++ Build Tools (Desktop development with C++) and WebView2.
- Native builds on each platform: build Windows installers on Windows and macOS bundles on macOS.

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
```

Build artifacts are located in `src-tauri/target/release/bundle/`. Release signing, notarization, automatic updates, and online publishing are not currently configured; default bundles are intended only for local development validation. Windows/macOS check workflows are configured and will run once the project is connected to a GitHub remote.

The Tauri Rust core and frontend API are pinned to the 2.11 series; transitive dependencies are recorded in `Cargo.lock`. When upgrading, validate Tauri core/runtime/macros/build/codegen/utils together. Do not delete the lockfile or upgrade just one of these packages in isolation.

To add shadcn components:

```sh
pnpm exec shadcn add input dialog table
```

## Project structure

- `src/App.tsx`: desktop navigation, home screen, business module placeholders, and settings.
- `src/components/ui/`: shadcn component source code, maintained as needed for the project.
- `src/hooks/`: interface state logic.
- `src/lib/workspace.ts`: typed Tauri IPC boundary; browser previews do not simulate a successful database connection.
- `src-tauri/src/storage.rs`: application directory and SQLite schema initialization.
- `src-tauri/src/lib.rs`: asynchronous desktop commands, with disk operations handled by the blocking task pool.
- `docs/bootstrap.md`: foundation scope and acceptance criteria (in Chinese).

## Local data

Tauri uses the `com.tradequill.desktop` identifier to determine the application data directory. The settings page displays the actual paths:

- macOS: `~/Library/Application Support/com.tradequill.desktop/`.
- Windows: `%APPDATA%/com.tradequill.desktop/`.

The directory contains `tradequill.sqlite3` and `attachments/`. The initial schema contains only application metadata, leaving customer and business models to be defined later. Migrations use transactions and `PRAGMA user_version`; data with a schema version newer than the application supports is rejected rather than overwritten or downgraded. Restarting the application does not clear existing data. The database currently has no application-level encryption.

Theme preferences are stored in the local WebView's localStorage. Business data is accessed in SQLite only through Rust. For a temporary manual backup, fully exit the application and then copy the entire application data directory. Future CSV/Excel exports will not replace a full backup that includes attachments.

## Security and extension boundaries

The production CSP permits only local resources and Tauri IPC. The frontend is not granted arbitrary file access or SQL execution permissions. Future business modules should expose capabilities through explicit Rust commands, without allowing arbitrary SQL or arbitrary file path access from the interface.

This project has no remote repository configured. Release signing, validation on Windows hardware, and production distribution require further setup.

## Contributing

See the [contribution guide](CONTRIBUTING.md) (in Chinese) for the development workflow, validation requirements, and bug reporting guidance.
