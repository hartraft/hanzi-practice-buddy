(function (factory) {
  if (typeof define === 'function' && define.amd)
    define(['exports'], factory);
  else if (typeof exports === 'object')
    factory(module.exports);
  else
    globalThis['components-resources-library'] = factory(typeof globalThis['components-resources-library'] === 'undefined' ? {} : globalThis['components-resources-library']);
}(function (_) {
  'use strict';
  //region block: pre-declaration
  //endregion
  return _;
}));

//# sourceMappingURL=components-resources-library.js.map
