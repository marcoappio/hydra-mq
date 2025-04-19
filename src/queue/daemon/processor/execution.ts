import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import type { DaemonProcessorDequeueModule } from "@src/queue/daemon/processor/dequeue"
import type { ProcessorFn } from "@src/queue/daemon/processor/process-fn"
import { messageFail } from "@src/binding/message-fail"
import { messageSuccess } from "@src/binding/message-success"

export class DaemonProcessorExecutionModule {

    private readonly eventHandler: HydraEventHandler
    private readonly databaseClient: DatabaseClient
    private readonly schema: string
    private readonly promise: Promise<void>
    private readonly processorFn: ProcessorFn
    private readonly dequeueModule: DaemonProcessorDequeueModule

    constructor(params: {
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

            let processResult = true
            let exhaust = false
            let error: any = null

            try {
                await this.processorFn(dequeueResult.message.payload, {
                    setFail: (params) => {
                        processResult = false
                        if (params?.exhaust) {
                            exhaust = true
                        }
                    },
                    message: {
                        id: dequeueResult.message.id,
                        channelName: dequeueResult.message.channelName,
                    }
                })
            } catch (err) {
                processResult = false
                error = err
            }

            if (processResult) {
                const result = await messageSuccess({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.message.id,
                    schema: this.schema,
                })

                if (result.resultType === "MESSAGE_COMPLETED") {
                    this.eventHandler({
                        eventType: "MESSAGE_COMPLETED",
                        messageId: dequeueResult.message.id
                    })
                }
            } else {
                const result = await messageFail({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.message.id,
                    schema: this.schema,
                    exhaust,
                })

                if (result.resultType === "MESSAGE_LOCKED") {
                    this.eventHandler({
                        eventType: "MESSAGE_LOCKED",
                        messageId: dequeueResult.message.id,
                        error: error
                    })
                } else if (result.resultType === "MESSAGE_EXHAUSTED") {
                    this.eventHandler({
                        eventType: "MESSAGE_EXHAUSTED",
                        messageId: dequeueResult.message.id,
                        error: error
                    })
                }
            }

        }
    }

    async join() {
        await this.promise
    }
}
