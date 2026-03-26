# Project Structure

This repository is organized so maintainers can quickly separate live application code from supporting material.

## Top-Level Folders

- `src/`: All runtime application code.
- `public/`: Static assets served by Next.js.
- `supabase/`: Supabase-related project files.
- `plans/`: Planning documents and working notes for feature work.
- `scripts/`: Standalone scripts that are not part of the Next.js runtime.
- `docs/`: Documentation that explains architecture, workflows, or troubleshooting.
- `archive/`: Old backups, scratch notes, debug output, and reference material that should not live next to active code.

## `src/` Layout

- `src/app/`: App Router routes, layouts, and API endpoints.
- `src/components/`: Reusable UI plus feature-oriented React components.
- `src/hooks/`: Custom React hooks.
- `src/lib/`: Shared helpers, service wrappers, and utility modules.
- `src/providers/`: App-wide React providers.
- `src/types/`: Shared TypeScript declarations and domain types.

## Placement Rules

- If a file is imported by the app at runtime, keep it under `src/` unless Next.js requires a different location.
- If a file is a manual reference, troubleshooting write-up, or implementation note, place it under `docs/`.
- If a file is historical, experimental, or a backup copy, place it under `archive/`.
- If a file is a manual script run from the terminal, place it under `scripts/`.

## Current Non-App Locations

- `docs/notes/VIDEO_EXPORT_FIX.md`: Troubleshooting note for video export behavior.
- `scripts/encode_b64.js`: Utility script.
- `scripts/legacy/`: Legacy server-side scripts kept for reference.
- `archive/notes/`: Old text notes and debug files.
- `archive/vps-render/`: Backup/reference files previously mixed into the live VPS route folder.

## Naming Guidance

- Prefer descriptive names over generic ones like `backup`, `random`, or `final`.
- Group by purpose first, then by feature.
- Keep the repository root limited to config files, package manifests, and clearly global project folders.
