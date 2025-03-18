import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"

export const tableMessageCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.message (
            id UUID NOT NULL,
            group_id TEXT NOT NULL,
            queue_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            priority INTEGER,
            timeout_secs INTEGER NOT NULL,
            stale_secs INTEGER NOT NULL,
            num_attempts INTEGER NOT NULL,
            deduplication_id TEXT,
            status INTEGER NOT NULL,
            unlock_after TIMESTAMP,
            clean_after TIMESTAMP,
            waiting_at TIMESTAMP,
            ready_at TIMESTAMP,
            processed_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            PRIMARY KEY (id)
        );
    `,

    sql `
        CREATE UNIQUE INDEX message_deduplication_id_ix
        ON ${params.schema}.message (
            group_id,
            queue_id,
            deduplication_id
        ) WHERE processed_at IS NULL;
    `,

    sql `
        CREATE INDEX message_processing_ix
        ON ${params.schema}.message (
            clean_after ASC
        ) WHERE status = ${valueNode(MessageStatus.PROCESSING)};
    `,

    sql `
        CREATE INDEX message_ready_ix
        ON ${params.schema}.message (
            group_id,
            priority DESC NULLS LAST,
            ready_at ASC
        ) WHERE STATUS = ${valueNode(MessageStatus.READY)};
    `,

    sql `
        CREATE INDEX message_locked_ix
        ON ${params.schema}.message (
            unlock_after ASC
        ) WHERE STATUS = ${valueNode(MessageStatus.LOCKED)};
    `,

    sql `
        CREATE INDEX message_waiting_ix
        ON ${params.schema}.message (
            group_id,
            queue_id,
            priority DESC NULLS LAST,
            waiting_at ASC
        ) WHERE STATUS = ${valueNode(MessageStatus.WAITING)};
    `,
]
