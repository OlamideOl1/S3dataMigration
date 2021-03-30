FROM node:14-alpine as base

WORKDIR /src
COPY package*.json /src

FROM base as s3Producer
RUN npm ci
COPY s3JobProducer.js /src
CMD ["node", "s3JobProducer.js"]

FROM base as s3Consumer
RUN npm ci
COPY s3JobConsumer.js /src
CMD ["node", "s3JobConsumer.js"]
