FROM node:20-alpine as build

WORKDIR /app
COPY package*.json ./
# Since we are not strictly providing a lockfile, we can just use npm install.
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html
# Copy custom Nginx configuration to proxy API requests
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose port 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
