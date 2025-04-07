import dts from "bun-plugin-dts"

const esmBuild = Bun.build({
    entrypoints: ["./src/index.ts"],
    format: "esm",
    minify: true,
    target: "node",
    outdir: "./dist",
    plugins: [dts()],
})

const cjsBuild = Bun.build({
    entrypoints: ["./src/index.ts"],
    format: "cjs",
    minify: true,
    target: "node",
    naming: {
        entry: "[name].cjs",
    },
    outdir: "./dist",
})

await Promise.all([esmBuild, cjsBuild])
