const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = env => {
    const libraryName = "brsFiddle";
    const brsLibName = "brsEmu"
    if (env.production) {
        mode = "production";
        outputLib = libraryName + ".min.js";
        apiLib = brsLibName + ".min.js";
        wrkLib = brsLibName + ".worker.min.js";
        devtool = "source-map";
        distPath = "app/lib"
    } else {
        mode = "development";
        outputLib = libraryName + ".js";
        apiLib = brsLibName + ".js";
        wrkLib = brsLibName + ".worker.js";
        devtool = "inline-source-map";
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
            devtool: devtool,
            plugins: [
                new HtmlWebpackPlugin({
                    filename: "../index.html",
                    templateParameters: { brsApi: apiLib },
                }),
                new CopyWebpackPlugin({
                    patterns: [
                        { context: "node_modules/brs-emu/app/lib", from: apiLib },
                        { context: "node_modules/brs-emu/app/lib", from: wrkLib },
                        { context: "node_modules/brs-emu/app/", from: "audio/**", to: ".." },
                        { context: "node_modules/brs-emu/app/", from: "fonts/**", to: ".." },
                        { context: "src/", from: "web.config", to: ".." },
                        { context: "src/styles/", from: "**/*", to: "../css/" },
                        { context: "src/images/", from: "**/*", to: "../images/" },
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
