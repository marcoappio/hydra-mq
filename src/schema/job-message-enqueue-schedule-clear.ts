import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

export const jobMessageEnqueueScheduleClearInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.job_message_enqueue_schedule_clear(
            p_name TEXT
        )
        RETURNS VOID AS $$
        BEGIN
            DELETE FROM ${params.schema}.job
            WHERE type = ${valueNode(JobType.MESSAGE_ENQUEUE)}
            AND name = p_name;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
