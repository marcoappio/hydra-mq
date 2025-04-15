import { sql, valueNode, type SqlRefNode } from "@src/core/sql"

export const jobProcessMessageEnqueueInstall = (params : {
    schema: SqlRefNode
}) => {
    return sql `
        CREATE FUNCTION ${params.schema}.job_process_message_enqueue(
            p_id UUID
        ) RETURNS VOID AS $$
        DECLARE
            v_params RECORD;
        BEGIN
            SELECT
                name,
                channel_name,
                payload,
                priority,
                channel_priority,
                num_attempts,
                max_processing_secs,
                lock_secs,
                lock_secs_factor,
                delay_secs
            FROM ${params.schema}.job_message_enqueue_params
            WHERE job_id = p_id
            INTO v_params;

            PERFORM ${params.schema}.message_enqueue(
                v_params.name,
                COALESCE(v_params.channel_name, GEN_RANDOM_UUID()::TEXT),
                v_params.payload,
                v_params.priority,
                v_params.channel_priority,
                v_params.num_attempts,
                v_params.max_processing_secs,
                v_params.lock_secs,
                v_params.lock_secs_factor,
                v_params.delay_secs,
                ARRAY[]::UUID[],
                ${valueNode(false)}
            );
        END;
        $$ LANGUAGE plpgsql;
    `
}

