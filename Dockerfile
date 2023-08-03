FROM node:18-alpine

USER root
ENV NODE_ENV=production
ENV TINI_SUBREAPER=true
WORKDIR /src

COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 8080
ENV TZ=Europe/Amsterdam
CMD ["npm" , "start"]