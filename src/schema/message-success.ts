import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageSuccessResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_COMPLETED
}

export const messageSuccessInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_success(
                p_id UUID
            )
            RETURNS JSONB AS $$
            DECLARE
                v_message RECORD;
            BEGIN
                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.COMPLETED)}
                WHERE id = p_id
                AND status = ${valueNode(MessageStatus.PROCESSING)}
                RETURNING channel_name
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageSuccessResultCode.MESSAGE_NOT_FOUND)}
                    );
                END IF;

                UPDATE ${params.schema}.channel_state SET
                    current_concurrency = current_concurrency - 1,
                    current_size = current_size - 1
                WHERE name = v_message.channel_name;
                
                PERFORM ${params.schema}.job_message_finalize_enqueue(p_id);

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageSuccessResultCode.MESSAGE_COMPLETED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
