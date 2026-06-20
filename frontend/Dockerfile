FROM node:20
WORKDIR /app
COPY server.js /app/server.js
COPY static /app/static
RUN npm install express
EXPOSE 3000
CMD ["node", "server.js"]
