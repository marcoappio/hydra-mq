import { getUniqueJobName } from "@src/queue/channel/message/schedule"
import { describe, it, expect } from "bun:test"

describe("getUniqueJobName", () => {

    it("should return a unique job name for each channel and name combination", () => {
        const pairs : [string | null, string][] = [
            ["foo", "bar"],
            [null, "foobar"],
            ["foobar", ""],
            ["", "foobar"],
            ["\"foo\"", "\"bar\""],
            ["\"foo\"", "bar"],

        ]

        const nameSet = new Set<string>()
        for (const [channel, name] of pairs) {
            const uniqueName = getUniqueJobName({ channel, name })
            nameSet.add(uniqueName)
        }

        expect(nameSet.size).toBe(pairs.length)
    })
})
