# VSL123

Next.js application for VSL editing, infographic generation, and export workflows.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

- `src/app`: App Router pages and API routes.
- `src/components`: UI and feature components.
- `src/hooks`: React hooks for project data and shared client logic.
- `src/lib`: framework-agnostic helpers and service clients.
- `src/providers`: top-level React providers.
- `src/types`: shared TypeScript types.
- `public`: static assets.
- `scripts`: standalone utility and legacy operational scripts.
- `docs`: maintainer-facing documentation.
- `archive`: old notes, backups, and reference material that should not sit beside live app code.

Detailed navigation guidance lives in `docs/PROJECT_STRUCTURE.md`.

## Maintenance Rules

- Keep runtime application code inside `src`.
- Put one-off utilities in `scripts`, not the repository root.
- Put reference notes, debug output, and backups in `archive` or `docs`.
- Avoid adding new loose `.txt`, `.js`, or backup files at the root level.

## Scripts

- `npm run dev`: Start the development server.
- `npm run build`: Build the app.
- `npm run start`: Run the production server.
- `npm run lint`: Run ESLint.
