/* eslint-disable no-console */

import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createServer } from 'http';
import { graphqlExpress, graphiqlExpress } from 'graphql-server-express';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { connect } from './db/connection';
import { markCustomerAsNotActive } from './db/utils';
import schema from './data';
import { subscriptionManager } from './data/subscriptionManager';

// load environment variables
dotenv.config();

// connect to mongo database
connect();

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors());

app.use('/graphql', graphqlExpress({ schema }));

if (process.env.NODE_ENV === 'development') {
  app.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));
}

const server = createServer(app);
const { PORT } = process.env;

const SUBSCRIPTION_PATH = '/subscriptions';

server.listen(PORT, () => {
  console.log(`GraphQL server is running on port ${PORT}`);
  console.log(`Websocket server is running on port ${PORT}${SUBSCRIPTION_PATH}`);

  new SubscriptionServer(
    {
      subscriptionManager,
      onConnect(connectionParams, webSocket) {
        webSocket.on('message', message => {
          const parsedMessage = JSON.parse(message);

          if (parsedMessage.type === 'messengerConnected') {
            webSocket.messengerData = parsedMessage.value;
          }
        });
      },
      onDisconnect(webSocket) {
        const messengerData = webSocket.messengerData;

        if (messengerData) {
          markCustomerAsNotActive(messengerData.customerId);
        }
      },
    },
    {
      server,
      path: SUBSCRIPTION_PATH,
    },
  );
});
