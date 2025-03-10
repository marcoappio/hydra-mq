import { DAEMON_ORCHESTRATOR_CLEAN_TIMEOUT_SECS, DAEMON_ORCHESTRATOR_SCHEDULE_TIMEOUT_SECS, DAEMON_ORCHESTRATOR_UNLOCK_TIMEOUT_SECS, DAEMON_PROCESSOR_EXECUTION_CONCURRENCY, DAEMON_PROCESSOR_QUEUE_PREFIX, DAEMON_PROCESSOR_TIMEOUT_SECS } from '@src/core/config'
import type { DatabaseClient } from '@src/core/database-client'
import { DaemonOrchestrator } from '@src/deployment/daemon/orchestrator'
import { DaemonProcessor, type ProcessFn } from '@src/deployment/daemon/processor'
import type { HydraEvent, HydraEventHandler } from '@src/deployment/event'

export class DeploymentDaemonNamespace {

    private readonly schema: string
    private readonly eventHandlers: HydraEventHandler[]

    constructor(params: {
        schema: string
    }) {
        this.schema = params.schema
        this.eventHandlers = []
    }

    private onEvent(event: HydraEvent) {
        for (const handler of this.eventHandlers) {
            handler(event)
        }
    }

    addEventHandler(handler: HydraEventHandler) {
        this.eventHandlers.push(handler)
    }

    processor(params: {
        daemonId?: string
        databaseClient: DatabaseClient
        executionConcurrency?: number
        processFn: ProcessFn
        queuePrefix?: string
        timeoutSecs?: number
    }) {
        return new DaemonProcessor({
            daemonId: params.daemonId ?? null,
            databaseClient: params.databaseClient,
            eventHandler: this.onEvent.bind(this),
            executionConcurrency: params.executionConcurrency ?? DAEMON_PROCESSOR_EXECUTION_CONCURRENCY,
            processFn: params.processFn,
            queuePrefix: params.queuePrefix ?? DAEMON_PROCESSOR_QUEUE_PREFIX,
            schema: this.schema,
            timeoutSecs: params.timeoutSecs ?? DAEMON_PROCESSOR_TIMEOUT_SECS,
        })
    }

    orchestrator(params: {
        cleanTimeoutSecs?: number
        daemonId?: string
        databaseClient: DatabaseClient
        scheduleTimeoutSecs?: number
        unlockTimeoutSecs?: number
    }) {
        return new DaemonOrchestrator({
            cleanTimeoutSecs: params.cleanTimeoutSecs ?? DAEMON_ORCHESTRATOR_CLEAN_TIMEOUT_SECS,
            daemonId: params.daemonId ?? null,
            databaseClient: params.databaseClient,
            eventHandler: this.onEvent.bind(this),
            scheduleTimeoutSecs: params.scheduleTimeoutSecs ?? DAEMON_ORCHESTRATOR_SCHEDULE_TIMEOUT_SECS,
            schema: this.schema,
            unlockTimeoutSecs: params.unlockTimeoutSecs ?? DAEMON_ORCHESTRATOR_UNLOCK_TIMEOUT_SECS,
        })
    }

}
