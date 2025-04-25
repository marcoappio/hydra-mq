import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"

export const jobMessageCreateScheduleClearInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.job_message_create_schedule_clear(
            p_name TEXT
        )
        RETURNS VOID AS $$
        BEGIN
            DELETE FROM ${params.schema}.job
            WHERE type = ${valueNode(JobType.MESSAGE_CREATE)}
            AND name = p_name;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
