FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
    g++ \
    python3 \
    default-jdk

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000
CMD ["npm", "start"]