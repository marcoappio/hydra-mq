<div align="center">
    <img src="logo.svg" height="200px"></img>
</div>
<br/>

**N.B. Docs are a Work in Progress. HydraMQ is NOT ready for production use. Check back later!!**

A high performance Postgres message queue implementation for NodeJs/TypeScript. 

Documentation available at: [hydra-mq.marcoapp.io](https://hydra-mq.marcoapp.io/).

## Features

  - High throughput.
  - Fine-grained settings for multi-tenancy concurrency and size.
  - Scheduled/repeating messages.
  - Prioritized messages.
  - Retryable messages with customizable timeout and back-off strategies.
  - Delayed messages.
  - Message dependencies/flows with cascading failures.
  - Message enqueuing within *existing* database transactions.
  - DB client agnostic.
  - Zero dependencies.

## Quick Look

```typescript
import { Queue, type ProcessorFn } from "hydra-mq"
import { Pool } from "pg"

// Initialize the database client.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Create a hydra queue.
const queue = new Queue({ schema: "hydra" })

// Add some messages into the queue.
for (let i = 0; i < 500; i += 1) {
  await queue.message.enqueue({ payload: `Ping: ${i}`, databaseClient: pool })
}

// Create daemons to process messages.
const processorFn : ProcessorFn = async (msg) => console.log(msg)
queue.daemon.processor({ databaseClient: pool, processorFn })
queue.daemon.coordinator({ databaseClient: pool })
```

## Setup & Installation

HydraMQ can be installed from npm via:

```bash
npm install hydra-mq
```

Once the package is installed, we need to install the requisite DB machinery. HydraMQ aims to be agnostic to the DB client/migration procedure and thus provides a simple `string[]` of well-formatted SQL commands to run as part of a migration to facilitate said installation.

```typescript
import { Queue } from "hydra-mq"

// Choose which postgres schema in which you wish to install hydraMQ.
const queue = new Queue({ schema: "hydra" })

// Run these SQL commands as part of a DB migration.
const sqlCommands: string[] = queue.installation()
```
N.B. the set of SQL commands generated is **not** idempotent and thus it is strongly recommended that they are executed within a transaction.

## Channels

Channels provide multi-tenancy support within HydraMQ. They can be thought of us as lightweight or "micro" queues that messages are read from in a round-robin fashion (unless explicit message priorities dictates otherwise). There is no performance penalty associated with using channels, and can be assigned on a granular (per-user for example) basis to ensure fair scheduling of work. To enqueue a message within a specific channel, we simply run:

```typescript
  await queue.channel("my-channel").message.enqueue({ payload: `Ping: ${i}`, databaseClient: pool })
```
 Channels can be configured to limit their max size (with messages being dropped when size limits are reached) *and* their max concurrency - ensuring _at most_ `n` jobs run globally at any one time. We do this by defining a "Channel Policy" which can be set and removed by running:

```typescript
  // N.B. null parameters mean 
  await queue.channel("my-channel").policy.set({
    maxSize: null,
    maxConcurrency: 1,
    databaseClient: pool,
  })

  await queue.channel("my-channel").policy.clear({
    databaseClient: pool,
  })
```

## Retyring failed messages

Messages can be given a retry policy to ensure that should processing fail, messages are re-attempted at a later date. We provide the `numAttempts`, `lockSecs` and `lockSecsFactor` arguments when enqueueing a message. `numAttempts` specifies the number of times processing can be attempted on a message. `lockSecs` specifies the amount of time a message is "locked" (and unavailable for attempted re-processing) after a failure and `lockSecsFactor` specifies the factor by which `lockSecs` is multiplied each time a message is locked. 

```typescript
await queue.message.enqueue({
  payload: "hello world",
  databaseClient: pool,
  numAttempts: 5,
  lockSecs: 5,
  lockSecsFactor: 2 // Double the lock time after each failure.
})
```

## Prioritizing messages

Messages can be prioritized. This will push messages to the "front" of their respective channel - as well as override the usual round-robin fashion in which messages are dequeued from channels. Messages with no explciit priority are assumed to be of the lowest priority.

```typescript
await queue.message.enqueue({
  message: "hello world",
  databaseClient: pool,
  priority: 10,
})
```

## De-duplicating messages

Messages can be de-duplicated by specifying a `name` argument when enqueued. If a message exists with a matching `name`, that is yet to be processed, then no new messagee will be enqueued. Once a message has been processed (at least once), it is no longer eligible for deduplication.

```typescript
await queue.message.enqueue({
  payload: "updated hello world",
  databaseClient: pool,
  name: "hello"
})
```

## Scheduling messages

Messages can be scheduled to enqueue repeatedly by specifying the enqueue parameters and a `cronExpr` argument to describe how often to perform said enqueue. Schedules have an identifying name, which can be used to update or delete the schedule:

```typescript
await queue
  .message
  .schedule("schedule-name")
  .set({
    payload: "hello world",
    databaseClient: pool,
    numAttempts: 5,
    cronExpr: "0 * * * *"
  })

await queue
  .schedule("schedule-name")
  .clear({ databaseClient: pool })
```

Schedules can also be set for a specific channel using:

```typescript
await queue
  .channel("channel-name")
  .message
  .schedule("schedule-name")
  .set({
    payload: "hello world",
    databaseClient: pool,
    numAttempts: 5,
    cronExpr: "0 * * * *"
  })
```

N.B. Schedule names are scoped to their channel, and thus both the queue-level and channel-level schedules will _not_ collide despite having the same name.

## Adding dependencies to messages

We can enqueue messages that run according to an arbitrary dependency DAG. We do this by providing a `dependsOn` parameter that takes an array of message ids. 

Only messages in their starting state can be referenced. An attempt to "depend" on a job that has progressed will result in the enqueue failing. To prevent this from happening, it is strongly encouraged that you construct the DAG within an explicit database transaction.

If any message in the DAG fails to process, its failure will transitively propagate to all of its descendents.

```typescript
const client = await pool.connect()
try {
    await client.query("BEGIN")

    const parentMessage = queue.message.enqueue({
        databaseClient: client,
        payload: "parent"
    })

    if(parentMessage.resultType !== "MESSAGE_ENQUEUED") {
        // Perhaps it was deduplicated?
        throw new Error("Message failed to enqueue")
    }

    const childMessage = queue.message.enqueue({
        databaseClient: client,
        payload: "child",
        dependsOn: [parentMessage.messageId]
    })

    await client.query("COMMIT")
} catch {
    await client.query("ROLLBACK")
}finally {
    await client.release()
}
```

## Processors

Processor daemons dequeue messages from the queue and perform work on them as per the `processorFn`. By default a processor will wait until it finishes processing a message before dequeuing another one. This behaviour can be changed by setting `executionSlots` to a number larger than `1`. Message throughput can be further increased by spawning additional processors, allowing messages to be concurrently dequeued (which happens efficiently thanks to `SKIP LOCKED`).

```typescript
const processor = deployment.daemon.processor({ 
  processorFn: processorFn, 
  databaseClient: pool,
  executionSlots: 10,
})
```

Finally, it is worth noting that HydraMQ daemons all run on a single thread. This is no problem for IO-bound work, however anything CPU intensive will cause significant performance issues. HydraMQ processors must be spread across multiple processes/servers to leverage additional CPU cores to mitigate this issue.

## Coordinators

At least one coordinator daemon must run to ensure HydraMQ functions correctly by processing an internal job queue - with some workloads potentially necessitating the spawning of _multiple_ coordinators to keep the job queue size reasonable.

## Graceful Daemon Shutdown

Coordinator and Processor daemons can be gracefully shutdown by awaiting their `stop()` method. This ensures daemons finish any tasks they are currently working on before exiting.

Failure to gracefully shut down daemons (particularly processors) may result in messages being _stuck_ in an invalid `PROCESSING` state. In this state they will occupy a concurrency slot inside their queue - potentially causing blockages and reducing job throughput until the coordinator sweeps them away.

The coordinator will consider messages _stuck_ if they have existed in a `PROCESSING` state for longer than `maxProcessingSecs` - which can be defined on a per-message basis when enqueueing. Make sure you set this value such that it is larger than any potential processing time for the given message (by default it is set to 1 hour).

## Other Database Clients

Although `pg.Pool` has been used in the examples above, it is trivial for you to switch this for a database client of your choice by implementing the minimal HydraMQ `DatabaseClient` interface (`pg.Pool` and `pg.Client` already implement this interface). 

HydraMQ never uses explicit transactions and as such single connections as well as connection pools work perfectly fine as HydraMQ database clients:

```typescript
type MyDatabaseClientResult = {
  rows: Array<Record<string, unknown>>
}

export class MyDatabaseClient implements DatabaseClient {
  async query(sqlQuery: string): Promise<MyDatabaseClientResult> {
    // Implement here...
  }
}
```

## Events 

HydraMQ daemons emit the following events:

| Event Type | Description |
| ----------|-------------|
| `MESSAGE_ENQUEUED` | A scheduled message has been enqueued by the scheduler.
| `MESSAGE_RELEASED` | A message has been "released" for processing (it has no outstanding dependencies and any initial delay has elapsed) by the scheduler. |
| `MESSAGE_DROPPED` | A message has been dropped due to its channel's max size constraint being violated. |
| `MESSAGE_DEQUEUED` | A message has been dequeued for processing. |
| `MESSAGE_PROCESSED_SUCCESS` | Attempted processing of a message has succeeded. |
| `MESSAGE_PROCESSED_FAIL` | Attempted processing of a message has failed. |
| `MESSAGE_LOCKED` | Due to a processing failure, a message has been temporarily moved to a "locked" state to prevent further reprocessing. |
| `MESSAGE_UNLOCKED` | A previously locked message has been unlocked and is now again ready for attempted processing. |
| `MESSAGE_FINALIZED` | A message has transitioned to a post-processing state awaiting deletion. |
| `MESSAGE_DELETED` | A message has been truly deleted from the database. |
| `MESSAGE_DEPENDENCY_RESOLGVED` | A message's dependency has resolved (either a success or fail). |
| `MESSAGE_DEPENDENCIES_UNMET` | A dequeued message will not be processed due to a failure of one of its parents.
| `MESSAGE_ATTEMPTS_EXHAUSTED` | A dequeued message will not be processed as there are no attempts remaining.

These events can be subscribed to by passing an event handler to the queue:

```typescript
queue.daemon.onEvent(ev => console.log(ev))
```
