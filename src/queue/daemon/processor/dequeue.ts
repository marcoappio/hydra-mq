import type { DatabaseClient } from "@src/core/database-client"
import { EggTimer } from "@src/core/egg-timer"
import { Semaphore } from "@src/core/semaphore"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import { messageDequeue, type MessageDequeueResultMessageDequeued } from "@src/binding/message-dequeue"

type DequeueResultEndSignal = {
    resultType: "END_SIGNAL"
}

type DequeueResult =
    | DequeueResultEndSignal
    | MessageDequeueResultMessageDequeued

type RequestCallback = (result: DequeueResult) => void

export class DaemonProcessorDequeueModule {

    private readonly databaseClient: DatabaseClient
    private readonly schema: string
    private readonly timeoutMs: number
    private readonly eggTimer: EggTimer
    private readonly requestQueue: RequestCallback[]
    private readonly semaphore: Semaphore
    private readonly promise: Promise<void>
    private readonly eventHandler: HydraEventHandler | null

    private shouldStop: boolean

    constructor(params: {
        databaseClient: DatabaseClient
        eventHandler: HydraEventHandler | null
        schema: string
        timeoutMs: number
    }) {
        this.schema = params.schema
        this.semaphore = new Semaphore(0)
        this.timeoutMs = params.timeoutMs
        this.databaseClient = params.databaseClient
        this.eggTimer = new EggTimer(() => this.semaphore.release())
        this.eventHandler = params.eventHandler
        this.requestQueue = []
        this.shouldStop = false
        this.promise = this.run()
    }

    private async run() {
        while (!this.shouldStop) {
            if (this.requestQueue.length === 0) {
                await this.semaphore.acquire()
                continue
            }

            const dequeueResult = await messageDequeue({
                databaseClient: this.databaseClient,
                schema: this.schema,
            })

            if (dequeueResult.resultType === "QUEUE_EMPTY") {
                this.eggTimer.set(this.timeoutMs)
                await this.semaphore.acquire()
                continue
            } else if (this.eventHandler) {
                this.eventHandler({
                    eventType: "MESSAGE_DEQUEUED",
                    messageId: dequeueResult.id
                })
            }

            const request = this.requestQueue.shift() as RequestCallback
            request(dequeueResult)
        }

        for (const request of this.requestQueue) {
            request({ resultType: "END_SIGNAL" })
        }
    }

    async dequeue(): Promise<DequeueResult> {
        if (this.shouldStop) {
            return { resultType: "END_SIGNAL" }
        }

        return new Promise((resolve) => {
            this.requestQueue.push(resolve)
            this.semaphore.release()
        })
    }

    async stop() {
        this.shouldStop = true
        this.eggTimer.clear()
        this.semaphore.release()
        await this.promise
    }

}
