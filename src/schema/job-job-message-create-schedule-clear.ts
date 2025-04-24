import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"

export const jobJobMessageCreateScheduleClearInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.job_job_message_create_schedule_clear(
            p_name TEXT
        )
        RETURNS VOID AS $$
        DECLARE
            v_now TIMESTAMP;
            v_params JSONB;
        BEGIN
            v_now := NOW();
            v_params := JSONB_BUILD_OBJECT('name', p_name);

            INSERT INTO ${params.schema}.job (
                name,
                type, 
                params,
                is_recurring,
                process_after
            ) VALUES (
                p_name,
                ${valueNode(JobType.JOB_MESSAGE_CREATE_SCHEDULE_CLEAR)},
                v_params,
                ${valueNode(false)},
                v_now
            );
        END;
        $$ LANGUAGE plpgsql;
    `,
]
