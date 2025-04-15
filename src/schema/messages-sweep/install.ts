import { parseCronExpr } from "@src/core/cron"
import { arrayNode, sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"
import { MessageStatus } from "@src/schema/message"

export const messageSweepInstall = (params: {
    schema: SqlRefNode
}) => {
    const parsedCronExpr = parseCronExpr("* * * * *")
    if (parsedCronExpr.resultType !== "CRON_EXPR_PARSED") {
        throw new Error("Invalid cron expression")
    }

    return [
        sql `
            CREATE FUNCTION ${params.schema}.messages_sweep()
            RETURNS VOID AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
            BEGIN
                v_now := NOW();

                FOR v_message IN
                    SELECT id
                    FROM ${params.schema}.message
                    WHERE status = ${valueNode(MessageStatus.PROCESSING)}
                    AND sweep_after <= v_now
                    ORDER BY sweep_after ASC
                LOOP
                    PERFORM ${params.schema}.job_message_lock_enqueue(
                        v_message.id
                    );
                END LOOP;
            END;
            $$ LANGUAGE plpgsql;
        `,

        sql `
            INSERT INTO ${params.schema}.job (
                type, 
                is_recurring, 
                cron_expr_mins,
                cron_expr_hours,
                cron_expr_days,
                cron_expr_months,
                cron_expr_days_of_week,
                process_after
            ) VALUES (
                ${valueNode(JobType.MESSAGES_SWEEP)},
                ${valueNode(true)},
                ${arrayNode(parsedCronExpr.expression.mins)},
                ${arrayNode(parsedCronExpr.expression.hours)},
                ${arrayNode(parsedCronExpr.expression.days)},
                ${arrayNode(parsedCronExpr.expression.months)},
                ${arrayNode(parsedCronExpr.expression.daysOfWeek)},
                NOW()
            )
        `
    ]
}
