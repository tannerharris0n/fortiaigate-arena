FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --ignore-scripts && npm --prefix client ci
COPY . .
RUN npm --prefix client run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "server/index.js"]
