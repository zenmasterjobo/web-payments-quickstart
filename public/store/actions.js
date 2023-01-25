export default {
    addItem(context, payload) {
        context.commit('addItem', payload);
    },
    clearItem(context, payload) {
        context.commit('clearItem', payload);
    },
    nextStep(context, payload) {
        context.commit('nextStep', payload)
    },
    setData(context, payload) {
        context.commit('setData', payload)
    }
};
