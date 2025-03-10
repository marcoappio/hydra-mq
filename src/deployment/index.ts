import { sql } from '@src/core/sql'
import { DeploymentDaemonNamespace } from '@src/deployment/daemon'
import { Queue } from '@src/deployment/queue'
import { functionCronTestCreate } from '@src/driver/sql/function-cron-test-create'
import { functionMessageCleanCreateSql } from '@src/driver/sql/function-message-clean-create'
import { functionMessageDequeueCreateSql } from '@src/driver/sql/function-message-dequeue-create'
import { functionMessageEnqueueCreateSql } from '@src/driver/sql/function-message-enqueue-create'
import { functionMessageArchiveCreateSql } from '@src/driver/sql/function-message-finalize-create'
import { functionMessageLockCreateSql } from '@src/driver/sql/function-message-lock-create'
import { functionMessageScheduleCreateSql } from '@src/driver/sql/function-message-schedule-create'
import { functionMessageUnlockCreateSql } from '@src/driver/sql/function-message-unlock-create'
import { functionPrefixesGenerateCreateSql } from '@src/driver/sql/function-prefixes-generate-create'
import { functionQueueAdvanceCreateSql } from '@src/driver/sql/function-queue-advance-create'
import { functionQueueConfigClearCreateSql } from '@src/driver/sql/function-queue-config-clear-create'
import { functionQueueConfigSetCreateSql } from '@src/driver/sql/function-queue-config-set-create'
import { functionScheduleClearCreateSql } from '@src/driver/sql/function-schedule-clear-create'
import { functionScheduleSetCreateSql } from '@src/driver/sql/function-schedule-set-create'
import { tableMessageCreateSql } from '@src/driver/sql/table-message-create'
import { tableMessageQueuePrefixCreateSql } from '@src/driver/sql/table-message-queue-prefix-create'
import { tableQueueConfigCreateSql } from '@src/driver/sql/table-queue-config-create'
import { tableScheduleCreateSql } from '@src/driver/sql/table-schedule-create'

export class Deployment {

    private readonly schema: string

    readonly daemon: DeploymentDaemonNamespace

    constructor(params: {
        schema: string
    }) {
        this.schema = params.schema

        this.daemon = new DeploymentDaemonNamespace({
            schema: this.schema,
        })
    }

    installation() {
        const schema = sql.ref(this.schema)
        return [
            ...tableMessageCreateSql({ schema }),
            ...tableMessageQueuePrefixCreateSql({ schema }),
            ...tableQueueConfigCreateSql({ schema }),
            ...tableScheduleCreateSql({ schema }),
            ...functionPrefixesGenerateCreateSql({ schema }),
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

    queue(queueId: string) {
        return new Queue({
            queueId,
            schema: this.schema,
        })
    }
}
