/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
var events = bedrock.events;
var config = bedrock.config;
var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');
var readline = require('readline');

var logger = bedrock.loggers.get('app');

// module API
var api = {};
module.exports = api;

events.on('bedrock-cli.init', function(callback) {
  // add test setup command
  // this will set up a module with a runnable test enviornment
  var installCommand = bedrock.program
    .command('install')
    .description('install application')
    .action(function() {
      config.cli.command = installCommand;
    });

  callback();
});

events.on('bedrock-cli.ready', function(callback) {
  var command = config.cli.command;
  if(command.name() === 'install') {
    return _checkDirectoryThenInstall(command, callback);
  }
  callback();
});

function _checkDirectoryThenInstall(command, callback) {
  var baseDirectory = path.basename(process.cwd());
  if(baseDirectory === 'app' || baseDirectory === 'test') {
    // Command is meant to be run in the app or test directory,
    // continue with install
    return _runInstallCommand(command, callback);
  }
  // Command is being run outside of the 'app' or 'test' directory,
  // promt the user if this is intended
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('You are running "install" outside of the "test" or "app" ' +
    'directory; this is not recommended.\nProceed? (Y/N)\n',
    function(response) {
    rl.close();
    if(response.toLowerCase().indexOf('y') === 0) {
      return _runInstallCommand(command, callback);
    }
    return process.exit();
  });
}

function _runInstallCommand(command, callback) {
  var rootPackage;
  try {
    rootPackage = require(path.join(process.cwd(), '..', 'package.json'));
  } catch(err) {
    if(err.code === 'MODULE_NOT_FOUND') {
      // Use the package.json present in the current folder
      rootPackage = require(path.join(process.cwd(), 'package.json'));
    }
    logger.error(err);
    process.exit(0);
  }
  var applicationDir = path.join(process.cwd());
  var applicationPackage = require(path.join(applicationDir, 'package.json'));
  api.resolvePeerDependencies(rootPackage);
  for(var peer in rootPackage.peerDependencies) {
    var version = rootPackage.peerDependencies[peer];
    if(peer in rootPackage.dependencies) {
      // Package already in dependency list
      // TODO: Check semver versions and see if conflict
      //console.log("Peer " + peer + " already in package's dependency list");
    }
    rootPackage.dependencies[peer] = version;
  }
  for(var dependency in rootPackage.dependencies) {
    var version = rootPackage.dependencies[dependency];
    applicationPackage.dependencies[dependency] = version;
  }
  // Write the application package.json
  fs.writeFileSync(path.join(applicationDir, 'package.json'),
    JSON.stringify(applicationPackage, null, 2));

  // Run npm install
  execSync('npm install', {cwd: applicationDir, stdio: [0, 1, 2]});

  // Write bower dependencies to application bower.json
  try {
    var rootBower = require(path.join(process.cwd(), '..', 'bower.json'));
    var applicationBower = require(path.join(applicationDir, 'bower.json'));
    logger.info('Copying bower.json dependencies to ' + applicationDir);
    for(var dependency in rootBower.dependencies) {
      var version = rootBower.dependencies[dependency];
      applicationBower.dependencies[dependency] = version;
    }
    fs.writeFileSync(
      path.join(applicationDir, 'bower.json'),
      JSON.stringify(applicationBower, null, 2));

  } catch(err) {
    if(err.code === 'MODULE_NOT_FOUND') {
      logger.info(
        'No bower.json file found');
    } else if(err.code !== 'EEXIST') {
      throw err;
    }
  }

  // Run bower install
  execSync('bower install', {cwd: applicationDir, stdio: [0, 1, 2]});

  // Symlink node_modules
  var moduleDir = path.join(process.cwd(), '..');
  var moduleName = path.basename(moduleDir);
  var symlinkDir = path.join(applicationDir, 'node_modules', moduleName);
  // Symlink the current directory inside the newly created node_modules directory
  logger.info('Symlinking ' + symlinkDir + ' => ' + moduleDir);
  try {
    fs.symlinkSync(moduleDir, symlinkDir);
  } catch(err) {
    if(err.code !== 'EEXIST') {
      throw err;
    }
  }
  // Symlink bower_components
  symlinkDir = path.join(applicationDir, 'bower_components', moduleName);
  // Symlink the current directory inside the newly created node_modules directory
  logger.info('Symlinking ' + symlinkDir + ' => ' + moduleDir);
  try {
    fs.symlinkSync(moduleDir, symlinkDir);
  } catch(err) {
    if(err.code !== 'EEXIST') {
      throw err;
    }
  }

  bedrock.exit();
  return callback(null, false);
}
