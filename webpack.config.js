const path = require('path');
const htmlPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
module.exports = {
  entry: './src/test.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[hash].js'
  },
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
    hot: true
  },
  plugins: [
    new webpack.NamedModulesPlugin(), 
    new webpack.HotModuleReplacementPlugin(),
    new htmlPlugin({
      title: 'Mue',
      template: 'src/index.html'
    })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      }
    ]
  }
}