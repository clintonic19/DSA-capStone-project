# Build 4 API examples

Start the server with `npm start`. The API uses the `x-user-id` header to
identify the organizer or attendee until Build 7. Replace IDs and values as
needed. Ticket prices are whole cents.

## Create an event

```sh
curl -X POST http://localhost:3000/api/events \
  -H "content-type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Yaba Hub","startsAt":"2027-12-05T17:00:00Z"}'
```

Copy the returned event `id` for the tier and publish requests.

## Add a ticket tier

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers \
  -H "content-type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"name":"General","priceCents":500000,"capacity":100}'
```

Copy the returned tier `id` for the booking request.

## Publish the event

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish \
  -H "x-user-id: organizer-1"
```

## Search published events

```sh
curl "http://localhost:3000/api/events?q=meetup&city=Lagos&maxPriceCents=600000&onlyAvailable=true&sortBy=price"
```

## Book tickets

```sh
curl -X POST http://localhost:3000/api/bookings \
  -H "content-type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"tierId":"TIER_ID","quantity":2}'
```

Copy the returned booking `reference` for payment or cancellation.

## Pay for a booking

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay \
  -H "content-type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{}'
```

To simulate a decline, send `{"decline":true}` instead. A declined payment
returns `PAYMENT_DECLINED` and leaves the booking pending.

## Cancel an unpaid booking

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel \
  -H "x-user-id: attendee-1"
```
