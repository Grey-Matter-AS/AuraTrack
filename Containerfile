# Use the latest LTS version of Node
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /app

# Install a simple shell and git (useful for Vite)
RUN apt-get update && apt-get install -y git

# Expose the port Vite uses (5173)
EXPOSE 5173

# Command to keep the container alive and ready
CMD ["node"]
