var bedrock = require('bedrock');

// NOTE: it is critical that bedrock-protractor be required first so that
// it can register a bedrock.cli event listener
require('bedrock-protractor');
require('$MODULE_NAME');

var config = bedrock.config;

bedrock.events.on('bedrock.test.configure', function() {
  // Test configuration code
});

$PSEUDO_BOWER

bedrock.start();
