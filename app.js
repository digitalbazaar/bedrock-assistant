#!/usr/bin/env node

'use strict';

var path = require('path');
var bedrock = require('bedrock');

bedrock.start({script: path.join(__dirname, 'run.js')});
