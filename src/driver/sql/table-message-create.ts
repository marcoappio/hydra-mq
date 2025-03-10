import { type SqlRefNode, sql } from '@src/core/sql'
import { MessageStatus } from '@src/driver/message-status'

export const tableMessageCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build `
        CREATE TABLE ${params.schema}.message (
            id UUID NOT NULL,
            queue_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            priority INTEGER,
            timeout_secs INTEGER NOT NULL,
            stale_secs INTEGER NOT NULL,
            num_attempts INTEGER NOT NULL,
            status INTEGER NOT NULL,
            unlocked_at TIMESTAMP,
            processed_at TIMESTAMP,
            stale_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL,
            PRIMARY KEY (id)
        );
    `,

    sql.build `
        CREATE INDEX message_clean_ix
        ON ${params.schema}.message (
            stale_at ASC NULLS LAST
        ) WHERE status = ${sql.value(MessageStatus.PROCESSING)};
    `,

    sql.build `
        CREATE INDEX message_unlock_ix
        ON ${params.schema}.message (
            unlocked_at ASC NULLS FIRST
        ) WHERE STATUS = ${sql.value(MessageStatus.LOCKED)};
    `,

    sql.build `
        CREATE INDEX message_advance_ix
        ON ${params.schema}.message (
            queue_id,
            priority DESC NULLS LAST,
            created_at ASC
        ) WHERE STATUS = ${sql.value(MessageStatus.WAITING)};
    `,
]
