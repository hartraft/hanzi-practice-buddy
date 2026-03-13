(function (factory) {
  if (typeof define === 'function' && define.amd)
    define(['exports'], factory);
  else if (typeof exports === 'object')
    factory(module.exports);
  else
    globalThis['compose-multiplatform-core-compose-runtime-runtime-saveable'] = factory(typeof globalThis['compose-multiplatform-core-compose-runtime-runtime-saveable'] === 'undefined' ? {} : globalThis['compose-multiplatform-core-compose-runtime-runtime-saveable']);
}(function (_) {
  'use strict';
  //region block: pre-declaration
  //endregion
  var MaxSupportedRadix;
  //region block: init
  MaxSupportedRadix = 36;
  //endregion
  return _;
}));

//# sourceMappingURL=compose-multiplatform-core-compose-runtime-runtime-saveable.js.map
