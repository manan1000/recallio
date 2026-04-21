# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@repo/ui/components/button";
```
apps/api        ← Express + Auth + Documents + Chat + Search + Rate limiting
apps/worker     ← BullMQ + LINK/YOUTUBE/NOTE/PDF/IMAGE/DOCUMENT processors
packages/ai     ← OpenAI, chunking, embedding, summarization
packages/queue  ← BullMQ + Redis
packages/db     ← Prisma + pgvector
packages/storage ← Supabase storage