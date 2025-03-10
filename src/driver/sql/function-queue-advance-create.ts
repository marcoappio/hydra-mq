import { type SqlRefNode, sql } from '@src/core/sql'
import { MessageStatus } from '@src/driver/message-status'
import { queryMessageAdvance } from '@src/driver/sql/query/message-advance'

export const functionQueueAdvanceCreateSql = (params: {
    schema: SqlRefNode
}) => {
    const advanceQuery = queryMessageAdvance({
        limit: sql.value(1),
        queueId: sql.ref('p_queue_id'),
        schema: params.schema,
    })

    return [
        sql.build `
            CREATE FUNCTION ${params.schema}.queue_advance(
                p_queue_id TEXT
            )
            RETURNS VOID AS $$
            DECLARE
                v_queue_config RECORD;
                v_message RECORD;
            BEGIN
                SELECT current_concurrency, max_concurrency
                INTO v_queue_config
                FROM ${params.schema}.queue_config
                WHERE id = p_queue_id
                FOR UPDATE;

                IF v_queue_config.max_concurrency - v_queue_config.current_concurrency <= 0 THEN
                    RETURN;
                END IF;

                ${sql.raw(advanceQuery)}
                INTO v_message
                FOR UPDATE SKIP LOCKED;

                IF v_message IS NULL THEN
                    RETURN;
                END IF;

                UPDATE ${params.schema}.message SET
                    status = ${sql.value(MessageStatus.READY)}
                WHERE id = v_message.id;

                UPDATE ${params.schema}.message_queue_prefix SET
                    status = ${sql.value(MessageStatus.READY)}
                WHERE message_id = v_message.id;

                UPDATE ${params.schema}.queue_config SET
                    current_concurrency = current_concurrency + 1
                WHERE id = p_queue_id;
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
