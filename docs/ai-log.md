# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

### Prompt 2:
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

Things I was unsure about on BUILD-2:
- docs/build-2.md still has the S04 placeholder, so there were no class-written publishing criteria. I tested inferred rules: publishing with tiers makes it public, publishing without tiers is INVALID_STATE, publishing a missing event is NOT_FOUND, and drafts stay hidden.

- The prompt does not define the summary object shape. I used id, title, city, venue, startsAt, status, tierCount, tierIds, cheapestPriceCents/minPriceCents, and seatsLeft/totalSeatsLeft; search also accepts several common price/seat aliases.

- I added stricter validation to createEvent so an impossible date like 2026-02-30 is rejected, matching S02’s “date that is not a real date” criterion.

- Date-only from/to values are interpreted in UTC, and date sorting compares the full ISO timestamp, with ties broken by title then id as specified.
