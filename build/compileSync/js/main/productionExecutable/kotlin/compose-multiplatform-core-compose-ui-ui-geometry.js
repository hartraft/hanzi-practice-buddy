(function (factory) {
  if (typeof define === 'function' && define.amd)
    define(['exports'], factory);
  else if (typeof exports === 'object')
    factory(module.exports);
  else
    globalThis['compose-multiplatform-core-compose-ui-ui-geometry'] = factory(typeof globalThis['compose-multiplatform-core-compose-ui-ui-geometry'] === 'undefined' ? {} : globalThis['compose-multiplatform-core-compose-ui-ui-geometry']);
}(function (_) {
  'use strict';
  //region block: pre-declaration
  //endregion
  return _;
}));

//# sourceMappingURL=compose-multiplatform-core-compose-ui-ui-geometry.js.map
