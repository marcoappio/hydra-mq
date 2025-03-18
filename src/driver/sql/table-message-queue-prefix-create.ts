import { type SqlRefNode, sql } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"

export const tableMessageQueuePrefixCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build `
        CREATE TABLE ${params.schema}.message_queue_prefix (
            message_id UUID NOT NULL,
            queue_id_prefix TEXT NOT NULL,
            status INTEGER NOT NULL,
            priority INTEGER,
            created_at TIMESTAMP NOT NULL,
            PRIMARY KEY (message_id, queue_id_prefix),
            FOREIGN KEY (message_id) REFERENCES ${params.schema}.message (id)
                ON DELETE CASCADE
        )
    `,

    sql.build`
        CREATE INDEX message_queue_prefix_dequeue_ix
        ON ${params.schema}.message_queue_prefix (
            queue_id_prefix,
            priority DESC NULLS LAST,
            created_at ASC
        ) WHERE STATUS = ${sql.value(MessageStatus.READY)};
   `,

    sql.build `
        CREATE INDEX message_queue_prefix_join_ix
        ON ${params.schema}.message_queue_prefix (
            message_id
        );
    `,
]
