import { type SqlRefNode, sql } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { ResultCode } from "@src/driver/result-code"
import { queryMessageUnlock } from "@src/driver/sql/query/message-unlock"

export const functionMessageUnlockCreateSql = (params: {
    schema: SqlRefNode
}) => {
    const query = queryMessageUnlock({
        limit: sql.value(1),
        schema: params.schema,
        threshold: sql.ref("v_now"),
    })

    return [
        sql.build `
            CREATE FUNCTION ${params.schema}.message_unlock()
            RETURNS TABLE (
                o_result_code INT,
                o_message_id UUID,
                o_queue_id TEXT
            ) AS $$
            DECLARE
                v_now TIMESTAMP := NOW();
                v_message RECORD;
                v_status INTEGER;
                v_queue_config RECORD;
            BEGIN
                ${sql.raw(query)}
                INTO v_message
                FOR UPDATE SKIP LOCKED;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT 
                        ${sql.value(ResultCode.MESSAGE_NOT_AVAILABLE)},
                        ${sql.value(null)}::UUID,
                        ${sql.value(null)}::TEXT;
                    RETURN;
                END IF;

                SELECT current_concurrency, max_concurrency
                INTO v_queue_config    
                FROM ${params.schema}.queue_config
                WHERE id = v_message.queue_id
                FOR UPDATE;

                if v_queue_config.max_concurrency IS NULL OR v_queue_config.current_concurrency < v_queue_config.max_concurrency THEN
                    v_status := ${sql.value(MessageStatus.READY)};
                    UPDATE ${params.schema}.queue_config SET
                        current_concurrency = current_concurrency + 1
                    WHERE id = v_message.queue_id;
                ELSE
                    v_status := ${sql.value(MessageStatus.WAITING)};
                END IF;

                UPDATE ${params.schema}.message SET
                    status = v_status
                WHERE id = v_message.id;

                UPDATE ${params.schema}.message_queue_prefix SET
                    status = v_status
                WHERE message_id = v_message.id;

                RETURN QUERY SELECT 
                    ${sql.value(ResultCode.MESSAGE_UNLOCKED)},
                    v_message.id,
                    v_message.queue_id;
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
