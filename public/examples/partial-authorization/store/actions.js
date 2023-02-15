export default {
  nextStep(context, payload) {
    context.commit('nextStep', payload);
  },
  setData(context, payload) {
    context.commit('setData', payload);
  },
};
