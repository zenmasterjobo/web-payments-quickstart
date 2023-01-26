// micro provides http helpers
const { createError, json, send } = require('micro');
// microrouter provides http server routing
const { router, get, post } = require('microrouter');
// serve-handler serves static assets
const staticHandler = require('serve-handler');
// async-retry will retry failed API requests
const retry = require('async-retry');

// logger gives us insight into what's happening
const logger = require('./server/logger');
// schema validates incoming requests
const {
  //  validatePaymentPayload,
  validateCreateCardPayload,
} = require('./server/schema');
// square provides the API client and error types
const { ApiError, client: square } = require('./server/square');
const { nanoid } = require('nanoid');
const { createSquarePayment } = require('./server/server-helpers');

// todo: make this nicer
BigInt.prototype.toJSON = function () {
  return this.toString();
};

async function createPayment(req, res) {
  const payload = await json(req);
  logger.debug(JSON.stringify(payload));
  // We validate the payload for specific fields. You may disable this feature
  // if you would prefer to handle payload validation on your own.

  // TODO: adapt payload to accept autocomplete and partialAuth
  // if (!validatePaymentPayload(payload)) {
  //   throw createError(400, 'Bad Request');
  // }
  try {
    const { result, statusCode } = await createSquarePayment(payload);
    send(res, statusCode, {
      success: true,
      payment: {
        id: result.payment.id,
        status: result.payment.status,
        receiptUrl: result.payment.receiptUrl,
        orderId: result.payment.orderId,
      },
    });
  } catch (e) {
    console.log('There was an error creating the payment:', e);
  }
}

async function storeCard(req, res) {
  const payload = await json(req);

  if (!validateCreateCardPayload(payload)) {
    throw createError(400, 'Bad Request');
  }
  await retry(async (bail, attempt) => {
    try {
      logger.debug('Storing card', { attempt });

      const idempotencyKey = payload.idempotencyKey || nanoid();
      const cardReq = {
        idempotencyKey,
        sourceId: payload.sourceId,
        card: {
          customerId: payload.customerId,
        },
      };

      if (payload.verificationToken) {
        cardReq.verificationToken = payload.verificationToken;
      }

      const { result, statusCode } = await square.cardsApi.createCard(cardReq);

      logger.info('Store Card succeeded!', { result, statusCode });

      // remove 64-bit value from response
      delete result.card.expMonth;
      delete result.card.expYear;

      send(res, statusCode, {
        success: true,
        card: result.card,
      });
    } catch (ex) {
      if (ex instanceof ApiError) {
        // likely an error in the request. don't retry
        logger.error(ex.errors);
        bail(ex);
      } else {
        // IDEA: send to error reporting service
        logger.error(
          `Error creating card-on-file on attempt ${attempt}: ${ex}`
        );
        throw ex; // to attempt retry
      }
    }
  });
}

async function createOrder(req, res) {
  const payload = await json(req);
  logger.debug(JSON.stringify(payload));

  await retry(async (bail, attempt) => {
    try {
      logger.debug('Creating Order', { attempt });

      const idempotencyKey = payload.idempotencyKey || nanoid();
      const body = {
        idempotencyKey,
        order: {
          locationId: payload.locationId,
          lineItems: payload.lineItems,
        },
      };

      const { result, statusCode } = await square.ordersApi.createOrder(body);

      const orderId = result.order.id;

      logger.info('Create Order succeeded!', {
        result,
        statusCode,
        orderId,
      });

      send(res, statusCode, {
        success: true,
        order: {
          id: result.order.id,
          status: result.order.status,
          itemName: result.order.lineItems[0].name,
          price: (Number(result.order.totalMoney.amount) / 100).toFixed(2),
        },
      });
    } catch (ex) {
      if (ex instanceof ApiError) {
        // likely an error in the request. don't retry
        logger.error(ex.errors);
        bail(ex);
      } else {
        // IDEA: send to error reporting service
        logger.error(`Error creating order on attempt ${attempt}: ${ex}`);
        throw ex; // to attempt retry
      }
    }
  });
}

