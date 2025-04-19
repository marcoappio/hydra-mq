import { type SqlRefNode, sql } from "@src/core/sql"

export const channelStateInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.channel_state (
            id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
            name TEXT NOT NULL,
            max_size INTEGER,
            max_concurrency INTEGER,
            current_size INTEGER NOT NULL,
            current_concurrency INTEGER NOT NULL,
            next_message_id UUID,
            next_priority INTEGER,
            dequeued_at TIMESTAMP,
            PRIMARY KEY (id)
        );
    `,
]

