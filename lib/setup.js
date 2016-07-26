/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
var config = bedrock.config;
var events = bedrock.events;
var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');

// module API
var api = {};
module.exports = api;

var BLUEPRINTS_DIR = path.join(__dirname, '..', 'blueprints');

events.on('bedrock-cli.init', function(callback) {
  // add setup command
  // by default, this will set up a module with a
  // runnable application and test enviornment
  var setupCommand = bedrock.program
    .command('setup <name> [options]')
    .description('Sets up a bedrock enviornment')
    .option(
      '-p, --plugin',
      'Creates a bedrock plugin')
    .option(
      '-b, --bower-only',
      'Sets up a front-end module only, without a node enviornment')
    .option(
      '-n, --node-only',
      'Sets up a node enviornment only, no front-end components will be added')
    .action(function(name) {
      setupCommand.arguments = {
        name: name
      };
      config.cli.command = setupCommand;
    });

  callback();
});

events.on('bedrock-cli.ready', function(callback) {
  var command = config.cli.command;
  if(command.name() === 'setup') {
    return _runSetupCommand(command, callback);
  }
  events.emit('bedrock.test.configure', callback);
});

function _runSetupCommand(command, callback) {
  if(command.nodeOnly && command.bowerOnly) {
    //conflict
  }

  var moduleName = command.arguments.name;
  if(!moduleName) {
    // must supply module name
  }

  var moduleDir = path.join(process.cwd(), moduleName);
  fs.mkdirSync(moduleDir);

  _writeCommonFiles(moduleName, moduleDir);

  if(!command.bowerOnly) {
    _writeNodeFiles(moduleName, moduleDir);
  }
  if(!command.nodeOnly) {
    _writeBowerFiles(moduleName, moduleDir, command);
  }

  _writeTestFiles(moduleName, moduleDir, command);

  if(!command.bowerOnly && !command.plugin) {
    _writeAppFiles(moduleName, moduleDir, command);
  }
};

function _writeCommonFiles(moduleName, moduleDir) {
  // Write .gitignore
  var ignoreBlueprintDir =
    path.join(BLUEPRINTS_DIR, 'gitignore');

  var ignoreBlueprint =
    fs.readFileSync(ignoreBlueprintDir, {encoding: 'utf-8'});

  var ignoreDir = path.join(moduleDir, '\.gitignore');
  fs.writeFileSync(ignoreDir, ignoreBlueprint);

  // Write README.md
  var readmeBlueprintDir =
    path.join(BLUEPRINTS_DIR, 'README.md');

  var readmeBlueprint =
    fs.readFileSync(readmeBlueprintDir, {encoding: 'utf-8'});

  readmeBlueprint = readmeBlueprint.replace(/\$MODULE_NAME/g, moduleName);

  var readmeDir = path.join(moduleDir, 'README.md');
  fs.writeFileSync(readmeDir, readmeBlueprint);
}

function _writeNodeFiles(moduleName, moduleDir) {
  // Write package.json
  var packageBlueprintDir =
    path.join(__dirname, '..', 'blueprints', 'package.json');

  var packageBlueprint = JSON.parse(
    fs.readFileSync(packageBlueprintDir, {encoding: 'utf-8'}));

  packageBlueprint.name = moduleName;
  packageBlueprint.description = moduleName + ' module';

  var packageDir = path.join(moduleDir, 'package.json');
  fs.writeFileSync(packageDir, JSON.stringify(packageBlueprint, null, 2));

  // Make lib folder
  var libDir = path.join(moduleDir, 'lib');
  fs.mkdirSync(libDir);

  // Write lib/index.js
  var indexBlueprintDir =
    path.join(BLUEPRINTS_DIR, 'lib', 'index.js');

  var indexDir = path.join(moduleDir, 'lib', 'index.js');

  fs.writeFileSync(
    indexDir, fs.readFileSync(indexBlueprintDir, {encoding: 'utf-8'}));

  // Write lib/config.js
  var configBlueprintDir =
    path.join(BLUEPRINTS_DIR, 'lib', 'config.js');

  var configDir = path.join(moduleDir, 'lib', 'config.js');

  fs.writeFileSync(
    configDir, fs.readFileSync(configBlueprintDir, {encoding: 'utf-8'}));
}

