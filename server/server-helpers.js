/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable func-style */
// async-retry will retry failed API requests
const retry = require('async-retry');
// logger gives us insight into what's happening
const logger = require('./logger');
const { nanoid } = require('nanoid');
const { ApiError, client: square } = require('./square');

const createSquarePayment = async (payload) => {
  let payment, result, statusCode;
  await retry(async (bail, attempt) => {
    try {
      console.log('hello');
      logger.debug('Creating payment', { attempt });

      const idempotencyKey = payload.idempotencyKey || nanoid();
      payment = {
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
          amount: payload.money || 2000000,
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

      ({ result, statusCode } = await square.paymentsApi.createPayment(
        payment
      ));

      const amountMoney = result.payment.amountMoney;
      const cardDetails = result.payment.cardDetails;

      logger.info('Payment succeeded!', {
        result,
        statusCode,
        amountMoney,
        cardDetails,
      });
    } catch (ex) {
      console.log('we are catching', ex);
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
  return { result, statusCode, payment };
};

module.exports = {
  createSquarePayment,
};
