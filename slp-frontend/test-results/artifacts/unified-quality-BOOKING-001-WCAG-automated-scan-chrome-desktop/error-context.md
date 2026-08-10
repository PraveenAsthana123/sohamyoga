# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: unified-quality.spec.ts >> BOOKING-001 | WCAG automated scan
- Location: tests/e2e/unified-quality.spec.ts:17:6

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": 6,
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e3]:
    - navigation [ref=e4]:
      - generic [ref=e6]:
        - link "SY Soham Yoga" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e8]: SY
          - generic [ref=e10]: Soham Yoga
        - generic [ref=e11]:
          - link "Home" [ref=e12] [cursor=pointer]:
            - /url: /
          - link "Products" [ref=e13] [cursor=pointer]:
            - /url: /products
          - link "Categories" [ref=e14] [cursor=pointer]:
            - /url: /categories
          - link "Blog" [ref=e15] [cursor=pointer]:
            - /url: /blog
          - link "Monitoring" [ref=e16] [cursor=pointer]:
            - /url: /monitoring
          - link "About" [ref=e17] [cursor=pointer]:
            - /url: /about
          - link "Contact" [ref=e18] [cursor=pointer]:
            - /url: /contact
          - link "Shop Now" [ref=e19] [cursor=pointer]:
            - /url: /products
    - main [ref=e22]:
      - generic [ref=e24]:
        - generic [ref=e25]:
          - heading "Book a Class" [level=1] [ref=e26]
          - paragraph [ref=e27]: Find your perfect yoga session
        - generic [ref=e28]:
          - button "All Levels" [ref=e29] [cursor=pointer]
          - button "Beginner" [ref=e30] [cursor=pointer]
          - button "Intermediate" [ref=e31] [cursor=pointer]
          - button "Advanced" [ref=e32] [cursor=pointer]
        - generic [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]:
              - generic [ref=e36]:
                - heading "Morning Flow" [level=3] [ref=e37]
                - generic [ref=e38]: Beginner
                - generic [ref=e39]: Hatha
              - paragraph [ref=e40]: 👩‍🏫 Priya Sharma · ⏱ 60 min
              - paragraph [ref=e41]: 📅 Thu, Aug 6 at 07:00 a.m.
              - generic [ref=e42]: 8 spots left
            - generic [ref=e46]:
              - generic [ref=e47]: $15
              - link "Book Now" [ref=e48] [cursor=pointer]:
                - /url: /booking/1
          - generic [ref=e49]:
            - generic [ref=e50]:
              - generic [ref=e51]:
                - heading "Power Vinyasa" [level=3] [ref=e52]
                - generic [ref=e53]: Intermediate
                - generic [ref=e54]: Vinyasa
              - paragraph [ref=e55]: 👩‍🏫 Raj Patel · ⏱ 75 min
              - paragraph [ref=e56]: 📅 Thu, Aug 6 at 10:00 a.m.
              - generic [ref=e57]: 3 spots left
            - generic [ref=e61]:
              - generic [ref=e62]: $18
              - link "Book Now" [ref=e63] [cursor=pointer]:
                - /url: /booking/2
          - generic [ref=e64]:
            - generic [ref=e65]:
              - generic [ref=e66]:
                - heading "Yin & Restore" [level=3] [ref=e67]
                - generic [ref=e68]: Beginner
                - generic [ref=e69]: Yin
              - paragraph [ref=e70]: 👩‍🏫 Anita Mehta · ⏱ 90 min
              - paragraph [ref=e71]: 📅 Thu, Aug 6 at 06:00 p.m.
              - generic [ref=e72]: 12 spots left
            - generic [ref=e76]:
              - generic [ref=e77]: $15
              - link "Book Now" [ref=e78] [cursor=pointer]:
                - /url: /booking/3
          - generic [ref=e79]:
            - generic [ref=e80]:
              - generic [ref=e81]:
                - heading "Advanced Inversions" [level=3] [ref=e82]
                - generic [ref=e83]: Advanced
                - generic [ref=e84]: Ashtanga
              - paragraph [ref=e85]: 👩‍🏫 Priya Sharma · ⏱ 60 min
              - paragraph [ref=e86]: 📅 Fri, Aug 7 at 08:00 a.m.
              - generic [ref=e87]: 5 spots left
            - generic [ref=e91]:
              - generic [ref=e92]: $22
              - link "Book Now" [ref=e93] [cursor=pointer]:
                - /url: /booking/4
    - contentinfo [ref=e94]:
      - generic [ref=e98]:
        - generic [ref=e99]:
          - generic [ref=e100]:
            - generic [ref=e101]:
              - generic [ref=e102]: SY
              - generic [ref=e104]: Soham Yoga
            - paragraph [ref=e105]: Premium yoga products, meditation supplies, and wellness accessories for yogis of all levels. Sustainably sourced and thoughtfully designed.
            - generic [ref=e106]:
              - link "LinkedIn" [ref=e107] [cursor=pointer]:
                - /url: "#"
              - link "Twitter" [ref=e110] [cursor=pointer]:
                - /url: "#"
              - link "GitHub" [ref=e113] [cursor=pointer]:
                - /url: "#"
          - generic [ref=e116]:
            - heading "Products" [level=3] [ref=e117]
            - list [ref=e118]:
              - listitem [ref=e119]:
                - link "Yoga Mats" [ref=e120] [cursor=pointer]:
                  - /url: /products/yoga-mats
              - listitem [ref=e122]:
                - link "Meditation Cushions" [ref=e123] [cursor=pointer]:
                  - /url: /products/meditation-cushions
              - listitem [ref=e125]:
                - link "Yoga Blocks" [ref=e126] [cursor=pointer]:
                  - /url: /products/yoga-blocks
              - listitem [ref=e128]:
                - link "Yoga Straps" [ref=e129] [cursor=pointer]:
                  - /url: /products/yoga-straps
              - listitem [ref=e131]:
                - link "Bolsters" [ref=e132] [cursor=pointer]:
                  - /url: /products/bolsters
              - listitem [ref=e134]:
                - link "Essential Oils" [ref=e135] [cursor=pointer]:
                  - /url: /products/essential-oils
          - generic [ref=e137]:
            - heading "Company" [level=3] [ref=e138]
            - list [ref=e139]:
              - listitem [ref=e140]:
                - link "About Us" [ref=e141] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e143]:
                - link "Wellness Blog" [ref=e144] [cursor=pointer]:
                  - /url: /blog
              - listitem [ref=e146]:
                - link "Categories" [ref=e147] [cursor=pointer]:
                  - /url: /categories
              - listitem [ref=e149]:
                - link "Contact Us" [ref=e150] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e152]:
            - heading "Stay Updated" [level=3] [ref=e153]
            - paragraph [ref=e154]: Get yoga tips, wellness inspiration, and new product updates delivered to your inbox.
            - generic [ref=e155]:
              - textbox "Enter your email" [ref=e156]
              - button "Subscribe to newsletter" [ref=e157] [cursor=pointer]
            - generic [ref=e160]:
              - paragraph [ref=e161]: Calgary, Alberta, Canada
              - paragraph [ref=e165]: info@sohamyoga.com
        - generic [ref=e168]:
          - paragraph [ref=e169]: © 2026 Soham Yoga. All rights reserved.
          - generic [ref=e170]:
            - link "Privacy Policy" [ref=e171] [cursor=pointer]:
              - /url: /contact
            - link "Terms of Service" [ref=e172] [cursor=pointer]:
              - /url: /contact
    - generic [ref=e173]:
      - generic:
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - heading "Get Started" [level=3]
                  - paragraph: SohamYoga
            - button "Close chat"
          - generic:
            - generic:
              - generic:
                - heading "How can we help?" [level=4]
                - paragraph: Select the type of request to get started.
                - generic:
                  - button "General Inquiry"
                  - button "Request a Demo"
                  - button "Book Consultation"
                  - button "Technical Support"
      - button "Open chat" [ref=e174] [cursor=pointer]:
        - generic [ref=e182]: "?"
    - button "Open AI assistant" [ref=e183] [cursor=pointer]
  - button "Open live chat" [ref=e186] [cursor=pointer]: 💬
  - alert [ref=e187]
  - dialog "Cookie and analytics consent" [ref=e188]:
    - generic [ref=e190]:
      - paragraph [ref=e192]:
        - text: Your privacy matters. We use essential cookies to run the portal and optional analytics to understand how visitors navigate — no passwords, health information, or payment data are ever recorded.
        - button "Customize" [ref=e193] [cursor=pointer]
      - generic [ref=e194]:
        - button "Essential Only" [ref=e195] [cursor=pointer]
        - button "Accept Analytics" [ref=e196] [cursor=pointer]
        - button "Accept All" [ref=e197] [cursor=pointer]
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