import { DAEMON_PROCESSOR_DEFAULT_EXECUTION_SLOTS, DAEMON_PROCESSOR_DEFAULT_TIMEOUT_SECS } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import type { HydraEvent, HydraEventHandler } from "@src/queue/daemon/event"
import { DaemonProcessor } from "@src/queue/daemon/processor"
import type { ProcessorFn } from "@src/queue/daemon/processor/process-fn"
import { DaemonCoordinator } from "@src/queue/daemon/coordinator"

export class QueueDaemonModule {

    private readonly schema: string
    private readonly eventHandlers: HydraEventHandler[]

    constructor(params: {
        schema: string
    }) {
        this.schema = params.schema
        this.eventHandlers = []
    }

    private eventHandler(event : HydraEvent) {
        for (const handler of this.eventHandlers) {
            handler(event)
        }
    }

    onEvent(handler: HydraEventHandler) {
        this.eventHandlers.push(handler)
    }

    coordinator(params: {
        daemonId?: string
        databaseClient: DatabaseClient
        timeoutSecs?: number
    }) {
        return new DaemonCoordinator({
            daemonId: params.daemonId ?? null,
            databaseClient: params.databaseClient,
            eventHandler: (event) => this.eventHandler(event),
            schema: this.schema,
            timeoutSecs: params.timeoutSecs ?? DAEMON_PROCESSOR_DEFAULT_TIMEOUT_SECS,
        })
    }

    processor(params: {
        daemonId?: string
        databaseClient: DatabaseClient
        executionSlots?: number
        processorFn: ProcessorFn
        timeoutSecs?: number
    }) {
        return new DaemonProcessor({
            daemonId: params.daemonId ?? null,
            databaseClient: params.databaseClient,
            eventHandler: (event) => this.eventHandler(event),
            executionSlots: params.executionSlots ?? DAEMON_PROCESSOR_DEFAULT_EXECUTION_SLOTS,
            processorFn: params.processorFn,
            schema: this.schema,
            timeoutSecs: params.timeoutSecs ?? DAEMON_PROCESSOR_DEFAULT_TIMEOUT_SECS,
        })
    }

}
