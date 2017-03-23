/* eslint-env mocha */

import { expect } from 'chai';
import { Customers, Brands, Integrations, Conversations, Messages } from '../connectors';
import { createCustomer, createConversation, createMessage } from '../utils';
import { brandFactory, integrationFactory } from './factories';
import inAppMutations from '../inapp-mutations';


// helper function that calls then and catch on given promise
const expectPromise = (done, promise, callback) => {
  // success callback
  promise.then((...params) => {
    callback(...params);

  // catch exception
  }).catch((error) => {
    done(error);
  });
};

describe('Mutations', () => {
  describe('inAppConnect', () => {
    let integrationId;
    let customerId;

    const brandCode = 'code';
    const email = 'email@domain.com';

    // create initial values
    beforeEach((done) => {
      // create brand
      brandFactory({ code: brandCode }).then((brandId) => {
        integrationFactory({ brandId, kind: 'in_app_messaging' }).then(({ _id }) => {
          integrationId = _id;
          done();
        });
      });
    });

    // remove previous datas
    afterEach((done) => {
      const p1 = Customers.remove({});
      const p2 = Integrations.remove({});
      const p3 = Brands.remove({});
      const p4 = Conversations.remove({});
      const p5 = Messages.remove({});

      expectPromise(done, Promise.all([p1, p2, p3, p4, p5]), () => { done(); });
    });

    describe('first time', () => {
      beforeEach((done) => {
        // there must be no customer
        expectPromise(done, Customers.find().count(), (count) => {
          expect(count).to.equal(0);
          done();
        });
      });

      it('first time', (done) => {
        // call mutation
        expectPromise(
          done,
          inAppMutations.inAppConnect({}, { brandCode, email }),
          (res) => {
            // must return integrationId and newly created customerId
            expect(res.integrationId).to.not.equal(undefined);
            expect(res.customerId).to.not.equal(undefined);

            // must be created 1 customer
            const p1 = Customers.find().count().then((count) => {
              expect(count).to.equal(1);
            });

            // check customer fields
            const p2 = Customers.findOne({}).then((customer) => {
              expect(customer.email).to.equal(email);
              expect(customer.inAppMessagingData.lastSeenAt).to.not.equal(undefined);
              expect(customer.inAppMessagingData.isActive).to.equal(true);
              expect(customer.inAppMessagingData.sessionCount).to.equal(1);
            });

            expectPromise(done, Promise.all([p1, p2]), () => { done(); });
          });
      });
    });

    describe('second time', () => {
      beforeEach((done) => {
        // create initial customer
        createCustomer({ integrationId, email }).then((customer) => {
          customerId = customer._id;

          done();
        });
      });

      it('second time', (done) => {
        // call mutation
        expectPromise(
          done,
          inAppMutations.inAppConnect({}, { brandCode, email }),
          (res) => {
            // must return integrationId and old customerId
            expect(res.integrationId).to.equal(integrationId);
            expect(res.customerId).to.equal(customerId);

            // must not created any customer
            const p1 = Customers.find().count().then((count) => {
              expect(count).to.equal(1);
            });

            expectPromise(done, Promise.all([p1]), () => { done(); });
          });
      });
    });
  });

  describe('in app insert message', () => {
    const integrationId = 'DFDFDFDFD';
    const customerId = 'JJJELJKFJDF';

    // remove previous datas
    after((done) => {
      const p1 = Conversations.remove({});
      const p2 = Messages.remove({});

      expectPromise(done, Promise.all([p1, p2]), () => { done(); });
    });

    describe('first time', () => {
      beforeEach((done) => {
        // there must be no conversation
        expectPromise(done, Conversations.find().count(), (count) => {
          expect(count).to.equal(0);
          done();
        });
      });

      it('first time', (done) => {
        const message = 'hi';
        const attachments = [{ url: 'url' }];
        const args = { integrationId, customerId, message, attachments };

        // call mutation
        expectPromise(
          done,
          inAppMutations.insertMessage({}, args),
          (messageObj) => {
            // check message fields
            expect(messageObj.content).to.equal(message);
            expect(messageObj.attachments[0].url).to.equal(attachments[0].url);
            expect(messageObj.conversationId).to.not.equal(undefined);
            expect(messageObj.createdAt).to.not.equal(undefined);
            expect(messageObj.customerId).to.equal(customerId);
            expect(messageObj.internal).to.equal(false);

            // must be created 1 conversation
            const p1 = Conversations.find().count().then((count) => {
              expect(count).to.equal(1);
            });

            // check conversation fields
            const p2 = Conversations.findOne({}).then((conversation) => {
              expect(conversation.customerId).to.equal(customerId);
              expect(conversation.integrationId).to.equal(integrationId);
              expect(conversation.content).to.equal(message);
              expect(conversation.status).to.equal('open');
              expect(conversation.number).to.equal(1);
              expect(conversation.messageCount).to.equal(0);
              expect(messageObj.createdAt).to.not.equal(undefined);
            });

            expectPromise(done, Promise.all([p1, p2]), () => { done(); });
          });
      });
    });

    describe('second time', () => {
      it('second time', (done) => {
        const message = 'hi again';
        const conversationId = 'FDFDFDFDFDFA';
        const args = { integrationId, customerId, message, conversationId };

        // call mutation
        expectPromise(
          done,
          inAppMutations.insertMessage({}, args),
          (messageObj) => {
            // check message fields
            expect(messageObj.conversationId).to.equal(conversationId);
            expect(messageObj.content).to.equal(message);

            // must be created 1 message again
            const p1 = Messages.find().count().then((count) => {
              expect(count).to.equal(2);
            });

            // must not create any conversation
            const p2 = Conversations.find().count().then((count) => {
              expect(count).to.equal(1);
            });

            expectPromise(done, Promise.all([p1, p2]), () => { done(); });
          });
      });
    });
  });

  describe('readConversationMessages', () => {
    let conversationId;

    const integrationId = 'KDFJKJKETJEFDF';
    const customerId = 'DFDFDEERER';
    const userId = 'JEKJRELKEJFD';

    // find conversation's unread messages
    const findMessages = () =>
      Messages.find({
        conversationId,
        userId: { $exists: true },
        isCustomerRead: { $exists: false },
      });

    beforeEach((done) => {
      // create conversation
      const promise = createConversation({
        integrationId,
        customerId,
        content: 'hi',
      })

      // create message
      .then((conversation) => {
        // save created conversation's id
        conversationId = conversation._id;

        createMessage({
          conversationId,
          userId,
          customerId,
          message: 'hi',
        });
      });

      expectPromise(done, promise, () => {
        // check whether or not there is 1 unread message
        expectPromise(done, findMessages().count(), (count) => {
          expect(count).to.equal(1);
          done();
        });
      });
    });

    it('readConversationMessages', (done) => {
      // call mutation
      expectPromise(
        done,
        inAppMutations.readConversationMessages({}, { conversationId }),
        () => {
          // check whether or not all messages are marked as read
          expectPromise(done, findMessages().count(), (count) => {
            expect(count).to.equal(0);
            done();
          });
        });
    });
  });
});
