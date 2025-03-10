import type { DatabaseClient } from '@src/core/database-client'
import { DaemonProcessorDequeueModule } from '@src/deployment/daemon/processor/dequeue'
import type { DaemonProcessorDirectory } from '@src/deployment/daemon/processor/directory'
import { DaemonProcessorExecutionModule } from '@src/deployment/daemon/processor/execution'
import type { HydraEventHandler } from '@src/deployment/event'

export type ProcessFn = (payload: string, metadata: {
    markAsFailed: () => void
    messageId: string
    queueId: string
}) => Promise<void>

export class DaemonProcessor {

    private readonly dequeueModule: DaemonProcessorDequeueModule
    private readonly executionModules: DaemonProcessorExecutionModule[]

    constructor(params: {
        daemonId: string | null
        dbClient: DatabaseClient
        eventHandler: HydraEventHandler
        executionConcurrency: number
        processFn: ProcessFn
        queuePrefix: string
        schema: string
        timeoutSecs: number

    }) {
        this.dequeueModule = new DaemonProcessorDequeueModule({
            dbClient: params.dbClient,
            queuePrefix: params.queuePrefix,
            schema: params.schema,
            timeoutSecs: params.timeoutSecs,
        })

        const directory: DaemonProcessorDirectory = {
            getDequeueModule: () => this.dequeueModule,
        }

        this.executionModules = []
        for (let ix = 0; ix < params.executionConcurrency; ix += 1) {
            this.executionModules.push(new DaemonProcessorExecutionModule({
                daemonId: params.daemonId,
                dbClient: params.dbClient,
                directory: directory,
                eventHandler: params.eventHandler,
                processFn: params.processFn,
                schema: params.schema,
            }))
        }
    }

    async stop() {
        await this.dequeueModule.stop()
        await Promise.all(this.executionModules.map(module => module.join()))
    }

}
