import { DAEMON_ORCHESTRATOR_CLEAN_TIMEOUT_SECS, DAEMON_ORCHESTRATOR_SCHEDULE_TIMEOUT_SECS, DAEMON_ORCHESTRATOR_UNLOCK_TIMEOUT_SECS } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import { refNode } from "@src/core/sql"
import { DaemonOrchestrator } from "@src/deployment/orchestrator"
import type { HydraEventHandler } from "@src/deployment/event"
import { Group } from "@src/deployment/group"
import { functionCronTestCreate } from "@src/driver/sql/function-cron-test-create"
import { functionMessageCleanCreateSql } from "@src/driver/sql/function-message-clean-create"
import { functionMessageDequeueCreateSql } from "@src/driver/sql/function-message-dequeue-create"
import { functionMessageEnqueueCreateSql } from "@src/driver/sql/function-message-enqueue-create"
import { functionMessageArchiveCreateSql } from "@src/driver/sql/function-message-finalize-create"
import { functionMessageLockCreateSql } from "@src/driver/sql/function-message-lock-create"
import { functionMessageScheduleCreateSql } from "@src/driver/sql/function-message-schedule-create"
import { functionMessageUnlockCreateSql } from "@src/driver/sql/function-message-unlock-create"
import { functionQueueAdvanceCreateSql } from "@src/driver/sql/function-queue-advance-create"
import { functionQueueConfigClearCreateSql } from "@src/driver/sql/function-queue-config-clear-create"
import { functionQueueConfigSetCreateSql } from "@src/driver/sql/function-queue-config-set-create"
import { functionScheduleClearCreateSql } from "@src/driver/sql/function-schedule-clear-create"
import { functionScheduleSetCreateSql } from "@src/driver/sql/function-schedule-set-create"
import { tableMessageCreateSql } from "@src/driver/sql/table-message-create"
import { tableQueueConfigCreateSql } from "@src/driver/sql/table-queue-config-create"
import { tableScheduleCreateSql } from "@src/driver/sql/table-schedule-create"

export class Deployment {

    private readonly schema: string

    constructor(params: {
        schema: string
    }) {
        this.schema = params.schema
    }

    installation() {
        const schema = refNode(this.schema)
        return [
            ...tableMessageCreateSql({ schema }),
            ...tableQueueConfigCreateSql({ schema }),
            ...tableScheduleCreateSql({ schema }),
            ...functionCronTestCreate({ schema }),
            ...functionQueueAdvanceCreateSql({ schema }),
            ...functionQueueConfigSetCreateSql({ schema }),
            ...functionQueueConfigClearCreateSql({ schema }),
            ...functionScheduleSetCreateSql({ schema }),
            ...functionScheduleClearCreateSql({ schema }),
            ...functionMessageUnlockCreateSql({ schema }),
            ...functionMessageCleanCreateSql({ schema }),
            ...functionMessageEnqueueCreateSql({ schema }),
            ...functionMessageDequeueCreateSql({ schema }),
            ...functionMessageLockCreateSql({ schema }),
            ...functionMessageArchiveCreateSql({ schema }),
            ...functionMessageScheduleCreateSql({ schema }),
        ]
    }

    group(groupId: string) {
        return new Group({
            groupId,
            schema: this.schema,
        })
    }

    orchestrator(params: {
        cleanTimeoutSecs?: number
        eventHandler?: HydraEventHandler
        daemonId?: string
        databaseClient: DatabaseClient
        scheduleTimeoutSecs?: number
        unlockTimeoutSecs?: number
    }) {
        return new DaemonOrchestrator({
            cleanTimeoutSecs: params.cleanTimeoutSecs ?? DAEMON_ORCHESTRATOR_CLEAN_TIMEOUT_SECS,
            daemonId: params.daemonId ?? null,
            databaseClient: params.databaseClient,
            eventHandler: params.eventHandler ?? null,
            scheduleTimeoutSecs: params.scheduleTimeoutSecs ?? DAEMON_ORCHESTRATOR_SCHEDULE_TIMEOUT_SECS,
            schema: this.schema,
            unlockTimeoutSecs: params.unlockTimeoutSecs ?? DAEMON_ORCHESTRATOR_UNLOCK_TIMEOUT_SECS,
        })
    }


}
