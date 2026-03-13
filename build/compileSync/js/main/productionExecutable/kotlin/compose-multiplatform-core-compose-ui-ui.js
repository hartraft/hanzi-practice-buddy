(function (factory) {
  if (typeof define === 'function' && define.amd)
    define(['exports'], factory);
  else if (typeof exports === 'object')
    factory(module.exports);
  else
    globalThis['compose-multiplatform-core-compose-ui-ui'] = factory(typeof globalThis['compose-multiplatform-core-compose-ui-ui'] === 'undefined' ? {} : globalThis['compose-multiplatform-core-compose-ui-ui']);
}(function (_) {
  'use strict';
  //region block: pre-declaration
  //endregion
  var VelocityTrackerAddPointsFix;
  var VelocityTrackerStrategyUseImpulse;
  var DefaultCacheSize;
  //region block: init
  VelocityTrackerAddPointsFix = true;
  VelocityTrackerStrategyUseImpulse = false;
  DefaultCacheSize = 8;
  //endregion
  return _;
}));

//# sourceMappingURL=compose-multiplatform-core-compose-ui-ui.js.map
