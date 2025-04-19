import { DAEMON_PROCESSOR_DEFAULT_EXECUTION_SLOTS, DAEMON_PROCESSOR_DEFAULT_TIMEOUT_MS } from "@src/core/config"
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
        databaseClient: DatabaseClient
        timeoutMs?: number
    }) {
        return new DaemonCoordinator({
            databaseClient: params.databaseClient,
            eventHandler: (event) => this.eventHandler(event),
            schema: this.schema,
            timeoutMs: params.timeoutMs ?? DAEMON_PROCESSOR_DEFAULT_TIMEOUT_MS,
        })
    }

    processor(params: {
        databaseClient: DatabaseClient
        executionSlots?: number
        processorFn: ProcessorFn
        timeoutMs?: number
    }) {
        return new DaemonProcessor({
            databaseClient: params.databaseClient,
            eventHandler: (event) => this.eventHandler(event),
            executionSlots: params.executionSlots ?? DAEMON_PROCESSOR_DEFAULT_EXECUTION_SLOTS,
            processorFn: params.processorFn,
            schema: this.schema,
            timeoutMs: params.timeoutMs ?? DAEMON_PROCESSOR_DEFAULT_TIMEOUT_MS,
        })
    }

}
