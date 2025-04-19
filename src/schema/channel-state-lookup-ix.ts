import { type SqlRefNode, sql } from "@src/core/sql"

export const channelStateLookupIxInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE UNIQUE INDEX channel_state_lookup_ix
        ON ${params.schema}.channel_state (name);
    `,
]

