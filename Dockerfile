FROM registry.access.redhat.com/ubi8/nodejs-18

USER root

# Install OS updates
RUN yum install --disableplugin=subscription-manager python2 -y \
    && yum clean --disableplugin=subscription-manager packages \
    && ln -s /usr/bin/python2 /usr/bin/python \
    && useradd --uid 1000 --gid 0 --shell /bin/bash --create-home node

RUN npm -v

ENV IBM_DB_INSTALLER_URL https://github.com/ibmdb/db2drivers/raw/main/clidriver

COPY jazzcash-appsody-stack/image/project/package*.json /project/
COPY jazzcash-appsody-stack/image/project/*.js /project/
COPY . /project/user-app/
RUN rm -rf /project/user-app/node_modules && mkdir -p /project/user-app/node_modules

RUN chown -hR root:0 /project

# Install stack dependencies
WORKDIR /project

RUN npm install --unsafe-perm --production

# Install user-app dependencies
WORKDIR /project/user-app
RUN npm install --unsafe-perm --production
RUN npm run build
RUN cp dist/app.js ../../
RUN chown -hR node:0 /project \
    && chmod -R g=u /project
RUN chown -R ⁠ `whoami` ⁠ /opt/app-root/src/.npm

WORKDIR /project

ENV NODE_PATH=/project/user-app/node_modules

ENV NODE_ENV development
ENV PORT 3000

USER node

EXPOSE 3000
CMD ["npm", "start"]
