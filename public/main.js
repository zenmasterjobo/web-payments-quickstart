/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable require-atomic-updates */
/* eslint-disable unicorn/import-index */
/* eslint-disable import/extensions */
import store from './store/index.js';

import Step from './components/step.js';
import Terminal from './components/terminal.js';

import {
  handleCreateOrder,
  handlePaymentMethodSubmission,
  initializeCards,
  handleCompletePurchase,
} from './lib/helpers.js';

const appId = 'sandbox-sq0idb-EdHsYlG8TPVZUe8vt1jHxg';
const locationId = 'LHJ1ZXJ8YSV8W';

document.addEventListener('DOMContentLoaded', async function () {
  if (!window.Square) {
    throw new Error('Square.js failed to load properly');
  }

  let payments;
  try {
    payments = window.Square.payments(appId, locationId);
  } catch {
    const statusContainer = document.getElementById('payment-status-container');
    statusContainer.className = 'missing-credentials';
    statusContainer.style.visibility = 'visible';
    return;
  }

  let card, giftCard;
  try {
    ({ card, giftCard } = await initializeCards(payments));
  } catch (e) {
    console.error('Initializing Cards failed', e);
  }
  const cardButton = document.getElementById('card-button');
  cardButton.addEventListener('click', async function (event) {
    const paymentData = {
      body: {
        money: store.state.data.total * 100,
        autocomplete: false,
        orderId: store.state.data.orderId,
      },
    };
    const result = await handlePaymentMethodSubmission(
      event,
      card,
      cardButton,
      paymentData
    );
    const amount = (result.payment.amountMoney.amount / 100).toFixed(2);
    store.dispatch('setData', {
      ccPaymentId: result.payment.id,
      ccAmountPaid: amount,
      total: 0,
    });
    store.dispatch('nextStep', 1);
  });

  const giftCardButton = document.getElementById('gift-card-button');
  giftCardButton.addEventListener('click', async function (event) {
    const paymentData = {
      body: {
        money: 1000,
        autocomplete: false,
        orderId: store.state.data.orderId,
      },
    };
    const result = await handlePaymentMethodSubmission(
      event,
      giftCard,
      giftCardButton,
      paymentData
    );
    const amount = (result.payment.amountMoney.amount / 100).toFixed(2);
    store.dispatch('setData', {
      total: (store.state.data.total - amount).toFixed(2),
      gcPaymentId: result.payment.id,
      gcAmountPaid: amount,
    });
    giftCardButton.disabled = true;
    document.getElementById('credit-card-section').style.display = 'block';
  });
});

const orderButton = document.getElementById('order-button');
const completePayment = document.getElementById('complete-payment');
const copyGiftCard = document.getElementById('square-gift-card');

orderButton.addEventListener('click', async () => {
  const result = await handleCreateOrder();
  const item = result.order.lineItems[0];
  store.dispatch('setData', {
    orderId: result.order.id,
    itemName: item.name,
    price: (item.basePriceMoney.amount / 100).toFixed(2),
    total: (result.order.netAmountDueMoney.amount / 100).toFixed(2),
  });
  store.dispatch('nextStep', 1);
});

completePayment.addEventListener('click', async () => {
  completePayment.disabled = true;
  await handleCompletePurchase({
    orderId: store.state.data.orderId,
    paymentIds: [store.state.data.ccPaymentId, store.state.data.gcPaymentId],
  });
});

copyGiftCard.addEventListener('click', () => {
  navigator.clipboard.writeText('7783 3200 0000 0000');
  const tooltip = document.getElementById('myTooltip');
  tooltip.innerHTML = 'Copied';
});

const stepInstance = new Step();
const terminalInstance = new Terminal();
stepInstance.render();
terminalInstance.render();
