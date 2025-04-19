import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageEnqueueResultCode {
    MESSAGE_DEPENDENCY_NOT_FOUND,
    MESSAGE_ENQUEUED
}

export const messageEnqueueInstall = (params: {
    schema: SqlRefNode,
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_enqueue(
                p_name TEXT,
                p_channel_name TEXT,
                p_payload TEXT,
                p_priority INTEGER,
                p_channel_priority INTEGER,
                p_num_attempts INTEGER,
                p_max_processing_ms INTEGER,
                p_lock_ms INTEGER,
                p_lock_ms_factor REAL,
                p_delay_ms REAL,
                p_depends_on UUID[],
                p_dependency_failure_cascade BOOLEAN
            )
            RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_process_after TIMESTAMP;
                v_channel_name TEXT;
                v_parent_id UUID;
                v_parent RECORD;
                v_message RECORD;
                v_params RECORD;
                v_normalized_deps UUID[];
            BEGIN
                v_now := NOW();
                v_channel_name := COALESCE(p_channel_name, GEN_RANDOM_UUID()::TEXT);

                v_normalized_deps := ARRAY(
                    SELECT DISTINCT UNNEST(p_depends_on)
                );

                FOREACH v_parent_id IN ARRAY v_normalized_deps LOOP
                    SELECT status
                    FROM ${params.schema}.message
                    WHERE id = v_parent_id
                    AND status = ${valueNode(MessageStatus.CREATED)}
                    FOR SHARE
                    INTO v_parent;

                    IF v_parent IS NULL THEN
                        RETURN JSONB_BUILD_OBJECT(
                            'result_code', ${valueNode(MessageEnqueueResultCode.MESSAGE_DEPENDENCY_NOT_FOUND)}
                        );
                    END IF;
                END LOOP;

                INSERT INTO ${params.schema}.message (
                    name,
                    channel_name,
                    payload,
                    priority,
                    channel_priority,
                    num_attempts,
                    max_processing_ms,
                    delay_ms,
                    lock_ms,
                    lock_ms_factor,
                    status,
                    is_processed,
                    num_dependencies,
                    num_dependencies_failed,
                    dependency_failure_cascade,
                    created_at
                ) VALUES (
                    p_name,
                    v_channel_name,
                    p_payload,
                    p_priority,
                    p_channel_priority,
                    p_num_attempts,
                    p_max_processing_ms,
                    p_delay_ms,
                    p_lock_ms,
                    p_lock_ms_factor,
                    ${valueNode(MessageStatus.CREATED)},
                    ${valueNode(false)},
                    COALESCE(ARRAY_LENGTH(v_normalized_deps, 1), 0),
                    ${valueNode(0)},
                    p_dependency_failure_cascade,
                    v_now
                ) RETURNING id, num_dependencies
                INTO v_message;

                INSERT INTO ${params.schema}.message_dependency (
                    parent_message_id,
                    child_message_id
                ) SELECT
                    parent_id,
                    v_message.id
                FROM UNNEST(v_normalized_deps) AS parent_id;


                IF v_message.num_dependencies = 0 THEN
                    PERFORM ${params.schema}.job_message_release_enqueue(
                        v_message.id,
                        v_now + p_delay_ms * INTERVAL '1 MILLISECOND'
                    );
                END IF;

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageEnqueueResultCode.MESSAGE_ENQUEUED)}, 
                    'id', v_message.id
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
