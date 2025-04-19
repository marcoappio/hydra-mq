import { type SqlRefNode, sql } from "@src/core/sql"

export const channelStateDequeueIxInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE INDEX channel_state_dequeue_ix
        ON ${params.schema}.channel_state (
            next_priority DESC NULLS LAST,
            dequeued_at ASC NULLS FIRST
        ) WHERE next_message_id IS NOT NULL AND (max_concurrency IS NULL OR current_concurrency < max_concurrency
        );
    `
]

