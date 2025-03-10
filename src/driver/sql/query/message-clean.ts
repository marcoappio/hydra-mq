import type { SqlRawNode, SqlRefNode, SqlValueNode } from '@src/core/sql'
import { sql } from '@src/core/sql'
import { MessageStatus } from '@src/driver/message-status'

export const queryMessageClean = (params: {
    limit: SqlValueNode | SqlRefNode
    schema: SqlRefNode
    threshold: SqlValueNode | SqlRefNode | SqlRawNode
}) => sql.build `
    SELECT id, queue_id
    FROM ${params.schema}.message
    WHERE status = ${sql.value(MessageStatus.PROCESSING)}
    AND stale_at <= ${params.threshold}
    ORDER BY stale_at ASC NULLS LAST
    LIMIT ${params.limit}
`
