FROM node:20-slim

WORKDIR /app

# system deps (minimal but correct for dev tooling)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# copy dependency manifests first (for layer caching)
COPY package.json package-lock.json ./

# install EXACT dependency tree
RUN npm ci

# copy application source
COPY . .

# Vite dev server port
EXPOSE 5173

# run dev server properly
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]