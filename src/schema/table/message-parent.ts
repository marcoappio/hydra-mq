import { sql, type SqlRefNode } from "@src/core/sql"

export const messageParentInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.message_parent (
            id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
            message_id UUID NOT NULL,
            parent_message_id UUID NOT NULL,
            status INTEGER NULL,
            result TEXT NULL,
            PRIMARY KEY (id)
        )
    `,

    sql `
        CREATE INDEX message_parent_message_id_ix
        ON ${params.schema}.message_parent (message_id);
    `,

    sql `
        CREATE INDEX message_parent_parent_message_id_ix
        ON ${params.schema}.message_parent (parent_message_id);
    `
]
