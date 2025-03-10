import { type SqlRefNode, sql } from '@src/core/sql'
import { ResultCode } from '@src/driver/result-code'
import { queryMessageClean } from '@src/driver/sql/query/message-clean'

export const functionMessageCleanCreateSql = (params: {
    schema: SqlRefNode
}) => {
    const cleanQuery = queryMessageClean({
        limit: sql.value(1),
        schema: params.schema,
        threshold: sql.ref('v_now'),
    })
    return [
        sql.build `
        CREATE FUNCTION ${params.schema}.message_clean()
        RETURNS TABLE (
            o_result_code INT,
            o_action INT,
            o_message_id UUID,
            o_queue_id TEXT
        ) AS $$
        DECLARE
            v_now TIMESTAMP := NOW();
            v_message RECORD;
        BEGIN
            ${sql.raw(cleanQuery)}
            INTO v_message
            FOR UPDATE SKIP LOCKED;

            IF v_message IS NULL THEN
                RETURN QUERY SELECT 
                    ${sql.value(ResultCode.MESSAGE_NOT_AVAILABLE)},
                    ${sql.value(null)}::INT,
                    ${sql.value(null)}::UUID,
                    ${sql.value(null)}::TEXT;
                RETURN;
            END IF;

            IF v_message.num_attempts <= 1 THEN
                PERFORM ${params.schema}.message_finalize(v_message.id);
                RETURN QUERY SELECT 
                    ${sql.value(ResultCode.MESSAGE_CLEANED)},
                    ${sql.value(ResultCode.MESSAGE_FINALIZED)},
                    v_message.id,
                    v_message.queue_id;
            ELSE
                PERFORM ${params.schema}.message_lock(v_message.id);
                RETURN QUERY SELECT 
                    ${sql.value(ResultCode.MESSAGE_CLEANED)},
                    ${sql.value(ResultCode.MESSAGE_LOCKED)},
                    v_message.id,
                    v_message.queue_id;
            END IF;

        END;
        $$ LANGUAGE plpgsql;
    `,
    ]
}
