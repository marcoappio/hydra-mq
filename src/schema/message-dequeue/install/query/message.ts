import { type SqlRefNode, type SqlValueNode, escapeRefNode, rawNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export const messageDequeueQueryMessage = (params: {
    channelName: SqlValueNode | SqlRefNode
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.message
        WHERE status = ${valueNode(MessageStatus.WAITING)}
        AND channel_name = ${params.channelName}
        ORDER BY 
            priority DESC NULLS LAST,
            waiting_at ASC
        LIMIT ${params.limit}
    `
}

