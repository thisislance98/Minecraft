# Use the official Node.js image.
# https://hub.docker.com/_/node
FROM node:20-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY package*.json ./
COPY tsconfig.json ./

# Install production dependencies.
# If you add a package-lock.json speed your build by switching to 'npm ci'.
# RUN npm ci --only=production
RUN npm install

# Copy local code to the container image.
COPY . .

# Build the TypeScript code
# (Assuming you don't have a build step in package.json, we can just run ts-node directly in production 
# OR ideally build it. The current package.json uses ts-node for start, which is fine for simple apps,
# but for production it's often better to compile. Let's stick to the existing 'npm start' which uses ts-node).
# If we wanted to pre-build:
# RUN npx tsc

# Run the web service on container startup.
# The 'npm start' script in package.json runs 'ts-node index.ts'
CMD [ "npm", "start" ]
