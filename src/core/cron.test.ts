import { parseCronField } from "@src/core/cron"
import { expect, test } from "bun:test"

test("parseCronField", () => {

    expect(parseCronField("/5", 0, 59)).toEqual({ resultType: "CRON_FIELD_INVALID" })
    expect(parseCronField("**", 0, 59)).toEqual({ resultType: "CRON_FIELD_INVALID" })
    expect(parseCronField("", 0, 59)).toEqual({ resultType: "CRON_FIELD_INVALID" })
    expect(parseCronField("5-/3", 0, 59)).toEqual({ resultType: "CRON_FIELD_INVALID" })
    expect(parseCronField("/3", 0, 59)).toEqual({ resultType: "CRON_FIELD_INVALID" })
    expect(parseCronField("60", 0, 59)).toEqual({ resultType: "CRON_FIELD_INVALID" })
    expect(parseCronField("5-60", 0, 59)).toEqual({ resultType: "CRON_FIELD_INVALID" })

    expect(parseCronField("1", 0, 59)).toEqual({
        resultType: "CRON_FIELD_PARSED",
        values: [1],
    })

    expect(parseCronField("1-3", 0, 59)).toEqual({
        resultType: "CRON_FIELD_PARSED",
        values: [1, 2, 3],
    })

    expect(parseCronField("*", 0, 59)).toEqual({
        resultType: "CRON_FIELD_PARSED",
        values: Array.from({ length: 60 }, (_, ix) => ix),
    })

    expect(parseCronField("*/5", 0, 59)).toEqual({
        resultType: "CRON_FIELD_PARSED",
        values: Array.from({ length: 60 }, (_, ix) => ix).filter(ix => ix % 5 === 0),
    })

    expect(parseCronField("0-10/5", 0, 59)).toEqual({
        resultType: "CRON_FIELD_PARSED",
        values: [0, 5, 10],
    })

    expect(parseCronField("3,0-10/5", 0, 59)).toEqual({
        resultType: "CRON_FIELD_PARSED",
        values: [3, 0, 5, 10],
    })

})
