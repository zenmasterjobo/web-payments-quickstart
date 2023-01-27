import store from './store/index.js';

// import Count from './components/count.js';
// import List from './components/list.js';
// import Status from './components/status.js';
import Step from './components/step.js';
import Terminal from './components/terminal.js';

import { handleCreateOrder, handlePaymentMethodSubmission, initializeCards, handleCompletePurchase } from './lib/helpers.js';

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
        const statusContainer = document.getElementById(
            'payment-status-container'
        );
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
            path: '/payment',
            body: {
                money: store.state.data.total * 100,
                autocomplete: false,
                orderId: store.state.data.orderId,
            }
        }
        const result = await handlePaymentMethodSubmission(event, card, cardButton, paymentData);
        store.dispatch('setData', {
            ccPaymentId: result.payment.id
        })
        store.dispatch('nextStep', 1);

    });

    const giftCardButton = document.getElementById('gift-card-button');
    giftCardButton.addEventListener('click', async function (event) {
        const paymentData = {
            path: '/payment',
            body: {
                money: 1000,
                autocomplete: false,
                orderId: store.state.data.orderId,
            }
        }
        const result = await handlePaymentMethodSubmission(event, giftCard, giftCardButton, paymentData);
        store.dispatch('setData', {
            total: (store.state.data.total - 10).toFixed(2),
            gcPaymentId: result.payment.id,
        })
        store.dispatch('nextStep', 1)

    });


});

const orderButton = document.getElementById('order-button');
const completePayment = document.getElementById('complete-payment');

orderButton.addEventListener('click', async () => {
    const result = await handleCreateOrder();
    store.dispatch('setData', {
        orderId: result.order.id,
        itemName: result.order.itemName,
        price: result.order.price,
        total: result.order.price,
    });
    store.dispatch('nextStep', 1);
});

completePayment.addEventListener('click', async () => {
    completePayment.disabled = true
    const result = await handleCompletePurchase({
        orderId: store.state.data.orderId,
        paymentIds: [
            store.state.data.ccPaymentId,
            store.state.data.gcPaymentId
        ]
    });
})

const stepInstance = new Step();
const terminalInstance = new Terminal();

stepInstance.render();
terminalInstance.render();
