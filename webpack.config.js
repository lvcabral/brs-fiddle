const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = env => {
    const libraryName = "brsFiddle";
    const brsLibName = "brs"
    if (env.production) {
        mode = "production";
        outputLib = libraryName + ".min.js";
        apiLib = brsLibName + ".api.js";
        wrkLib = brsLibName + ".worker.js";
        devtool = "source-map";
        distPath = "app/lib"
    } else {
        mode = "development";
        outputLib = libraryName + ".js";
        apiLib = brsLibName + ".api.js";
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
                "brs-engine": "brs"
            },
            devServer: {
                static: "./app",
                hot: true,
                port: 8500,
                headers: {
                    "cross-origin-embedder-policy": "require-corp",
                    "cross-origin-opener-policy": "same-origin",
                }
            },
            devtool: devtool,
            plugins: [
                new HtmlWebpackPlugin({
                    filename: "../index.html",
                    templateParameters: { brsApi: apiLib, gtag: process.env.GTAG },
                }),
                new CopyWebpackPlugin({
                    patterns: [
                        { context: "node_modules/brs-engine/app/lib", from: apiLib },
                        { context: "node_modules/brs-engine/app/lib", from: wrkLib },
                        { context: "node_modules/brs-engine/app/", from: "audio/**", to: ".." },
                        { context: "node_modules/brs-engine/app/", from: "fonts/**", to: ".." },
                        { context: "src/", from: "web.config", to: ".." },
                        { context: "src/styles/", from: "**/*", to: "../css/" },
                        { context: "src/themes/", from: "**/*", to: "../css/" },
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
