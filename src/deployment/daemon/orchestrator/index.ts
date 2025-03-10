import type { DatabaseClient } from '@src/core/database-client'
import { DaemonCleaner as DaemonOrchestratorCleanModule } from '@src/deployment/daemon/orchestrator/cleaner'
import { DaemonScheduler as DaemonOrchestratorScheduleModule } from '@src/deployment/daemon/orchestrator/scheduler'
import { DaemonUnlocker as DaemonOrchestratorUnlockModule } from '@src/deployment/daemon/orchestrator/unlocker'
import type { HydraEventHandler } from '@src/deployment/event'

export class DaemonOrchestrator {

    private readonly cleanModule: DaemonOrchestratorCleanModule
    private readonly scheduleModule: DaemonOrchestratorScheduleModule
    private readonly unlockModule: DaemonOrchestratorUnlockModule

    constructor(params: {
        cleanTimeoutSecs: number
        daemonId: string | null
        databaseClient: DatabaseClient
        eventHandler: HydraEventHandler
        scheduleTimeoutSecs: number
        schema: string
        unlockTimeoutSecs: number
    }) {
        this.cleanModule = new DaemonOrchestratorCleanModule({
            daemonId: params.daemonId,
            databaseClient: params.databaseClient,
            eventHandler: params.eventHandler,
            schema: params.schema,
            timeoutSecs: params.cleanTimeoutSecs,
        })
        this.scheduleModule = new DaemonOrchestratorScheduleModule({
            daemonId: params.daemonId,
            databaseClient: params.databaseClient,
            eventHandler: params.eventHandler,
            schema: params.schema,
            timeoutSecs: params.scheduleTimeoutSecs,
        })
        this.unlockModule = new DaemonOrchestratorUnlockModule({
            daemonId: params.daemonId,
            databaseClient: params.databaseClient,
            eventHandler: params.eventHandler,
            schema: params.schema,
            timeoutSecs: params.unlockTimeoutSecs,
        })
    }

    async stop() {
        await Promise.all([
            this.cleanModule.stop(),
            this.scheduleModule.stop(),
            this.unlockModule.stop(),
        ])
    }

}
