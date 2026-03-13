(function (factory) {
  if (typeof define === 'function' && define.amd)
    define(['exports'], factory);
  else if (typeof exports === 'object')
    factory(module.exports);
  else
    globalThis['compose-multiplatform-core-compose-animation-animation'] = factory(typeof globalThis['compose-multiplatform-core-compose-animation-animation'] === 'undefined' ? {} : globalThis['compose-multiplatform-core-compose-animation-animation']);
}(function (_) {
  'use strict';
  //region block: pre-declaration
  //endregion
  var platformFlingScrollFriction;
  //region block: init
  platformFlingScrollFriction = 0.015;
  //endregion
  return _;
}));

//# sourceMappingURL=compose-multiplatform-core-compose-animation-animation.js.map
