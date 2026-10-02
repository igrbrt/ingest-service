# Ingest Service

HTTP ingestion for patient events. The API acknowledges an event only after MongoDB has stored it, then a worker applies that patient's events in clinical time order. A five-second external call is simulated; the processing result is irrelevant, the wait is real.

## Architecture

```text
POST /events
  -> API key guard and validation
  -> EventIngestionService
  -> PatientEventRepository (Prisma / MongoDB)
  -> 202 Accepted
  -> BullMQ job per patient
       -> worker lock
       -> oldest eligible event
       -> simulated external processor
       -> outcome stored on the same document
```

| Piece | Role |
| --- | --- |
| API (`src/main.ts`) | Stateless HTTP process. Validates, persists, enqueues. |
| Worker (`src/worker.ts`) | Drains one patient at a time and runs the reconciler. |
| MongoDB | Source of truth for the event, its status, retries, and dead letters. |
| Redis + BullMQ | Wake-up queue and per-patient lock. Not a cache. AOF is enabled. |

A BullMQ job represents a **patient**, not an event. Its id is a SHA-256 of `patientId`. If that job is already queued or active, enqueue is a success: the active worker keeps draining events that arrive while it runs. `removeOnComplete` frees the id. Failed jobs stay in Redis for inspection and are retried in place.

Events for one patient are applied in `occurredAt` order. Events for different patients run in parallel, up to `WORKER_CONCURRENCY` (default 100) per worker process. More capacity is `docker compose up --scale worker=N`.

## Requirements

