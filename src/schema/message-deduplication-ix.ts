import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export const messageDeduplicationIxInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE UNIQUE INDEX message_deduplication_ix
        ON ${params.schema}.message (
            name
        ) WHERE status = ${valueNode(MessageStatus.ACCEPTED)} AND NOT is_processed
    `
]
