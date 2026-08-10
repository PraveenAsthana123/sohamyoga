# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: unified-quality.spec.ts >> MEMBERSHIP-001 | WCAG automated scan
- Location: tests/e2e/unified-quality.spec.ts:17:6

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 12

- Array []
+ Array [
+   Object {
+     "id": "document-title",
+     "impact": "serious",
+     "nodes": 1,
+   },
+   Object {
+     "id": "html-has-lang",
+     "impact": "serious",
+     "nodes": 1,
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Internal Server Error
```

# Test source

```ts
  1  | import {test,expect} from 'playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {qualityStories} from '../quality/test-stories';
  4  | 
  5  | const publicStories=qualityStories.filter(s=>!s.route.startsWith('/admin/')&&s.status!=='missing');
  6  | for(const story of publicStories){
  7  |  test(`${story.id} | ${story.actor} | positive route and UI contract`,async({page},testInfo)=>{
  8  |   const consoleErrors:string[]=[];const failedRequests:string[]=[];
  9  |   page.on('pageerror',e=>consoleErrors.push(e.message));
  10 |   page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('401'))consoleErrors.push(m.text())});
  11 |   page.on('requestfailed',r=>failedRequests.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
  12 |   const response=await page.goto(story.route,{waitUntil:'networkidle'});
  13 |   expect(response?.status(),story.id).toBeLessThan(400);await expect(page.locator('body')).toBeVisible();await expect(page.locator('h1').first()).toBeVisible();
  14 |   expect(consoleErrors,`console/page errors: ${consoleErrors.join('\n')}`).toEqual([]);expect(failedRequests,`failed requests: ${failedRequests.join('\n')}`).toEqual([]);
  15 |   await testInfo.attach('story',{body:Buffer.from(JSON.stringify(story,null,2)),contentType:'application/json'});
  16 |  });
  17 |  test(`${story.id} | WCAG automated scan`,async({page},testInfo)=>{
  18 |   await page.goto(story.route,{waitUntil:'networkidle'});const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  19 |   await testInfo.attach('axe-results',{body:Buffer.from(JSON.stringify(scan,null,2)),contentType:'application/json'});
> 20 |   expect(scan.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))).toEqual([]);
     |                                                                                    ^ Error: expect(received).toEqual(expected) // deep equality
  21 |  });
  22 | }
  23 | test('ADMIN-AUTH-001 | anonymous admin access is redirected',async({page})=>{const response=await page.goto('/admin/operations-center');expect(response?.status()).toBeLessThan(400);await expect(page).toHaveURL(/\/auth\/login/)});
  24 | test('CUSTOMER-AUTH-001 | negative malformed login remains unauthenticated',async({page})=>{
  25 |  await page.goto('/customer/login');const email=page.locator('input[type="email"]');const password=page.locator('input[type="password"]');
  26 |  if(await email.count()&&await password.count()){await email.fill("not-an-email' OR 1=1 --");await password.fill('<script>alert(1)</script>');await page.locator('button[type="submit"]').click();await expect(page).not.toHaveURL(/customer\/(dashboard|portal)/)}
  27 | });
  28 | test('global UI contract | keyboard focus, landmarks and non-colour status cues',async({page})=>{await page.goto('/');await page.keyboard.press('Tab');await expect(page.locator(':focus')).toBeVisible();expect(await page.locator('main,#main-content').count()).toBeGreaterThan(0);expect(await page.locator('h1').count()).toBeGreaterThan(0);const statuses=page.locator('[data-status]');for(let i=0;i<await statuses.count();i++)await expect(statuses.nth(i)).toHaveAttribute('aria-label',/.+/)});
  29 | test('Chrome DevTools Protocol | runtime, network and accessibility tree',async({page,browserName},testInfo)=>{
  30 |  test.skip(browserName!=='chromium','CDP is a Chromium protocol');const cdp=await page.context().newCDPSession(page);const exceptions:unknown[]=[];const failed:unknown[]=[];
  31 |  await cdp.send('Runtime.enable');await cdp.send('Network.enable');await cdp.send('Accessibility.enable');cdp.on('Runtime.exceptionThrown',e=>exceptions.push(e));cdp.on('Network.loadingFailed',e=>failed.push(e));
  32 |  await page.goto('/catalog',{waitUntil:'networkidle'});const tree=await cdp.send('Accessibility.getFullAXTree');await testInfo.attach('cdp-accessibility-tree',{body:Buffer.from(JSON.stringify(tree,null,2)),contentType:'application/json'});
  33 |  expect(exceptions).toEqual([]);expect(failed).toEqual([]);expect(tree.nodes.length).toBeGreaterThan(1);
  34 | });
  35 | 
```