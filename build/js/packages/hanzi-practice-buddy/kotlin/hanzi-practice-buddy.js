(function (factory) {
  if (typeof define === 'function' && define.amd)
    define(['exports'], factory);
  else if (typeof exports === 'object')
    factory(module.exports);
  else
    globalThis['com.hartraft:hanzi-practice-buddy'] = factory(typeof globalThis['com.hartraft:hanzi-practice-buddy'] === 'undefined' ? {} : globalThis['com.hartraft:hanzi-practice-buddy']);
}(function (_) {
  'use strict';
  //region block: pre-declaration
  //endregion
  var com_hartraft_hanzi_practice_buddy_generated_resources_Res_drawable$stable;
  var com_hartraft_hanzi_practice_buddy_generated_resources_Res_string$stable;
  var com_hartraft_hanzi_practice_buddy_generated_resources_Res_array$stable;
  var com_hartraft_hanzi_practice_buddy_generated_resources_Res_plurals$stable;
  var com_hartraft_hanzi_practice_buddy_generated_resources_Res_font$stable;
  var com_hartraft_hanzi_practice_buddy_generated_resources_Res$stable;
  var com_hartraft_models_Hanzi_$serializer$stable;
  var com_hartraft_models_Hanzi$stable;
  var com_hartraft_models_Practice_$serializer$stable;
  var com_hartraft_models_Practice$stable;
  function main() {
    console.log('Hanzi Practice Buddy - Web App');
  }
  function mainWrapper() {
    main();
  }
  //region block: init
  com_hartraft_hanzi_practice_buddy_generated_resources_Res_drawable$stable = 0;
  com_hartraft_hanzi_practice_buddy_generated_resources_Res_string$stable = 0;
  com_hartraft_hanzi_practice_buddy_generated_resources_Res_array$stable = 0;
  com_hartraft_hanzi_practice_buddy_generated_resources_Res_plurals$stable = 0;
  com_hartraft_hanzi_practice_buddy_generated_resources_Res_font$stable = 0;
  com_hartraft_hanzi_practice_buddy_generated_resources_Res$stable = 0;
  com_hartraft_models_Hanzi_$serializer$stable = 8;
  com_hartraft_models_Hanzi$stable = 8;
  com_hartraft_models_Practice_$serializer$stable = 8;
  com_hartraft_models_Practice$stable = 0;
  //endregion
  mainWrapper();
  return _;
}));

//# sourceMappingURL=hanzi-practice-buddy.js.map
