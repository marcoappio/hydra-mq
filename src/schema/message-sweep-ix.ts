import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export const messageSweepIxInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE INDEX message_sweep_ix
        ON ${params.schema}.message (
            sweep_after ASC
        ) WHERE status = ${valueNode(MessageStatus.PROCESSING)}
    `,
]
