/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-undef */
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
    const { result, statusCode, payment } = await createSquarePayment(payload);
    send(res, statusCode, {
      success: true,
      payment: result.payment,
      request: payment,
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
        order: result.order,
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
      order: result,
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
  post('/complete-payment', completePayment),
  post('/payment', createPayment),
  post('/card', storeCard),
  get('/*', serveStatic)
);
