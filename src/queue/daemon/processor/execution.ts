import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import type { DaemonProcessorDequeueModule } from "@src/queue/daemon/processor/dequeue"
import type { ProcessorFn } from "@src/queue/daemon/processor/process-fn"
import { messageDelete } from "@src/binding/message-delete"
import { messageRetry } from "@src/binding/message-retry"

export class DaemonProcessorExecutionModule {

    private readonly eventHandler: HydraEventHandler
    private readonly databaseClient: DatabaseClient
    private readonly schema: string
    private readonly promise: Promise<void>
    private readonly processorFn: ProcessorFn
    private readonly dequeueModule: DaemonProcessorDequeueModule
    private isStopped : boolean

    constructor(params: {
        databaseClient: DatabaseClient
        dequeueModule: DaemonProcessorDequeueModule
        eventHandler: HydraEventHandler
        processorFn: ProcessorFn
        schema: string
    }) {
        this.isStopped = false
        this.schema = params.schema
        this.dequeueModule = params.dequeueModule
        this.processorFn = params.processorFn
        this.databaseClient = params.databaseClient
        this.eventHandler = params.eventHandler
        this.promise = this.run()
    }

    private async run() {
        const run = true

        while (run) {
            const dequeueResult = await this.dequeueModule.dequeue()
            if (dequeueResult.resultType === "END_SIGNAL") {
                break
            }

            let lockMs : number | null = null
            let error : any = null

            try {
                await this.processorFn({
                    message : {
                        id: dequeueResult.id,
                        payload: dequeueResult.payload,
                        channelName: dequeueResult.channelName,
                        numAttempts: dequeueResult.numAttempts,
                        channelPriority: dequeueResult.channelPriority,
                        name: dequeueResult.name,
                        priority: dequeueResult.priority,
                    },
                    isStopped: () => this.isStopped,
                    setRetry: (p) => { lockMs = p?.lockMs ?? 0 }
                })
            } catch (err) {
                error = err
            }

            if (lockMs === null) {
                const deleteResult = await messageDelete({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.id,
                    schema: this.schema
                })

                if (deleteResult.resultType === "MESSAGE_DELETED") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_DELETED",
                        messageId: dequeueResult.id,
                        error: error
                    })
                } else if (deleteResult.resultType === "MESSAGE_NOT_FOUND") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_NOT_FOUND",
                        messageId: dequeueResult.id,
                    })
                } else if (deleteResult.resultType === "MESSAGE_STATUS_INVALID") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_STATUS_INVALID",
                        messageId: dequeueResult.id,
                    })
                } else {
                    deleteResult satisfies never
                    throw new Error("Unexpected result")
                }
            } else {
                const retryResult = await messageRetry({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.id,
                    lockMs: lockMs,
                    schema: this.schema,
                })

                if (retryResult.resultType === "MESSAGE_LOCKED") {
                    this.eventHandler({
                        eventType: "MESSAGE_RETRIED",
                        eventResult: "MESSAGE_LOCKED",
                        messageId: dequeueResult.id,
                    })
                } else if (retryResult.resultType === "MESSAGE_ACCEPTED") {
                    this.eventHandler({
                        eventType: "MESSAGE_RETRIED",
                        eventResult: "MESSAGE_ACCEPTED",
                        messageId: dequeueResult.id,
                    })
                } else if (retryResult.resultType === "MESSAGE_NOT_FOUND") {
                    this.eventHandler({
                        eventType: "MESSAGE_RETRIED",
                        eventResult: "MESSAGE_NOT_FOUND",
                        messageId: dequeueResult.id,
                    })
                } else if (retryResult.resultType === "MESSAGE_STATUS_INVALID") {
                    this.eventHandler({
                        eventType: "MESSAGE_RETRIED",
                        eventResult: "MESSAGE_STATUS_INVALID",
                        messageId: dequeueResult.id,
                    })
                } else {
                    retryResult satisfies never
                    throw new Error("Unexpected result")
                }
            }
        }
    }

    async join() {
        this.isStopped = true
        await this.promise
    }
}
