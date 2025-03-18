import { type SqlRefNode, rawNode, refNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { ResultCode } from "@src/driver/result-code"
import { messageFetchForUnlock } from "@src/driver/sql/query/message-fetch-for-unlock"

export const functionMessageUnlockCreateSql = (params: {
    schema: SqlRefNode
}) => {
    const query = messageFetchForUnlock({
        select: [
            refNode("id"),
            refNode("group_id"),
            refNode("queue_id"),
        ],
        limit: valueNode(1),
        schema: params.schema,
        threshold: refNode("v_now"),
    })

    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_unlock()
            RETURNS TABLE (
                o_result_code INT,
                o_message_id UUID,
                o_group_id TEXT,
                o_queue_id TEXT
            ) AS $$
            DECLARE
                v_now TIMESTAMP := NOW();
                v_message RECORD;
                v_queue_config RECORD;
            BEGIN
                ${rawNode(query)}
                INTO v_message
                FOR UPDATE SKIP LOCKED;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT 
                        ${valueNode(ResultCode.MESSAGE_NOT_AVAILABLE)},
                        ${valueNode(null)}::UUID,
                        ${valueNode(null)}::TEXT;
                    RETURN;
                END IF;

                SELECT current_concurrency, max_concurrency
                INTO v_queue_config    
                FROM ${params.schema}.queue_config
                WHERE group_id = v_message.group_id 
                AND queue_id = v_message.queue_id
                FOR UPDATE;

                if v_queue_config.max_concurrency IS NULL OR v_queue_config.current_concurrency < v_queue_config.max_concurrency THEN
                    UPDATE ${params.schema}.queue_config SET
                        current_concurrency = current_concurrency + 1
                    WHERE group_id = v_message.group_id
                    AND queue_id = v_message.queue_id;

                    UPDATE ${params.schema}.message SET
                        status = ${valueNode(MessageStatus.READY)},
                        ready_at = v_now
                    WHERE id = v_message.id;
                ELSE
                    UPDATE ${params.schema}.message SET
                        status = ${valueNode(MessageStatus.WAITING)},
                        waiting_at = v_now
                    WHERE id = v_message.id;
                END IF;

                RETURN QUERY SELECT 
                    ${valueNode(ResultCode.MESSAGE_UNLOCKED)},
                    v_message.id,
                    v_message.queue_id;
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
