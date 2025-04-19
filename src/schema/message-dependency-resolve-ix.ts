import { sql, type SqlRefNode } from "@src/core/sql"

export const messageDependencyResolveIxInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE INDEX message_dependency_resolve_ix
        ON ${params.schema}.message_dependency (parent_message_id);
    `
]