async function getOrder(req, res) {
  const { id } = req.query;
  try {
    const { result, statusCode } = await square.ordersApi.retrieveOrder(id);
    logger.info('Retrieve Order succeeded!', {
      result,
      statusCode,
    });

    send(res, statusCode, result);
  } catch (e) {
    logger.error('Error fetching order', e);
  }
}

async function completePayment(req, res) {
  const payload = await json(req);
  logger.debug(JSON.stringify(payload));

  try {
    logger.debug('Completing Payment');

    const idempotencyKey = payload.idempotencyKey || nanoid();
    const body = {
      idempotencyKey,
      paymentIds: payload.paymentIds,
    };

    const { result, statusCode } = await square.ordersApi.payOrder(
      payload.orderId,
      body
    );

    logger.info('Complete Payment succeeded!', {
      result,
      statusCode,
    });

    send(res, statusCode, {
      success: true,
      order: {
        id: result.order.id,
        status: result.order.state,
        result: result.order,
      },
    });
  } catch (ex) {
    if (ex instanceof ApiError) {
      // likely an error in the request. don't retry
      logger.error(ex.errors);
    } else {
      // IDEA: send to error reporting service
      logger.error(`Error completing payment: ${ex}`);
      throw ex; // to attempt retry
    }
  }
}

async function purchaseGiftCard(req, res) {
  // Step 1: Create order for the requested amount
  const payload = await json(req);
  const idempotencyKey = payload.idempotencyKey || nanoid();
  let body = {
    idempotencyKey,
    order: {
      locationId: payload.locationId,
      // fulfillments: [
      //   {
      //     type: 'SHIPMENT',
      //     shipment_details: {
      //       recipient: {
      //         display_name: 'John Doe',
      //       },
      //     },
      //   },
      // ],
      lineItems: [
        {
          name: 'Square Sandbox Giftcard',
          itemType: 'GIFT_CARD',
          quantity: '1',
          basePriceMoney: {
            amount: 1000,
            currency: 'USD',
          },
        },
      ],
    },
  };
  let result, statusCode;
  try {
    ({ result, statusCode } = await square.ordersApi.createOrder(body));
  } catch (e) {
    logger.error('failed to create giftcard order', e);
  }
  if (statusCode !== 200) {
    send(res, statusCode, { success: false });
    return;
  }

  // Step 2: Pay for the order
  const orderId = result.order.id;
  const lineItemUid = result.order.lineItems[0].uid;
  const data = {
    ...payload,
    orderId,
    autocomplete: true,
  };

  ({ result, statusCode } = await createSquarePayment(data));
  if (statusCode !== 200) {
    send(res, statusCode, { success: false });
    return;
  }

  // Step 3: Create a gift Card
  try {
    ({ result, statusCode } = await square.giftCardsApi.createGiftCard({
      idempotencyKey: nanoid(),
      locationId: payload.locationId,
      giftCard: {
        type: 'DIGITAL',
      },
    }));
  } catch (e) {
    logger.error('failed to create giftcard', e);
  }

  if (statusCode !== 200) {
    send(res, statusCode, { success: false });
    return;
  }

  // Step 4: Activate the gift card

  try {
    ({ result, statusCode } =
      await square.giftCardActivitiesApi.createGiftCardActivity({
        idempotencyKey: nanoid(),
        giftCardActivity: {
          type: 'ACTIVATE',
          locationId: payload.locationId,
          giftCardGan: result.giftCard.gan,
          activateActivityDetails: {
            orderId,
            lineItemUid,
          },
        },
      }));

    console.log(result);
  } catch (error) {
    console.log(error);
  }

  if (statusCode !== 200) {
    send(res, statusCode, { success: false });
    return;
  }

  send(res, statusCode, {
    success: true,
    result: {
      gan: result.giftCardActivity.giftCardGan,
    },
  });
}

// serve static files like index.html and favicon.ico from public/ directory
async function serveStatic(req, res) {
  logger.debug('Handling request', req.path);
  await staticHandler(req, res, {
    public: 'public',
  });
}

// export routes to be served by micro
module.exports = router(
  post('/create-order', createOrder),
  get('/order', getOrder),
  post('/complete-payment', completePayment),
  post('/payment', createPayment),
  post('/purchase-gift-card', purchaseGiftCard),
  post('/card', storeCard),
  get('/*', serveStatic)
);
