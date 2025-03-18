import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { ResultCode } from "@src/driver/result-code"

export const functionMessageEnqueueCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.message_enqueue(
            p_group_id TEXT,
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
            v_result_code INTEGER;
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
            WHERE group_id = p_group_id
            AND queue_id = p_queue_id
            FOR UPDATE;

            IF v_queue_config.current_capacity >= v_queue_config.max_capacity THEN
                RETURN QUERY SELECT 
                    ${valueNode(ResultCode.QUEUE_CAPACITY_EXCEEDED)}, 
                    ${valueNode(null)}::UUID;
                RETURN;
            END IF;

            IF v_queue_config.max_concurrency IS NULL OR v_queue_config.current_concurrency < v_queue_config.max_concurrency THEN
                v_status := ${valueNode(MessageStatus.READY)};
                UPDATE ${params.schema}.queue_config SET
                    current_capacity = current_capacity + 1,
                    current_concurrency = current_concurrency + 1
                WHERE group_id = p_group_id
                AND queue_id = p_queue_id;
            ELSE
                v_status := ${valueNode(MessageStatus.WAITING)};
                UPDATE ${params.schema}.queue_config SET
                    current_capacity = current_capacity + 1
                WHERE group_id = p_group_id
                AND queue_id = p_queue_id;
            END IF;

            INSERT INTO ${params.schema}.message (
                id,
                group_id,
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
                p_group_id,
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
            ) ON CONFLICT (group_id, queue_id, deduplication_id) 
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
                v_result_code := ${valueNode(ResultCode.MESSAGE_UPDATED)};
            ELSE
                v_result_code := ${valueNode(ResultCode.MESSAGE_ENQUEUED)};
            END IF;

            RETURN QUERY SELECT 
                v_result_code,
                v_message.id;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
