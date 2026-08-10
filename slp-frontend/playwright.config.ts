import {defineConfig, devices} from 'playwright/test';
const baseURL=process.env.SOHAM_BASE_URL||'http://127.0.0.1:8085';
export default defineConfig({
 testDir:'./tests/e2e',outputDir:'./test-results/artifacts',timeout:45_000,expect:{timeout:8_000},
 retries:process.env.CI?2:0,workers:process.env.CI?2:1,
 reporter:[['list'],['json',{outputFile:'test-results/unified-quality.json'}],['html',{outputFolder:'test-results/html',open:'never'}]],
 use:{baseURL,trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure'},
 projects:[
  {name:'chrome-desktop',use:{...devices['Desktop Chrome'],channel:'chrome'}},
  {name:'mobile-pwa',use:{...devices['Pixel 7']}},
  {name:'color-blind-protanopia',use:{...devices['Desktop Chrome'],channel:'chrome',colorScheme:'light'}},
 ],
});
