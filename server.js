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
  await retry(async (bail, attempt) => {
    try {
      logger.debug('Creating payment', { attempt });

      const idempotencyKey = payload.idempotencyKey || nanoid();
      const payment = {
        idempotencyKey,
        locationId: payload.locationId,
        sourceId: payload.sourceId,
        autocomplete: payload.autocomplete ? true : false,
        // While it's tempting to pass this data from the client
        // Doing so allows bad actor to modify these values
        // Instead, leverage Orders to create an order on the server
        // and pass the Order ID to createPayment rather than raw amounts
        // See Orders documentation: https://developer.squareup.com/docs/orders-api/what-it-does
        amountMoney: {
          // the expected amount is in cents, meaning this is $1.00.
          amount: payload.money || 100,
          // If you are a non-US account, you must change the currency to match the country in which
          // you are accepting the payment.
          currency: 'USD',
        },
      };

      if (payload.orderId) {
        payment.orderId = payload.orderId;
      }

      if (payload.customerId) {
        payment.customerId = payload.customerId;
      }

      // VerificationDetails is part of Secure Card Authentication.
      // This part of the payload is highly recommended (and required for some countries)
      // for 'unauthenticated' payment methods like Cards.
      if (payload.verificationToken) {
        payment.verificationToken = payload.verificationToken;
      }

      console.log('the payment:', payment);
      const { result, statusCode } = await square.paymentsApi.createPayment(
        payment
      );

      const amountMoney = result.payment.amountMoney;
      const cardDetails = result.payment.cardDetails;

      logger.info('Payment succeeded!', {
        result,
        statusCode,
        amountMoney,
        cardDetails,
      });

      send(res, statusCode, {
        success: true,
        payment: {
          id: result.payment.id,
          status: result.payment.status,
          receiptUrl: result.payment.receiptUrl,
          orderId: result.payment.orderId,
        },
      });
    } catch (ex) {
      if (ex instanceof ApiError) {
        // likely an error in the request. don't retry
        logger.error(ex.errors);
        bail(ex);
      } else {
        // IDEA: send to error reporting service
        logger.error(`Error creating payment on attempt ${attempt}: ${ex}`);
        throw ex; // to attempt retry
      }
    }
  });
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
  post('/card', storeCard),
  get('/*', serveStatic)
);
