import { type SqlRefNode, sql } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { ResultCode } from "@src/driver/result-code"

export const functionMessageEnqueueCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build`
        CREATE FUNCTION ${params.schema}.message_enqueue(
            p_queue_id TEXT,
            p_payload TEXT,
            p_priority INTEGER,
            p_timeout_secs INTEGER,
            p_stale_secs INTEGER,
            p_num_attempts INTEGER,
            p_deduplication_id TEXT
        )
        RETURNS TABLE (
            o_result_code INTEGER,
            o_message_id UUID
        ) AS $$
        DECLARE
            v_now TIMESTAMP := NOW();
            v_status INTEGER;
            v_chunks TEXT[];
            v_message_id UUID := GEN_RANDOM_UUID();
            v_message RECORD;
            v_queue_config RECORD;
        BEGIN
            SELECT 
                current_capacity, 
                current_concurrency,
                max_capacity,
                max_concurrency
            INTO v_queue_config
            FROM ${params.schema}.queue_config
            WHERE id = p_queue_id
            FOR UPDATE;

            IF v_queue_config.current_capacity >= v_queue_config.max_capacity THEN
                RETURN QUERY SELECT 
                    ${sql.value(ResultCode.QUEUE_CAPACITY_EXCEEDED)}, 
                    ${sql.value(null)}::UUID;
                RETURN;
            END IF;

            IF v_queue_config.max_concurrency IS NULL OR v_queue_config.current_concurrency < v_queue_config.max_concurrency THEN
                v_status := ${sql.value(MessageStatus.READY)};
                UPDATE ${params.schema}.queue_config SET
                    current_capacity = current_capacity + 1,
                    current_concurrency = current_concurrency + 1
                WHERE id = p_queue_id;
            ELSE
                v_status := ${sql.value(MessageStatus.WAITING)};
                UPDATE ${params.schema}.queue_config SET
                    current_capacity = current_capacity + 1
                WHERE id = p_queue_id;
            END IF;

            INSERT INTO ${params.schema}.message (
                id,
                queue_id,
                payload,
                priority,
                timeout_secs,
                stale_secs,
                num_attempts,
                deduplication_id,
                status,
                created_at,
                updated_at
            ) VALUES (
                v_message_id,
                p_queue_id,
                p_payload,
                p_priority,
                p_timeout_secs,
                p_stale_secs,
                p_num_attempts,
                p_deduplication_id,
                v_status,
                v_now,
                v_now
            ) ON CONFLICT (queue_id, deduplication_id) 
            WHERE processed_at IS NULL
            DO UPDATE SET
                payload = EXCLUDED.payload,
                priority = EXCLUDED.priority,
                timeout_secs = EXCLUDED.timeout_secs,
                stale_secs = EXCLUDED.stale_secs,
                num_attempts = EXCLUDED.num_attempts,
                updated_at = EXCLUDED.created_at
            RETURNING id 
            INTO v_message;

            IF v_message.id != v_message_id THEN
                RETURN QUERY SELECT 
                    ${sql.value(ResultCode.MESSAGE_UPDATED)}, 
                    v_message.id;
                RETURN;
            END IF;

            v_chunks := ${params.schema}.prefixes_generate(p_queue_id);

            FOR i IN 1..array_length(v_chunks, 1) LOOP
                INSERT INTO ${params.schema}.message_queue_prefix (
                    message_id,
                    queue_id_prefix,
                    status,
                    priority,
                    created_at
                ) VALUES (
                    v_message_id,
                    v_chunks[i],
                    v_status,
                    p_priority,
                    v_now
                );
            END LOOP;

            RETURN QUERY SELECT 
                ${sql.value(ResultCode.MESSAGE_ENQUEUED)}, 
                v_message_id;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
