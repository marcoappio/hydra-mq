import { parseCronField, type CronFieldResult } from "@src/core/cron"
import { describe, expect, it } from "bun:test"

type TestPair = [
    { field: string, min: number, max: number },
    CronFieldResult
]

describe("parseCronField", () => {

    const testPairs: TestPair[] = [
        [{ field: "/5", min: 0, max: 59 }, { resultType: "CRON_FIELD_INVALID" }],
        [{ field: "**", min: 0, max: 59 }, { resultType: "CRON_FIELD_INVALID" }],
        [{ field: "", min: 0, max: 59 }, { resultType: "CRON_FIELD_INVALID" }],
        [{ field: "5-/3", min: 0, max: 59 }, { resultType: "CRON_FIELD_INVALID" }],
        [{ field: "/3", min: 0, max: 59 }, { resultType: "CRON_FIELD_INVALID" }],
        [{ field: "60", min: 0, max: 59 }, { resultType: "CRON_FIELD_INVALID" }],
        [{ field: "5-60", min: 0, max: 59 }, { resultType: "CRON_FIELD_INVALID" }],
        [{ field: "1", min: 0, max: 59 }, {
            resultType: "CRON_FIELD_PARSED",
            values: [1],
        }],
        [{ field: "1-3", min: 0, max: 59 }, {
            resultType: "CRON_FIELD_PARSED",
            values: [1, 2, 3],
        }],
        [{ field: "*", min: 0, max: 59 }, {
            resultType: "CRON_FIELD_PARSED",
            values: Array.from({ length: 60 }, (_, ix) => ix),
        }],
        [{ field: "*/5", min: 0, max: 59 }, {
            resultType: "CRON_FIELD_PARSED",
            values: Array.from({ length: 60 }, (_, ix) => ix).filter(ix => ix % 5 === 0),
        }],
        [{ field: "0-10/5", min: 0, max: 59 }, {
            resultType: "CRON_FIELD_PARSED",
            values: [0, 5, 10],
        }],
        [{ field: "3,0-10/5", min: 0, max: 59 }, {
            resultType: "CRON_FIELD_PARSED",
            values: [0, 3, 5, 10],
        }]
    ]

    for(const [field, expected] of testPairs) {
        const testDescr = `parses: ${field.field} (${field.min}, ${field.max}) to: ${expected.resultType}`
        it(testDescr, () => {
            const result = parseCronField(field.field, field.min, field.max)
            expect(result).toEqual(expected)
        })
    }
})
