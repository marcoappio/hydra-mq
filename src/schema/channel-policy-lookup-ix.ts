import { type SqlRefNode, sql } from "@src/core/sql"

export const channelPolicyLookupIxInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE UNIQUE INDEX channel_policy_lookup_ix
        ON ${params.schema}.channel_policy (name);
    `
]
