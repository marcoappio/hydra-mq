import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export const messageDequeueIxInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE INDEX message_dequeue_ix
        ON ${params.schema}.message (
            channel_name,
            priority ASC NULLS FIRST,
            channel_priority ASC NULLS FIRST,
            accepted_at ASC
        ) WHERE status = ${valueNode(MessageStatus.ACCEPTED)}
    `
]
