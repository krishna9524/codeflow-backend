# Start with Node on Debian Bullseye
FROM node:18-bullseye

# 1. Install Python, C++, Java, and the missing JSON libraries!
RUN apt-get update && apt-get install -y \
    g++ \
    python3 \
    python-is-python3 \
    default-jdk \
    libjsoncpp-dev \
    wget

WORKDIR /app

# 2. Download the Java JSON library so org.json works
RUN mkdir -p /app/libs
RUN wget -O /app/libs/json.jar https://repo1.maven.org/maven2/org/json/json/20230227/json-20230227.jar

# 3. Copy files and install dependencies
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000
CMD ["npm", "start"]