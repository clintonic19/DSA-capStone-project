export function createMockPaymentGateway() {
  return {
    async charge({ decline = false } = {}) {
      if (decline) {
        return { success: false };
      }

      return { success: true };
    },
  };
}
