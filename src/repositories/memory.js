export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  const bookingsByReference = new Map();

  return {
    async createEvent(event) {
      events.set(event.id, event);
      return event;
    },

    async saveEvent(event) {
      events.set(event.id, event);
      return event;
    },

    async getEvent(id) {
      return events.get(id);
    },

    async listEvents() {
      return [...events.values()];
    },

    async createTier(tier) {
      tiers.set(tier.id, tier);
      return tier;
    },

    async getTier(id) {
      return tiers.get(id);
    },

    async saveTier(tier) {
      tiers.set(tier.id, tier);
      return tier;
    },

    async listTiers() {
      return [...tiers.values()];
    },

    async listTiersForEvent(eventId) {
      return [...tiers.values()].filter((tier) => tier.eventId === eventId);
    },

    async createBooking(booking) {
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking);
      return booking;
    },

    async getBookingByReference(reference) {
      return bookingsByReference.get(reference);
    },

    async saveBooking(booking) {
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking);
      return booking;
    },

    async listBookings() {
      return [...bookings.values()];
    },
  };
}
