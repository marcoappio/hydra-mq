import { type SqlRefNode, sql } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { ResultCode } from "@src/driver/result-code"
import { queryMessageDequeue } from "@src/driver/sql/query/message-dequeue"

export const functionMessageDequeueCreateSql = (params: {
    schema: SqlRefNode
}) => {
    const dequeueQuery = queryMessageDequeue({
        limit: sql.value(1),
        queueIdPrefix: sql.ref("p_queue_id_prefix"),
        schema: params.schema,
    })

    return [
        sql.build `
        CREATE FUNCTION ${params.schema}.message_dequeue(
            p_queue_id_prefix TEXT
        )
        RETURNS TABLE (
            o_result_code INTEGER,
            o_message_id UUID,
            o_queue_id TEXT,
            o_payload TEXT,
            o_num_attempts INTEGER
        ) AS $$
        DECLARE
            v_now TIMESTAMP := NOW();
            v_queue_config RECORD;
            v_message RECORD;
        BEGIN
            ${sql.raw(dequeueQuery)}
            FOR UPDATE SKIP LOCKED
            INTO v_message;

            IF v_message IS NULL THEN
                RETURN QUERY SELECT 
                    ${sql.value(ResultCode.MESSAGE_NOT_AVAILABLE)}, 
                    ${sql.value(null)}::UUID, 
                    ${sql.value(null)}::TEXT, 
                    ${sql.value(null)}::TEXT, 
                    ${sql.value(null)}::INTEGER;
                RETURN;
            END IF;

            UPDATE ${params.schema}.message SET
                status = ${sql.value(MessageStatus.PROCESSING)},
                processed_at = v_now,
                stale_at = v_now + stale_secs * INTERVAL '1 SECOND'
            WHERE id = v_message.id;

            UPDATE ${params.schema}.message_queue_prefix SET
                status = ${sql.value(MessageStatus.PROCESSING)}
            WHERE message_id = v_message.id;

            RETURN QUERY SELECT
                ${sql.value(ResultCode.MESSAGE_DEQUEUED)},
                v_message.id,
                v_message.queue_id,
                v_message.payload,
                v_message.num_attempts;
        END;
        $$ LANGUAGE plpgsql;
    `,
    ]
}
