/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable consistent-return */
/* eslint-disable import/extensions */
/* eslint-disable no-param-reassign */
/* eslint-disable unicorn/import-index */
/* eslint-disable no-undef */
/* eslint-disable func-style */
import store from '../store/index.js';

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const createOrder = async (locationId) => {
  const value = document.querySelector('input[name="food"]:checked').value;
  const id = document.querySelector('input[name="food"]:checked').id;

  const body = {
    locationId,
    lineItems: [
      {
        name: id,
        quantity: '1',
        basePriceMoney: {
          amount: value,
          currency: 'USD',
        },
      },
    ],
  };

  const orderResponse = await fetch('/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (orderResponse.ok) {
    const response = await orderResponse.json();
    store.dispatch('setData', {
      requestBody: JSON.stringify(body, null, 4),
      apiCall: 'POST /v2/orders',
      responseBody: JSON.stringify(response.order, null, 4),
    });
    return response;
  }

  const errorBody = await orderResponse.text();
  throw new Error(errorBody);
};

const createPayment = async (token, paymentData, locationId) => {
  const body = {
    locationId,
    sourceId: token,
    ...paymentData.body,
  };

  const paymentResponse = await fetch('/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (paymentResponse.ok) {
    const response = await paymentResponse.json();
    console.log({ response });
    store.dispatch('setData', {
      requestBody: JSON.stringify(response.request, null, 4),
      apiCall: 'POST /v2/payments',
      responseBody: JSON.stringify(response.payment, null, 4),
    });
    return response;
  }

  const errorBody = await paymentResponse.text();
  throw new Error(errorBody);
};

const tokenize = async (paymentMethod) => {
  const tokenResult = await paymentMethod.tokenize();
  if (tokenResult.status === 'OK') {
    return tokenResult.token;
  } else {
    let errorMessage = `Tokenization failed with status: ${tokenResult.status}`;
    if (tokenResult.errors) {
      errorMessage += ` and errors: ${JSON.stringify(tokenResult.errors)}`;
    }

    throw new Error(errorMessage);
  }
};

const displayPaymentResults = (status) => {
  const statusContainer = document.getElementById('payment-status-container');
  if (status === 'SUCCESS') {
    statusContainer.classList.remove('is-failure');
    statusContainer.classList.add('is-success');
  } else {
    statusContainer.classList.remove('is-success');
    statusContainer.classList.add('is-failure');
  }

  statusContainer.style.visibility = 'visible';
};

export const initializeCards = async (payments) => {
  const card = await payments.card();
  await card.attach('#card-container');

  const giftCard = await payments.giftCard();
  await giftCard.attach('#gift-card-container');

  return { card, giftCard };
};

export const handlePaymentMethodSubmission = async (
  event,
  paymentMethod,
  cardButton,
  paymentData,
  locationId
) => {
  event.preventDefault();
  let paymentResults;
  try {
    // disable the submit button as we await tokenization and make a payment request.
    cardButton.disabled = true;
    const token = await tokenize(paymentMethod);
    paymentResults = await createPayment(token, paymentData, locationId);
    console.debug('Payment Success', paymentResults);
  } catch (e) {
    cardButton.disabled = false;
    console.error(e.message);
  }
  return paymentResults;
};

export const handleCompletePurchase = async ({ orderId, paymentIds }) => {
  const body = {
    orderId,
    paymentIds,
  };
  try {
    const completePaymentResponse = await fetch('/complete-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (completePaymentResponse.ok) {
      const response = await completePaymentResponse.json();
      store.dispatch('setData', {
        requestBody: JSON.stringify(body, null, 4),
        apiCall: `POST /v2/orders/${store.state.data.orderId}/pay`,
        responseBody: JSON.stringify(response.order, null, 4),
      });
      displayPaymentResults('SUCCESS');
      return response;
    }
  } catch (e) {
    displayPaymentResults('FAILURE');

    console.log('error:', e);
  }
};
