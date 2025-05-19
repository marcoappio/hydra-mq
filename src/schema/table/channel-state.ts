import { type SqlRefNode, sql } from "@src/core/sql"

export const channelStateInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.channel_state (
            id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
            name TEXT NOT NULL,
            max_concurrency INTEGER,
            current_size INTEGER NOT NULL,
            current_concurrency INTEGER NOT NULL,
            next_message_id UUID,
            next_priority INTEGER,
            dequeued_at TIMESTAMP,
            PRIMARY KEY (id)
        );
    `,

    // Find a channel by its name
    sql `
        CREATE UNIQUE INDEX channel_state_name_ux
        ON ${params.schema}.channel_state (name);
    `,

    // Find the next channel to dequeue from
    sql `
        CREATE INDEX channel_state_next_priority_dequeued_at_ix
        ON ${params.schema}.channel_state (
            next_priority DESC NULLS LAST,
            dequeued_at ASC NULLS FIRST
        ) WHERE next_message_id IS NOT NULL AND (max_concurrency IS NULL OR current_concurrency < max_concurrency);
    `
]

