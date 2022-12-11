const {makeReactLayout, saveReactLayout} = require('./makeLayout');

exports.onPreBootstrap = async (_, pluginOptions) => {
    pluginOptions.headerUrl = 'https://deploy-preview-5668--jenkins-io-site-pr.netlify.app/template/index.html';
    console.log('pluginOptions', pluginOptions);
    await makeReactLayout(pluginOptions).then(saveReactLayout);
};

