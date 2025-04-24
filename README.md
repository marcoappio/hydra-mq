<div align="center">
    <img src="logo.svg" height="200px"></img>
</div>
<br/>

A high performance Postgres message queue implementation for NodeJs/TypeScript. 

Detailed API documentation available at: [HydraMQ API Docs](https://hydra-mq.marcoapp.io/).

Join our discord if you have any questions/issues: [Marco Discord](https://discord.gg/JnX8KJpQJx)

## Features

  - High throughput.
  - Fine-grained settings for multi-tenancy concurrency and capacity.
  - Scheduled/repeating messages.
  - Inter-tenant *and* intra-tenant message prioritization options.
  - Retryable messages with customizable timeout and back-off strategy.
  - Storage of message processing result.
  - Delayed messages.
  - Message de-duplication.
  - Arbitrary message dependency DAGs with intermediate result storage.
  - Message enqueuing within *existing* database transactions.
  - Deadlock resistance.
  - DB client agnostic.
  - A rich event system.
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
    await queue.message.create({ payload: `Ping: ${i}`, databaseClient: pool })
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

Channels provide multi-tenancy support within HydraMQ. They can be thought of as lightweight or "micro" queues that messages are read from in a round-robin fashion (unless explicit message priorities dictates otherwise). There is no performance penalty associated with using channels, and thus can be assigned on a highly granular (per-user for example) basis to ensure fair scheduling of work. To enqueue a message within a specific channel, we simply run:

```typescript
    await queue
        .channel("my-channel")
        .message
        .enqueue({ 
            payload: `Ping: ${i}`, 
            databaseClient: pool 
        })
```

Channels can be configured to limit their maximum size. Messages will be dropped when size limits are reached. You can also limit their maximum concurrency, ensuring that _at most_ `n` jobs run globally at any one time. This is done by defining a "Channel Policy," which can be set and removed as follows:

```typescript
    // N.B. null parameters mean 
    await queue
        .channel("my-channel")
        .policy
        .set({
            maxConcurrency: 1,
            maxSize: null,
            databaseClient: pool,
        })

    await queue
        .channel("my-channel")
        .policy
        .clear({ databaseClient: pool })
```

## Retrying failed messages

Messages can be given a retry policy to ensure that should processing fail, messages are re-attempted at a later date. We provide the `numAttempts`, `lockMs` and `lockMsFactor` arguments when creating a message. `numAttempts` specifies the number of times processing can be attempted on a message. `lockMs` specifies the amount of time a message is "locked" (and unavailable for attempted re-processing) after a failure and `lockMsFactor` specifies the factor by which `lockMs` is multiplied each time a message is locked. 

```typescript
await queue.message.create({
    payload: "hello world",
    databaseClient: pool,
    numAttempts: 5,
    lockMs: 5_000,
    lockMsFactor: 2 // Double the lock time after each failure.
})
```

## Explicit failures

The default behaviour of HydraMQ is to assume every message that processes without an error being thrown was successful. We can override this behaviour by using the second argument within a `ProcessorFn`:

```typescript
queue.daemon.processor({ 
    databaseClient: pool, 
    processorFn: async (payload, params) => {
        params.setFail({ exhaust: true })
    })
}
```

N.B. We can optionally specify an `exhaust` parameter which instructs HydraMQ to skip further retry attempts - useful if you know the situation is unrecoverable.

## Prioritizing messages

Messages can be prioritized. This will push messages to the "front" of their respective channel - as well as override the usual round-robin fashion in which messages are dequeued from channels. Messages are ordered in *ASCENDING* order of their priority, with messages with no/null priority coming first.

```typescript
await queue
    .message
    .enqueue({
        payload: "hello world",
        databaseClient: pool,
        priority: 10,
    })
```

If you wish to prioritize work _within_ a particular channel without disrupting the expected round-robin scheduling, you can specify a `channelPriority` when your message is enqueued:

```typescript
await queue
    .message
    .enqueue({
        payload: "hello world",
        databaseClient: pool,
        priority: 10,
        channelPriority: 3
    })
```

Workers dequeueing messages for processing will ignore `channelPriority` entirely - however, when deciding which message should be at the head of a particular channel, a lexicographical sort is performed using `priority` and then `channelPriority`.

## De-duplicating messages

Messages can be de-duplicated by specifying a `name` argument when enqueued. If a message exists with a matching `name`, that is yet to be processed, then the newly enqueued message will be rejected from the queue. 

N.B. Once processing has been attempted on a message (even if it ultimately fails and remains within the queue for a retry), deduplication will no longer apply to that message. 

This is a conscious design choice as it guarantees an instance of the message will be processed *AFTER* the enqueue is called.

```typescript
await queue.message.create({
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

```typescript
const client = await pool.connect()
try {
    await client.query("BEGIN")

    const parentMessage = queue.message.create({
        databaseClient: client,
        payload: "parent"
    })

    if(parentMessage.resultType !== "message.createD") {
        throw new Error("Message failed to enqueue")
    }

    const childMessage = queue.message.create({
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

The child message will now run only after the parent message dependency has resolved. N.B. the child message will _always_ be processed, regardless of the outcome of the parent message processing. However, we can trivially implement custom failure cascade behaviour by inspecting the statuses of the parent messages.

```typescript
const processor = queue.daemon.processor({ 
    databaseClient: pool,
    processorFn: async (payload, { dependencies }) => {
        if(!params.dependencies.every(x => x.isSuccess)) {
            // Use exhaust to ignore retry attempts 
            // and move to the failed state immediately.
            params.setFail({ exhaust: true }) 
            return
        }

        // Remaining biz-logic goes here...
    }
})
```

### Persisting intermediate data

We can "attach" intermediate data during the processing of a particular message such that its consumable by children jobs. We can do this by calling:

```typescript
const processor = queue.daemon.processor({ 
    databaseClient: pool,
    processorFn: async (payload, { dependencies }) => {
        params.setResult("arbitrary string data")
    }
})
```

## Processors

Processor daemons dequeue messages from the queue and perform work on them as per the `processorFn`. By default a processor will wait until it finishes processing a message before dequeuing another one. This behaviour can be changed by setting `executionSlots` to a number larger than `1`. Message throughput can be further increased by spawning multiple processors, allowing messages to be concurrently dequeued (which happens efficiently thanks to `SKIP LOCKED`).

```typescript
const processor = queue.daemon.processor({ 
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

The coordinator will consider messages _stuck_ if they have existed in a `PROCESSING` state for longer than `maxProcessingMs` - which can be defined on a per-message basis when creating. Make sure you set this value such that it is larger than any potential processing time for the given message (by default it is set to 1 hour).

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