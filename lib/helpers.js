/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
var execSync = require('child_process').execSync;

var logger = bedrock.loggers.get('app');

var api = {};
module.exports = api;

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
  // "npm info lookup version" will return a buffer like this if
  // multiple results:
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
      // logger.info('Peer ' + peer + ' already in peer dependecy list,
      // overwriting');
      package.peerDependencies[peer] = version;
      continue;
    }
    package.peerDependencies[peer] = version;
    _resolvePeer(package, peer, version);
  }
}
