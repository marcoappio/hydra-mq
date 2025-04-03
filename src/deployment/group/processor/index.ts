import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEventHandler } from "@src/deployment/event"
import { DaemonProcessorDequeueModule } from "@src/deployment/group/processor/dequeue"
import { DaemonProcessorExecutionModule } from "@src/deployment/group/processor/execution"
import type { ProcessorFn } from "@src/deployment/group/processor/process-fn"

export class DaemonProcessor {

    private readonly dequeueModule: DaemonProcessorDequeueModule
    private readonly executionModules: DaemonProcessorExecutionModule[]

    constructor(params: {
        daemonId: string | null
        groupId: string
        databaseClient: DatabaseClient
        eventHandler: HydraEventHandler | null
        executionConcurrency: number
        processorFn: ProcessorFn
        queuePrefix: string
        schema: string
        timeoutSecs: number

    }) {
        this.dequeueModule = new DaemonProcessorDequeueModule({
            databaseClient: params.databaseClient,
            eventHandler: params.eventHandler,
            groupId: params.groupId,
            daemonId: params.daemonId,
            schema: params.schema,
            timeoutSecs: params.timeoutSecs,
        })

        this.executionModules = []
        for (let ix = 0; ix < params.executionConcurrency; ix += 1) {
            this.executionModules.push(new DaemonProcessorExecutionModule({
                daemonId: params.daemonId,
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
