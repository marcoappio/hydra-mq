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

            let processResult : boolean = true
            let exhaust : boolean = false
            let error : any = null
            let result : string | null = null

            try {
                await this.processorFn(dequeueResult.payload, {
                    messageId: dequeueResult.id,
                    channelName: dequeueResult.channelName,
                    dependencies: dequeueResult.dependencies,
                    setFail: (p) => {
                        processResult = false
                        exhaust = p?.exhaust ?? false
                    },
                    setResults: (p) => {
                        result = p
                    },
                })
            } catch (err) {
                processResult = false
                error = err
            }

            if (processResult) {
                const successResult = await messageSuccess({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.id,
                    schema: this.schema,
                    result: result,
                })

                if (successResult.resultType === "MESSAGE_SUCCEEDED") {
                    this.eventHandler({
                        eventType: "MESSAGE_SUCCEEDED",
                        eventResult: "MESSAGE_SUCCEEDED",
                        messageId: dequeueResult.id,
                    })
                } else if (successResult.resultType === "MESSAGE_NOT_FOUND") {
                    this.eventHandler({
                        eventType: "MESSAGE_SUCCEEDED",
                        eventResult: "MESSAGE_NOT_FOUND",
                        messageId: dequeueResult.id,
                    })
                } else if (successResult.resultType === "MESSAGE_STATUS_INVALID") {
                    this.eventHandler({
                        eventType: "MESSAGE_SUCCEEDED",
                        eventResult: "MESSAGE_STATUS_INVALID",
                        messageId: dequeueResult.id,
                    })
                } else {
                    successResult satisfies never
                    throw new Error("Unexpected result")
                }
            } else {
                const failResult = await messageFail({
                    databaseClient: this.databaseClient,
                    id: dequeueResult.id,
                    schema: this.schema,
                    exhaust,
                })

                if (failResult.resultType === "MESSAGE_LOCKED") {
                    this.eventHandler({
                        eventType: "MESSAGE_FAILED",
                        eventResult: "MESSAGE_LOCKED",
                        messageId: dequeueResult.id,
                        error: error
                    })
                } else if (failResult.resultType === "MESSAGE_EXHAUSTED") {
                    this.eventHandler({
                        eventType: "MESSAGE_FAILED",
                        eventResult: "MESSAGE_EXHAUSTED",
                        messageId: dequeueResult.id,
                        error: error
                    })
                } else if (failResult.resultType === "MESSAGE_NOT_FOUND") {
                    this.eventHandler({
                        eventType: "MESSAGE_FAILED",
                        eventResult: "MESSAGE_NOT_FOUND",
                        messageId: dequeueResult.id,
                    })
                } else if (failResult.resultType === "MESSAGE_STATUS_INVALID") {
                    this.eventHandler({
                        eventType: "MESSAGE_FAILED",
                        eventResult: "MESSAGE_STATUS_INVALID",
                        messageId: dequeueResult.id,
                    })
                } else {
                    failResult satisfies never
                    throw new Error("Unexpected result")
                }
            }

        }
    }

    async join() {
        await this.promise
    }
}
