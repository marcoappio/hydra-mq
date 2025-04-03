import { escapeRefNode, rawNode, sql, valueNode, type SqlRawNode, type SqlRefNode, type SqlValueNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"

export const messageFetchForClean = (params: {
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    schema: SqlRefNode
    threshold: SqlValueNode | SqlRefNode | SqlRawNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.message
        WHERE status = ${valueNode(MessageStatus.PROCESSING)}
        AND clean_afer <= ${params.threshold}
        ORDER BY clean_after ASC
        LIMIT ${params.limit}
    `
}
