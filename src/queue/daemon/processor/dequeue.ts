import type { DatabaseClient } from "@src/core/database-client"
import { EggTimer } from "@src/core/egg-timer"
import { Semaphore } from "@src/core/semaphore"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import { messageDequeue, type MessageDequeueMessage } from "@src/schema/message-dequeue/binding"

type DequeueResultEndSignal = {
    resultType: "END_SIGNAL"
}

type DequeueResultMessage = {
    resultType: "MESSAGE_DEQUEUED",
    message: MessageDequeueMessage
}

type DequeueResult =
    | DequeueResultEndSignal
    | DequeueResultMessage

type RequestCallback = (result: DequeueResult) => void

export class DaemonProcessorDequeueModule {

    private readonly databaseClient: DatabaseClient
    private readonly schema: string
    private readonly timeoutSecs: number
    private readonly eggTimer: EggTimer
    private readonly requestQueue: RequestCallback[]
    private readonly semaphore: Semaphore
    private readonly promise: Promise<void>
    private readonly daemonId: string | null
    private readonly eventHandler: HydraEventHandler | null

    private shouldStop: boolean

    constructor(params: {
        daemonId: string | null
        databaseClient: DatabaseClient
        eventHandler: HydraEventHandler | null
        schema: string
        timeoutSecs: number
    }) {
        this.schema = params.schema
        this.semaphore = new Semaphore(0)
        this.timeoutSecs = params.timeoutSecs
        this.databaseClient = params.databaseClient
        this.eggTimer = new EggTimer(() => this.semaphore.release())
        this.eventHandler = params.eventHandler
        this.daemonId = params.daemonId
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
                this.eggTimer.set(this.timeoutSecs * 1_000)
                await this.semaphore.acquire()
                continue
            } else if (this.eventHandler) {
                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_DEQUEUED",
                    message: dequeueResult.message,
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
