import { sql, type SqlRefNode } from "@src/core/sql"

export const messageDependencyInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.message_dependency (
            id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
            parent_message_id UUID NOT NULL,
            child_message_id UUID NOT NULL
        )
    `
]
