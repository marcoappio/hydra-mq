import { DAEMON_PROCESSOR_EXECUTION_CONCURRENCY, DAEMON_PROCESSOR_QUEUE_PREFIX, DAEMON_PROCESSOR_TIMEOUT_SECS } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEventHandler } from "@src/deployment/event"
import { DaemonProcessor } from "@src/deployment/group/processor"
import type { ProcessorFn } from "@src/deployment/group/processor/process-fn"
import { Queue } from "@src/deployment/group/queue"

export class Group {

    private readonly schema: string
    private readonly groupId: string

    constructor(params: {
        groupId: string
        schema: string
    }) {
        this.schema = params.schema
        this.groupId = params.groupId
    }

    queue(queueId: string) {
        return new Queue({
            queueId,
            groupId: this.groupId,
            schema: this.schema,
        })
    }

    processor(params: {
        daemonId?: string
        databaseClient: DatabaseClient
        executionConcurrency?: number
        eventHandler?: HydraEventHandler
        processorFn: ProcessorFn
        queuePrefix?: string
        timeoutSecs?: number
    }) {
        return new DaemonProcessor({
            daemonId: params.daemonId ?? null,
            groupId: this.groupId,
            databaseClient: params.databaseClient,
            eventHandler: params.eventHandler ?? null,
            executionConcurrency: params.executionConcurrency ?? DAEMON_PROCESSOR_EXECUTION_CONCURRENCY,
            processorFn: params.processorFn,
            queuePrefix: params.queuePrefix ?? DAEMON_PROCESSOR_QUEUE_PREFIX,
            schema: this.schema,
            timeoutSecs: params.timeoutSecs ?? DAEMON_PROCESSOR_TIMEOUT_SECS,
        })
    }


}
