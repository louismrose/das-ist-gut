# Build stage: compile the server and bundle the React client
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: production dependencies + built output only
FROM node:22-alpine
# The commit this image was built from; surfaced at /api/version and in the UI.
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=${GIT_SHA}
WORKDIR /app
ENV NODE_ENV=production
ENV GIT_SHA=${GIT_SHA}
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY data ./data
EXPOSE 3000
USER node
CMD ["node", "dist/server/index.js"]
