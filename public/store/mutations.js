/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-param-reassign */
export default {
  nextStep(state, payload) {
    state.currentStep = state.currentStep + payload;
    return state;
  },
  setData(state, payload) {
    state.data = { ...state.data, ...payload };
    return state;
  },
};
