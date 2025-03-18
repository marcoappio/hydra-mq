import type { SqlRawNode, SqlRefNode, SqlValueNode } from "@src/core/sql"
import { sql } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"

export const queryMessageUnlock = (params: {
    limit: SqlValueNode | SqlRefNode
    schema: SqlRefNode
    threshold: SqlValueNode | SqlRefNode | SqlRawNode
}) => sql.build `
    SELECT id, queue_id
    FROM ${params.schema}.message
    WHERE status = ${sql.value(MessageStatus.LOCKED)}
    AND unlocked_at <= ${params.threshold}
    ORDER BY unlocked_at ASC NULLS FIRST
    LIMIT ${params.limit}
`
