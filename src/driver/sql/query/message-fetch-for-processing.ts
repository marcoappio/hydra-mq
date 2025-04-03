import { escapeRefNode, rawNode, sql, valueNode, type SqlRefNode, type SqlValueNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"

export const messageFetchForProcessing = (params: {
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    groupId: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.message
        WHERE status = ${valueNode(MessageStatus.READY)}
        AND group_id = ${params.groupId}
        ORDER BY 
            priority DESC NULLS LAST, 
            ready_at ASC
        LIMIT ${params.limit}
    `
}
