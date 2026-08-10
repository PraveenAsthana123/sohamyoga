/** Single source of truth for SohamYoga UI, accessibility and product experience. */
export const experienceConfig = {
  identity:{appName:'SohamYoga',tagline:'Find Your Inner Peace',productPromise:'One accessible operating system for practice, teaching and wellness business.'},
  typography:{fontFamily:'Inter, system-ui, -apple-system, sans-serif',basePx:16,lineHeight:1.6,headings:{h1:'clamp(2rem,4vw,3rem)',h2:'clamp(1.5rem,3vw,2.25rem)',h3:'1.25rem',weight:700}},
  colors:{
    brand:{50:'#fdf8f0',100:'#faecd8',500:'#d4872a',600:'#b86d1d',700:'#944f18',900:'#644019'},
    neutral:{page:'#f8fafc',surface:'#ffffff',subtle:'#f1f5f9',text:'#0f172a',muted:'#64748b',border:'#e2e8f0'},
    status:{info:{bg:'#eff6ff',fg:'#1e40af',icon:'ℹ'},success:{bg:'#ecfdf5',fg:'#065f46',icon:'✓'},warning:{bg:'#fff7ed',fg:'#9a3412',icon:'!'},danger:{bg:'#fef2f2',fg:'#991b1b',icon:'×'},disabled:{bg:'#f1f5f9',fg:'#475569',icon:'—'}},
    cardVariants:{identity:'#fff7ed',commerce:'#eff6ff',wellness:'#ecfdf5',marketing:'#faf5ff',operations:'#f8fafc',security:'#fef2f2',education:'#f0fdfa',platform:'#f1f5f9',default:'#ffffff'},
  },
  accessibility:{standard:'WCAG 2.2 AA',minContrast:4.5,largeTextContrast:3,minTouchTargetPx:44,keyboard:true,visibleFocus:true,skipLink:true,reducedMotion:true,colorAloneNeverConveysState:true,landmarksRequired:true,formLabelsRequired:true,altTextRequired:true},
  layout:{maxContentPx:1440,sidebarPx:256,headerPx:64,contentPadding:'clamp(1rem,3vw,2rem)',radiusPx:12,cardBorder:true,cardBackgroundRequired:true,shells:{admin:'left-sidebar',customer:'left-sidebar',sales:'top-navigation',teacher:'role-dashboard'}},
  navigation:{adminHome:'/admin',customerHome:'/customer/dashboard',salesHome:'/',teacherHome:'/teacher/dashboard',maxPrimaryItems:9,groupOverflow:true,breadcrumbs:true},
  pwa:{enabled:true,offlineShell:['/','/catalog','/membership','/contact'],themeColor:'#b86d1d'},
  requiredServiceDetail:['title','description','category','level','duration','price','currency','capacity','schedule','trainer','requirements','doList','dontList','images','video','trainingPlan','faq','cancellationPolicy','accessibilityNotes'],
  requiredTrainerDetail:['name','photo','bio','certifications','experienceYears','languages','specialties','services','availability','location','onlineAvailable','safetyStatement','rating','reviewCount'],
  processes:[
    {key:'user-onboarding',name:'User onboarding',actors:['customer','identity','notification'],steps:['Register','Verify consent','Build wellness profile','Select goals','Recommend services','Start guided tour']},
    {key:'trainer-onboarding',name:'Trainer onboarding',actors:['trainer','admin','security'],steps:['Apply','Identity verification','Certification review','Service setup','Availability','Safety approval','Publish']},
    {key:'model-onboarding',name:'AI model onboarding',actors:['admin','ollama','assurance'],steps:['Discover','Capability classify','Safety test','Performance test','Tenant policy','Enable','Monitor']},
    {key:'purchase-booking',name:'Purchase and booking',actors:['customer','catalog','payment','booking'],steps:['Discover','Compare','Select trainer/time','Cart','Consent','Payment','Confirmation','Reminder','Attendance']},
    {key:'async-content',name:'Asynchronous content campaign',actors:['marketer','ollama','workflow','social'],steps:['Brief','Plan','Generate','Review','Approve','Schedule','Publish','Measure','Retry']},
  ],
  telemetry:{requiredDimensions:['tenantId','organizationId','traceId','component','module','operation','actor','status','durationMs','errorCode'],syntheticTag:'SYNTHETIC_DATA'},
} as const;
export type ExperienceConfig=typeof experienceConfig;
