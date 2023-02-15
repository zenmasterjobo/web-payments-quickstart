/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable unicorn/import-index */
/* eslint-disable import/extensions */
import Component from '../lib/component.js';
import store from '../store/index.js';

export default class Terminal extends Component {
  constructor() {
    super({
      store,
      element: {
        endpoint: document.getElementById('api-request'),
        body: document.getElementById('request-body'),
        response: document.getElementById('response-body'),
      },
    });
  }

  render() {
    this.element.endpoint.innerHTML = store.state.data.apiCall || '';
    this.element.body.innerHTML = store.state.data.requestBody || '';
    this.element.response.innerHTML = store.state.data.responseBody || '';
  }
}
