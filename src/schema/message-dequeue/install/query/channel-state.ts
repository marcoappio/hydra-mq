import { escapeRefNode, rawNode, sql, type SqlRefNode, type SqlValueNode } from "@src/core/sql"

export const messageDequeueQueryChannelState = (params: {
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.channel_state
        WHERE next_message_id IS NOT NULL AND (max_concurrency IS NULL OR current_concurrency < max_concurrency)
        ORDER BY 
            next_priority DESC NULLS LAST,
            dequeued_at ASC NULLS FIRST
        LIMIT ${params.limit}
    `
}
