import { type SqlRefNode, type SqlValueNode, escapeRefNode, rawNode, sql } from "@src/core/sql"

export const jobProcessQueryJob = (params: {
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    threshold: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.job
        WHERE process_after <= ${params.threshold}
        ORDER BY process_after ASC
        LIMIT ${params.limit}
    `
}

