FROM node:20-alpine

WORKDIR /app

# Build deps for native modules: sharp, better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite-dev

COPY package.json .
RUN npm install

COPY src ./src

EXPOSE 3001

CMD ["node", "src/index.js"]
