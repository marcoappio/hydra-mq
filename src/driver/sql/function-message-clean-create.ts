import { type SqlRefNode, rawNode, refNode, sql, valueNode } from "@src/core/sql"
import { ResultCode } from "@src/driver/result-code"
import { messageFetchForClean } from "@src/driver/sql/query/message-fetch-for-clean"

export const functionMessageCleanCreateSql = (params: {
    schema: SqlRefNode
}) => {
    const cleanQuery = messageFetchForClean({
        limit: valueNode(1),
        schema: params.schema,
        threshold: refNode("v_now"),
        select: [
            refNode("id"),
            refNode("group_id"),
            refNode("queue_id")
        ],
    })
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_clean()
            RETURNS TABLE (
                o_result_code INT,
                o_action INT,
                o_message_id UUID,
                o_group_id TEXT,
                o_queue_id TEXT
            ) AS $$
            DECLARE
                v_now TIMESTAMP := NOW();
                v_message RECORD;
            BEGIN
                ${rawNode(cleanQuery)}
                INTO v_message
                FOR UPDATE SKIP LOCKED;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT 
                        ${valueNode(ResultCode.MESSAGE_NOT_AVAILABLE)},
                        ${valueNode(null)}::INT,
                        ${valueNode(null)}::UUID,
                        ${valueNode(null)}::TEXT,
                        ${valueNode(null)}::TEXT;
                    RETURN;
                END IF;

                IF v_message.num_attempts <= 1 THEN
                    PERFORM ${params.schema}.message_finalize(v_message.id);
                    RETURN QUERY SELECT 
                        ${valueNode(ResultCode.MESSAGE_CLEANED)},
                        ${valueNode(ResultCode.MESSAGE_FINALIZED)},
                        v_message.id,
                        v_message.group_id,
                        v_message.queue_id;
                ELSE
                    PERFORM ${params.schema}.message_lock(v_message.id);
                    RETURN QUERY SELECT 
                        ${valueNode(ResultCode.MESSAGE_CLEANED)},
                        ${valueNode(ResultCode.MESSAGE_LOCKED)},
                        v_message.id,
                        v_message.group_id,
                        v_message.queue_id;
                END IF;

            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
