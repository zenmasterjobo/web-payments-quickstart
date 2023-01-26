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
        console.log('the result: ', result)
        store.dispatch('setData', {
            apiCall: 'POST /v2/payments',
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
        console.log('the result', result);
        store.dispatch('setData', {
            total: (store.state.data.total - 10).toFixed(2),
            apiCall: 'POST /v2/payments',
            gcPaymentId: result.payment.id,
        })
        store.dispatch('nextStep', 1)

    });


});

// const formElement = document.querySelector('.js-form');
// const inputElement = document.querySelector('#new-item-field');
// const nextButton = document.getElementById('next-step');
const orderButton = document.getElementById('order-button');
const completePayment = document.getElementById('complete-payment');

// formElement.addEventListener('submit', e => {
//     e.preventDefault();
//     let value = inputElement.value.trim();

//     if (value.length) {
//         store.dispatch('addItem', value);
//         inputElement.value = '';
//         inputElement.focus();
//     }
// });


orderButton.addEventListener('click', async (e) => {
    const result = await handleCreateOrder();
    console.log({ result })
    store.dispatch('setData', {
        orderId: result.order.id,
        itemName: result.order.itemName,
        price: result.order.price,
        total: result.order.price,
        apiCall: 'POST /v2/orders',
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
    console.log('the result: ', result);
})

// const countInstance = new Count();
// const listInstance = new List();
// const statusInstance = new Status();
const stepInstance = new Step();
const terminalInstance = new Terminal();

// countInstance.render();
// listInstance.render();
// statusInstance.render();
stepInstance.render();
terminalInstance.render();
