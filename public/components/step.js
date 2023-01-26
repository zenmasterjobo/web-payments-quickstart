import Component from '../lib/component.js';
import store from '../store/index.js';

export default class Step extends Component {
    constructor() {
        super({
            store,
            element: {
                step1: document.querySelector('.section-step1'),
                step2: document.querySelector('#section-step2'),
                step3: document.querySelector('#section-step3'),
                step4: document.querySelector('.section-step4'),
                step5: document.querySelector('.section-step5'),
                orderId: document.getElementById('order-number-text'),
                itemName: document.getElementById('item-title'),
                price: document.getElementById('price'),
                total: document.getElementById('total'),
                cardButton: document.getElementById('card-button'),
                appliedGiftcard: document.getElementById('applied-gift-card'),
                appliedCreditcard: document.getElementById('applied-credit-card'),
            },
            nextButton: document.getElementById('nextStep'),
        });
    }

    render() {
        switch (store.state.currentStep) {
            case 1:
                this.element.step1.style.display = 'block';
                break;
            case 2:
                this.element.step1.style.display = 'none';
                this.element.step2.style.display = 'flex';
                break;
            case 3:
                this.element.step2.style.display = 'none';
                this.element.step3.style.display = 'flex';
                this.element.orderId.innerHTML = `Order ID: ${store.state.data.orderId}`;
                this.element.itemName.innerHTML = `Item: ${store.state.data.itemName}`;
                this.element.price.innerHTML = `Order Total: $${store.state.data.price}`;
                this.element.total.innerHTML = `Amount Due: $${store.state.data.total}`;
                break;
            case 4:
                this.element.step3.style.display = 'none';
                this.element.step4.style.display = 'block';
                this.element.appliedGiftcard.innerHTML = "Gift Card: -$10.00";
                this.element.cardButton.innerHTML = `Pay: $${store.state.data.total}`
                break;
            case 5:
                this.element.step4.style.display = 'none';
                this.element.step5.style.display = 'block';
                this.element.appliedCreditcard.innerHTML = `Credit Card: -$${store.state.data.total}`;
                this.element.total.innerHTML = 'Amount Due: $0';
                break;
            default:
                this.nextButton.disabled = true;
                break;
        }
    }
}
