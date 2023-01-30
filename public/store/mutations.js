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