| Tool | When you need it |
| --- | --- |
| Docker Engine and the Compose plugin | `docker compose up`. Compose starts MongoDB 7, Redis 7.4, the API, and one worker. The image uses Node 24 and pnpm 10.18.1. |
| Node.js 24 or newer | Running the API and worker on the host, or running `pnpm test`, `pnpm test:e2e`, and `pnpm lint`. |
| pnpm 10.18.1 | The same cases as Node. Activate it with Corepack, which ships with Node 24. |
| MongoDB as a replica set, and Redis | Only when the API and worker run on the host. Compose already provides both. |
| k6 | The [load test](#load-test). Compose does not start it. |

```bash
corepack enable
corepack prepare pnpm@10.18.1 --activate
```

A `.env` file is optional with Compose. The defaults live in `docker-compose.yml`. Copy `.env.example` to `.env` before the host commands in [Without Compose](#without-compose).

## Run locally

```bash
docker compose up --build
```

That starts MongoDB (single-node replica set), Redis with AOF, a one-shot `prisma db push`, the API on port 3000, and one worker.

```bash
docker compose up --build --scale worker=2
```

The API image is stateless. The same image runs `node dist/main.js` or `node dist/worker.js`.

k6 is not part of startup. See [Load test](#load-test).

### Without Compose

```bash
nvm use
pnpm install
pnpm prisma:push
pnpm build
node dist/main.js
node dist/worker.js
```

MongoDB must be a replica set (`?replicaSet=rs0`). Prisma uses transactions internally. Copy `.env.example` to `.env` first. `LEASE_MS` must be greater than `PROCESSING_DELAY_MS`.

## HTTP

`POST /events` requires `X-API-Key` equal to `INGEST_API_KEY`. Health routes are public. Admin routes require `ADMIN_API_KEY`. Keys are compared as SHA-256 digests with `timingSafeEqual`. The service does not log keys, event payloads, or clinical fields.

```bash
curl -sS -D - http://localhost:3000/events \
  -H 'content-type: application/json' \
  -H 'x-api-key: local-ingest-key' \
  -H 'idempotency-key: visit-1001' \
  -H 'x-correlation-id: demo-1' \
  -d '{"patientId":"patient-1","type":"observation","data":{"note":"stable"},"ts":"2026-10-01T12:00:00.000Z"}'
```

`202` body (clinical `data` is not echoed):

```json
{
  "id": "…",
  "patientId": "patient-1",
  "type": "observation",
  "occurredAt": "2026-10-01T12:00:00.000Z",
  "status": "PENDING",
  "idempotencyKey": "visit-1001",
  "receivedAt": "2026-10-01T12:00:01.000Z"
}
```

Sending the same `Idempotency-Key`, or the same canonical payload when the header is omitted, returns `202` with the original id and does not create a second processing outcome. If the header is absent, the key is the SHA-256 of the payload with object keys sorted. Array order is preserved, so two payloads that differ only by key order are the same event, and two that differ by timestamp text are not.

If MongoDB cannot persist the insert, the response is `503`. The event is not acknowledged.

Errors:

```json
{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "API key is missing or invalid",
  "timestamp": "2026-10-01T12:00:00.000Z",
  "path": "/events",
  "correlationId": "demo-1"
}
```

`GET /health/live` is process liveness. `GET /health/ready` pings MongoDB and Redis.

## Decisions and downsides

| Decision | Why | Downside |
| --- | --- | --- |
| `202` only after the MongoDB insert | A retry after a crash cannot lose an acknowledged event. | The client waits on the database, not only on validation. |
| Idempotency key, else payload hash | Senders that omit the header still cannot double-insert the same body. | Equivalent clinical facts with different JSON text are different events. |
| One job per patient | Preserves per-patient order and allows cross-patient parallelism. | A hot patient is strictly serial and can fall behind. |
| Reorder window (`REORDER_WINDOW_MS`, default 15s) | Gives an older event time to arrive before a newer one is applied. | Adds latency. `0` disables it for tests. |
| Late events become `RECONCILIATION_REQUIRED` | Clinical data is kept and is not applied as current state. | Those events need a human or a later reconciliation workflow. |
| Retry state in MongoDB | A Redis flush cannot forget attempt count or the next retry time. | Two stores must be understood when debugging a stuck patient. |
| Dead letter in MongoDB, failed BullMQ jobs retained | Nothing is dropped. Redis is an inspection aid. | A dead-lettered event blocks later events for that patient until replay. |
| MongoDB lease | A killed worker's `PROCESSING` row returns to `PENDING` after `LEASE_MS`. | A lease shorter than the external call could double-invoke that call. Startup rejects `LEASE_MS <= PROCESSING_DELAY_MS`. |
| API keys | Machine-to-machine auth without a user directory. | Keys are shared secrets. Rotation and per-sender keys are not built. |
| Prisma 6.19.3 | MongoDB access through one schema and a unique index. | Prisma 7.10 generates a MongoDB client but cannot connect: it requires a driver adapter, and `@prisma/adapter-mongodb` does not exist. Prisma 8 can connect and is still a release candidate, so this service stays on the last stable connector. |
| `prisma db push` | MongoDB has no Prisma migration history. | Schema changes are pushed, not versioned as reversible migrations. |

## Delivery and ordering

### Delivery semantics

The ingest service provides at-least-once delivery to the external processor.

An event has a unique idempotency key and is persisted exactly once in MongoDB. If the worker crashes after the external side effect succeeds but before MongoDB is marked `PROCESSED`, the external call may be retried.

Exactly-once business effects require the downstream system to honor the provided idempotency key.

What this service guarantees:

- An event is acknowledged only after it is inserted.
- The unique index on `idempotencyKey` makes the insert idempotent across API instances.
- A duplicate acknowledgement does not create a second outcome.
- Pending work survives process death. Expired leases return to `PENDING`. The reconciler enqueues those patients.
- Losing Redis does not lose events. MongoDB remains authoritative; the reconciler rebuilds jobs.
- After `MAX_ATTEMPTS` (default 5), the event becomes `DEAD_LETTER` with `lastErrorCode`. It is not deleted.
- A failure does not advance that patient's watermark. Later events wait.
- An event older than the last applied `occurredAt`, once the reorder window has elapsed, is marked `RECONCILIATION_REQUIRED` and left in place.

What the contract cannot guarantee:

- There is no patient sequence number. An event that arrives after a newer one was applied cannot be inserted into history safely. The window bounds that race; it does not eliminate arbitrarily late events.
- BullMQ's deterministic job id closes the common double-enqueue race. The gap between the worker's last empty check and lock release is closed by the reconciler, not by a distributed transaction.

## Capacity

Sustained arrival is 1000 events per minute, about 16.67 events per second. A 5-second external call needs at least `16.67 * 5 = 84` concurrent calls. The default worker concurrency is 100, inside the 100–120 band. That assumes events are spread across patients. One patient is always sequential, so a single hot patient needs about 12 seconds per minute of events at this rate and will queue. Extra worker containers raise the ceiling for distinct patients; they do not parallelize one patient.

## Failure and recovery

1. API dies after insert, before enqueue. The document is `PENDING`. The reconciler finds it once the reorder window has passed and enqueues the patient.
2. Worker dies during the 5-second call. The row stays `PROCESSING` until `leaseUntil`. The reconciler, or the next drain, returns it to `PENDING` and calls the external system again with the same idempotency key.
3. External system returns an error. `attemptCount` increases and `nextRetryAt` becomes `now + RETRY_BASE_DELAY_MS * 2^(attempt-1)`. Later events for that patient wait. At the attempt limit the row becomes `DEAD_LETTER`.
4. Redis restarts with an empty AOF. Jobs disappear. Documents do not. The next reconciler pass enqueues eligible patients.
5. Two API replicas receive the same key. One insert wins. The loser reads the stored row and returns `202`.

## Dead letter

MongoDB is the dead-letter record. BullMQ also keeps failed jobs so `GET /admin/queues/status` can show `failed`.

```bash
curl -sS http://localhost:3000/admin/dead-letter-events \
  -H 'x-api-key: local-admin-key'

curl -sS -X POST http://localhost:3000/admin/dead-letter-events/<id>/reprocess \
  -H 'x-api-key: local-admin-key'

curl -sS http://localhost:3000/admin/queues/status \
  -H 'x-api-key: local-admin-key'
```

Replay resets that same document to `PENDING`, clears the lease and attempt count, and enqueues the patient. It does not insert a second event. While a dead letter is the oldest open event, later events for that patient stay blocked.

## Load test

k6 is not started by Compose. Install it on the machine that will call the API, then run the script from the repository root. The API must already be listening on port 3000.

### Linux (Debian and Ubuntu)

```bash
curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

On Fedora and other `dnf` distributions:

```bash
sudo dnf install https://dl.k6.io/rpm/repo.rpm
sudo dnf install k6
```

### Windows

```powershell
winget install k6 --source winget
```

Open a new terminal after the install so `k6` is on `PATH`. Confirm with `k6 version`.

```bash
k6 run k6/ingest.js
```

The script holds 1000 arrivals per minute for two minutes against `http://localhost:3000`, spread across 200 patients. Override `BASE_URL` and `INGEST_API_KEY` if needed. With the default 5-second processor, run more than one worker before expecting the queue to stay short.

## Tests

`pnpm test` and `pnpm test:e2e` do not need MongoDB or Redis. They cover hashing, duplicate acknowledgement, refusal to acknowledge a failed insert, per-patient order, cross-patient parallelism, the reorder window, late-event reconciliation, backoff, the dead-letter transition, expired leases, an already-active patient job, dead-letter replay, the API-key guard, validation, and the error body.

## Deferred

These are real limits, left out of the local scope on purpose:

- Kafka (or an equivalent log) partitioned by patient, instead of a Redis job per patient.
- A transactional outbox or change-data capture so the enqueue cannot depend on a second write after the insert.
- Autoscaling on queue lag.
- OpenTelemetry.
- Highly available MongoDB and Redis.
- Stronger authentication: per-sender keys, rotation, and a vault.
- An optional gateway in front of the API. Compose does not run Nginx or a load balancer.
