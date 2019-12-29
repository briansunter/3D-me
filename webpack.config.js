/* global __dirname, require, module*/

const webpack = require('webpack');
const path = require('path');
const pkg = require('./package.json');
const CopyPlugin = require('copy-webpack-plugin');

let libraryName = pkg.name;

let outputFile, mode;

if (process.env.NODE_ENV === 'production') {
  mode = 'production';
  outputFile = libraryName + '.min.js';
} else {
  mode = 'development';
  outputFile = libraryName + '.js';
}

const config = {
  mode: mode,
  entry: __dirname + '/src/index.js',
  devtool: 'source-map',
  output: {
    path: __dirname + '/dist',
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  plugins: [
    new CopyPlugin([
      { from: 'index.html', to: (__dirname + '/dist/index.html') },
      { from: 'assets', to: (__dirname + '/dist/assets') }

    ])
  ],
  module: {
    rules: [
      {
        test: /(\.jsx|\.js)$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        },
        exclude: /(node_modules|bower_components)/
      }
    ]
  },
  resolve: {
    modules: [path.resolve('./node_modules'), path.resolve('./src')],
    extensions: ['.json', '.js']
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 9000
  }
};

module.exports = config;
