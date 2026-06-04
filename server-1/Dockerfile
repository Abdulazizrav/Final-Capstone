FROM node:18-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma Client for the build target
RUN npx prisma generate

EXPOSE 5001

# Run migrations and start the server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
