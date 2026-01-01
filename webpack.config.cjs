const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  // Browser target: chrome (default), firefox, safari
  // Usage: webpack --env browser=firefox
  const browserTarget = env?.browser || 'chrome';
  const validTargets = ['chrome', 'firefox', 'safari'];
  if (!validTargets.includes(browserTarget)) {
    throw new Error(`Invalid browser target: ${browserTarget}. Valid targets: ${validTargets.join(', ')}`);
  }

  // Manifest path: defaults to manifests/{browser}.json, falls back to manifest.json
  const manifestPath = env?.manifest ||
    (browserTarget !== 'chrome' ? `manifests/${browserTarget}.json` : 'manifest.json');

  // Output directory: dist-{browser} for non-chrome, dist for chrome
  const outputDir = browserTarget === 'chrome' ? 'dist' : `dist-${browserTarget}`;

  console.log(`Building for: ${browserTarget}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Output: ${outputDir}`);

  return {
    entry: {
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      'content-styles': './src/content/styles-entry.ts',
      popup: './src/popup/index.tsx',
    },
    output: {
      path: path.resolve(__dirname, outputDir),
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
      clean: true,
      publicPath: '',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader',
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@/components': path.resolve(__dirname, 'src/components'),
        '@/lib': path.resolve(__dirname, 'src/lib'),
        '@/hooks': path.resolve(__dirname, 'src/hooks'),
        '@/types': path.resolve(__dirname, 'src/types'),
        '@/utils': path.resolve(__dirname, 'src/utils'),
        '@/processing': path.resolve(__dirname, 'src/processing'),
        // Browser adapter - resolved to target-specific implementation at build time
        '@/adapters$': path.resolve(__dirname, `src/adapters/${browserTarget}.ts`),
        '@/adapters': path.resolve(__dirname, 'src/adapters'),
      },
    },
    plugins: [
      // Define browser target for runtime checks (if needed)
      new webpack.DefinePlugin({
        BROWSER_TARGET: JSON.stringify(browserTarget),
      }),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new HtmlWebpackPlugin({
        template: './popup.html',
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      new CopyPlugin({
        patterns: [
          {
            from: manifestPath,
            to: 'manifest.json',
          },
          {
            from: 'icons',
            to: 'icons',
            noErrorOnMissing: true,
          },
          {
            from: 'node_modules/gif.js/dist/gif.worker.js',
            to: 'gif.worker.js',
          },
        ],
      }),
    ],
    devtool: isProduction ? false : 'cheap-module-source-map',
    optimization: {
      minimize: isProduction,
    },
  };
};
