import {
  Messages,
  Conversations,
  Brands,
  Customers,
  Integrations,
} from './connectors';

export const CONVERSATION_STATUSES = {
  NEW: 'new',
  OPEN: 'open',
  CLOSED: 'closed',
  ALL_LIST: ['new', 'open', 'closed'],
};

/*
 * Get integration by brandCode and integration kind
 */

export const getIntegration = (brandCode, kind) =>
  Brands.findOne({ code: brandCode })
    .then(brand =>
      // find integration by brand
      Integrations.findOne({
        brandId: brand._id,
        kind,
      }),
    );


/*
 * Get customer
 */

export const getCustomer = (integrationId, email) =>
  Customers.findOne({ email, integrationId });


/*
 * Create new customer
 */

export const createCustomer = ({ integrationId, email, name }) => {
  // create new customer
  const customerObj = new Customers({
    createdAt: new Date(),
    email,
    name,
    integrationId,
    inAppMessagingData: {
      lastSeenAt: new Date(),
      isActive: true,
      sessionCount: 1,
    },
  });

  return customerObj.save();
};


/*
 * Get or create customer
 */

export const getOrCreateCustomer = (doc) => {
  const { integrationId, email } = doc;

  // try to find by integrationId and email
  return getCustomer(integrationId, email)
    .then((customerId) => {
      // if found
      if (customerId) {
        return Promise.resolve(customerId);
      }

      // if not, create new
      return createCustomer(doc);
    });
};


/*
 * Create new conversation
 */

export const createConversation = (doc) => {
  const { integrationId, customerId, content } = doc;

  // get total conversations count
  return Conversations.find({ customerId, integrationId }).count().then((count) => {
    // create conversation object
    const conversationObj = new Conversations({
      customerId,
      integrationId,
      content,
      status: CONVERSATION_STATUSES.NEW,
      createdAt: new Date(),
      number: count + 1,
      messageCount: 0,
    });

    // save conversation
    return conversationObj.save();
  });
};


/*
 * Get or create conversation
 */

export const getOrCreateConversation = (doc) => {
  const { conversationId, integrationId, customerId, message } = doc;

  // customer can write message to even closed conversation
  if (conversationId) {
    Conversations.update(
      { _id: conversationId },
      {
        // empty read users list then it will be shown as unread again
        readUserIds: [],

        // if conversation is closed then reopen it.
        status: CONVERSATION_STATUSES.OPEN,
      },
    );

    return Promise.resolve(doc.conversationId);
  }

  // create conversation
  return createConversation({
    customerId,
    integrationId,
    content: message,
  });
};


/*
 * Create new message
 */

export const createMessage = (doc) => {
  const messageOptions = {
    createdAt: new Date(),
    internal: false,
    ...doc,
  };

  // create message object
  const messageObj = new Messages(messageOptions);

  // save and return newly created one
  return messageObj.save().then(_id => Messages.findOne({ _id }));
};


/*
 * Create conversation and message
 */

export const createConversationWithMessage = (doc) => {
  const { integrationId, customerId, content } = doc;

  // create conversation
  return createConversation({
    customerId,
    integrationId,
    content,
  })

  // create message
  .then(conversationId =>
    createMessage({
      conversationId,
      customerId,
      message: content,
    }),
  );
};


/*
 * mark as not active when connection close
 */

export const markCustomerAsNotActive = (customerId) => {
  Customers.update(
    { _id: customerId },
    {
      $set: {
        'inAppMessagingData.isActive': false,
        'inAppMessagingData.lastSeenAt': new Date(),
      },
    },

    () => {},
  );
};
