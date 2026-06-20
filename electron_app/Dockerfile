FROM node:20-bullseye
WORKDIR /app
COPY main_stub.js preload.js package.json consent_store.js renderer_stub.html /app/
RUN npm install --only=prod
EXPOSE 3000
CMD ["node", "main_stub.js"]
