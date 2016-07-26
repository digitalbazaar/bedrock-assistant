define(['angular'], function(angular) {

'use strict';

var module = angular.module('$MODULE_NAME', []);

Array.prototype.slice.call(arguments, 1).forEach(function(register) {
  register(module);
});

});
