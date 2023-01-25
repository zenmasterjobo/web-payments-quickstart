import store from './store/index.js';

// import Count from './components/count.js';
// import List from './components/list.js';
// import Status from './components/status.js';
import Step from './components/step.js';
import { handleCreateOrder, handlePaymentMethodSubmission, initializeCards } from './lib/helpers.js';

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
        console.log('the card: ', card);
        console.log('the gift card: ', giftCard)
    } catch (e) {
        console.error('Initializing Cards failed', e);
    }
    const cardButton = document.getElementById('card-button');
    cardButton.addEventListener('click', async function (event) {
        const paymentData = {
            path: '/purchase-gift-card',
            body: {
                money: 1000,
                autocomplete: true,
                orderId: store.state.orderId,
            }
        }
        const { result } = await handlePaymentMethodSubmission(event, card, cardButton, paymentData);
        store.dispatch('setData', { giftCardGan: result.gan });
        store.dispatch('nextStep', 1);
    });

    const giftCardButton = document.getElementById('gift-card-button');
    giftCardButton.addEventListener('click', async function (event) {
        const paymentData = {
            path: '/payment',
            body: {
                money: 1000,
                autocomplete: false,
                orderId: store.state.ordierId,
            }

        }
        await handlePaymentMethodSubmission(event, giftCard, giftCardButton, paymentData);
    });


});

// const formElement = document.querySelector('.js-form');
// const inputElement = document.querySelector('#new-item-field');
// const nextButton = document.getElementById('next-step');
const orderButton = document.getElementById('order-button');

// formElement.addEventListener('submit', e => {
//     e.preventDefault();
//     let value = inputElement.value.trim();

//     if (value.length) {
//         store.dispatch('addItem', value);
//         inputElement.value = '';
//         inputElement.focus();
//     }
// });

// nextButton.addEventListener('click', e => {
//     store.dispatch('nextStep', 1);
// })

orderButton.addEventListener('click', async (e) => {
    const result = await handleCreateOrder();
    store.dispatch('setData', { orderId: result.order.id })
    store.dispatch('nextStep', 1);
});

// const countInstance = new Count();
// const listInstance = new List();
// const statusInstance = new Status();
const stepInstance = new Step();

// countInstance.render();
// listInstance.render();
// statusInstance.render();
stepInstance.render();
