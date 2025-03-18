import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEventHandler } from "@src/deployment/event"
import type { DaemonProcessorDequeueModule } from "@src/deployment/group/processor/dequeue"
import type { ProcessorFn } from "@src/deployment/group/processor/process-fn"
import { messageFinalize } from "@src/driver/message-finalize"
import { messageLock } from "@src/driver/message-lock"

export class DaemonProcessorExecutionModule {

    private readonly eventHandler: HydraEventHandler | null
    private readonly databaseClient: DatabaseClient
    private readonly schema: string
    private readonly daemonId: string | null
    private readonly promise: Promise<void>
    private readonly processorFn: ProcessorFn
    private readonly dequeueModule: DaemonProcessorDequeueModule

    constructor(params: {
        daemonId: string | null
        databaseClient: DatabaseClient
        dequeueModule: DaemonProcessorDequeueModule
        eventHandler: HydraEventHandler | null
        processorFn: ProcessorFn
        schema: string
    }) {
        this.schema = params.schema
        this.dequeueModule = params.dequeueModule
        this.processorFn = params.processorFn
        this.databaseClient = params.databaseClient
        this.daemonId = params.daemonId
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

            let isProcessed = true
            let error: any = null

            try {
                await this.processorFn(dequeueResult.payload, {
                    markAsFailed: () => { isProcessed = false },
                    messageId: dequeueResult.messageId,
                    queueId: dequeueResult.queueId,
                })
            } catch (err) {
                isProcessed = false
                error = err
            }

            if (isProcessed) {
                const finalizeResult = await messageFinalize({
                    databaseClient: this.databaseClient,
                    messageId: dequeueResult.messageId,
                    schema: this.schema,
                })

                if (finalizeResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.messageId} could not be finalized`)
                }

                if(this.eventHandler) {
                    this.eventHandler({
                        daemonId: this.daemonId,
                        eventType: "MESSAGE_PROCESSED",
                        messageId: dequeueResult.messageId,
                        queueId: dequeueResult.queueId,
                    })
                }

            } else if (dequeueResult.numAttempts <= 1) {
                const finalizeResult = await messageFinalize({
                    databaseClient: this.databaseClient,
                    messageId: dequeueResult.messageId,
                    schema: this.schema,
                })

                if (finalizeResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.messageId} could not be finalized`)
                }

                if(this.eventHandler) {
                    this.eventHandler({
                        daemonId: this.daemonId,
                        error: error,
                        eventType: "MESSAGE_EXPIRED",
                        messageId: dequeueResult.messageId,
                        queueId: dequeueResult.queueId,
                    })
                }
            } else {
                const lockResult = await messageLock({
                    databaseClient: this.databaseClient,
                    messageId: dequeueResult.messageId,
                    schema: this.schema,
                })

                if (lockResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.messageId} could not be locked`)
                }

                if(this.eventHandler) {
                    this.eventHandler({
                        daemonId: this.daemonId,
                        error: error,
                        eventType: "MESSAGE_LOCKED",
                        messageId: dequeueResult.messageId,
                        queueId: dequeueResult.queueId,
                    })
                }
            }

        }
    }

    async join() {
        await this.promise
    }
}
