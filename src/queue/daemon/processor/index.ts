import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import { DaemonProcessorDequeueModule } from "@src/queue/daemon/processor/dequeue"
import { DaemonProcessorExecutionModule } from "@src/queue/daemon/processor/execution"
import type { ProcessorFn } from "@src/queue/daemon/processor/process-fn"

export class DaemonProcessor {

    private readonly dequeueModule: DaemonProcessorDequeueModule
    private readonly executionModules: DaemonProcessorExecutionModule[]

    constructor(params: {
        databaseClient: DatabaseClient
        eventHandler: HydraEventHandler
        executionSlots: number
        processorFn: ProcessorFn
        schema: string
        timeoutMs: number

    }) {
        this.dequeueModule = new DaemonProcessorDequeueModule({
            databaseClient: params.databaseClient,
            eventHandler: params.eventHandler,
            schema: params.schema,
            timeoutMs: params.timeoutMs,
        })

        this.executionModules = []
        for (let ix = 0; ix < params.executionSlots; ix += 1) {
            this.executionModules.push(new DaemonProcessorExecutionModule({
                databaseClient: params.databaseClient,
                dequeueModule: this.dequeueModule,
                eventHandler: params.eventHandler,
                processorFn: params.processorFn,
                schema: params.schema,
            }))
        }
    }

    async stop() {
        await this.dequeueModule.stop()
        await Promise.all(this.executionModules.map(module => module.join()))
    }

}
