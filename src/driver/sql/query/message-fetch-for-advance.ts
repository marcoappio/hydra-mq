import { escapeRefNode, rawNode, sql, valueNode, type SqlRefNode, type SqlValueNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"

export const messageFetchForAdvance = (params: {
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    groupId: SqlValueNode | SqlRefNode
    queueId: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => { 
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.message
        WHERE status = ${valueNode(MessageStatus.WAITING)}
        AND message.group_id = ${params.groupId}
        AND message.queue_id = ${params.queueId}
        ORDER BY 
            priority DESC NULLS LAST, 
            waiting_at ASC
        LIMIT ${params.limit}
    `
}
