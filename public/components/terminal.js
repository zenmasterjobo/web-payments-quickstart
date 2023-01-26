import Component from '../lib/component.js';
import store from '../store/index.js';

export default class Terminal extends Component {
    constructor() {
        super({
            store,
            element: document.querySelector('#api-request')
        });
    }

    render() {
        this.element.innerHTML = store.state.data.apiCall || ""
    }
}
