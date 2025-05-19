import { type SqlRefNode, sql } from "@src/core/sql"

export const channelPolicyInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.channel_policy (
            id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
            name TEXT NOT NULL,
            max_concurrency INTEGER,
            PRIMARY KEY (id)
        );
    `,

    // Find a channel policy by its name
    sql `
        CREATE UNIQUE INDEX channel_policy_name_ux
        ON ${params.schema}.channel_policy (name);
    `
]
