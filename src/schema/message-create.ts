import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageCreateResultCode {
    MESSAGE_CREATED
}

export const messageCreateInstall = (params: {
    schema: SqlRefNode,
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_create(
                p_name TEXT,
                p_channel_name TEXT,
                p_payload TEXT,
                p_priority INTEGER,
                p_channel_priority INTEGER,
                p_num_attempts INTEGER,
                p_max_processing_ms INTEGER,
                p_lock_ms INTEGER,
                p_lock_ms_factor REAL,
                p_delay_ms INTEGER,
                p_delete_ms INTEGER,
                p_depends_on UUID[]
            )
            RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message_id UUID;
                v_channel_name TEXT;
                v_parent_id UUID;
                v_parent RECORD;
                v_num_dependencies INTEGER;
            BEGIN
                v_now := NOW();
                v_message_id := GEN_RANDOM_UUID();
                v_channel_name := COALESCE(p_channel_name, GEN_RANDOM_UUID()::TEXT);
                v_num_dependencies := 0;

                FOREACH v_parent_id IN ARRAY p_depends_on LOOP
                    v_parent := NULL;

                    SELECT id, status, result
                    FROM ${params.schema}.message
                    WHERE id = v_parent_id
                    FOR SHARE
                    INTO v_parent;

                    IF v_parent.status NOT IN (
                        ${valueNode(MessageStatus.COMPLETED)},
                        ${valueNode(MessageStatus.EXHAUSTED)},
                        ${valueNode(MessageStatus.DEDUPLICATED)},
                        ${valueNode(MessageStatus.DROPPED)}
                    ) THEN
                        v_num_dependencies := v_num_dependencies + 1;
                    END IF;

                    INSERT INTO ${params.schema}.message_parent (
                        message_id,
                        parent_message_id,
                        status,
                        result
                    ) VALUES (
                        v_message_id,
                        v_parent_id,
                        v_parent.status,
                        v_parent.result
                    );
                END LOOP;

                INSERT INTO ${params.schema}.message (
                    id,
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
                    delete_ms,
                    status,
                    is_processed,
                    num_dependencies,
                    created_at
                ) VALUES (
                    v_message_id,
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
                    p_delete_ms,
                    ${valueNode(MessageStatus.CREATED)},
                    ${valueNode(false)},
                    v_num_dependencies,
                    v_now
                );

                IF v_num_dependencies = 0 THEN
                    PERFORM ${params.schema}.job_message_release(
                        v_message_id,
                        v_now + p_delay_ms * INTERVAL '1 MILLISECOND'
                    );
                END IF;

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageCreateResultCode.MESSAGE_CREATED)}, 
                    'id', v_message_id
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
