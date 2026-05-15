# syntax=docker/dockerfile:1.7-labs
#
# Frontend Dockerfile — uses pre-built .next output from the host.
# The Next.js 14.2.x lockfile patching bug prevents building inside
# Docker Alpine; we build on the host and copy artifacts into the image.

FROM node:20-alpine
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs
EXPOSE 3000
ENV PORT=3000

# Pre-built .next output (from host `npx next build`)
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

CMD ["node", "server.js"]
