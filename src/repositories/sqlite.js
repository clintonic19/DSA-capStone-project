import { createConnection, DEFAULT_DATABASE_PATH } from '../db/connection.js';

function mapEvent(row, tierIds) {
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    organizerId: row.organizerId,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.startsAt,
    status: row.status,
    tierIds,
  };
};

function mapTier(row) {
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    priceCents: row.priceCents,
    capacity: row.capacity,
    sold: row.sold,
  };
};

function mapBooking(row) {
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    reference: row.reference,
    userId: row.userId,
    tierId: row.tierId,
    quantity: row.quantity,
    amountCents: row.amountCents,
    status: row.status,
    createdAt: row.createdAt,
  };
};

export function createSqliteRepository({
  databasePath = DEFAULT_DATABASE_PATH,
} = {}) {
  const database = createConnection(databasePath);
  const insertUser = database.prepare(
    'INSERT OR IGNORE INTO users (id) VALUES (?)',
  );
  const getEventRow = database.prepare(
    `SELECT id, organizer_id AS organizerId, title, city, venue,
            starts_at AS startsAt, status
     FROM events WHERE id = ?`,
  );
  const getTierIds = database.prepare(
    'SELECT id FROM ticket_tiers WHERE event_id = ?',
  );
  const getTierRow = database.prepare(
    `SELECT id, event_id AS eventId, name, price_cents AS priceCents,
            capacity, sold
     FROM ticket_tiers WHERE id = ?`,
  );
  const getBookingByReferenceRow = database.prepare(
    `SELECT id, reference, user_id AS userId, tier_id AS tierId, quantity,
            amount_cents AS amountCents, status, created_at AS createdAt
     FROM bookings WHERE reference = ?`,
  );

  function readEvent(row) {
    if (!row) {
      return undefined;
    }

    const tierIds = getTierIds.all(row.id).map((tier) => tier.id);
    return mapEvent(row, tierIds);
  }

  return {
    async createEvent(event) {
      insertUser.run(event.organizerId);
      database
        .prepare(
          `INSERT INTO events
            (id, organizer_id, title, city, venue, starts_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.organizerId,
          event.title,
          event.city,
          event.venue,
          event.startsAt,
          event.status,
        );
      return readEvent(getEventRow.get(event.id));
    },

    async saveEvent(event) {
      insertUser.run(event.organizerId);
      database
        .prepare(
          `INSERT INTO events
            (id, organizer_id, title, city, venue, starts_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             organizer_id = excluded.organizer_id,
             title = excluded.title,
             city = excluded.city,
             venue = excluded.venue,
             starts_at = excluded.starts_at,
             status = excluded.status`,
        )
        .run(
          event.id,
          event.organizerId,
          event.title,
          event.city,
          event.venue,
          event.startsAt,
          event.status,
        );
      return readEvent(getEventRow.get(event.id));
    },

    async getEvent(id) {
      return readEvent(getEventRow.get(id));
    },

    async listEvents() {
      return database
        .prepare(
          `SELECT id, organizer_id AS organizerId, title, city, venue,
                  starts_at AS startsAt, status
           FROM events`,
        )
        .all()
        .map(readEvent);
    },

    async createTier(tier) {
      database
        .prepare(
          `INSERT INTO ticket_tiers
            (id, event_id, name, price_cents, capacity, sold)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          tier.id,
          tier.eventId,
          tier.name,
          tier.priceCents,
          tier.capacity,
          tier.sold,
        );
      return mapTier(getTierRow.get(tier.id));
    },

    async getTier(id) {
      return mapTier(getTierRow.get(id));
    },

    async saveTier(tier) {
      database
        .prepare(
          `INSERT INTO ticket_tiers
            (id, event_id, name, price_cents, capacity, sold)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             event_id = excluded.event_id,
             name = excluded.name,
             price_cents = excluded.price_cents,
             capacity = excluded.capacity,
             sold = excluded.sold`,
        )
        .run(
          tier.id,
          tier.eventId,
          tier.name,
          tier.priceCents,
          tier.capacity,
          tier.sold,
        );
      return mapTier(getTierRow.get(tier.id));
    },

    async listTiers() {
      return database
        .prepare(
          `SELECT id, event_id AS eventId, name, price_cents AS priceCents,
                  capacity, sold
           FROM ticket_tiers`,
        )
        .all()
        .map(mapTier);
    },

    async listTiersForEvent(eventId) {
      return database
        .prepare(
          `SELECT id, event_id AS eventId, name, price_cents AS priceCents,
                  capacity, sold
           FROM ticket_tiers WHERE event_id = ?`,
        )
        .all(eventId)
        .map(mapTier);
    },

    async createBooking(booking) {
      insertUser.run(booking.userId);
      database
        .prepare(
          `INSERT INTO bookings
            (id, reference, user_id, tier_id, quantity, amount_cents, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          booking.id,
          booking.reference,
          booking.userId,
          booking.tierId,
          booking.quantity,
          booking.amountCents,
          booking.status,
          booking.createdAt,
        );
      return mapBooking(getBookingByReferenceRow.get(booking.reference));
    },

    async getBookingByReference(reference) {
      return mapBooking(getBookingByReferenceRow.get(reference));
    },

    async saveBooking(booking) {
      insertUser.run(booking.userId);
      database
        .prepare(
          `INSERT INTO bookings
            (id, reference, user_id, tier_id, quantity, amount_cents, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             reference = excluded.reference,
             user_id = excluded.user_id,
             tier_id = excluded.tier_id,
             quantity = excluded.quantity,
             amount_cents = excluded.amount_cents,
             status = excluded.status,
             created_at = excluded.created_at`,
        )
        .run(
          booking.id,
          booking.reference,
          booking.userId,
          booking.tierId,
          booking.quantity,
          booking.amountCents,
          booking.status,
          booking.createdAt,
        );
      return mapBooking(getBookingByReferenceRow.get(booking.reference));
    },

    async listBookings() {
      return database
        .prepare(
          `SELECT id, reference, user_id AS userId, tier_id AS tierId, quantity,
                  amount_cents AS amountCents, status, created_at AS createdAt
           FROM bookings`,
        )
        .all()
        .map(mapBooking);
    },

    close() {
      database.close();
    },
  };
}
