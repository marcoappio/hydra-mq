import { type SqlRefNode, rawNode, refNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { messageFetchForAdvance } from "@src/driver/sql/query/message-fetch-for-advance"

export const functionQueueAdvanceCreateSql = (params: {
    schema: SqlRefNode
}) => {
    const advanceQuery = messageFetchForAdvance({
        select: [ refNode("id") ],
        limit: valueNode(1),
        queueId: refNode("p_queue_id"),
        groupId: refNode("p_group_id"),
        schema: params.schema,
    })

    return [
        sql `
            CREATE FUNCTION ${params.schema}.queue_advance(
                p_group_id TEXT,
                p_queue_id TEXT
            )
            RETURNS VOID AS $$
            DECLARE
                v_queue_config RECORD;
                v_message RECORD;
                v_now TIMESTAMP := NOW();
            BEGIN
                SELECT current_concurrency, max_concurrency
                INTO v_queue_config
                FROM ${params.schema}.queue_config
                WHERE group_id = p_group_id
                AND queue_id = p_queue_id
                FOR UPDATE;

                IF v_queue_config.max_concurrency - v_queue_config.current_concurrency <= 0 THEN
                    RETURN;
                END IF;

                ${rawNode(advanceQuery)}
                INTO v_message
                FOR UPDATE SKIP LOCKED;

                IF v_message IS NULL THEN
                    RETURN;
                END IF;

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.READY)},
                    ready_at = v_now
                WHERE id = v_message.id;

                UPDATE ${params.schema}.queue_config SET
                    current_concurrency = current_concurrency + 1
                WHERE group_id = p_group_id
                AND queue_id = p_queue_id;
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
