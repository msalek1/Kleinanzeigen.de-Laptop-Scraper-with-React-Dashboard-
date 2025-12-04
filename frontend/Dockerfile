# Frontend Dockerfile for React SPA
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run development server (for production, use nginx to serve built files)
CMD ["npm", "run", "dev", "--", "--host"]
