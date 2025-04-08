import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageEnqueueResultCode {
    MESSAGE_DEDUPLICATED,
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
                p_max_processing_secs REAL,
                p_lock_secs REAL,
                p_lock_secs_factor REAL,
                p_delay_secs REAL,
                p_depends_on UUID[],
                p_dependency_failure_cascade BOOLEAN
            )
            RETURNS TABLE (
                o_result_code INTEGER,
                o_id UUID
            ) AS $$
            DECLARE
                v_now TIMESTAMP;
                v_process_after TIMESTAMP;
                v_channel_name TEXT;
                v_message_id UUID;
                v_parent_id UUID;
                v_parent RECORD;
                v_message RECORD;
                v_params RECORD;
                v_normalized_deps UUID[];
            BEGIN
                v_now := NOW();
                v_message_id := GEN_RANDOM_UUID();
                v_channel_name := COALESCE(p_channel_name, GEN_RANDOM_UUID()::TEXT);

                v_normalized_deps := ARRAY(
                    SELECT DISTINCT UNNEST(p_depends_on)
                );

                FOREACH v_parent_id IN ARRAY v_normalized_deps LOOP
                    SELECT 1
                    FROM ${params.schema}.message
                    WHERE id = v_parent_id
                    AND status = ${valueNode(MessageStatus.CREATED)}
                    FOR SHARE
                    INTO v_parent;

                    IF v_parent_id IS NULL THEN
                        RETURN QUERY SELECT
                            ${valueNode(MessageEnqueueResultCode.MESSAGE_DEPENDENCY_NOT_FOUND)},
                            ${valueNode(null)}::UUID;
                    END IF;
                END LOOP;

                INSERT INTO ${params.schema}.message (
                    id,
                    name,
                    channel_name,
                    payload,
                    priority,
                    channel_priority,
                    num_attempts,
                    max_processing_secs,
                    delay_secs,
                    lock_secs,
                    lock_secs_factor,
                    status,
                    is_processed,
                    num_dependencies,
                    num_dependencies_failed,
                    dependency_failure_cascade,
                    created_at
                ) VALUES (
                    v_message_id,
                    p_name,
                    v_channel_name,
                    p_payload,
                    p_priority,
                    p_channel_priority,
                    p_num_attempts,
                    p_max_processing_secs,
                    p_delay_secs,
                    p_lock_secs,
                    p_lock_secs_factor,
                    ${valueNode(MessageStatus.CREATED)},
                    ${valueNode(false)},
                    COALESCE(ARRAY_LENGTH(v_normalized_deps, 1), 0),
                    ${valueNode(0)},
                    p_dependency_failure_cascade,
                    v_now
                ) ON CONFLICT (name) 
                WHERE NOT is_processed
                DO UPDATE SET
                    id = ${params.schema}.message.id
                RETURNING id, num_dependencies
                INTO v_message;

                INSERT INTO ${params.schema}.message_dependency (
                    parent_message_id,
                    child_message_id
                ) SELECT
                    parent_id,
                    v_message_id
                FROM UNNEST(v_normalized_deps) AS parent_id;

                IF v_message.id != v_message_id THEN
                    RETURN QUERY SELECT 
                        ${valueNode(MessageEnqueueResultCode.MESSAGE_DEDUPLICATED)}, 
                        v_message.id;
                    RETURN;
                END IF;

                IF v_message.num_dependencies = 0 THEN
                    PERFORM ${params.schema}.job_message_release_enqueue(
                        v_message.id,
                        v_now + p_delay_secs * INTERVAL '1 SECOND'
                    );
                END IF;

                RETURN QUERY SELECT 
                    ${valueNode(MessageEnqueueResultCode.MESSAGE_ENQUEUED)}, 
                    v_message.id;
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
