export default {
    addItem(state, payload) {
        state.items.push(payload);

        return state;
    },
    clearItem(state, payload) {
        state.items.splice(payload.index, 1);

        return state;
    },
    nextStep(state, payload) {
        state.currentStep = state.currentStep + payload;
        return state;
    },
    setData(state, payload) {
        state.data = { ...state.data, ...payload };
        return state;
    },
};
