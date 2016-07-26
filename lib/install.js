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

api.resolvePeerDependencies = function(package) {
  if(!package.peerDependencies) {
    return;
  }
  for(var peer in package.peerDependencies) {
    _resolvePeer(package, peer, package.peerDependencies[peer]);
  }
};

// FIXME: Handle direct repo link versions
// (i.e. https://github.comdigitalbazaar/bedrock#master)
function _resolvePeer(package, peer, version) {
  // Run an "npm view" on the peer
  var lookup = peer + '"@' + version + '"';
  // Get all versions matching the lookup,
  // (i.e. all versions matching "bedrock@^1.0.0")
  var versions = execSync('npm info ' + lookup + ' version').toString('utf8');
  // Grab the last version found
  // "npm info lookup version" will return a buffer like this if multiple results:
  // bedrock-idp@1.0.0 '1.0.0'
  // bedrock-idp@1.0.1 '1.0.1'
  // bedrock-idp@1.0.2 '1.0.2'
  // bedrock-idp@1.0.3 '1.0.3'
  //
  if(versions.trim().lastIndexOf('\n') === -1) {
    // Got one result back, npm info will return a string of just the version
    var latestVersion = peer + '@' + versions.trim();
  } else {
    // Got multiple back
    var latestVersion = versions
      .substring(versions.trim().lastIndexOf('\n'))
      .split(' ')[0]
      .trim();
  }

  logger.info('Running npm info ' + latestVersion);
  var peerPackage = JSON.parse(
    execSync('npm info ' + latestVersion + ' --json').toString('utf8'));

  // Add resolved peer dependencies into the original
  // package's peer dependency list
  for(peer in peerPackage.peerDependencies) {
    version = peerPackage.peerDependencies[peer];
    if(peer in package.peerDependencies) {
      // Peer is already in peerDependency list, overwrite, and  do not
      // continue resolving it
      // TODO: Compare semver versions and throw error if conflict
      //logger.info('Peer ' + peer + ' already in peer dependecy list, overwriting');
      package.peerDependencies[peer] = version;
      continue;
    }
    package.peerDependencies[peer] = version;
    _resolvePeer(package, peer, version);
  }
}
