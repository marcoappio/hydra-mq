Documentation is available at [hydra-mq.marcoapp.io](https://hydra-mq.marcoapp.io/).

<img src="https://i.imgur.com/DDaUXy8.jpeg" alt="hydra-mq" style="width: 400px; max-width: 100%; margin-bottom: 16px;" />

A high performance Postgres message queue implementation for NodeJs/TypeScript.

<br />

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

<br />

## Quick Look

```typescript
import { Deployment } from 'hydramq'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const deployment = new Deployment({
  schema: 'hydra'
})

// Enqueue messages
const queue = deployment.queue('myQueue')

for (let i = 0; i < 500; i += 1) {
  await queue.message.enqueue({ payload: `Ping: ${i}`, databaseClient: pool })
}

const processFn = async (msg: string) => console.log(msg)

deployment.daemon.processor({ processFn, databaseClient: pool })
deployment.daemon.orchestrator({ databaseClient: pool })
```

<br />

## Setup & Installation

HydraMQ can be installed from npm via:

```bash
npm install hydra-mq
```

Once the package is installed, we need to install the requisite DB machinery. HydraMQ aims to be agnostic to the DB client/migration procedure and thus provides a simple `string[]` of well-formatted SQL commands to run as part of a migration to facilitate said installation.

```typescript
import { Deployment } from 'hydramq'

// Choose which postgres schema in which you wish to install hydraMQ.
const deployment = new Deployment({ schema: 'hydra' })

// Run these SQL commands as part of a DB migration.
const sqlCommands: string[] = deployment.installation()
```

N.B. the set of SQL commands generated is **not** idempotent and thus it is strongly recommended that they are executed within a transaction.

<br />

## Basic Usage

The most simple usage pattern for HydraMQ would be a single queue being processed by a processor daemon. Using your `deployment` (defined above), we first must instantiate a queue (what we name our queue is irrelevant in this particular usecase):

```typescript
const queue = deployment.queue('myQueue')
```

We can now enqueue messages to our queue by passing both a string payload and our database client (we will use `pg.Pool` for examples going forward - however, we will see below that it is trivial to use any other database client):

```typescript
await queue.message.enqueue({ payload: 'Hi!', databaseClient: pool })
```

Messages will remain enqueued until they are processed by a processor daemon. We can create one by passing in a function to process the messages and our database client:

```typescript
const processFn = async (msg: string) => console.log(msg)
const processor = deployment.daemon.processor({ processFn: processFn, databaseClient: pool })
```

It is important to spawn _at least_ one orchestrator daemon. The orchestrator is responsible for maintaining general system health as well as providing support for more advance features mentioned below (scheduling and retries):

```typescript
const orchestrator = deployment.daemon.orchestrator({ databaseClient: pool })
```

<br />

## Processor Concurrency

Processor daemons will poll for messages - processing them when available. If no messages are available it will "timeout" for some period of time before polling again.

By default, the processor daemon will process one message at a time. However, if we set the `executionConcurrency` of the processor, it will dispatch dequeued messages to a fleet of executors that can process messages concurrent with one another:

```typescript
const processor = deployment.daemon.processor({ 
  processFn: processFn, 
  databaseClient: pool,
  executionConcurrency: 10,
})
```

This setting is useful when dealing with long running, IO-bound jobs. However, we will run into throughput limitations with short-lived jobs as even though there are multiple executors, the processor will still dequeue messages sequentially. In this scenario, it is recommended to deploy _multiple_ processors - with each processor dequeuing messages concurrently affording a much greater message throughput:

```typescript
const processors = [
  deployment.daemon.processor({ 
    processFn: processFn, 
    databaseClient: pool,
    executionConcurrency: 10,
  }),
  deployment.daemon.processor({ 
    processFn: processFn, 
    databaseClient: pool,
    executionConcurrency: 10,
  }),
  deployment.daemon.processor({ 
    processFn: processFn, 
    databaseClient: pool,
    executionConcurrency: 10,
  }),
]
```

Finally, it is worth noting that HydraMQ daemons all run on a single thread. This is no problem for IO-bound work, however anything CPU intensive will cause significant performance issues. HydraMQ processors must be spread across multiple processes/servers to leverage additional CPU cores to mitigate this issue.

Unlike other queuing solutions, there is no need to ensure the orchestrator daemon remains a singleton. Multiple orchestrators spanning multiple processes will behave well with one another – thus simply naively replicating your HydraMQ worker process is perfectly sensible vs. having to separate the orchestrator into its own dedicated singleton process.

<br />

## Multiple Queues

As mentioned in the features section, HydraMQ scales to thousands of queues (maximum throughput actually _increases_ as jobs are distributed across more queues) with no performance penalty. 

By default, processor daemons will process messages across *all* queues. However, we can specify a `queuePrefix` override when creating a processor daemon. This will restrict the processor to only working on matching queues.

```typescript
const queue = deployment.queue('myQueue')
const highPriorityQueue = deployment.queue('highPriorityQueue')

const processors = [
  deployment.processor({
    processFn: processFn,
    databaseClient: pool,
  }),
  deployment.processor({
    processFn: processFn,
    queuePrefix: 'highPriorityQueue',
    databaseClient: pool,
  }),
]
```

In the example above, we show a pattern by which certain workloads can be prioritized. We define normal and high priority queues along with two processors. Messages from both queues are serviced by the first processor, but the second _only_ services messages from the `highPriorityQueue` – providing extra compute to messages in said queue.

N.B. queue names must be dot-separated (i.e. `foo.bar.baz`). Prefix matching will only work at dot boundaries and not within the individual name segments (e.g. `foo.bar` will match with `foo.bar.baz`, but `foo.ba` will not).

<br />

## Queue Configuration

Queues can be configured to constrain maximum concurrency. Queues with a specified maximum concurrency will only allow a certain number of messages to be processed simultaneously across all processors (N.B. this concurrency limit is truly global and thus will work across distinct daemons/processes/servers). Queues can also be configured to constrain their total capacity. Queues with a specified maximum capacity will prevent further messages from being enqueued should their limit be reached. 

We can set and clear queue configuration via:

```typescript
// N.B. a null value means the concurrency/capacity is be unrestricted.
await queue.config.set({
  maxConcurrency: 5,
  databaseClient: pool,
  maxCapacity: null,
})

await queue.config.clear({
  databaseClient: pool,
})
```

N.B. changes to concurrency don't propagate instantly and messages currently being procesed will certainly never be "evicted" in response to concurrency changes.

<br />

## Prioritized Messages

Messages can be prioritized - ensuring they are processed faster than others by setting the `priority` argument when enqueuing a message. All messages with specified priorities are processed _before_ those without any specific priority:

```typescript
await queue.message.enqueue({
  message: 'hello world',
  databaseClient: pool,
  priority: 10,
})
```

<br />

## Retryable Messages

Messages can be given a retry policy to ensure that should processing fail, messages are re-attempted at a later date. We simply provide the `numAttempts` and `timeoutSecs` arguments when enqueueing a message. `numAttempts` specifies the number of times a message can be processed before being archived in a failed state. `timeoutSecs` specifies the amount of time a message is "locked" (and unavailable for attempted re-processing) after a failure.

```typescript
await queue.message.enqueue({
  payload: 'hello world',
  databaseClient: pool,
  numAttempts: 5,
  timeoutSecs: 60 * 5,
})
```

<br />

## Scheduled Messages

Each queue can also have scheduled messages that enqueue repeatedly at fixed intervals. Scheduled messages can be set and cleared using the same arguments as we'd expect to see when enqueuing a message. An additional required argument is `repeatSecs` which describes how often the message should be scheduled:

```typescript
await queue
  .schedule('myScheduledMessage')
  .set({
    payload: 'hello world',
    databaseClient: pool,
    numAttempts: 5,
    priority: 10,
    timeoutSecs: 60 * 5,
    repeatSecs: 10,
  })

await queue
  .schedule('myScheduledMessage')
  .clear({
    databaseClient: pool,
  })
```

<br />

## Graceful Shutdown & Cleaning

Daemons (processors and orchestrators) can be gracefully shutdown by awaiting their `stop()` method. This ensures daemons finish any tasks they are currently working on before exiting.

Failure to gracefully shut down daemons (particularly processors) may result in messages being stuck in an invalid "processing" state. In this state they will occupy a concurrency slot inside their queue - potentially causing blockages and reducing job throughput.

That being said, hard crashes are a fact of life and ultimately can't be avoided. As such, we must be able to recover from theser situations. To that end, the orchestrator regularly performs a "clean" operation that sweeps these "stuck" jobs. It does this by considering all jobs that have been processing for longer than a specified `staleSecs` (set when a message is enqueued) as "stuck".

N.B. Make sure to set `staleSecs` such that it is larger than the expected amount of time required to process a job as otherwise the orchestrator is liable to "clean" it even if not stuck. By default this is set to 1 hour.

<br />

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

<br />

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

These events can be subscribed to by adding event handlers:

```typescript
deployment.daemon.addEventHandler(event => {
  console.log(event.eventType)
})
```

<br />

## Message Lifecycle

When a message is enqueued, it will start in the `READY` state if the queue has sufficient open concurrency slots. If this is not the case, messages will begin in a `WAITING` state.

Processors will grab messages in the `READY` state for processing. They do this in order of priority and then creation time. Once a message has been "dequeued" by a processor it transitions into the `PROCESSING` state. 

If processing completes successfully or fails with no retries remaining, the message is deleted. The queue from which the message originated will then be explicitly "advanced" - this involves potentially bringing a message in the `WAITING` state into the `READY` state, should the concurrency constraints of the queue allow (again in order of priority and creation time).

If processing fails with retries remaining, instead of being deleted, it will be transitioned into a `LOCKED` state. As above, the queue is again "advanced", potentially pulling another message into the `READY` state should it be allowed. 

Similar to how message enqueuing works, the orchestrator will transition locked messages into either the `WAITING` or `READY` state when they are ready for attempted re-processing.

Messages that have been stuck in the `PROCESSING` state for too long, will either be deleted or transitioned into a `LOCKED` state by the orchestrator for re-processing.

<br />

## Polling & Responsiveness

HydraMQ uses polling as its central mechanism for transitioning and processing messages. 

As a result, responsiveness can sometimes suffer with enqueued jobs not _immediately_ being picked up for processing due to processors being in a "timeout" period after previously finding no messages to process. 

We also see this lack of responsiveness with jobs not being unlocked immediately after their timeout period expires (for similar reasons).
