var path = require('path');

module.exports = function(bedrock) {
  var config = bedrock.config;
  if(!config.protractor) {
    return;
  }
  var protractor = config.protractor.config;
  var prepare = path.join(__dirname, 'prepare.js');
  protractor.params.config.onPrepare.push(prepare);
};
