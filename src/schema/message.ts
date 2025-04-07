import { type SqlRefNode, sql, valueNode } from "@src/core/sql"

export enum MessageStatus {
    CREATED,
    WAITING,
    PROCESSING,
    LOCKED,
    FINALIZED
}

export const messageInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.message (
            id UUID NOT NULL,
            name TEXT,
            channel_name TEXT NOT NULL,
            payload TEXT NOT NULL,
            priority INTEGER NULL,
            num_attempts INTEGER NOT NULL,
            max_processing_secs REAL NOT NULL,
            delay_secs REAL NOT NULL,
            lock_secs REAL NOT NULL,
            lock_secs_factor REAL NOT NULL,
            status INTEGER NOT NULL,
            is_processed BOOLEAN NOT NULL,
            num_dependencies INTEGER NOT NULL,
            num_dependencies_failed INTEGER NOT NULL,
            dependency_failure_cascade BOOLEAN NOT NULL,
            created_at TIMESTAMP,
            waiting_at TIMESTAMP,
            locked_at TIMESTAMP,
            PRIMARY KEY (id)
        );
    `,

    sql `
        CREATE INDEX message_dequeue_ix
        ON ${params.schema}.message (
            channel_name,
            priority DESC NULLS LAST,
            waiting_at ASC
        ) WHERE status = ${valueNode(MessageStatus.WAITING)}
    `,

    sql `
        CREATE UNIQUE INDEX message_deduplication_ix
        ON ${params.schema}.message (
            name
        ) WHERE NOT is_processed;
    `
]
