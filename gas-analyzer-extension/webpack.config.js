// webpack.config.js
const path = require('path');

module.exports = [
    // Extension bundle
    {
        target: 'node',
        entry: './src/extension.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'extension.js',
            libraryTarget: 'commonjs2'
        },
        externals: {
            vscode: 'commonjs vscode'
        },
        resolve: {
            extensions: ['.ts', '.js']
        },
        module: {
            rules: [{
                test: /\.ts$/,
                exclude: /node_modules/,
                use: 'ts-loader'
            }]
        }
    },
    // Webview bundle
    {
        target: 'web',
        entry: './webview/src/index.tsx',
        output: {
            path: path.resolve(__dirname, 'webview/dist'),
            filename: 'bundle.js'
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js']
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader', 'postcss-loader']
                }
            ]
        }
    }
];