# Architecture

The application is layered. Dependencies point downwards only: routes call services, and services call domain rules and repositories. Nothing calls upwards.

## Layers

```mermaid
flowchart TB
    Client["Browser or HTTP client"]
    Routes["Routes<br/>src/http"]
    Services["Services<br/>use cases"]
    Rules["Domain rules<br/>src/domain"]
    Repositories["Repositories<br/>data access"]
    Store[("Database or in-memory store")]

    Client --> Routes
    Routes --> Services
    Services --> Rules
    Services --> Repositories
    Repositories --> Store
```

- **Routes** may read HTTP requests, validate transport-level details, call services and map results or errors to HTTP responses. They may not contain business rules or reach into repositories or storage directly.
- **Services** may orchestrate one use case at a time by calling domain rules and repositories. They may not know about HTTP, request objects or response objects.
- **Domain rules** may enforce invariants, calculations and state transitions using plain data. They may not perform I/O, use HTTP, or read and write storage.
- **Repositories** may read and write the database or in-memory store. They may not contain business rules or call services, routes or HTTP code.

## Data model

```mermaid
erDiagram
    USER ||--o{ EVENT : organizes
    USER ||--o{ BOOKING : makes
    EVENT ||--o{ TICKET_TIER : has
    TICKET_TIER ||--o{ BOOKING : booked_as

    USER {
        string id PK
        string name
        string email UK
        string role
    }

    EVENT {
        string id PK
        string organizerId FK
        string title
        string city
        string venue
        string startsAt
        string status
    }

    TICKET_TIER {
        string id PK
        string eventId FK
        string name
        integer priceCents
        integer capacity
        integer sold
    }

    BOOKING {
        string id PK
        string reference UK
        string userId FK
        string tierId FK
        integer quantity
        integer amountCents
        string status
        string createdAt
    }
```

Money is stored as whole cents. A booking belongs to one user and one ticket tier. A tier belongs to one event, and an event belongs to one organizer.

## Booking life cycle

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> paid
    pending --> cancelled
    paid --> checked_in
    paid --> refunded
    paid --> cancelled
    cancelled --> [*]
    refunded --> [*]
    checked_in --> [*]

    note right of cancelled
        cancelled, refunded and checked_in
        are final: no moves leave them.
    end note
```

A new booking starts as `pending`. It may be paid or cancelled. A paid booking may be checked in, refunded or cancelled. `cancelled`, `refunded` and `checked_in` are final states.
