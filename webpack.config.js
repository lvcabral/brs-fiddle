const path = require("node:path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = (env) => {
    const libraryName = "brsFiddle";
    const brsLibName = "brs";
    const apiLib = `${brsLibName}.api.js`;
    const wrkLib = `${brsLibName}.worker.js`;
    const rsgLib = `${brsLibName}-sg.js`;
    const distPath = "app/lib";
    let mode = "development";
    let outputLib = libraryName + ".js";
    let devtool = "inline-source-map";
    if (env.production) {
        mode = "production";
        outputLib = libraryName + ".min.js";
        devtool = "source-map";
    }
    return [
        {
            entry: "./src/index.ts",
            target: "web",
            mode: mode,
            externals: {
                "brs-engine": "brs",
            },
            devServer: {
                server: "http",
                static: {
                    directory: path.join(__dirname, "app"),
                },
                hot: true,
                port: 8500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "cross-origin-embedder-policy": "require-corp",
                    "cross-origin-opener-policy": "same-origin",
                },
            },
            devtool: devtool,
            plugins: [
                new MonacoWebpackPlugin({
                    // Only include built-in languages - BrightScript is registered manually
                    languages: ["xml", "ini"],
                    // Disable features we don't need to reduce bundle size
                    features: [
                        "!gotoSymbol",
                        "!quickCommand",
                        "!quickOutline",
                        "!format",
                        "!codeAction",
                        "!suggest",
                    ],
                }),
                new HtmlWebpackPlugin({
                    filename: "../index.html",
                    templateParameters: { brsApi: apiLib, gtag: process.env.GTAG },
                }),
                new CopyWebpackPlugin({
                    patterns: [
                        { context: "node_modules/brs-engine/lib", from: apiLib },
                        { context: "node_modules/brs-engine/lib", from: wrkLib },
                        { context: "node_modules/brs-scenegraph/lib", from: rsgLib },
                        { context: "node_modules/brs-scenegraph/", from: "assets/**", to: ".." },
                        {
                            context: "node_modules/coi-serviceworker/",
                            from: "coi-serviceworker.min.js",
                            to: "..",
                        },
                        { context: "src/", from: "web.config", to: ".." },
                        { context: "src/", from: "CNAME", to: ".." },
                        { context: "src/styles/", from: "**/*", to: "../css/" },
                        { context: "src/themes/", from: "**/*", to: "../css/" },
                        { context: "src/images/", from: "**/*", to: "../images/" },
                        { context: "src/fonts/", from: "**/*", to: "../fonts/" },
                        { context: "src/templates/", from: "**/*", to: "../templates/" },
                        { context: "src/data/", from: "**/*", to: "../data/" },
                    ],
                }),
                new webpack.ProvidePlugin({
                    process: "process/browser",
                }),
            ],
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.css$/,
                        use: ["style-loader", "css-loader"],
                    },
                    {
                        test: /\.ttf$/,
                        type: "asset/resource",
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
                globalObject: "globalThis",
            },
        },
    ];
};
