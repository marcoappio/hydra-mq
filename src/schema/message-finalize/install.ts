import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageFinalizeResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_FINALIZED
}

export const messageFinalizeInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_finalize(
                p_id UUID,
                p_is_success BOOLEAN
            )
            RETURNS TABLE (
                o_result_code INT
            ) AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_channel_state RECORD;
            BEGIN
                v_now := NOW();

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.FINALIZED)},
                    finalized_at = v_now
                WHERE id = p_id
                AND status = ${valueNode(MessageStatus.PROCESSING)}
                RETURNING channel_name
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT ${valueNode(MessageFinalizeResultCode.MESSAGE_NOT_FOUND)};
                    RETURN;
                END IF;
                
                UPDATE ${params.schema}.channel_state SET
                    current_concurrency = current_concurrency - 1,
                    current_size = current_size - 1
                WHERE name = v_message.channel_name
                RETURNING current_size
                INTO v_channel_state;

                IF v_channel_state.current_size = 0 THEN
                    DELETE FROM ${params.schema}.channel_state
                    WHERE name = v_message.channel_name;
                END IF;

                PERFORM ${params.schema}.job_message_delete_enqueue(
                    p_id,
                    p_is_success
                );

                RETURN QUERY SELECT ${valueNode(MessageFinalizeResultCode.MESSAGE_FINALIZED)};
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
