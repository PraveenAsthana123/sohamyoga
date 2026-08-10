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

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": 2,
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
      - generic [ref=e23]:
        - generic [ref=e24]:
          - heading "Join SohamYoga" [level=1] [ref=e25]
          - paragraph [ref=e26]: Unlimited classes, AI coaching, and a supportive community — all in one platform.
          - link "View Plans" [ref=e27] [cursor=pointer]:
            - /url: /payments
        - generic [ref=e28]:
          - heading "Everything You Need" [level=2] [ref=e29]
          - generic [ref=e30]:
            - generic [ref=e31]:
              - generic [ref=e32]: 🎯
              - heading "Unlimited Classes" [level=3] [ref=e33]
              - paragraph [ref=e34]: Access every live and on-demand class across all styles and levels.
            - generic [ref=e35]:
              - generic [ref=e36]: 🤖
              - heading "AI Pose Coach" [level=3] [ref=e37]
              - paragraph [ref=e38]: Real-time pose analysis and correction feedback after every session.
            - generic [ref=e39]:
              - generic [ref=e40]: ✨
              - heading "Personalised Flows" [level=3] [ref=e41]
              - paragraph [ref=e42]: AI-generated yoga sequences tailored to your goals and schedule.
            - generic [ref=e43]:
              - generic [ref=e44]: 📱
              - heading "WhatsApp Reminders" [level=3] [ref=e45]
              - paragraph [ref=e46]: Booking confirmations and class reminders sent directly to you.
            - generic [ref=e47]:
              - generic [ref=e48]: 👥
              - heading "Community Access" [level=3] [ref=e49]
              - paragraph [ref=e50]: Connect with fellow yogis, join challenges, and share your journey.
            - generic [ref=e51]:
              - generic [ref=e52]: 📊
              - heading "Progress Dashboard" [level=3] [ref=e53]
              - paragraph [ref=e54]: Track sessions, pose scores, streaks, and wellness milestones.
        - generic [ref=e56]:
          - heading "Ready to start?" [level=3] [ref=e57]
          - paragraph [ref=e58]: Try 7 days free on any paid plan. Cancel anytime.
          - link "See Pricing" [ref=e59] [cursor=pointer]:
            - /url: /payments
          - link "Browse free classes first →" [ref=e60] [cursor=pointer]:
            - /url: /booking
    - contentinfo [ref=e61]:
      - generic [ref=e65]:
        - generic [ref=e66]:
          - generic [ref=e67]:
            - generic [ref=e68]:
              - generic [ref=e69]: SY
              - generic [ref=e71]: Soham Yoga
            - paragraph [ref=e72]: Premium yoga products, meditation supplies, and wellness accessories for yogis of all levels. Sustainably sourced and thoughtfully designed.
            - generic [ref=e73]:
              - link "LinkedIn" [ref=e74] [cursor=pointer]:
                - /url: "#"
              - link "Twitter" [ref=e77] [cursor=pointer]:
                - /url: "#"
              - link "GitHub" [ref=e80] [cursor=pointer]:
                - /url: "#"
          - generic [ref=e83]:
            - heading "Products" [level=3] [ref=e84]
            - list [ref=e85]:
              - listitem [ref=e86]:
                - link "Yoga Mats" [ref=e87] [cursor=pointer]:
                  - /url: /products/yoga-mats
              - listitem [ref=e89]:
                - link "Meditation Cushions" [ref=e90] [cursor=pointer]:
                  - /url: /products/meditation-cushions
              - listitem [ref=e92]:
                - link "Yoga Blocks" [ref=e93] [cursor=pointer]:
                  - /url: /products/yoga-blocks
              - listitem [ref=e95]:
                - link "Yoga Straps" [ref=e96] [cursor=pointer]:
                  - /url: /products/yoga-straps
              - listitem [ref=e98]:
                - link "Bolsters" [ref=e99] [cursor=pointer]:
                  - /url: /products/bolsters
              - listitem [ref=e101]:
                - link "Essential Oils" [ref=e102] [cursor=pointer]:
                  - /url: /products/essential-oils
          - generic [ref=e104]:
            - heading "Company" [level=3] [ref=e105]
            - list [ref=e106]:
              - listitem [ref=e107]:
                - link "About Us" [ref=e108] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e110]:
                - link "Wellness Blog" [ref=e111] [cursor=pointer]:
                  - /url: /blog
              - listitem [ref=e113]:
                - link "Categories" [ref=e114] [cursor=pointer]:
                  - /url: /categories
              - listitem [ref=e116]:
                - link "Contact Us" [ref=e117] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e119]:
            - heading "Stay Updated" [level=3] [ref=e120]
            - paragraph [ref=e121]: Get yoga tips, wellness inspiration, and new product updates delivered to your inbox.
            - generic [ref=e122]:
              - textbox "Enter your email" [ref=e123]
              - button "Subscribe to newsletter" [ref=e124] [cursor=pointer]
            - generic [ref=e127]:
              - paragraph [ref=e128]: Calgary, Alberta, Canada
              - paragraph [ref=e132]: info@sohamyoga.com
        - generic [ref=e135]:
          - paragraph [ref=e136]: © 2026 Soham Yoga. All rights reserved.
          - generic [ref=e137]:
            - link "Privacy Policy" [ref=e138] [cursor=pointer]:
              - /url: /contact
            - link "Terms of Service" [ref=e139] [cursor=pointer]:
              - /url: /contact
    - generic [ref=e140]:
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
      - button "Open chat" [ref=e141] [cursor=pointer]:
        - generic [ref=e149]: "?"
    - button "Open AI assistant" [ref=e150] [cursor=pointer]
  - button "Open live chat" [ref=e153] [cursor=pointer]: 💬
  - alert [ref=e154]
  - dialog "Cookie and analytics consent" [ref=e155]:
    - generic [ref=e157]:
      - paragraph [ref=e159]:
        - text: Your privacy matters. We use essential cookies to run the portal and optional analytics to understand how visitors navigate — no passwords, health information, or payment data are ever recorded.
        - button "Customize" [ref=e160] [cursor=pointer]
      - generic [ref=e161]:
        - button "Essential Only" [ref=e162] [cursor=pointer]
        - button "Accept Analytics" [ref=e163] [cursor=pointer]
        - button "Accept All" [ref=e164] [cursor=pointer]
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