function _writeBowerFiles(moduleName, moduleDir, command) {
  // Write bower.json
  var bowerBlueprintDir =
    path.join(BLUEPRINTS_DIR, 'bower.json');

  var bowerBlueprint = JSON.parse(
    fs.readFileSync(bowerBlueprintDir, {encoding: 'utf-8'}));

  bowerBlueprint.name = moduleName;

  bowerDir = path.join(moduleDir, 'bower.json');
  fs.writeFileSync(bowerDir, JSON.stringify(bowerBlueprint, null, 2));

  // Write bedrock.json
  var bedrockBlueprintDir =
    path.join(BLUEPRINTS_DIR, 'bedrock.json');

  var bedrockBlueprint = JSON.parse(
    fs.readFileSync(bedrockBlueprintDir, {encoding: 'utf-8'}));

  bedrockBlueprint.config = './test/protractor/config.js';

  bedrockDir = path.join(moduleDir, 'bedrock.json');
  fs.writeFileSync(
    bedrockDir, JSON.stringify(bedrockBlueprint, null, 2));

  // Write components directory
  var componentsDir;
  if(command.bowerOnly) {
    // Do not create a components folder
    componentsDir = moduleDir;
  } else {
    // Crate a components folder
    componentsDir = path.join(moduleDir, 'components');
    fs.mkdirSync(componentsDir);
  }

  // Write main.js
  var mainBlueprintDir =
    path.join(BLUEPRINTS_DIR, 'components', 'main.js');

  var mainBlueprint = fs.readFileSync(mainBlueprintDir, {encoding: 'utf-8'});

  mainBlueprint = mainBlueprint.replace(/\$MODULE_NAME/g, moduleName);

  var mainDir = path.join(componentsDir, 'main.js');
  fs.writeFileSync(mainDir, mainBlueprint);
}

function _writeAppFiles(moduleName, moduleDir, command) {
  // Write app directory
  var appDir = path.join(moduleDir, 'app');
  fs.mkdirSync(appDir);

  // Write app/package.json
  var packageBlueprint = JSON.parse(fs.readFileSync(
      path.join(BLUEPRINTS_DIR, 'app', 'package.json'),
      {encoding: 'utf-8'}));

  packageBlueprint.name = moduleName + '-app';

  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify(packageBlueprint, null, 2));

  // Write app/bower.json
  var bowerBlueprint = JSON.parse(fs.readFileSync(
      path.join(BLUEPRINTS_DIR, 'app', 'bower.json'),
      {encoding: 'utf-8'}));

  bowerBlueprint.name = moduleName + '-app';

  fs.writeFileSync(
    path.join(appDir, 'bower.json'),
    JSON.stringify(bowerBlueprint, null, 2));

  // Write app/run.js
  var runBlueprint = fs.readFileSync(
    path.join(BLUEPRINTS_DIR, 'app', 'run.js'), {encoding: 'utf-8'});

  runBlueprint = runBlueprint.replace(/\$MODULE_NAME/g, moduleName);

  fs.writeFileSync(
    path.join(appDir, 'run.js'), runBlueprint);

  // Wrtie app/configs directory
  var configDir = path.join(appDir, 'configs');
  fs.mkdirSync(configDir);

  // Write app/configs/config.js
  var configBlueprint = fs.readFileSync(
    path.join(BLUEPRINTS_DIR, 'app', 'configs', 'config.js'),
    {encoding: 'utf-8'});

  fs.writeFileSync(
    path.join(configDir, 'config.js'), configBlueprint);
};

