# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: unified-quality.spec.ts >> CUSTOMER-AUTH-001 | WCAG automated scan
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
      - main [ref=e23]:
        - generic [ref=e24]:
          - link "🧘 Soham Yoga Student Portal" [ref=e26] [cursor=pointer]:
            - /url: /
            - generic [ref=e27]: 🧘
            - generic [ref=e28]: Soham Yoga
            - generic [ref=e29]: Student Portal
          - generic [ref=e30]:
            - heading "Welcome Back" [level=1] [ref=e31]
            - generic [ref=e32]:
              - button "🔵 Google Most popular" [ref=e33] [cursor=pointer]:
                - generic [ref=e34]: 🔵
                - generic [ref=e35]: Google
                - generic [ref=e36]: Most popular
              - button "📘 Facebook" [ref=e37] [cursor=pointer]:
                - generic [ref=e38]: 📘
                - generic [ref=e39]: Facebook
              - button "🍎 Apple Private email" [ref=e40] [cursor=pointer]:
                - generic [ref=e41]: 🍎
                - generic [ref=e42]: Apple
                - generic [ref=e43]: Private email
              - button "🪟 Microsoft" [ref=e44] [cursor=pointer]:
                - generic [ref=e45]: 🪟
                - generic [ref=e46]: Microsoft
            - generic [ref=e47]: or sign in with
            - generic [ref=e51]:
              - button "🔑 Password" [ref=e52] [cursor=pointer]:
                - generic [ref=e53]: 🔑
                - text: Password
              - button "📱 One-Time Code" [ref=e54] [cursor=pointer]:
                - generic [ref=e55]: 📱
                - text: One-Time Code
              - button "🔐 Passkey" [ref=e56] [cursor=pointer]:
                - generic [ref=e57]: 🔐
                - text: Passkey
              - button "📷 QR Login" [ref=e58] [cursor=pointer]:
                - generic [ref=e59]: 📷
                - text: QR Login
            - generic [ref=e60]:
              - generic [ref=e61]:
                - generic [ref=e62]: Email
                - textbox "you@example.com" [ref=e63]
              - generic [ref=e64]:
                - generic [ref=e65]:
                  - generic [ref=e66]: Password
                  - link "Forgot?" [ref=e67] [cursor=pointer]:
                    - /url: /auth/forgot-password
                - textbox "••••••••" [ref=e68]
              - button "Sign In" [ref=e69] [cursor=pointer]
          - generic [ref=e70]:
            - paragraph [ref=e71]:
              - text: New to Soham?
              - link "Create your free account" [ref=e72] [cursor=pointer]:
                - /url: /customer/register
            - paragraph [ref=e73]:
              - text: Teacher or admin?
              - link "Staff sign-in →" [ref=e74] [cursor=pointer]:
                - /url: /auth/login
    - contentinfo [ref=e75]:
      - generic [ref=e79]:
        - generic [ref=e80]:
          - generic [ref=e81]:
            - generic [ref=e82]:
              - generic [ref=e83]: SY
              - generic [ref=e85]: Soham Yoga
            - paragraph [ref=e86]: Premium yoga products, meditation supplies, and wellness accessories for yogis of all levels. Sustainably sourced and thoughtfully designed.
            - generic [ref=e87]:
              - link "LinkedIn" [ref=e88] [cursor=pointer]:
                - /url: "#"
              - link "Twitter" [ref=e91] [cursor=pointer]:
                - /url: "#"
              - link "GitHub" [ref=e94] [cursor=pointer]:
                - /url: "#"
          - generic [ref=e97]:
            - heading "Products" [level=3] [ref=e98]
            - list [ref=e99]:
              - listitem [ref=e100]:
                - link "Yoga Mats" [ref=e101] [cursor=pointer]:
                  - /url: /products/yoga-mats
              - listitem [ref=e103]:
                - link "Meditation Cushions" [ref=e104] [cursor=pointer]:
                  - /url: /products/meditation-cushions
              - listitem [ref=e106]:
                - link "Yoga Blocks" [ref=e107] [cursor=pointer]:
                  - /url: /products/yoga-blocks
              - listitem [ref=e109]:
                - link "Yoga Straps" [ref=e110] [cursor=pointer]:
                  - /url: /products/yoga-straps
              - listitem [ref=e112]:
                - link "Bolsters" [ref=e113] [cursor=pointer]:
                  - /url: /products/bolsters
              - listitem [ref=e115]:
                - link "Essential Oils" [ref=e116] [cursor=pointer]:
                  - /url: /products/essential-oils
          - generic [ref=e118]:
            - heading "Company" [level=3] [ref=e119]
            - list [ref=e120]:
              - listitem [ref=e121]:
                - link "About Us" [ref=e122] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e124]:
                - link "Wellness Blog" [ref=e125] [cursor=pointer]:
                  - /url: /blog
              - listitem [ref=e127]:
                - link "Categories" [ref=e128] [cursor=pointer]:
                  - /url: /categories
              - listitem [ref=e130]:
                - link "Contact Us" [ref=e131] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e133]:
            - heading "Stay Updated" [level=3] [ref=e134]
            - paragraph [ref=e135]: Get yoga tips, wellness inspiration, and new product updates delivered to your inbox.
            - generic [ref=e136]:
              - textbox "Enter your email" [ref=e137]
              - button "Subscribe to newsletter" [ref=e138] [cursor=pointer]
            - generic [ref=e141]:
              - paragraph [ref=e142]: Calgary, Alberta, Canada
              - paragraph [ref=e146]: info@sohamyoga.com
        - generic [ref=e149]:
          - paragraph [ref=e150]: © 2026 Soham Yoga. All rights reserved.
          - generic [ref=e151]:
            - link "Privacy Policy" [ref=e152] [cursor=pointer]:
              - /url: /contact
            - link "Terms of Service" [ref=e153] [cursor=pointer]:
              - /url: /contact
    - generic [ref=e154]:
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
      - button "Open chat" [ref=e155] [cursor=pointer]:
        - generic [ref=e163]: "?"
    - button "Open AI assistant" [ref=e164] [cursor=pointer]
  - button "Open live chat" [ref=e167] [cursor=pointer]: 💬
  - alert [ref=e168]
  - dialog "Cookie and analytics consent" [ref=e169]:
    - generic [ref=e171]:
      - paragraph [ref=e173]:
        - text: Your privacy matters. We use essential cookies to run the portal and optional analytics to understand how visitors navigate — no passwords, health information, or payment data are ever recorded.
        - button "Customize" [ref=e174] [cursor=pointer]
      - generic [ref=e175]:
        - button "Essential Only" [ref=e176] [cursor=pointer]
        - button "Accept Analytics" [ref=e177] [cursor=pointer]
        - button "Accept All" [ref=e178] [cursor=pointer]
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