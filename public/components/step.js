import Component from '../lib/component.js';
import store from '../store/index.js';

export default class Step extends Component {
    constructor() {
        super({
            store,
            element: {
                step1: document.querySelector('.section-step1'),
                step2: document.querySelector('.section-step2'),
                step3: document.querySelector('.section-step3'),
                step4: document.querySelector('.section-step4'),
                orderId: document.getElementById('order-number-text'),
                giftCard: document.getElementById('square-gift-card'),
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
                this.element.step3.style.display = 'block';
                this.element.orderId.innerHTML = `Order Id: ${store.state.data.orderId}`;
                this.element.giftCard.innerHTML = `Your Gift Card GAN: ${store.state.data.giftCardGan}`;
                break;
            case 4:
                this.element.step3.style.display = 'none';
                this.element.step4.style.display = 'block';
                break;
            default:
                this.nextButton.disabled = true;
                break;
        }
    }
}
