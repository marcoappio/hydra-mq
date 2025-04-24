import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export const messageInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.message (
            id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
            name TEXT,
            channel_name TEXT NOT NULL,
            payload TEXT NOT NULL,
            result TEXT NULL,
            priority INTEGER NULL,
            channel_priority INTEGER NULL,
            num_attempts INTEGER NOT NULL,
            max_processing_ms INTEGER NOT NULL,
            delay_ms INTEGER NOT NULL,
            delete_ms INTEGER NOT NULL,
            lock_ms INTEGER NOT NULL,
            lock_ms_factor INTEGER NOT NULL,
            status INTEGER NOT NULL,
            is_processed BOOLEAN NOT NULL,
            num_dependencies INTEGER NOT NULL,
            sweep_after TIMESTAMP,
            created_at TIMESTAMP,
            accepted_at TIMESTAMP,
            PRIMARY KEY (id)
        );
    `,

    // Find duplicated messages
    sql `
        CREATE UNIQUE INDEX message_name_ix
        ON ${params.schema}.message (
            name
        ) WHERE status = ${valueNode(MessageStatus.ACCEPTED)} AND NOT is_processed
    `,

    // Find stale messages to sweep
    sql `
        CREATE INDEX message_sweep_after_ix
        ON ${params.schema}.message (
            sweep_after ASC
        ) WHERE status = ${valueNode(MessageStatus.PROCESSING)}
    `,

    // Find accepted messages to "promote" to the head of a channel
    sql `
        CREATE INDEX message_channel_name_priority_channel_priority_accepted_at_ix
        ON ${params.schema}.message (
            channel_name,
            priority ASC NULLS FIRST,
            channel_priority ASC NULLS FIRST,
            accepted_at ASC
        ) WHERE status = ${valueNode(MessageStatus.ACCEPTED)}
    `



]
