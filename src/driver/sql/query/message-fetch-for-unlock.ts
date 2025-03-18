import type { SqlRawNode, SqlRefNode, SqlValueNode } from "@src/core/sql"
import { valueNode, escapeRefNode, sql, rawNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"

export const messageFetchForUnlock = (params: {
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    schema: SqlRefNode
    threshold: SqlValueNode | SqlRefNode | SqlRawNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.message
        WHERE status = ${valueNode(MessageStatus.LOCKED)}
        AND unlock_after <= ${params.threshold}
        ORDER BY unlock_after ASC
        LIMIT ${params.limit}
    `
}
