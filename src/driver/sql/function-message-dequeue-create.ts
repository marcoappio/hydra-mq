import { rawNode, refNode, sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { ResultCode } from "@src/driver/result-code"
import { messageFetchForProcessing } from "@src/driver/sql/query/message-fetch-for-processing"

export const functionMessageDequeueCreateSql = (params: {
    schema: SqlRefNode
}) => {
    const dequeueQuery = messageFetchForProcessing({
        limit: valueNode(1),
        groupId: refNode("p_group_id"),
        schema: params.schema,
        select: [
            refNode("id"),
            refNode("queue_id"),
            refNode("payload"),
            refNode("num_attempts"),
        ]
    })

    return [
        sql `
        CREATE FUNCTION ${params.schema}.message_dequeue(
            p_group_id TEXT
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
            ${rawNode(dequeueQuery)}
            FOR UPDATE SKIP LOCKED
            INTO v_message;

            IF v_message IS NULL THEN
                RETURN QUERY SELECT 
                    ${valueNode(ResultCode.MESSAGE_NOT_AVAILABLE)}, 
                    ${valueNode(null)}::UUID, 
                    ${valueNode(null)}::TEXT, 
                    ${valueNode(null)}::TEXT, 
                    ${valueNode(null)}::INTEGER;
                RETURN;
            END IF;

            UPDATE ${params.schema}.message SET
                status = ${valueNode(MessageStatus.PROCESSING)},
                processed_at = v_now,
                clean_after = v_now + stale_secs * INTERVAL '1 SECOND'
            WHERE id = v_message.id;

            RETURN QUERY SELECT
                ${valueNode(ResultCode.MESSAGE_DEQUEUED)},
                v_message.id,
                v_message.queue_id,
                v_message.payload,
                v_message.num_attempts;
        END;
        $$ LANGUAGE plpgsql;
    `,
    ]
}
