const {makeReactLayout, saveReactLayout} = require('./makeLayout');

exports.onPreBootstrap = async (_, pluginOptions) => {
    await makeReactLayout(pluginOptions).then(saveReactLayout);
};

