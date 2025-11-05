FROM node:16.13.2 as builder
LABEL org.opencontainers.image.vendor=BuildIT
USER node
WORKDIR /home/node/
COPY --chown=node:node ["package.json", "package-lock.json", "./"]
RUN ["npm", "ci"]
COPY --chown=node:node ["tsconfig.json", "./"]
COPY --chown=node:node ["src/", "./src/"]
RUN ["npm", "run", "build"]
RUN ["/bin/bash", "-c", "find . ! -name dist ! -name node_modules -maxdepth 1 -mindepth 1 -exec rm -rf {} \\;"]

FROM node:16.13.2-alpine3.14
LABEL org.opencontainers.image.vendor=BuildIT
LABEL org.opencontainers.image.title="Pet App"
USER node
WORKDIR /home/node/
COPY --chown=node:node --from=builder /home/node/ ./
ENTRYPOINT ["node", "/home/node/dist/index.js"]
