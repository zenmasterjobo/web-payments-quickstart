/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-prototype-builtins */
/* eslint-disable filenames/match-exported */
export default class PubSub {
  constructor() {
    this.events = {};
  }

  subscribe(event, callback) {
    const self = this;

    if (!self.events.hasOwnProperty(event)) {
      self.events[event] = [];
    }

    return self.events[event].push(callback);
  }

  publish(event, data = {}) {
    const self = this;

    if (!self.events.hasOwnProperty(event)) {
      return [];
    }

    return self.events[event].map((callback) => callback(data));
  }
}
