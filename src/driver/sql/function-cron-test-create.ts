import { type SqlRefNode, sql } from "@src/core/sql"

export const functionCronTestCreate = (params: {
    schema: SqlRefNode
}) => [
    sql.build `
        CREATE FUNCTION ${params.schema}.cron_test(
            p_cron_expr_mins INTEGER[],
            p_cron_expr_hours INTEGER[],
            p_cron_expr_days INTEGER[],
            p_cron_expr_months INTEGER[],
            p_cron_expr_days_of_week INTEGER[],
            p_timestamp TIMESTAMP
        ) RETURNS BOOLEAN AS $$
        DECLARE
            v_mins INTEGER := EXTRACT(MINUTE FROM p_timestamp);
            v_hours INTEGER := EXTRACT(HOUR FROM p_timestamp);
            v_day INTEGER := EXTRACT(DAY FROM p_timestamp);
            v_month INTEGER := EXTRACT(MONTH FROM p_timestamp);
            v_day_of_week INTEGER := EXTRACT(DOW FROM p_timestamp);
        BEGIN
            RETURN 
                v_mins = ANY(p_cron_expr_mins) AND
                v_hours = ANY(p_cron_expr_hours) AND
                v_day = ANY(p_cron_expr_days) AND
                v_month = ANY(p_cron_expr_months) AND
                v_day_of_week = ANY(p_cron_expr_days_of_week);
        END;
        $$ LANGUAGE plpgsql;
    `,
]
