FROM public.ecr.aws/docker/library/node:22-alpine AS base

WORKDIR /app

RUN npm install turbo@^2.9.16 -g

COPY . .

RUN npx turbo prune --scope=@app/backend --docker


FROM public.ecr.aws/docker/library/node:22-alpine AS installer

WORKDIR /app

COPY --from=base app/out/json/ .
RUN npm ci


FROM public.ecr.aws/docker/library/node:22-alpine AS builder

WORKDIR /app

# Copy node_modules
COPY --from=installer /app/ .
COPY --from=base /app/out/full/ .

RUN npm install turbo@^2.9.16 -g

RUN npx turbo run build

# Prune node_modules down to ONLY production dependencies
# RUN npm prune --production

FROM public.ecr.aws/docker/library/node:22-alpine AS production

WORKDIR /app

# Copy only the pruned production node_modules
COPY --from=builder app/node_modules ./node_modules

# Backend
COPY --from=builder app/apps/backend/package.json ./apps/backend/
COPY --from=builder app/apps/backend/dist ./apps/backend/dist

# for migrations
COPY --from=builder app/apps/backend/prisma.config.ts ./apps/backend/
COPY --from=builder app/apps/backend/prisma ./apps/backend/prisma

# Shared package
COPY --from=builder app/packages/shared/package.json ./packages/shared/
COPY --from=builder app/packages/shared/dist ./packages/shared/dist


WORKDIR /app/apps/backend

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=300s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "run", "start:migrate"]
