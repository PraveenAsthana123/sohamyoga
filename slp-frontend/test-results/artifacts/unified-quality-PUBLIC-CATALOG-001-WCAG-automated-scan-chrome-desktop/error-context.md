# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: unified-quality.spec.ts >> PUBLIC-CATALOG-001 | WCAG automated scan
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
+     "nodes": 1,
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
          - heading "Class Catalog" [level=1] [ref=e26]
          - paragraph [ref=e27]: 6 classes available
        - textbox "Search classes, teachers, or styles…" [ref=e28]
        - generic [ref=e29]:
          - paragraph [ref=e30]: Style
          - generic [ref=e31]:
            - button "All" [ref=e32] [cursor=pointer]
            - button "Hatha" [ref=e33] [cursor=pointer]
            - button "Vinyasa" [ref=e34] [cursor=pointer]
            - button "Yin" [ref=e35] [cursor=pointer]
            - button "Ashtanga" [ref=e36] [cursor=pointer]
            - button "Restorative" [ref=e37] [cursor=pointer]
            - button "Kundalini" [ref=e38] [cursor=pointer]
        - generic [ref=e39]:
          - paragraph [ref=e40]: Level
          - generic [ref=e41]:
            - button "All" [ref=e42] [cursor=pointer]
            - button "Beginner" [ref=e43] [cursor=pointer]
            - button "Intermediate" [ref=e44] [cursor=pointer]
            - button "Advanced" [ref=e45] [cursor=pointer]
            - button "All Levels" [ref=e46] [cursor=pointer]
        - generic [ref=e47]:
          - generic [ref=e48]:
            - generic [ref=e49]:
              - generic [ref=e50]:
                - generic [ref=e51]: Beginner
                - generic [ref=e52]: Hatha
              - heading "Morning Hatha Flow" [level=3] [ref=e53]
              - paragraph [ref=e54]: 👩‍🏫 Priya Sharma · ⏱ 60 min · 📅 Tomorrow 7:00 AM
              - paragraph [ref=e55]: Gentle sun salutations and foundational poses to start your day with intention and calm energy.
              - generic [ref=e56]:
                - generic [ref=e57]: morning
                - generic [ref=e58]: gentle
                - generic [ref=e59]: breathing
              - generic [ref=e60]:
                - generic [ref=e62]:
                  - generic [ref=e63]: 8 spots left
                  - generic [ref=e64]: 15 max
                - generic [ref=e67]:
                  - generic [ref=e68]: $15 CAD
                  - link "Book Now" [ref=e69] [cursor=pointer]:
                    - /url: /booking/1
            - button "FAQs about this class (2) +" [ref=e71] [cursor=pointer]:
              - generic [ref=e72]: FAQs about this class (2)
              - generic [ref=e73]: +
          - generic [ref=e74]:
            - generic [ref=e75]:
              - generic [ref=e76]:
                - generic [ref=e77]: Intermediate
                - generic [ref=e78]: Vinyasa
                - generic [ref=e79]: Online
              - heading "Power Vinyasa" [level=3] [ref=e80]
              - paragraph [ref=e81]: 👩‍🏫 Raj Patel · ⏱ 75 min · 📅 Today 10:00 AM
              - paragraph [ref=e82]: Dynamic, breath-linked movement sequences that build cardiovascular fitness and functional strength.
              - generic [ref=e83]:
                - generic [ref=e84]: strength
                - generic [ref=e85]: flow
                - generic [ref=e86]: cardio
              - generic [ref=e87]:
                - generic [ref=e89]:
                  - generic [ref=e90]: 3 spots left
                  - generic [ref=e91]: 12 max
                - generic [ref=e94]:
                  - generic [ref=e95]: $18 CAD
                  - link "Book Now" [ref=e96] [cursor=pointer]:
                    - /url: /booking/2
            - button "FAQs about this class (2) +" [ref=e98] [cursor=pointer]:
              - generic [ref=e99]: FAQs about this class (2)
              - generic [ref=e100]: +
          - generic [ref=e101]:
            - generic [ref=e102]:
              - generic [ref=e103]:
                - generic [ref=e104]: All Levels
                - generic [ref=e105]: Yin
              - heading "Yin & Restore" [level=3] [ref=e106]
              - paragraph [ref=e107]: 👩‍🏫 Anita Mehta · ⏱ 90 min · 📅 Today 6:00 PM
              - paragraph [ref=e108]: Deep, passive stretches held for 3–5 minutes each. Targets fascia and connective tissue. Perfect for recovery and stress relief.
              - generic [ref=e109]:
                - generic [ref=e110]: relaxation
                - generic [ref=e111]: flexibility
                - generic [ref=e112]: stress relief
              - generic [ref=e113]:
                - generic [ref=e115]:
                  - generic [ref=e116]: 12 spots left
                  - generic [ref=e117]: 15 max
                - generic [ref=e120]:
                  - generic [ref=e121]: $15 CAD
                  - link "Book Now" [ref=e122] [cursor=pointer]:
                    - /url: /booking/3
            - button "FAQs about this class (2) +" [ref=e124] [cursor=pointer]:
              - generic [ref=e125]: FAQs about this class (2)
              - generic [ref=e126]: +
          - generic [ref=e127]:
            - generic [ref=e128]:
              - generic [ref=e129]:
                - generic [ref=e130]: Advanced
                - generic [ref=e131]: Ashtanga
              - heading "Advanced Inversions" [level=3] [ref=e132]
              - paragraph [ref=e133]: 👩‍🏫 Priya Sharma · ⏱ 60 min · 📅 Thu 8:00 AM
              - paragraph [ref=e134]: Systematic progression through headstand, forearm balance, and handstand. Safety-first approach with spotting and wall work.
              - generic [ref=e135]:
                - generic [ref=e136]: inversions
                - generic [ref=e137]: headstand
                - generic [ref=e138]: handstand
                - generic [ref=e139]: advanced
              - generic [ref=e140]:
                - generic [ref=e142]:
                  - generic [ref=e143]: 5 spots left
                  - generic [ref=e144]: 8 max
                - generic [ref=e147]:
                  - generic [ref=e148]: $22 CAD
                  - link "Book Now" [ref=e149] [cursor=pointer]:
                    - /url: /booking/4
            - button "FAQs about this class (2) +" [ref=e151] [cursor=pointer]:
              - generic [ref=e152]: FAQs about this class (2)
              - generic [ref=e153]: +
          - generic [ref=e154]:
            - generic [ref=e155]:
              - generic [ref=e156]:
                - generic [ref=e157]: All Levels
                - generic [ref=e158]: Restorative
                - generic [ref=e159]: Online
              - heading "Prenatal Yoga" [level=3] [ref=e160]
              - paragraph [ref=e161]: 👩‍🏫 Anita Mehta · ⏱ 60 min · 📅 Sat 11:00 AM
              - paragraph [ref=e162]: Safe, nurturing practice designed for all trimesters. Focuses on pelvic floor, breath, and labour preparation.
              - generic [ref=e163]:
                - generic [ref=e164]: prenatal
                - generic [ref=e165]: pregnancy
                - generic [ref=e166]: gentle
              - generic [ref=e167]:
                - generic [ref=e169]:
                  - generic [ref=e170]: 10 spots left
                  - generic [ref=e171]: 10 max
                - generic [ref=e173]:
                  - generic [ref=e174]: $18 CAD
                  - link "Book Now" [ref=e175] [cursor=pointer]:
                    - /url: /booking/5
            - button "FAQs about this class (2) +" [ref=e177] [cursor=pointer]:
              - generic [ref=e178]: FAQs about this class (2)
              - generic [ref=e179]: +
          - generic [ref=e180]:
            - generic [ref=e181]:
              - generic [ref=e182]:
                - generic [ref=e183]: Intermediate
                - generic [ref=e184]: Kundalini
                - generic [ref=e185]: Online
              - heading "Kundalini Awakening" [level=3] [ref=e186]
              - paragraph [ref=e187]: 👩‍🏫 Raj Patel · ⏱ 90 min · 📅 Wed 7:30 PM
              - paragraph [ref=e188]: Traditional kriya practice combining dynamic poses, breathwork, mantra, and meditation to awaken energy and clarity.
              - generic [ref=e189]:
                - generic [ref=e190]: kundalini
                - generic [ref=e191]: meditation
                - generic [ref=e192]: breathing
                - generic [ref=e193]: chanting
              - generic [ref=e194]:
                - generic [ref=e196]:
                  - generic [ref=e197]: 7 spots left
                  - generic [ref=e198]: 12 max
                - generic [ref=e201]:
                  - generic [ref=e202]: $20 CAD
                  - link "Book Now" [ref=e203] [cursor=pointer]:
                    - /url: /booking/6
            - button "FAQs about this class (2) +" [ref=e205] [cursor=pointer]:
              - generic [ref=e206]: FAQs about this class (2)
              - generic [ref=e207]: +
    - contentinfo [ref=e208]:
      - generic [ref=e212]:
        - generic [ref=e213]:
          - generic [ref=e214]:
            - generic [ref=e215]:
              - generic [ref=e216]: SY
              - generic [ref=e218]: Soham Yoga
            - paragraph [ref=e219]: Premium yoga products, meditation supplies, and wellness accessories for yogis of all levels. Sustainably sourced and thoughtfully designed.
            - generic [ref=e220]:
              - link "LinkedIn" [ref=e221] [cursor=pointer]:
                - /url: "#"
              - link "Twitter" [ref=e224] [cursor=pointer]:
                - /url: "#"
              - link "GitHub" [ref=e227] [cursor=pointer]:
                - /url: "#"
          - generic [ref=e230]:
            - heading "Products" [level=3] [ref=e231]
            - list [ref=e232]:
              - listitem [ref=e233]:
                - link "Yoga Mats" [ref=e234] [cursor=pointer]:
                  - /url: /products/yoga-mats
              - listitem [ref=e236]:
                - link "Meditation Cushions" [ref=e237] [cursor=pointer]:
                  - /url: /products/meditation-cushions
              - listitem [ref=e239]:
                - link "Yoga Blocks" [ref=e240] [cursor=pointer]:
                  - /url: /products/yoga-blocks
              - listitem [ref=e242]:
                - link "Yoga Straps" [ref=e243] [cursor=pointer]:
                  - /url: /products/yoga-straps
              - listitem [ref=e245]:
                - link "Bolsters" [ref=e246] [cursor=pointer]:
                  - /url: /products/bolsters
              - listitem [ref=e248]:
                - link "Essential Oils" [ref=e249] [cursor=pointer]:
                  - /url: /products/essential-oils
          - generic [ref=e251]:
            - heading "Company" [level=3] [ref=e252]
            - list [ref=e253]:
              - listitem [ref=e254]:
                - link "About Us" [ref=e255] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e257]:
                - link "Wellness Blog" [ref=e258] [cursor=pointer]:
                  - /url: /blog
              - listitem [ref=e260]:
                - link "Categories" [ref=e261] [cursor=pointer]:
                  - /url: /categories
              - listitem [ref=e263]:
                - link "Contact Us" [ref=e264] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e266]:
            - heading "Stay Updated" [level=3] [ref=e267]
            - paragraph [ref=e268]: Get yoga tips, wellness inspiration, and new product updates delivered to your inbox.
            - generic [ref=e269]:
              - textbox "Enter your email" [ref=e270]
              - button "Subscribe to newsletter" [ref=e271] [cursor=pointer]
            - generic [ref=e274]:
              - paragraph [ref=e275]: Calgary, Alberta, Canada
              - paragraph [ref=e279]: info@sohamyoga.com
        - generic [ref=e282]:
          - paragraph [ref=e283]: © 2026 Soham Yoga. All rights reserved.
          - generic [ref=e284]:
            - link "Privacy Policy" [ref=e285] [cursor=pointer]:
              - /url: /contact
            - link "Terms of Service" [ref=e286] [cursor=pointer]:
              - /url: /contact
    - generic [ref=e287]:
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
      - button "Open chat" [ref=e288] [cursor=pointer]:
        - generic [ref=e296]: "?"
    - button "Open AI assistant" [ref=e297] [cursor=pointer]
  - button "Open live chat" [ref=e300] [cursor=pointer]: 💬
  - alert [ref=e301]
  - dialog "Cookie and analytics consent" [ref=e302]:
    - generic [ref=e304]:
      - paragraph [ref=e306]:
        - text: Your privacy matters. We use essential cookies to run the portal and optional analytics to understand how visitors navigate — no passwords, health information, or payment data are ever recorded.
        - button "Customize" [ref=e307] [cursor=pointer]
      - generic [ref=e308]:
        - button "Essential Only" [ref=e309] [cursor=pointer]
        - button "Accept Analytics" [ref=e310] [cursor=pointer]
        - button "Accept All" [ref=e311] [cursor=pointer]
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