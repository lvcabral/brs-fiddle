const path = require("path");
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = env => {
    let outputLib, mode, distPath;
    let libraryName = "brsFiddle";
    if (env.production) {
        mode = "production";
        outputLib = libraryName + ".min.js";
        distPath = "app/lib"
    } else {
        mode = "development";
        outputLib = libraryName + ".js";
        distPath = "app/lib"
    }
    return [
        {
            entry: "./src/index.ts",
            target: "web",
            mode: mode,
            externals: {
                "brs-emu": "brsEmu"
            },
            devServer: {
                static: "./app",
                hot: true,
                port: 6510,
                headers: {
                    "cross-origin-embedder-policy": "require-corp",
                    "cross-origin-opener-policy": "same-origin",
                }
            },
            devtool: "inline-source-map",
            plugins: [
                new CopyWebpackPlugin({
                    patterns: [
                        { context: "node_modules/brs-emu/app/lib", from: "**" },
                        { context: "node_modules/brs-emu/app/", from: "audio/**", to: ".." },
                        { context: "node_modules/brs-emu/app/", from: "fonts/**", to: ".." },
                        { context: "src/images/", from: "**/*", to: "../css/" },
                        { context: "src/styles/", from: "**/*", to: "../css/" },
                        { context: "src/fonts/", from: "**/*", to: "../fonts/" },
                    ]
                })
            ],
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        exclude: /node_modules/,
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            output: {
                filename: outputLib,
                library: libraryName,
                path: path.resolve(__dirname, distPath),
                globalObject: "global",
            },
        }
    ];
};
