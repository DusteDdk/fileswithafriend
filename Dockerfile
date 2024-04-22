FROM node:21-alpine3.18

run mkdir /getmods
add src/package.json /getmods
RUN chown node:node -R /getmods
user root
run npm install --global typescript
user node
run cd /getmods && npm install && npm install --save typescript
run cd /getmods && npm install --save @types/body-parser body-parser

add src /src/
user root
RUN chown node:node -R /src
user node 
run mv /getmods/node_modules /src/node_modules 
workdir /src
run npx tsc && mv dist/client.js client/ && mv dist/main.js .


ENTRYPOINT [ "node" ]
CMD ["./main.js" ]

#docker rm -f sender && docker run -d --restart=always -ti  --name=sender --network=i_webnet sender:latest