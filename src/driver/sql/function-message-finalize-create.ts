import { type SqlRefNode, sql } from '@src/core/sql'
import { ResultCode } from '@src/driver/result-code'

export const functionMessageArchiveCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build`
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
            RETURNING queue_id, payload, created_at
            INTO v_message;

            IF v_message IS NULL THEN
                RETURN QUERY SELECT ${sql.value(ResultCode.MESSAGE_NOT_FOUND)};
                RETURN;
            END IF;

            UPDATE ${params.schema}.queue_config SET
                current_capacity = current_capacity - 1,
                current_concurrency = current_concurrency - 1
            WHERE id = v_message.queue_id;
            
            PERFORM ${params.schema}.queue_advance(v_message.queue_id);
            RETURN QUERY SELECT ${sql.value(ResultCode.MESSAGE_FINALIZED)};
        END;
        $$ LANGUAGE plpgsql;
    `,
]
