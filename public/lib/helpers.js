const locationId = 'LHJ1ZXJ8YSV8W';

const getOrder = async (id) => {
    const orderResponse = await fetch(`/order?id=${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    if (orderResponse.ok) {
        return orderResponse.json();
    }

    const errorBody = await orderResponse.text();
    throw new Error(errorBody);
}

const createOrder = async () => {
    const value = document.querySelector('input[name="food"]:checked').value
    const id = document.querySelector('input[name="food"]:checked').id

    const body = JSON.stringify({
        locationId,
        lineItems: [
            {
                name: id,
                quantity: '1',
                basePriceMoney: {
                    amount: value,
                    currency: 'USD'
                }
            }
        ]
    });

    const orderResponse = await fetch('/create-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body,
    });

    if (orderResponse.ok) {
        return orderResponse.json();
    }

    const errorBody = await orderResponse.text();
    throw new Error(errorBody);
}

export const handleCreateOrder = async () => {
    let orderResult;
    try {
        orderResult = await createOrder();
    } catch (e) {
        console.log('no good: ', e);
    }
    return orderResult;
};


const createPayment = async (token, paymentData) => {
    const body = JSON.stringify({
        locationId,
        sourceId: token,
        ...paymentData.body,
    });

    const paymentResponse = await fetch(paymentData.path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body,
    });

    if (paymentResponse.ok) {
        return paymentResponse.json();
    }

    const errorBody = await paymentResponse.text();
    throw new Error(errorBody);
}

const tokenize = async (paymentMethod) => {
    console.log('the payment method: ', paymentMethod)
    const tokenResult = await paymentMethod.tokenize();
    if (tokenResult.status === 'OK') {
        return tokenResult.token;
    } else {
        let errorMessage = `Tokenization failed with status: ${tokenResult.status}`;
        if (tokenResult.errors) {
            errorMessage += ` and errors: ${JSON.stringify(
                tokenResult.errors
            )}`;
        }

        throw new Error(errorMessage);
    }
}

const displayPaymentResults = (status) => {
    const statusContainer = document.getElementById(
        'payment-status-container'
    );
    if (status === 'SUCCESS') {
        statusContainer.classList.remove('is-failure');
        statusContainer.classList.add('is-success');
    } else {
        statusContainer.classList.remove('is-success');
        statusContainer.classList.add('is-failure');
    }

    statusContainer.style.visibility = 'visible';
}

export const initializeCards = async (payments) => {
    const card = await payments.card();
    await card.attach('#card-container');

    const giftCard = await payments.giftCard();
    await giftCard.attach('#gift-card-container');

    return { card, giftCard };
}


export const handlePaymentMethodSubmission = async (event, paymentMethod, cardButton, paymentData) => {
    event.preventDefault();
    let paymentResults
    try {
        // disable the submit button as we await tokenization and make a payment request.
        cardButton.disabled = true;
        const token = await tokenize(paymentMethod);
        paymentResults = await createPayment(token, paymentData);
        displayPaymentResults('SUCCESS');
        console.debug('Payment Success', paymentResults);
    } catch (e) {
        cardButton.disabled = false;
        displayPaymentResults('FAILURE');
        console.error(e.message);
    }
    return paymentResults
}
