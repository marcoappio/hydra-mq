import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import type { DaemonProcessorDequeueModule } from "@src/queue/daemon/processor/dequeue"
import type { ProcessorFn } from "@src/queue/daemon/processor/process-fn"
import { messageDelete } from "@src/binding/message-delete"
import { messageRetry } from "@src/binding/message-retry"

type ProcessorResult =
    | { resultType: "SUCCESS" }
    | { resultType: "FAIL" }
    | { resultType: "RETRY", lockMs: number }

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

            let processorResult : ProcessorResult
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
                    setFail: () => {
                        processorResult = { resultType: "FAIL" }
                    },
                    setRetry: (p) => {
                        processorResult = {
                            resultType: "RETRY",
                            lockMs: p?.lockMs ?? 0
                        }
                    }
                })
                processorResult ||= { resultType: "SUCCESS" }
            } catch (err) {
                processorResult ||= { resultType: "FAIL" }
                error = err
            }

            // Typescript *incorrectly* narrows this type - so re-expand with this cast
            processorResult = processorResult as ProcessorResult

            if (processorResult.resultType === "SUCCESS") {
                const successResult = await messageDelete({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.id,
                    schema: this.schema
                })

                if (successResult.resultType === "MESSAGE_DELETED") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_DELETED",
                        isSuccess: true,
                        messageId: dequeueResult.id,
                    })
                } else if (successResult.resultType === "MESSAGE_NOT_FOUND") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_NOT_FOUND",
                        messageId: dequeueResult.id,
                    })
                } else if (successResult.resultType === "MESSAGE_STATUS_INVALID") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_STATUS_INVALID",
                        messageId: dequeueResult.id,
                    })
                } else {
                    successResult satisfies never
                    throw new Error("Unexpected result")
                }
            } else if (processorResult.resultType === "RETRY") {
                const retryResult = await messageRetry({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.id,
                    lockMs: processorResult.lockMs,
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


            } else if (processorResult.resultType === "FAIL") {
                const failResult = await messageDelete({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.id,
                    schema: this.schema,
                })

                if (failResult.resultType === "MESSAGE_DELETED") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_DELETED",
                        messageId: dequeueResult.id,
                        isSuccess: false,
                        error: error
                    })
                } else if (failResult.resultType === "MESSAGE_NOT_FOUND") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_NOT_FOUND",
                        messageId: dequeueResult.id,
                    })
                } else if (failResult.resultType === "MESSAGE_STATUS_INVALID") {
                    this.eventHandler({
                        eventType: "MESSAGE_DELETED",
                        eventResult: "MESSAGE_STATUS_INVALID",
                        messageId: dequeueResult.id,
                    })
                } else {
                    failResult satisfies never
                    throw new Error("Unexpected result")
                }
            } else {
                processorResult satisfies never
                throw new Error("Unexpected result")
            }

        }
    }

    async join() {
        this.isStopped = true
        await this.promise
    }
}
