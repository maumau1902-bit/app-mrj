const { test } = require('node:test');
const assert = require('node:assert/strict');
const { updatePolicy } = require('../electron/update-policy.cjs');
const valid = { provider: 'github', owner: 'maumau1902-bit', repo: 'app-mrj', publisherName: ['Test publisher'] };
test('only a packaged Windows build with a publisher and the pinned GitHub feed can update', () => {
  assert.equal(updatePolicy({ packaged:true, platform:'win32', config:valid }).enabled, true);
  for (const options of [
    {packaged:false, platform:'win32', config:valid},
    {packaged:true, platform:'linux', config:valid},
    {packaged:true, platform:'win32'},
    ...[{}, {...valid,publisherName:[]}, {...valid,publisherName:['']}, {...valid,publisherName:undefined}, {...valid,provider:'generic'}, {...valid,repo:'other-app'}, {...valid,owner:'other-owner'}].map(config=>({packaged:true,platform:'win32',config}))
  ]) assert.equal(updatePolicy(options).enabled, false);
});
