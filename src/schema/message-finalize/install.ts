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
                v_message_dependency RECORD;
            BEGIN
                v_now := NOW();

                SELECT channel_name
                FROM ${params.schema}.message
                WHERE id = p_id
                AND status = ${valueNode(MessageStatus.PROCESSING)}
                FOR UPDATE
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

                FOR v_message_dependency IN
                    DELETE FROM ${params.schema}.message_dependency 
                    WHERE parent_message_id = p_id
                    RETURNING child_message_id
                LOOP
                    PERFORM ${params.schema}.job_message_dependency_resolve_enqueue(
                        v_message_dependency.child_message_id,
                        p_is_success
                    );
                END LOOP;

                DELETE FROM ${params.schema}.message
                WHERE id = p_id;

                RETURN QUERY SELECT ${valueNode(MessageFinalizeResultCode.MESSAGE_FINALIZED)};
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
