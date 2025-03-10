import type { SqlRefNode, SqlValueNode } from '@src/core/sql'
import { sql } from '@src/core/sql'
import { MessageStatus } from '@src/driver/message-status'

export const queryMessageAdvance = (params: {
    limit: SqlValueNode | SqlRefNode
    queueId: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => sql.build `
    SELECT id
    FROM ${params.schema}.message
    WHERE status = ${sql.value(MessageStatus.WAITING)}
    AND message.queue_id = ${params.queueId}
    ORDER BY 
        priority DESC NULLS LAST, 
        created_at ASC
    LIMIT ${params.limit}
`
