/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
var events = bedrock.events;
var config = bedrock.config;
var execSync = require('child_process').execSync;
var fse = require('fs-extra');
var helpers = require('./helpers');
var path = require('path');
var readline = require('readline');
var stringify = require('json-stable-stringify');

var BLUEPRINTS_DIR = path.join(__dirname, '..', 'blueprints');

var logger = bedrock.loggers.get('app');

events.on('bedrock-cli.init', function(callback) {
  // add test setup command
  // this will set up a module with a runnable test enviornment
  var installCommand = bedrock.program
    .command('testframework')
    .description('install test framework')
    .action(function() {
      config.cli.command = installCommand;
    });
  callback();
});

events.on('bedrock-cli.ready', function(callback) {
  var command = config.cli.command;
  if(command.name() === 'testframework') {
    return _checkDirectoryThenInstall(command, callback);
  }
  callback();
});

function _checkDirectoryThenInstall(command, callback) {
  var baseDirectory = path.basename(process.cwd());
  var packageJson;
  try {
    packageJson = require(path.join(process.cwd(), 'package.json'));
  } catch(err) {
    logger.error(err);
    process.exit(1);
  }
  if(baseDirectory === packageJson.name) {
    // Command is meant to be run in the app or test directory,
    // continue with install
    return _runInstallCommand(command, callback);
  }
  logger.error('This command must be run from the module root.');
  return process.exit(1);
}

function _runInstallCommand(command, callback) {
  fse.mkdirSync('test');
  fse.mkdirSync('test/mocha');
  copyBlueprintFile('.eslintrc');
  copyBlueprintFile('test.config.js');

  var packageJson;
  try {
    packageJson = require(path.join(process.cwd(), 'package.json'));
  } catch(err) {
    logger.error(err);
    process.exit(1);
  }
  // read, modify, and write test.js
  var testBlueprint = fse.readFileSync(
      path.join(BLUEPRINTS_DIR, 'test', 'test.js'),
      {encoding: 'utf-8'});
  testBlueprint = testBlueprint.replace(/\$MODULE_NAME/g, packageJson.name);
  fse.writeFileSync(path.join(process.cwd(), 'test', 'test.js'), testBlueprint);

  var testPackageJson = require('../blueprints/test/package.json');
  testPackageJson.name = packageJson.name + '-test';
  testPackageJson.description = packageJson.description + ' test';

  helpers.resolvePeerDependencies(packageJson);
  for(var peer in packageJson.peerDependencies) {
    var version = packageJson.peerDependencies[peer];
    if(peer in packageJson.dependencies) {
      // Package already in dependency list
      // TODO: Check semver versions and see if conflict
      // console.log("Peer " + peer + " already in package's dependency list");
    }
    packageJson.dependencies[peer] = version;
  }
  for(var dependency in packageJson.dependencies) {
    var version = packageJson.dependencies[dependency];
    testPackageJson.dependencies[dependency] = version;
  }
  // sort dependencies
  testPackageJson.dependencies =
    JSON.parse(stringify(testPackageJson.dependencies));
  // write package file
  fse.writeFileSync(path.join('test', 'package.json'),
    JSON.stringify(testPackageJson, null, 2));

  // Run npm install
  var testDir = path.join(process.cwd(), 'test');
  execSync('npm install', {cwd: testDir, stdio: [0, 1, 2]});

  bedrock.exit();
  return callback(null, false);
}

function copyBlueprintFile(fileName) {
  fse.copySync(
    path.join(BLUEPRINTS_DIR, 'test', fileName),
    path.join(process.cwd(), 'test', fileName));
}