function _writeTestFiles(moduleName, moduleDir, command) {
  // Write test directory
  var testDir = path.join(moduleDir, 'test');
  fs.mkdirSync(testDir);

  // Open test/test.js to write later
  var testBlueprint = fs.readFileSync(
      path.join(BLUEPRINTS_DIR, 'test', 'test.js'),
      {encoding: 'utf-8'});

  testBlueprint = testBlueprint.replace(/\$MODULE_NAME/g, moduleName);

  // Open test/package.json to write later
  var packageBlueprint = JSON.parse(fs.readFileSync(
      path.join(BLUEPRINTS_DIR, 'test', 'package.json'),
      {encoding: 'utf-8'}));

  packageBlueprint.name = moduleName + '-test';
  packageBlueprint.description =  moduleName + '-test test module';

  if(!command.nodeOnly) {
    // Open up test/bower.json file to be written later
    var bowerBlueprint = JSON.parse(fs.readFileSync(
      path.join(BLUEPRINTS_DIR, 'test', 'bower.json'),
      {encoding: 'utf-8'}));

    bowerBlueprint.name = moduleName + '-test';

    // Add bedrock-protractor to test/package.json
    packageBlueprint.devDependencies['bedrock-protractor'] = '^3.0.0';

    // Write protractor test files
    _writeProtractorTestFiles(moduleName, testDir, command);
    // Add bedrock-protractor to test/package.json dependencies
    if(command.bowerOnly) {
      // If this is a bower-only plugin, create a test/components
      // folder so the module may configure a basic front-end to
      // host its views for testing
      var componentsDir = path.join(testDir, 'components');
      fs.mkdirSync(componentsDir);

      // Write components/main.js
      var mainBlueprint = fs.readFileSync(
        path.join(BLUEPRINTS_DIR, 'test', 'components', 'main.js'),
        {encoding: 'utf-8'});

      mainBlueprint = mainBlueprint.replace(/\$MODULE_NAME/g, moduleName);

      fs.writeFileSync(
        path.join(componentsDir, 'main.js'),
        mainBlueprint);

      // Add pseudo-bower code to test/test.js
      // TODO: We might not need to make this a
      // pseudo-bower package; experiment.
      var pseudoBower = fs.readFileSync(
        path.join(BLUEPRINTS_DIR, 'misc', 'pseudo-bower.js'),
        {encoding: 'utf-8'});

      testBlueprint = testBlueprint.replace(/\$PSEUDO_BOWER/g, pseudoBower);

      // Add main file to test/bower.json
      bowerBlueprint.main = './main.js';
    } else {
      // Remove pseudo-bower insert from test/test.js
      testBlueprint = testBlueprint.replace(/\$PSEUDO_BOWER/g, '');
    }
    //Write test/bower.json
    fs.writeFileSync(
      path.join(testDir, 'bower.json'),
      JSON.stringify(bowerBlueprint, null, 2));
  } else {
    // Remove pseudo-bower insert from test/test.js
    testBlueprint = testBlueprint.replace(/\$PSEUDO_BOWER/g, '');
  }

  // Write test/package.json
  fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageBlueprint, null, 2));

  // Write test/test.js
  fs.writeFileSync(
    path.join(testDir, 'test.js'),
    testBlueprint);
};

function _writeProtractorTestFiles(moduleName, testDir, command) {
  var protractorDir = path.join(testDir, 'protractor');
  fs.mkdirSync(protractorDir);

  var pagesDir = path.join(protractorDir, 'pages');
  fs.mkdirSync(pagesDir);

  var protractorTestDir = path.join(protractorDir, 'tests');
  fs.mkdirSync(protractorTestDir);

  // Write prepare.js
  var prepareBlueprint = fs.readFileSync(
    path.join(BLUEPRINTS_DIR, 'test', 'protractor', 'prepare.js'),
    {encoding: 'utf-8'});

  fs.writeFileSync(
    path.join(protractorDir, 'prepare.js'),
    prepareBlueprint);

  // Write config.js
  var configBlueprint = fs.readFileSync(
    path.join(BLUEPRINTS_DIR, 'test', 'protractor', 'config.js'),
    {encoding: 'utf-8'});

  fs.writeFileSync(
    path.join(protractorDir, 'config.js'),
    configBlueprint);

  // Write tests/protractor-test.js
  var protractorTestBlueprint = fs.readFileSync(path.join(
    BLUEPRINTS_DIR, 'test', 'protractor', 'tests', 'protractor-test.js'),
    {encoding: 'utf-8'});

  protractorTestBlueprint =
    protractorTestBlueprint.replace(/\$MODULE_NAME/g, moduleName);

  fs.writeFileSync(
    path.join(protractorTestDir, 'protractor-test.js'),
    protractorTestBlueprint);

  // Write pages/index.js
  var indexBlueprint = fs.readFileSync(path.join(
    BLUEPRINTS_DIR, 'test', 'protractor', 'pages', 'index.js'),
    {encoding: 'utf-8'});

  fs.writeFileSync(
    path.join(pagesDir, 'index.js'),
    indexBlueprint);
};
