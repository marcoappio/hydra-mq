import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { ResultCode } from "@src/driver/result-code"

export const functionMessageArchiveCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.message_finalize(
            p_message_id UUID
        )
        RETURNS TABLE (
            o_result_code INT
        ) AS $$
        DECLARE
            v_message RECORD;
            v_now TIMESTAMP := NOW();
        BEGIN
            DELETE FROM ${params.schema}.message
            WHERE id = p_message_id
            RETURNING group_id, queue_id
            INTO v_message;

            IF v_message IS NULL THEN
                RETURN QUERY SELECT ${valueNode(ResultCode.MESSAGE_NOT_FOUND)};
                RETURN;
            END IF;

            UPDATE ${params.schema}.queue_config SET
                current_capacity = current_capacity - 1,
                current_concurrency = current_concurrency - 1
            WHERE id = v_message.queue_id;
            
            PERFORM ${params.schema}.queue_advance(
                v_message.queue_id,
                v_message.group_id
            );
            RETURN QUERY SELECT ${valueNode(ResultCode.MESSAGE_FINALIZED)};
        END;
        $$ LANGUAGE plpgsql;
    `,
]
