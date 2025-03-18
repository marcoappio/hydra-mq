import type { DatabaseClient } from "@src/core/database-client"
import type { DaemonProcessorDirectory } from "@src/deployment/daemon/processor/directory"
import type { HydraEventHandler } from "@src/deployment/event"
import { messageFinalize } from "@src/driver/message-finalize"
import { messageLock } from "@src/driver/message-lock"

export type ProcessFn = (payload: string, metadata: {
    markAsFailed: () => void
    messageId: string
    queueId: string
}) => Promise<void>

export class DaemonProcessorExecutionModule {

    private readonly eventHandler: HydraEventHandler
    private readonly databaseClient: DatabaseClient
    private readonly schema: string
    private readonly daemonId: string | null
    private readonly promise: Promise<void>
    private readonly processFn: ProcessFn
    private readonly directory: DaemonProcessorDirectory

    constructor(params: {
        daemonId: string | null
        databaseClient: DatabaseClient
        directory: DaemonProcessorDirectory
        eventHandler: HydraEventHandler
        processFn: ProcessFn
        schema: string
    }) {
        this.schema = params.schema
        this.directory = params.directory
        this.processFn = params.processFn
        this.databaseClient = params.databaseClient
        this.daemonId = params.daemonId
        this.eventHandler = params.eventHandler
        this.promise = this.run()
    }

    private async run() {
        const run = true

        while (run) {
            const dequeueResult = await this.directory.getDequeueModule().dequeue()
            if (dequeueResult.resultType === "END_SIGNAL") {
                break
            }

            this.eventHandler({
                daemonId: this.daemonId,
                eventType: "MESSAGE_DEQUEUED",
                messageId: dequeueResult.messageId,
                queueId: dequeueResult.queueId,
            })

            let isProcessed = true
            let error: any = null

            try {
                await this.processFn(dequeueResult.payload, {
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

                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_PROCESSED",
                    messageId: dequeueResult.messageId,
                    queueId: dequeueResult.queueId,
                })

            } else if (dequeueResult.numAttempts <= 1) {
                const finalizeResult = await messageFinalize({
                    databaseClient: this.databaseClient,
                    messageId: dequeueResult.messageId,
                    schema: this.schema,
                })

                if (finalizeResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.messageId} could not be finalized`)
                }

                this.eventHandler({
                    daemonId: this.daemonId,
                    error: error,
                    eventType: "MESSAGE_EXPIRED",
                    messageId: dequeueResult.messageId,
                    queueId: dequeueResult.queueId,
                })
            } else {
                const lockResult = await messageLock({
                    databaseClient: this.databaseClient,
                    messageId: dequeueResult.messageId,
                    schema: this.schema,
                })

                if (lockResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.messageId} could not be locked`)
                }

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

    async join() {
        await this.promise
    }
}
