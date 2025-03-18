<div align="center">
    <img src="logo.svg" height="200px"></img>
</div>
<br/>

A high performance Postgres message queue implementation for NodeJs/TypeScript. 

Documentation available at: [hydra-mq.marcoapp.io](https://hydra-mq.marcoapp.io/).

## Features

  - Zero dependencies.
  - Scales to thousands of queues with no performance penalty.
  - Distributes well across multiple processes/servers.
  - Messages can be enqueued as part of existing database transactions.
  - Scheduled/repeating messages.
  - Fine-grained per-queue settings for concurrency and capacity.
  - Flexible message prioritization settings.
  - Configurable message retry settings.
  - DB client agnostic.
  - High throughput: > 10,000 jobs per second.

## Quick Look

```typescript
import { Deployment, type ProcessorFn } from "hydra-mq"
import { Pool } from "pg"

// Initialize the database client.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Create a hydra deployment (the schema containing hydra tables).
const deployment = new Deployment({ schema: "hydra" })

// Create a group (a logical grouping of queues).
const group = deployment.group("default")

// Create a queue within said group.
const queue = group.queue("myQueue")

// Add some messages into the queue.
for (let i = 0; i < 500; i += 1) {
  await queue.enqueue({ payload: `Ping: ${i}`, databaseClient: pool })
}

// Create a processor daemon to process messages across *all* queues within a group.
const processorFn : ProcessorFn = async (msg) => console.log(msg)
group.processor({ processorFn, databaseClient: pool })

// Create an orchestrator to maintain system health.
deployment.daemon.orchestrator({ databaseClient: pool })
```

## Setup & Installation

HydraMQ can be installed from npm via:

```bash
npm install hydra-mq
```

Once the package is installed, we need to install the requisite DB machinery. HydraMQ aims to be agnostic to the DB client/migration procedure and thus provides a simple `string[]` of well-formatted SQL commands to run as part of a migration to facilitate said installation.

```typescript
import { Deployment } from "hydra-mq"

// Choose which postgres schema in which you wish to install hydraMQ.
const deployment = new Deployment({ schema: "hydra" })

// Run these SQL commands as part of a DB migration.
const sqlCommands: string[] = deployment.installation()
```

N.B. the set of SQL commands generated is **not** idempotent and thus it is strongly recommended that they are executed within a transaction.

## Message Lifecycle

Before we proceed, it would be salient to understand the lifecycle of messages that are submitted into HydraMQ queues.

Messages can exist in the following states:

  - `READY` - The message is available to be processed.
  - `WAITING` - Due to queue concurrency limits, the message is not yet available for processing.
  - `PROCESSING` - The message is currently being processed.
  - `LOCKED` - The message is in a temporarily locked state (due to a processing failure) and won"t be re-processed for some time.

When a message is enqueued, it will begin its life in the `WAITING` state if its target queue doesn"t have sufficient concurrency to process it right away, else it will be in the `READY` state.

Processors will take jobs in the `READY` state and move them to the `PROCESSING` state for the duration that they are processed. 

After processing, the message will either be deleted if processed successfully or if it has failed and has no retry attempts left. If processing fails but there are retry attempts left, it will transition into the `LOCKED` state.

Messages in the `LOCKED` state will eventually be transitioned back to either `WAITING` or `READY` by the orchestrator, again depending on the concurrency limits of its queue.

## Queues

Queues can be created from a group object by calling:

```typescript
const queue = group.queue("myQueue")
```

By default, queues are completely unconstrained - meaning they can hold an unlimited number of messages and also allow an unlimited number of messages to be processed concurrently. However, we can quite easily constrain both a queue's capacity and concurrency:

```typescript
// N.B. a null value means the concurrency/capacity is be unrestricted.
await queue.config.set({
  maxConcurrency: 5,
  databaseClient: pool,
  maxCapacity: null,
})

// To remove any constraints on a queue
await queue.config.clear({
  databaseClient: pool,
})
```

Queue concurrency limits are completely global and thus will be respected across process/server boundaries. That being said, dynamic changes to queue concurrency might not propagate instantly. For example, HydraMQ will certainly never _evict_ messages that are currently being processed if the concurrency limit is suddenly lowered!

## Processor Daemons

Processor daemons will work to process messages across _all_ queues within a single group (respecting any queue concurrency limits).

By default, the processor will process one message at a time. However, if we set the `executionConcurrency` of the processor, it will dispatch dequeued messages to a fleet of executors that can process messages concurrent with one another:

```typescript
const processor = group.processor({ 
  processorFn: processorFn, 
  databaseClient: pool,
  executionConcurrency: 10,
})
```

This setting is useful when dealing with long running, IO-bound jobs. However, we will run into throughput limitations with short-lived jobs as even though there are multiple executors, the processor will still dequeue messages sequentially. 

In this pathological scenario, it is recommended to deploy _multiple_ processors - with each processor dequeuing messages concurrently and thus affording a much greater message throughput:

```typescript
const processors = [
  group.processor({ 
    processorFn: processorFn, 
    databaseClient: pool,
    executionConcurrency: 10,
  }),
  group.processor({ 
    processorFn: processorFn, 
    databaseClient: pool,
    executionConcurrency: 10,
  }),
  group.processor({ 
    processorFn: processorFn, 
    databaseClient: pool,
    executionConcurrency: 10,
  }),
]
```

Finally, it is worth noting that HydraMQ daemons all run on a single thread. This is no problem for IO-bound work, however anything CPU intensive will cause significant performance issues. HydraMQ processors must be spread across multiple processes/servers to leverage additional CPU cores to mitigate this issue.

N.B. changes to concurrency don"t propagate instantly and messages currently being procesed will certainly never be "evicted" in response to concurrency changes.

## Orchestrator Daemons

Orchestrator daemons maintain general system health and are essential for HydraMQ to run correctly. They perform 3 functions:

  1. They enqueue scheduled messages.
  2. They unlock messages that failed to process so they may be retried.
  3. They sweep up _stuck_ jobs that might otherwise cause queue blockages.

_At least_ one orchestrator is required. However, multiple orchestrators will play well with one another. Thus, if you need to horizontal scaling, you can simply replicate your worker process (along with the orchestrator) vs. having to create a special singleton orchestrator process as per other solutions.

Orchestrators service an entire deployment and unlike Processors, are not needed per-group.

## Graceful Daemon Shutdown

Orchestrator and Processor daemons can be gracefully shutdown by awaiting their `stop()` method. This ensures daemons finish any tasks they are currently working on before exiting.

Failure to gracefully shut down daemons (particularly processors) may result in messages being _stuck_ in an invalid `PROCESSING` state. In this state they will occupy a concurrency slot inside their queue - potentially causing blockages and reducing job throughput until the orchestrator sweeps them away.

The orchestrator will consider messages _stuck_ if they have existed in a `PROCESSING` state for longer than `staleSecs` - which can be defined on a per-message basis when enqueueing. Make sure you set this value such that it is larger than any potential processing time for the given message (by default it is set to 1 hour).

## Prioritized Messages

Messages can be prioritized - ensuring they are processed faster than others, by setting the `priority` argument when enqueuing a message. All messages with specified priorities are processed _before_ those without an explicit priority:

```typescript
await queue.enqueue({
  message: "hello world",
  databaseClient: pool,
  priority: 10,
})
```

## Retryable Messages

Messages can be given a retry policy to ensure that should processing fail, messages are re-attempted at a later date. We simply provide the `numAttempts` and `timeoutSecs` arguments when enqueueing a message. `numAttempts` specifies the number of times a message can be processed before being archived in a failed state. `timeoutSecs` specifies the amount of time a message is "locked" (and unavailable for attempted re-processing) after a failure.

```typescript
await queue.enqueue({
  payload: "hello world",
  databaseClient: pool,
  numAttempts: 5,
  timeoutSecs: 60 * 5,
})
```

## De-duplicated Messages

Messages can be de-duplicated by specifying a `deduplicationId` argument when enqueued. If a message with a matching `deduplicationId`, that is yet to be processed exists on the same queue, then said message (payload and message configuration) will be _updated_ vs. a new message being enqueued:

```typescript
await queue.enqueue({
  payload: "updated hello world",
  databaseClient: pool,
  deduplicationId: "hello"
})
```

## Scheduled Messages

Each queue can also have scheduled messages that enqueue repeatedly at fixed intervals. Scheduled messages can be set and cleared using the same arguments as we"d expect to see when enqueuing a message. An additional required argument is `cronExpr` which describes how often the message should be scheduled, using normal cron job syntax:

```typescript
await queue
  .schedule("myScheduledMessage")
  .set({
    payload: "hello world",
    databaseClient: pool,
    numAttempts: 5,
    priority: 10,
    timeoutSecs: 60 * 5,
    cronExpr: "0 * * * *"
  })

await queue
  .schedule("myScheduledMessage")
  .clear({
    databaseClient: pool,
  })
```

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
| `MESSAGE_DEQUEUED` | A message has been dequeued for processing. |
| `MESSAGE_PROCESSED` | A message has been successfully processed and was removed from the queue. |
| `MESSAGE_EXPIRED` | A message has failed to process and was removed from the queue. |
| `MESSAGE_LOCKED` | A message has failed to process - but will eventually be re-processed. |
| `MESSAGE_SCHEDULED` | A scheduled message has been enqueued. |
| `MESSAGE_UNLOCKED` | A previously locked message has been unlocked for re-processing. |
| `MESSAGE_CLEANED` | A message stuck in the "running" state has been cleaned. |

These events can be subscribed to by passing an event handler during daemon construction:

```typescript
// Creating a processor with an event handler
const processor = group.processor({ 
    processorFn: processorFn, 
    eventHandler: (ev) => console.log(ev),
    databaseClient: pool,
})

// Creating an orchestrator with an event handler
const orchestrator = deployment.orchestrator({
    eventHandler: (ev) => console.log(ev),
    databaseClient: pool,
})
```

## Polling & Responsiveness

HydraMQ uses polling as its central mechanism for transitioning and processing messages. 

As a result, responsiveness can sometimes suffer with enqueued jobs not _immediately_ being picked up for processing due to processors being in a "timeout" period after previously finding no messages to process. 

We also see this lack of responsiveness with jobs not being unlocked immediately after their timeout period expires (for similar reasons).
