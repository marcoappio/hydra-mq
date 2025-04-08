import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import type { DaemonProcessorDequeueModule } from "@src/queue/daemon/processor/dequeue"
import type { ProcessorFn } from "@src/queue/daemon/processor/process-fn"
import { messageFinalize } from "@src/schema/message-finalize/binding"
import { messageLock } from "@src/schema/message-lock/binding"

export class DaemonProcessorExecutionModule {

    private readonly eventHandler: HydraEventHandler
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
        eventHandler: HydraEventHandler
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

            if (!dequeueResult.message.isDependenciesMet) {
                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_DEPENDENCIES_UNMET",
                    messageId: dequeueResult.message.id,
                })

                const finalizeResult = await messageFinalize({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.message.id,
                    isSuccess: false,
                    schema: this.schema,
                })

                if (finalizeResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.message.id} could not be finalized`)
                }

                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_FINALIZED",
                    messageId: dequeueResult.message.id,
                    isSuccess: false
                })

                continue
            }

            let processResult = true
            let isRetry : boolean = dequeueResult.message.numAttempts > 0
            let error: any = null

            try {
                await this.processorFn(dequeueResult.message.payload, {
                    setFail: (params : {
                        cancelRetries?: boolean
                    }) => {
                        processResult = false
                        if (params.cancelRetries) {
                            isRetry = false
                        }
                    },
                    message: {
                        id: dequeueResult.message.id,
                        channelName: dequeueResult.message.channelName,
                        numAttempts: dequeueResult.message.numAttempts,
                    }
                })
            } catch (err) {
                processResult = false
                error = err
            }

            if (processResult) {
                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_PROCESSED_SUCCESS",
                    messageId: dequeueResult.message.id
                })

                const finalizeResult = await messageFinalize({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.message.id,
                    isSuccess: true,
                    schema: this.schema,
                })

                if (finalizeResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.message.id} could not be finalized`)
                }

                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_FINALIZED",
                    messageId: dequeueResult.message.id,
                    isSuccess: true
                })
            } else if (isRetry) {
                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_PROCESSED_FAIL",
                    messageId: dequeueResult.message.id,
                    error,
                })

                const lockResult = await messageLock({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.message.id,
                    schema: this.schema,
                })

                if (lockResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.message.id} could not be locked`)
                }

                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_LOCKED",
                    messageId: dequeueResult.message.id,
                })
            } else {
                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_PROCESSED_FAIL",
                    messageId: dequeueResult.message.id,
                    error,
                })

                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_ATTEMPTS_EXHAUSTED",
                    messageId: dequeueResult.message.id,
                })

                const finalizeResult = await messageFinalize({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.message.id,
                    schema: this.schema,
                    isSuccess: false,
                })

                if (finalizeResult.resultType === "MESSAGE_NOT_FOUND") {
                    throw new Error(`Message: ${dequeueResult.message.id} could not be finalized`)
                }

                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: "MESSAGE_FINALIZED",
                    messageId: dequeueResult.message.id,
                    isSuccess: false
                })


            }

        }
    }

    async join() {
        await this.promise
    }
}
