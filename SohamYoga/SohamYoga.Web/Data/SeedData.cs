using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Data;

public static class SeedData
{
    public static async Task InitializeAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        await context.Database.EnsureCreatedAsync();

        await SeedRolesAsync(roleManager);
        await SeedAdminUserAsync(userManager, config);
        await SeedSiteSettingsAsync(context);
        await SeedBlogCategoriesAsync(context);
        await SeedServicesAsync(context);
        await SeedTestimonialsAsync(context);
        await SeedCaseStudiesAsync(context);
        await SeedIndustrySolutionsAsync(context);
        await SeedTeamMembersAsync(context);
        await SeedVideoDemosAsync(context);
        await SeedBlogPostsAsync(context);
        await SeedAdditionalBlogCategoriesAsync(context);
        await SeedAdditionalBlogPostsAsync(context);
        await SeedJobPostingsAsync(context);
        await SeedYogaProductsAsync(context);
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        string[] roles = { "Admin", "Editor", "HR", "Sales", "Customer" };

        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }
    }

    private static async Task SeedAdminUserAsync(UserManager<IdentityUser> userManager, IConfiguration config)
    {
        var adminEmail = config["Admin:Email"];
        var adminPassword = config["Admin:Password"];

        if (string.IsNullOrEmpty(adminEmail) || string.IsNullOrEmpty(adminPassword))
            return; // Skip seeding if credentials not configured

        if (await userManager.FindByEmailAsync(adminEmail) == null)
        {
            var adminUser = new IdentityUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true
            };

            var result = await userManager.CreateAsync(adminUser, adminPassword);

            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }
        }
    }

    private static async Task SeedSiteSettingsAsync(ApplicationDbContext context)
    {
        if (await context.SiteSettings.AnyAsync()) return;

        context.SiteSettings.Add(new SiteSettings
        {
            CompanyName = "Soham Yoga",
            Tagline = "IT Management. SIMPLIFIED.",
            Description = "We provide expert IT consulting, development, and managed services for businesses across Canada.",
            Phone = "(403) 555-0123",
            Email = "info@sohamyoga.ca",
            Address = "123 Business Avenue, Suite 200, Calgary, AB T2P 1J9, Canada",
            LinkedInUrl = "https://www.linkedin.com/company/sohamyoga",
            TwitterUrl = "https://twitter.com/sohamyoga",
            FacebookUrl = "https://www.facebook.com/sohamyoga",
            SmtpPort = 587,
            NewsletterEnabled = false
        });

        await context.SaveChangesAsync();
    }

    private static async Task SeedBlogCategoriesAsync(ApplicationDbContext context)
    {
        if (await context.BlogCategories.AnyAsync()) return;

        context.BlogCategories.AddRange(
            new BlogCategory { Name = "Artificial Intelligence", Slug = "artificial-intelligence" },
            new BlogCategory { Name = "Machine Learning", Slug = "machine-learning" },
            new BlogCategory { Name = "Digital Transformation", Slug = "digital-transformation" },
            new BlogCategory { Name = "IT Management", Slug = "it-management" },
            new BlogCategory { Name = "Technology Trends", Slug = "technology-trends" }
        );

        await context.SaveChangesAsync();
    }

    private static async Task SeedServicesAsync(ApplicationDbContext context)
    {
        if (await context.Services.AnyAsync()) return;

        var services = new List<Service>
        {
            // IT Services
            new Service
            {
                Title = "SharePoint",
                ShortDescription = "Transform your workplace with custom SharePoint solutions.",
                FullDescription = "<p>Our SharePoint experts design and implement modern intranet solutions that transform how your organization collaborates, communicates, and manages knowledge. From document management to workflow automation, we leverage the full power of the Microsoft 365 ecosystem.</p>" +
                    "<p>We specialize in SharePoint Online migrations, custom web parts, Power Automate integrations, and information architecture design. Whether you need a simple team site or a complex enterprise content management system, our team delivers solutions that drive productivity.</p>" +
                    "<p>Our approach includes thorough requirements gathering, user experience design, iterative development, and comprehensive training to ensure high adoption rates across your organization.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><line x1=\"8.59\" y1=\"13.51\" x2=\"15.42\" y2=\"17.49\"/><line x1=\"15.41\" y1=\"6.51\" x2=\"8.59\" y2=\"10.49\"/></svg>",
                Slug = "sharepoint",
                Category = "IT",
                Features = "[\"Modern Intranet Design & Development\",\"Document Management & Workflow Automation\",\"SharePoint Online Migration & Optimization\",\"Custom Web Parts & Power Platform Integration\",\"Information Architecture & Governance\"]",
                SortOrder = 1,
                IsActive = true,
                IsFeatured = true
            },
            new Service
            {
                Title = "Managed Services",
                ShortDescription = "Focus on your business while we handle your IT with 24/7 monitoring.",
                FullDescription = "<p>Our Managed Services provide comprehensive IT support and monitoring so you can focus on running your business. We proactively manage your infrastructure, resolve issues before they impact operations, and ensure your systems are always performing at their best.</p>" +
                    "<p>With our 24/7 Network Operations Center (NOC), we monitor your servers, networks, and applications around the clock. Our team handles patch management, security updates, backup verification, and disaster recovery planning to keep your business running smoothly.</p>" +
                    "<p>We offer flexible service tiers from basic monitoring to fully managed IT, allowing you to choose the level of support that fits your organization's needs and budget.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\" ry=\"2\"/><line x1=\"8\" y1=\"21\" x2=\"16\" y2=\"21\"/><line x1=\"12\" y1=\"17\" x2=\"12\" y2=\"21\"/></svg>",
                Slug = "managed-services",
                Category = "IT",
                Features = "[\"24/7 Infrastructure Monitoring & Alerting\",\"Patch Management & Security Updates\",\"Backup Verification & Disaster Recovery\",\"Help Desk & End-User Support\",\"Monthly Performance Reports & Optimization\"]",
                SortOrder = 2,
                IsActive = true,
                IsFeatured = true
            },
            new Service
            {
                Title = "Custom Development",
                ShortDescription = "Custom web applications, APIs, and automation tools.",
                FullDescription = "<p>We build custom software solutions tailored to your unique business requirements. From web applications and RESTful APIs to automation tools and integration platforms, our development team delivers high-quality, scalable solutions using modern technologies.</p>" +
                    "<p>Our development process follows agile methodologies with iterative sprints, continuous integration, and regular stakeholder reviews. We use industry-standard frameworks including .NET, React, Angular, and Python to build solutions that are maintainable, testable, and performant.</p>" +
                    "<p>Every project includes comprehensive documentation, automated testing, deployment pipelines, and post-launch support to ensure your investment delivers lasting value.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"16 18 22 12 16 6\"/><polyline points=\"8 6 2 12 8 18\"/></svg>",
                Slug = "custom-development",
                Category = "IT",
                Features = "[\"Full-Stack Web Application Development\",\"RESTful API Design & Integration\",\"Process Automation & Workflow Tools\",\"Legacy System Modernization\",\"CI/CD Pipelines & DevOps Setup\"]",
                SortOrder = 3,
                IsActive = true,
                IsFeatured = true
            },
            new Service
            {
                Title = "Planning",
                ShortDescription = "Strategic IT roadmaps aligned with business goals.",
                FullDescription = "<p>Our IT Planning services help organizations develop comprehensive technology strategies that align with business objectives. We assess your current infrastructure, identify gaps and opportunities, and create actionable roadmaps that deliver measurable ROI.</p>" +
                    "<p>We work with your leadership team to understand your business vision and translate it into a technology strategy that supports growth, efficiency, and competitive advantage. Our planning process covers infrastructure, applications, security, and cloud strategy.</p>" +
                    "<p>Each engagement produces a detailed technology roadmap with prioritized initiatives, budget estimates, resource requirements, and implementation timelines to guide your IT investments.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\"/><path d=\"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/></svg>",
                Slug = "planning",
                Category = "IT",
                Features = "[\"IT Infrastructure Assessment & Gap Analysis\",\"Technology Roadmap Development\",\"Cloud Strategy & Migration Planning\",\"Budget Forecasting & ROI Analysis\",\"Vendor Evaluation & Selection\"]",
                SortOrder = 4,
                IsActive = true,
                IsFeatured = true
            },

            // AI Services
            new Service
            {
                Title = "Generative AI",
                ShortDescription = "ChatGPT/LLM integration, AI-powered automation, content generation.",
                FullDescription = "<p>Harness the power of large language models and generative AI to transform your business operations. We help organizations integrate ChatGPT, GPT-4, and other cutting-edge LLMs into their workflows for content generation, customer service automation, and intelligent document processing.</p>" +
                    "<p>Our generative AI solutions include custom chatbot development, RAG (Retrieval Augmented Generation) systems, automated report generation, and AI-powered knowledge bases. We fine-tune models on your proprietary data to deliver accurate, contextually relevant outputs.</p>" +
                    "<p>We prioritize responsible AI deployment with built-in guardrails, content filtering, bias detection, and transparent model governance to ensure your AI solutions are safe, reliable, and aligned with your organizational values.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a2 2 0 1 1 0 4h-1.17A7 7 0 0 1 14 22h-4a7 7 0 0 1-5.83-4H3a2 2 0 1 1 0-4h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z\"/></svg>",
                Slug = "generative-ai",
                Category = "AI",
                Features = "[\"ChatGPT & LLM Integration\",\"RAG Systems & Knowledge Bases\",\"AI-Powered Content Generation\",\"Custom Chatbot Development\",\"Responsible AI Governance\"]",
                SortOrder = 5,
                IsActive = true,
                IsFeatured = true
            },
            new Service
            {
                Title = "Machine Learning",
                ShortDescription = "Predictive analytics, recommendation systems, anomaly detection.",
                FullDescription = "<p>Our machine learning services help businesses unlock hidden insights from their data and automate complex decision-making processes. We build and deploy production-ready ML models for predictive analytics, recommendation engines, anomaly detection, and demand forecasting.</p>" +
                    "<p>Our data scientists work with you to identify high-value use cases, prepare and engineer features from your data, train and validate models, and deploy them into production with monitoring and retraining pipelines. We specialize in supervised and unsupervised learning, time series forecasting, and ensemble methods.</p>" +
                    "<p>Every ML solution we deliver includes model interpretability dashboards, performance monitoring, automated retraining triggers, and comprehensive documentation to ensure your team can maintain and evolve the models over time.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"22 12 18 12 15 21 9 3 6 12 2 12\"/></svg>",
                Slug = "machine-learning",
                Category = "AI",
                Features = "[\"Predictive Analytics & Forecasting\",\"Recommendation Systems\",\"Anomaly Detection & Fraud Prevention\",\"Model Monitoring & Retraining Pipelines\",\"Feature Engineering & Data Preparation\"]",
                SortOrder = 6,
                IsActive = true,
                IsFeatured = true
            },
            new Service
            {
                Title = "Deep Learning",
                ShortDescription = "Neural networks, NLP, image/speech recognition.",
                FullDescription = "<p>Our deep learning team builds advanced neural network solutions for problems that require human-like perception and understanding. From natural language processing and sentiment analysis to image recognition and speech-to-text systems, we leverage state-of-the-art architectures to solve complex challenges.</p>" +
                    "<p>We work with transformer models, convolutional neural networks (CNNs), recurrent neural networks (RNNs), and generative adversarial networks (GANs) to build solutions that push the boundaries of what is possible with AI. Our team has experience deploying models on GPU clusters, edge devices, and cloud platforms.</p>" +
                    "<p>Our deep learning solutions include data augmentation strategies, transfer learning from pre-trained models, hyperparameter optimization, and model compression techniques to deliver the best possible performance within your infrastructure constraints.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/></svg>",
                Slug = "deep-learning",
                Category = "AI",
                Features = "[\"Natural Language Processing & Sentiment Analysis\",\"Image & Video Recognition\",\"Speech-to-Text & Text-to-Speech\",\"Transfer Learning & Model Fine-Tuning\",\"Edge Deployment & Model Optimization\"]",
                SortOrder = 7,
                IsActive = true,
                IsFeatured = true
            },
            new Service
            {
                Title = "Computer Vision",
                ShortDescription = "Object detection, image classification, video analytics, OCR.",
                FullDescription = "<p>Our computer vision solutions enable machines to understand and interpret visual information from the world around them. We build custom object detection, image classification, video analytics, and optical character recognition (OCR) systems that automate visual inspection and data extraction tasks.</p>" +
                    "<p>From quality control on manufacturing lines to document digitization and license plate recognition, our computer vision solutions deliver measurable efficiency gains. We use YOLO, ResNet, EfficientNet, and custom architectures tailored to your specific use case and data characteristics.</p>" +
                    "<p>Our end-to-end service covers data collection and annotation, model training and validation, edge deployment for real-time inference, and integration with your existing systems and workflows.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>",
                Slug = "computer-vision",
                Category = "AI",
                Features = "[\"Object Detection & Tracking\",\"Image Classification & Segmentation\",\"Video Analytics & Surveillance\",\"OCR & Document Digitization\",\"Real-Time Edge Inference\"]",
                SortOrder = 8,
                IsActive = true,
                IsFeatured = true
            },

            // Enablement Services
            new Service
            {
                Title = "AI Strategy",
                ShortDescription = "AI readiness assessment, governance frameworks, and roadmaps.",
                FullDescription = "<p>Our AI Strategy consulting helps organizations navigate the complex landscape of artificial intelligence adoption. We conduct comprehensive AI readiness assessments, identify high-value use cases, and develop governance frameworks that ensure responsible and effective AI deployment.</p>" +
                    "<p>We work with your executive team to create an AI roadmap that aligns with business objectives, addresses data infrastructure gaps, builds internal capabilities, and establishes clear metrics for measuring AI ROI. Our assessments cover data maturity, technical infrastructure, organizational readiness, and ethical considerations.</p>" +
                    "<p>Each engagement delivers a prioritized portfolio of AI initiatives with business cases, resource requirements, risk assessments, and implementation timelines to guide your organization's AI transformation journey.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"12 2 2 7 12 12 22 7 12 2\"/><polyline points=\"2 17 12 22 22 17\"/><polyline points=\"2 12 12 17 22 12\"/></svg>",
                Slug = "ai-strategy",
                Category = "Enablement",
                Features = "[\"AI Readiness Assessment\",\"Use Case Identification & Prioritization\",\"AI Governance Framework Design\",\"Data Strategy & Infrastructure Planning\",\"AI ROI Measurement Framework\"]",
                SortOrder = 9,
                IsActive = true,
                IsFeatured = false
            },
            new Service
            {
                Title = "Digital Transformation",
                ShortDescription = "End-to-end digital modernization and process automation.",
                FullDescription = "<p>Our Digital Transformation services guide organizations through comprehensive modernization of their technology stack, processes, and culture. We help you move from legacy systems to modern, cloud-native architectures while automating manual processes and improving operational efficiency.</p>" +
                    "<p>We take a holistic approach that covers process re-engineering, technology platform selection, change management, and workforce upskilling. Our methodology ensures minimal disruption to ongoing operations while delivering rapid, measurable improvements in productivity and customer experience.</p>" +
                    "<p>From paperless office initiatives to fully automated workflows, we design and implement digital solutions that reduce costs, accelerate decision-making, and position your organization for sustained growth in the digital economy.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 20V10\"/><path d=\"M12 20V4\"/><path d=\"M6 20v-6\"/></svg>",
                Slug = "digital-transformation",
                Category = "Enablement",
                Features = "[\"Process Re-Engineering & Automation\",\"Legacy System Modernization\",\"Cloud Migration & Optimization\",\"Change Management & Training\",\"Digital Maturity Assessment\"]",
                SortOrder = 10,
                IsActive = true,
                IsFeatured = false
            },
            new Service
            {
                Title = "AI Testing & QA",
                ShortDescription = "ML model validation, bias testing, performance benchmarking.",
                FullDescription = "<p>Our AI Testing and Quality Assurance services ensure your machine learning models are accurate, fair, robust, and production-ready. We provide comprehensive model validation, bias testing, adversarial testing, and performance benchmarking to build confidence in your AI systems.</p>" +
                    "<p>We test models across diverse datasets to identify edge cases, data drift, concept drift, and fairness issues before they impact your users. Our testing framework covers functional correctness, performance under load, security vulnerabilities, and regulatory compliance requirements.</p>" +
                    "<p>Every engagement produces detailed test reports with actionable recommendations, automated regression test suites, and monitoring dashboards to track model performance over time in production.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/></svg>",
                Slug = "ai-testing",
                Category = "Enablement",
                Features = "[\"Model Validation & Accuracy Testing\",\"Bias Detection & Fairness Auditing\",\"Adversarial Robustness Testing\",\"Performance Benchmarking & Load Testing\",\"Automated Regression Test Suites\"]",
                SortOrder = 11,
                IsActive = true,
                IsFeatured = false
            },
            new Service
            {
                Title = "IoT Solutions",
                ShortDescription = "Sensor integration, edge computing, real-time data streaming.",
                FullDescription = "<p>Our IoT Solutions connect your physical assets to intelligent digital systems, enabling real-time monitoring, predictive maintenance, and data-driven decision making. We design and deploy end-to-end IoT architectures from sensor selection to cloud analytics dashboards.</p>" +
                    "<p>We specialize in industrial IoT applications including equipment monitoring, environmental sensing, asset tracking, and smart building systems. Our solutions leverage edge computing for low-latency processing and cloud platforms for large-scale analytics and machine learning.</p>" +
                    "<p>Our team handles hardware selection, firmware development, connectivity protocols (MQTT, CoAP, LoRaWAN), data pipeline design, and visualization dashboard development to deliver complete, turnkey IoT solutions.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" ry=\"2\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\"/><line x1=\"9\" y1=\"1\" x2=\"9\" y2=\"4\"/><line x1=\"15\" y1=\"1\" x2=\"15\" y2=\"4\"/><line x1=\"9\" y1=\"20\" x2=\"9\" y2=\"23\"/><line x1=\"15\" y1=\"20\" x2=\"15\" y2=\"23\"/><line x1=\"20\" y1=\"9\" x2=\"23\" y2=\"9\"/><line x1=\"20\" y1=\"14\" x2=\"23\" y2=\"14\"/><line x1=\"1\" y1=\"9\" x2=\"4\" y2=\"9\"/><line x1=\"1\" y1=\"14\" x2=\"4\" y2=\"14\"/></svg>",
                Slug = "iot-solutions",
                Category = "Enablement",
                Features = "[\"Sensor Selection & Integration\",\"Edge Computing & Real-Time Processing\",\"Data Pipeline & Stream Processing\",\"IoT Platform Architecture\",\"Monitoring Dashboards & Alerting\"]",
                SortOrder = 12,
                IsActive = true,
                IsFeatured = false
            },
            new Service
            {
                Title = "Project Management",
                ShortDescription = "Agile/Scrum delivery, PMO setup, risk management.",
                FullDescription = "<p>Our Project Management services ensure your technology initiatives are delivered on time, within budget, and to specification. We provide experienced project managers who specialize in IT and AI projects, bringing both technical understanding and proven delivery methodologies.</p>" +
                    "<p>We offer Agile/Scrum coaching, PMO setup, program management for multi-project portfolios, and risk management consulting. Our PMs are certified (PMP, CSM, SAFe) and experienced in managing distributed teams, vendor relationships, and complex stakeholder landscapes.</p>" +
                    "<p>Whether you need a dedicated PM for a single project or want to establish a Project Management Office for your organization, we bring the processes, tools, and expertise to drive successful outcomes.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\" ry=\"1\"/></svg>",
                Slug = "project-management",
                Category = "Enablement",
                Features = "[\"Agile/Scrum Project Delivery\",\"PMO Setup & Governance\",\"Risk Management & Mitigation\",\"Stakeholder Communication & Reporting\",\"Vendor Management & Coordination\"]",
                SortOrder = 13,
                IsActive = true,
                IsFeatured = false
            },
            new Service
            {
                Title = "Product Management",
                ShortDescription = "Product strategy, roadmapping, user research, MVP development.",
                FullDescription = "<p>Our Product Management services help organizations build the right products for their market. We provide experienced product managers who bridge the gap between business strategy, user needs, and technical execution to deliver products that customers love.</p>" +
                    "<p>We offer product discovery workshops, user research and persona development, competitive analysis, feature prioritization frameworks, and roadmap development. Our product managers work embedded with your team to ensure continuous alignment between product vision and delivery.</p>" +
                    "<p>From MVP definition and validation to scaling and optimization, we guide your product through every stage of its lifecycle with data-driven decision making and customer-centric design thinking.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M16 12l-4-4-4 4\"/><path d=\"M12 16V8\"/></svg>",
                Slug = "product-management",
                Category = "Enablement",
                Features = "[\"Product Discovery & User Research\",\"Roadmap Development & Prioritization\",\"MVP Definition & Validation\",\"Competitive Analysis & Market Positioning\",\"Metrics-Driven Product Optimization\"]",
                SortOrder = 14,
                IsActive = true,
                IsFeatured = false
            },

            // Technology Solutions
            new Service
            {
                Title = "Robotics",
                ShortDescription = "RPA, industrial robotics integration, collaborative robots.",
                FullDescription = "<p>Our Robotics services span from software-based Robotic Process Automation (RPA) to physical industrial robotics integration. We help organizations automate repetitive tasks, streamline manufacturing processes, and deploy collaborative robots (cobots) that work alongside human operators.</p>" +
                    "<p>For RPA, we use platforms like UiPath, Power Automate, and custom Python automation to eliminate manual data entry, document processing, and system integration tasks. For physical robotics, we provide system integration, programming, and AI-powered vision systems for quality inspection and pick-and-place operations.</p>" +
                    "<p>Our team assesses your automation opportunities, designs the optimal robotic solution, handles implementation and testing, and provides ongoing maintenance and optimization to maximize your automation ROI.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"10\" rx=\"2\"/><circle cx=\"12\" cy=\"5\" r=\"2\"/><path d=\"M12 7v4\"/><line x1=\"8\" y1=\"16\" x2=\"8\" y2=\"16\"/><line x1=\"16\" y1=\"16\" x2=\"16\" y2=\"16\"/></svg>",
                Slug = "robotics",
                Category = "Technology",
                Features = "[\"Robotic Process Automation (RPA)\",\"Industrial Robot Integration\",\"Collaborative Robot (Cobot) Deployment\",\"AI-Powered Vision Systems\",\"Automation ROI Assessment\"]",
                SortOrder = 15,
                IsActive = true,
                IsFeatured = false
            },
            new Service
            {
                Title = "Digital Twin",
                ShortDescription = "Virtual replicas of physical assets, simulation, predictive analysis.",
                FullDescription = "<p>Our Digital Twin solutions create virtual replicas of your physical assets, processes, and systems, enabling real-time monitoring, simulation, and predictive analysis. By bridging the physical and digital worlds, digital twins help you optimize operations, predict failures, and test changes without risk.</p>" +
                    "<p>We build digital twins for manufacturing equipment, building systems, supply chains, and infrastructure assets. Our solutions ingest real-time sensor data, apply physics-based and data-driven models, and provide interactive 3D visualizations for operators and decision-makers.</p>" +
                    "<p>From concept to production, our team handles data integration, model development, visualization design, and deployment on cloud platforms like Azure Digital Twins, AWS IoT TwinMaker, or custom solutions.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"7\" width=\"8\" height=\"10\" rx=\"1\"/><rect x=\"14\" y=\"7\" width=\"8\" height=\"10\" rx=\"1\"/><path d=\"M10 12h4\"/></svg>",
                Slug = "digital-twin",
                Category = "Technology",
                Features = "[\"Real-Time Asset Monitoring\",\"Physics-Based Simulation Models\",\"Predictive Maintenance Analytics\",\"3D Visualization & Dashboards\",\"What-If Scenario Analysis\"]",
                SortOrder = 16,
                IsActive = true,
                IsFeatured = false
            },
            new Service
            {
                Title = "IoT Platform",
                ShortDescription = "Sensor networks, data ingestion, real-time dashboards.",
                FullDescription = "<p>Our IoT Platform services provide the foundational infrastructure for connecting, managing, and analyzing data from thousands of IoT devices. We design and deploy scalable platforms that handle device provisioning, data ingestion, stream processing, and real-time analytics.</p>" +
                    "<p>We build on proven platforms like Azure IoT Hub, AWS IoT Core, and open-source solutions like ThingsBoard and Eclipse IoT, selecting the best fit for your scale, budget, and technical requirements. Our platforms support millions of messages per second with reliable delivery guarantees.</p>" +
                    "<p>Each platform deployment includes device management portals, data pipeline orchestration, real-time dashboards, alerting systems, and API layers for integration with your existing enterprise applications.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12.55a11 11 0 0 1 14.08 0\"/><path d=\"M1.42 9a16 16 0 0 1 21.16 0\"/><path d=\"M8.53 16.11a6 6 0 0 1 6.95 0\"/><line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"20\"/></svg>",
                Slug = "iot-platform",
                Category = "Technology",
                Features = "[\"Device Provisioning & Management\",\"Scalable Data Ingestion Pipelines\",\"Real-Time Stream Processing\",\"Interactive Analytics Dashboards\",\"Enterprise API Integration Layer\"]",
                SortOrder = 17,
                IsActive = true,
                IsFeatured = false
            },
            new Service
            {
                Title = "Embedded Systems",
                ShortDescription = "Firmware development, RTOS, hardware-software integration.",
                FullDescription = "<p>Our Embedded Systems team designs and develops firmware, real-time operating system (RTOS) applications, and hardware-software integration solutions for IoT devices, industrial controllers, and specialized computing platforms.</p>" +
                    "<p>We work with ARM Cortex, ESP32, STM32, and other microcontroller families to build reliable, power-efficient embedded solutions. Our expertise spans bare-metal programming, FreeRTOS, Zephyr, and Linux-based embedded systems with connectivity stacks including BLE, Wi-Fi, LoRa, and cellular.</p>" +
                    "<p>From prototype to production, we provide schematic review, firmware development, testing and certification support, over-the-air (OTA) update systems, and long-term maintenance to ensure your embedded products perform reliably in the field.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" ry=\"2\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\"/><line x1=\"9\" y1=\"1\" x2=\"9\" y2=\"4\"/><line x1=\"15\" y1=\"1\" x2=\"15\" y2=\"4\"/><line x1=\"9\" y1=\"20\" x2=\"9\" y2=\"23\"/><line x1=\"15\" y1=\"20\" x2=\"15\" y2=\"23\"/><line x1=\"20\" y1=\"9\" x2=\"23\" y2=\"9\"/><line x1=\"20\" y1=\"14\" x2=\"23\" y2=\"14\"/><line x1=\"1\" y1=\"9\" x2=\"4\" y2=\"9\"/><line x1=\"1\" y1=\"14\" x2=\"4\" y2=\"14\"/></svg>",
                Slug = "embedded-systems",
                Category = "Technology",
                Features = "[\"Firmware Development & RTOS\",\"Hardware-Software Integration\",\"Connectivity Stacks (BLE, Wi-Fi, LoRa)\",\"Over-the-Air (OTA) Update Systems\",\"Power Optimization & Battery Management\"]",
                SortOrder = 18,
                IsActive = true,
                IsFeatured = false
            }
        };

        context.Services.AddRange(services);
        await context.SaveChangesAsync();
    }

    private static async Task SeedTestimonialsAsync(ApplicationDbContext context)
    {
        if (await context.Testimonials.AnyAsync()) return;

        context.Testimonials.AddRange(
            new Testimonial
            {
                AuthorName = "Ben Clark",
                AuthorTitle = "Director of Operations",
                Company = "TechCorp Inc.",
                Initials = "BC",
                Rating = 5,
                Quote = "Soham Yoga transformed our outdated intranet into a modern SharePoint platform that our employees actually enjoy using. Collaboration has increased by 40% and we have saved countless hours on document management. Their team was professional, responsive, and delivered on time.",
                SortOrder = 1,
                IsActive = true
            },
            new Testimonial
            {
                AuthorName = "Sarah Mitchell",
                AuthorTitle = "CEO",
                Company = "Northern Analytics",
                Initials = "SM",
                Rating = 5,
                Quote = "Their managed services team has been incredible. Since partnering with Soham Yoga, we have had zero unplanned downtime. Their 24/7 monitoring caught and resolved issues before we even knew they existed. It is like having a world-class IT department without the overhead.",
                SortOrder = 2,
                IsActive = true
            },
            new Testimonial
            {
                AuthorName = "James Rodriguez",
                AuthorTitle = "VP of Technology",
                Company = "Summit Logistics",
                Initials = "JR",
                Rating = 5,
                Quote = "The custom application SLP built for our inventory management has been a game-changer. We reduced manual data entry by 80% and improved order accuracy to 99.5%. Their developers understood our business needs and translated them into an elegant, user-friendly solution.",
                SortOrder = 3,
                IsActive = true
            }
        );

        await context.SaveChangesAsync();
    }

    private static async Task SeedCaseStudiesAsync(ApplicationDbContext context)
    {
        if (await context.CaseStudies.AnyAsync()) return;

        context.CaseStudies.AddRange(
            new CaseStudy
            {
                Title = "Enterprise Intranet",
                Description = "Modernized a legacy intranet for a 2,000-employee organization using SharePoint Online, improving collaboration and reducing document search time by 60%.",
                FullContent = "<h3>Challenge</h3><p>A large enterprise with 2,000 employees was struggling with an outdated intranet built on SharePoint 2010. Employees could not find documents, collaboration was fragmented across email and file shares, and the system was costly to maintain.</p>" +
                    "<h3>Solution</h3><p>Soham Yoga designed and implemented a modern SharePoint Online intranet with department hubs, a unified search experience, automated document lifecycle management, and Power Automate workflows for common business processes.</p>" +
                    "<h3>Results</h3><ul><li>60% reduction in document search time</li><li>40% increase in cross-department collaboration</li><li>$150,000 annual savings in infrastructure costs</li><li>95% employee satisfaction rating after 6 months</li></ul>",
                Tag = "SharePoint",
                GradientFrom = "#1a5276",
                GradientTo = "#2980b9",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><line x1=\"8.59\" y1=\"13.51\" x2=\"15.42\" y2=\"17.49\"/><line x1=\"15.41\" y1=\"6.51\" x2=\"8.59\" y2=\"10.49\"/></svg>",
                Slug = "enterprise-intranet",
                SortOrder = 1,
                IsActive = true
            },
            new CaseStudy
            {
                Title = "24/7 IT Monitoring",
                Description = "Implemented comprehensive 24/7 monitoring and managed services for a mid-sized company, achieving 99.99% uptime and reducing IT incidents by 75%.",
                FullContent = "<h3>Challenge</h3><p>A growing mid-sized company was experiencing frequent unplanned downtime, slow incident response, and lacked visibility into their IT infrastructure health. Their small internal IT team was overwhelmed with reactive firefighting.</p>" +
                    "<h3>Solution</h3><p>Soham Yoga deployed a comprehensive monitoring solution covering servers, network equipment, applications, and security systems. We established a 24/7 NOC with proactive alerting, automated remediation for common issues, and escalation procedures for critical incidents.</p>" +
                    "<h3>Results</h3><ul><li>99.99% uptime achieved in the first year</li><li>75% reduction in IT incidents</li><li>Mean time to resolution reduced from 4 hours to 15 minutes</li><li>Internal IT team freed to focus on strategic projects</li></ul>",
                Tag = "Managed Services",
                GradientFrom = "#1c2833",
                GradientTo = "#34495e",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\" ry=\"2\"/><line x1=\"8\" y1=\"21\" x2=\"16\" y2=\"21\"/><line x1=\"12\" y1=\"17\" x2=\"12\" y2=\"21\"/></svg>",
                Slug = "it-monitoring",
                SortOrder = 2,
                IsActive = true
            },
            new CaseStudy
            {
                Title = "Inventory Management App",
                Description = "Built a custom inventory management application that reduced manual data entry by 80% and improved order accuracy to 99.5% for a logistics company.",
                FullContent = "<h3>Challenge</h3><p>A logistics company was managing inventory across three warehouses using spreadsheets and manual processes. Order errors were running at 5%, stock discrepancies were common, and the operations team spent hours each day on data entry.</p>" +
                    "<h3>Solution</h3><p>Soham Yoga developed a custom web application with barcode scanning, real-time inventory tracking, automated reorder triggers, and integration with the client's accounting and shipping systems. The solution included mobile apps for warehouse staff and management dashboards.</p>" +
                    "<h3>Results</h3><ul><li>80% reduction in manual data entry</li><li>Order accuracy improved from 95% to 99.5%</li><li>Real-time visibility across all three warehouses</li><li>ROI achieved within 8 months of deployment</li></ul>",
                Tag = "Custom Development",
                GradientFrom = "#0d3b66",
                GradientTo = "#1a5276",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"16 18 22 12 16 6\"/><polyline points=\"8 6 2 12 8 18\"/></svg>",
                Slug = "inventory-management",
                SortOrder = 3,
                IsActive = true
            },
            new CaseStudy
            {
                Title = "IT Roadmap & Strategy",
                Description = "Developed a 3-year IT roadmap for a growing company, aligning technology investments with business goals and reducing IT spend by 25%.",
                FullContent = "<h3>Challenge</h3><p>A rapidly growing company had accumulated technical debt from years of ad-hoc IT decisions. They had duplicate systems, underutilized licenses, no disaster recovery plan, and no clear technology direction aligned with their business strategy.</p>" +
                    "<h3>Solution</h3><p>Soham Yoga conducted a comprehensive IT assessment covering infrastructure, applications, security, and governance. We facilitated stakeholder workshops, benchmarked against industry peers, and developed a prioritized 3-year roadmap with quarterly milestones and budget projections.</p>" +
                    "<h3>Results</h3><ul><li>25% reduction in annual IT spend through license consolidation</li><li>Clear 3-year technology roadmap with quarterly milestones</li><li>Disaster recovery plan implemented within first quarter</li><li>Board-approved technology budget with measurable KPIs</li></ul>",
                Tag = "Planning",
                GradientFrom = "#2c3e50",
                GradientTo = "#3498db",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\"/><path d=\"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/></svg>",
                Slug = "it-roadmap",
                SortOrder = 4,
                IsActive = true
            },
            new CaseStudy
            {
                Title = "Cloud Migration",
                Description = "Migrated a company's on-premises infrastructure to Azure, reducing hosting costs by 40% and improving disaster recovery capabilities.",
                FullContent = "<h3>Challenge</h3><p>A company was running aging on-premises servers with limited redundancy, no automated backups, and escalating hardware maintenance costs. Their infrastructure could not scale to meet growing business demands, and a recent near-miss data loss event highlighted the urgency of modernization.</p>" +
                    "<h3>Solution</h3><p>Soham Yoga designed and executed a phased migration to Microsoft Azure, including virtual machines, Azure SQL databases, blob storage, and Azure Active Directory. We implemented automated backups, geo-redundant storage, and a comprehensive disaster recovery plan with sub-4-hour RTO.</p>" +
                    "<h3>Results</h3><ul><li>40% reduction in hosting and infrastructure costs</li><li>Disaster recovery RTO reduced from 48 hours to under 4 hours</li><li>Auto-scaling enabled to handle peak workloads</li><li>Zero data loss during migration with minimal downtime</li></ul>",
                Tag = "Managed Services",
                GradientFrom = "#154360",
                GradientTo = "#1f618d",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z\"/></svg>",
                Slug = "cloud-migration",
                SortOrder = 5,
                IsActive = true
            },
            new CaseStudy
            {
                Title = "Process Automation",
                Description = "Automated manual business processes for a financial services company, saving 2,000+ hours annually and eliminating data entry errors.",
                FullContent = "<h3>Challenge</h3><p>A financial services company had numerous manual processes involving data entry across multiple systems, document generation, compliance reporting, and client onboarding. Staff were spending over 40 hours per week on repetitive tasks that were error-prone and time-consuming.</p>" +
                    "<h3>Solution</h3><p>Soham Yoga implemented a comprehensive automation solution using Power Automate, custom APIs, and a centralized integration platform. We automated client onboarding workflows, compliance report generation, cross-system data synchronization, and document processing with intelligent OCR.</p>" +
                    "<h3>Results</h3><ul><li>2,000+ hours saved annually across the organization</li><li>Data entry errors reduced to near zero</li><li>Client onboarding time reduced from 5 days to 4 hours</li><li>Compliance reporting automated with audit trails</li></ul>",
                Tag = "Custom Development",
                GradientFrom = "#1a2a3a",
                GradientTo = "#2c3e50",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"16 18 22 12 16 6\"/><polyline points=\"8 6 2 12 8 18\"/></svg>",
                Slug = "process-automation",
                SortOrder = 6,
                IsActive = true
            }
        );

        await context.SaveChangesAsync();
    }

    private static async Task SeedIndustrySolutionsAsync(ApplicationDbContext context)
    {
        if (await context.IndustrySolutions.AnyAsync()) return;

        context.IndustrySolutions.AddRange(
            new IndustrySolution
            {
                Title = "Banking & Finance",
                ShortDescription = "Fraud detection, risk analytics, regulatory compliance, digital banking.",
                FullDescription = "<p>Soham Yoga delivers cutting-edge AI and technology solutions for the banking and financial services industry. Our solutions help financial institutions detect fraud in real-time, assess risk more accurately, automate compliance reporting, and deliver modern digital banking experiences to their customers.</p>" +
                    "<p>We understand the unique regulatory landscape of Canadian financial services, including OSFI guidelines, PIPEDA requirements, and anti-money laundering (AML) regulations. Our solutions are designed with compliance, security, and auditability at their core.</p>" +
                    "<p>From community banks to large financial institutions, we help organizations leverage AI and automation to reduce costs, improve customer experience, and stay ahead of evolving regulatory requirements.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"1\" x2=\"12\" y2=\"23\"/><path d=\"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\"/></svg>",
                Slug = "banking-finance",
                Challenges = "[\"Rising fraud losses and increasingly sophisticated attack vectors\",\"Complex regulatory compliance requirements (OSFI, AML, PIPEDA)\",\"Legacy core banking systems limiting digital innovation\",\"Customer expectations for seamless digital banking experiences\"]",
                Solutions = "[\"Real-time fraud detection using machine learning and behavioral analytics\",\"Automated regulatory reporting and compliance monitoring systems\",\"API-driven modernization layers for legacy core banking integration\",\"AI-powered chatbots and personalized digital banking platforms\"]",
                SortOrder = 1,
                IsActive = true
            },
            new IndustrySolution
            {
                Title = "Oil & Gas",
                ShortDescription = "Predictive maintenance, pipeline monitoring, reservoir analytics.",
                FullDescription = "<p>Soham Yoga provides AI-powered solutions for the oil and gas industry, helping operators optimize production, reduce downtime, and improve safety across upstream, midstream, and downstream operations. Our solutions leverage sensor data, satellite imagery, and advanced analytics to deliver actionable insights.</p>" +
                    "<p>We specialize in predictive maintenance for drilling equipment and compressors, pipeline integrity monitoring using computer vision and IoT sensors, reservoir simulation enhanced with machine learning, and production optimization using real-time data analytics.</p>" +
                    "<p>With deep experience serving Calgary-based energy companies, we understand the unique challenges of operating in Western Canada, including harsh environmental conditions, regulatory requirements, and the need for cost-efficient operations in volatile commodity markets.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/></svg>",
                Slug = "oil-gas",
                Challenges = "[\"Unplanned equipment downtime costing millions per incident\",\"Pipeline integrity risks across vast remote networks\",\"Reservoir performance uncertainty and production decline\",\"Environmental compliance and emissions monitoring requirements\"]",
                Solutions = "[\"Predictive maintenance models for critical equipment with 95% accuracy\",\"Computer vision and IoT-based pipeline monitoring and leak detection\",\"ML-enhanced reservoir simulation for optimized production strategies\",\"Automated emissions monitoring and environmental compliance reporting\"]",
                SortOrder = 2,
                IsActive = true
            },
            new IndustrySolution
            {
                Title = "Public Sector",
                ShortDescription = "Citizen services, document automation, data governance.",
                FullDescription = "<p>Soham Yoga helps government agencies and public sector organizations modernize citizen services, automate document-intensive processes, and establish robust data governance frameworks. Our solutions improve service delivery, reduce processing times, and enhance transparency while meeting strict security and accessibility requirements.</p>" +
                    "<p>We specialize in digital service delivery platforms, intelligent document processing for permits and applications, open data portals, and AI-assisted decision support systems. Our solutions comply with Government of Canada accessibility standards (WCAG 2.1 AA) and security requirements.</p>" +
                    "<p>From municipal governments to provincial agencies, we help public sector organizations deliver better outcomes for citizens while optimizing operational costs and maintaining public trust through transparent, auditable processes.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 21h18\"/><path d=\"M5 21V7l7-4 7 4v14\"/><path d=\"M9 21v-6h6v6\"/></svg>",
                Slug = "public-sector",
                Challenges = "[\"Long processing times for citizen applications and permits\",\"Paper-heavy processes and manual document handling\",\"Data silos across departments preventing holistic service delivery\",\"Strict accessibility, security, and bilingual requirements\"]",
                Solutions = "[\"Digital self-service portals for citizen applications and payments\",\"AI-powered document processing and automated workflow routing\",\"Unified data platforms with cross-department data sharing governance\",\"WCAG 2.1 AA compliant, bilingual, security-hardened solutions\"]",
                SortOrder = 3,
                IsActive = true
            },
            new IndustrySolution
            {
                Title = "Transportation",
                ShortDescription = "Fleet management, route optimization, real-time tracking.",
                FullDescription = "<p>Soham Yoga delivers AI and IoT solutions for the transportation and logistics industry, helping companies optimize fleet operations, reduce fuel costs, improve delivery reliability, and enhance driver safety. Our solutions process real-time data from vehicles, warehouses, and supply chain partners to enable smarter decisions.</p>" +
                    "<p>We specialize in fleet management platforms with real-time GPS tracking, AI-powered route optimization that considers traffic, weather, and delivery windows, predictive maintenance for vehicles, and automated dispatch systems that maximize fleet utilization.</p>" +
                    "<p>Our solutions integrate with existing TMS (Transportation Management Systems), ELD (Electronic Logging Devices), and warehouse management systems to provide end-to-end visibility across your logistics operations.</p>",
                IconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"1\" y=\"3\" width=\"15\" height=\"13\"/><polygon points=\"16 8 20 8 23 11 23 16 16 16 16 8\"/><circle cx=\"5.5\" cy=\"18.5\" r=\"2.5\"/><circle cx=\"18.5\" cy=\"18.5\" r=\"2.5\"/></svg>",
                Slug = "transportation",
                Challenges = "[\"Rising fuel costs and inefficient routing across large fleets\",\"Lack of real-time visibility into vehicle location and status\",\"Unplanned vehicle downtime from reactive maintenance\",\"Driver safety compliance and hours-of-service management\"]",
                Solutions = "[\"AI-powered route optimization reducing fuel costs by up to 20%\",\"Real-time GPS fleet tracking with geofencing and alerting\",\"Predictive maintenance models extending vehicle lifespan\",\"Automated ELD compliance and driver safety monitoring systems\"]",
                SortOrder = 4,
                IsActive = true
            }
        );

        await context.SaveChangesAsync();
    }

    private static async Task SeedTeamMembersAsync(ApplicationDbContext context)
    {
        if (await context.TeamMembers.AnyAsync()) return;

        context.TeamMembers.AddRange(
            new TeamMember
            {
                Name = "Rajesh Kumar",
                Title = "AI Enterprise Architect",
                Bio = "15+ years of experience in enterprise AI architecture, specializing in designing scalable machine learning platforms and AI governance frameworks for Fortune 500 companies. Rajesh has led AI transformation initiatives across banking, energy, and healthcare sectors, delivering production ML systems that process millions of predictions daily. He holds a Master's in Computer Science from the University of Toronto and multiple AWS and Azure AI certifications.",
                SortOrder = 1,
                IsActive = true
            },
            new TeamMember
            {
                Name = "Sarah Chen",
                Title = "Solution Architect",
                Bio = "Expert in designing scalable cloud-native solutions with deep expertise in Microsoft Azure, .NET, and modern web architectures. Sarah has architected enterprise platforms for organizations ranging from startups to large government agencies, with a focus on high availability, security, and performance. She brings 12 years of experience and is a Microsoft Certified Azure Solutions Architect Expert.",
                SortOrder = 2,
                IsActive = true
            },
            new TeamMember
            {
                Name = "Michael Torres",
                Title = "Test Architect",
                Bio = "Specializes in AI/ML model testing and quality assurance, with expertise in building comprehensive test frameworks for machine learning pipelines. Michael has developed automated testing strategies for computer vision, NLP, and predictive analytics systems, ensuring models meet accuracy, fairness, and performance requirements before production deployment. He has 10 years of experience in software quality engineering.",
                SortOrder = 3,
                IsActive = true
            },
            new TeamMember
            {
                Name = "Priya Sharma",
                Title = "DevOps Architect",
                Bio = "CI/CD pipelines, infrastructure as code, and cloud automation expert. Priya designs and implements DevOps practices that enable teams to deliver software faster and more reliably. She has built MLOps platforms for AI teams, Kubernetes-based deployment architectures, and automated infrastructure provisioning using Terraform and Pulumi. Priya holds AWS DevOps Professional and Kubernetes Administrator certifications.",
                SortOrder = 4,
                IsActive = true
            }
        );

        await context.SaveChangesAsync();
    }

    private static async Task SeedVideoDemosAsync(ApplicationDbContext context)
    {
        if (await context.VideoDemos.AnyAsync()) return;

        context.VideoDemos.AddRange(
            new VideoDemo
            {
                Title = "AI-Powered Document Processing",
                Description = "Watch how our AI solution automatically extracts, classifies, and processes documents with 98% accuracy. This demo shows intelligent OCR, named entity recognition, and automated data entry for invoices, contracts, and forms.",
                VideoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ",
                Duration = "4:32",
                Category = "AI Demo",
                SortOrder = 1,
                IsActive = true
            },
            new VideoDemo
            {
                Title = "Soham Yoga Platform Overview",
                Description = "A comprehensive tour of the Soham Yoga platform showing our service dashboard, project management tools, real-time monitoring, and client portal. See how we manage IT infrastructure and AI projects for our clients.",
                VideoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ",
                Duration = "6:15",
                Category = "Product Tour",
                SortOrder = 2,
                IsActive = true
            },
            new VideoDemo
            {
                Title = "Machine Learning Pipeline Tutorial",
                Description = "Step-by-step tutorial on building a production machine learning pipeline from data ingestion to model deployment. Covers feature engineering, model training, validation, and monitoring using our MLOps framework.",
                VideoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ",
                Duration = "12:45",
                Category = "Tutorial",
                SortOrder = 3,
                IsActive = true
            },
            new VideoDemo
            {
                Title = "Computer Vision for Quality Control",
                Description = "See our computer vision system in action detecting defects on a manufacturing line with real-time inference. The demo showcases object detection, defect classification, and automated alerting with 99.2% accuracy.",
                VideoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ",
                Duration = "5:20",
                Category = "AI Demo",
                SortOrder = 4,
                IsActive = true
            }
        );

        await context.SaveChangesAsync();
    }

    private static async Task SeedBlogPostsAsync(ApplicationDbContext context)
    {
        if (await context.BlogPosts.AnyAsync()) return;

        var categories = await context.BlogCategories.ToListAsync();
        var aiCategory = categories.First(c => c.Slug == "artificial-intelligence");
        var mlCategory = categories.First(c => c.Slug == "machine-learning");
        var dtCategory = categories.First(c => c.Slug == "digital-transformation");
        var techCategory = categories.First(c => c.Slug == "technology-trends");

        var blogPosts = new List<BlogPost>
        {
            new BlogPost
            {
                Title = "How Generative AI is Transforming Enterprise Software",
                Slug = "how-generative-ai-is-transforming-enterprise-software",
                Summary = "Generative AI is reshaping how enterprises build and interact with software. From automated code generation to intelligent document processing, discover how organizations are leveraging LLMs to accelerate innovation and reduce costs.",
                Content = "<h3>The Rise of Generative AI in the Enterprise</h3>" +
                    "<p>Generative AI has moved beyond the hype cycle and is now delivering real value in enterprise software development and operations. Organizations across industries are integrating large language models (LLMs) into their workflows to automate content creation, enhance customer interactions, and accelerate software development cycles.</p>" +
                    "<h3>Key Use Cases Driving Adoption</h3>" +
                    "<p>The most impactful enterprise applications of generative AI include intelligent document processing, where AI extracts and summarizes information from contracts and reports; code generation assistants that help developers write, test, and debug code faster; and AI-powered customer service chatbots that resolve queries with human-like understanding.</p>" +
                    "<ul><li>Automated code review and generation reducing development time by 30-40%</li><li>Intelligent document processing eliminating manual data entry</li><li>AI-powered knowledge bases providing instant answers from corporate data</li><li>Personalized content generation for marketing and communications</li></ul>" +
                    "<h3>Implementation Best Practices</h3>" +
                    "<p>Successful generative AI adoption requires a strategic approach. Start with clearly defined use cases that have measurable ROI, invest in data quality and governance, implement robust guardrails and content filtering, and build internal expertise through training and upskilling programs. Organizations that take a phased approach see the highest returns on their AI investments.</p>",
                CategoryId = aiCategory.Id,
                AuthorName = "Rajesh Kumar",
                Tags = "generative-ai,enterprise,llm",
                IsPublished = true,
                PublishedAt = new DateTime(2025, 12, 15, 9, 0, 0, DateTimeKind.Utc),
                ViewCount = 342,
                MetaTitle = "How Generative AI is Transforming Enterprise Software | Soham Yoga",
                MetaDescription = "Discover how enterprises are leveraging generative AI and LLMs to transform software development, customer service, and business operations."
            },
            new BlogPost
            {
                Title = "Machine Learning in Banking: Fraud Detection & Beyond",
                Slug = "machine-learning-in-banking-fraud-detection-and-beyond",
                Summary = "Banks are deploying machine learning models that detect fraudulent transactions in milliseconds, saving millions annually. Learn how ML is revolutionizing fraud detection, credit scoring, and customer analytics in financial services.",
                Content = "<h3>The ML Revolution in Banking</h3>" +
                    "<p>The banking industry has been one of the earliest and most aggressive adopters of machine learning technology. With billions of transactions processed daily, banks need automated systems that can detect fraudulent activity in real-time while minimizing false positives that frustrate legitimate customers.</p>" +
                    "<h3>Fraud Detection at Scale</h3>" +
                    "<p>Modern ML-based fraud detection systems analyze hundreds of features per transaction, including spending patterns, geographic data, device fingerprints, and behavioral biometrics. These models operate in milliseconds, scoring every transaction before it is approved and adapting continuously to new fraud patterns through online learning.</p>" +
                    "<ul><li>Real-time transaction scoring with sub-100ms latency</li><li>Behavioral biometrics detecting account takeover attempts</li><li>Network analysis identifying organized fraud rings</li><li>Adaptive models that learn new fraud patterns automatically</li></ul>" +
                    "<h3>Beyond Fraud: ML Across Banking</h3>" +
                    "<p>Machine learning applications in banking extend far beyond fraud detection. Leading institutions are using ML for credit risk assessment, customer churn prediction, personalized product recommendations, anti-money laundering compliance, and algorithmic trading. The banks that invest in ML capabilities today are building sustainable competitive advantages for the future.</p>",
                CategoryId = mlCategory.Id,
                AuthorName = "Sarah Chen",
                Tags = "banking,fraud-detection,ml",
                IsPublished = true,
                PublishedAt = new DateTime(2025, 12, 22, 10, 30, 0, DateTimeKind.Utc),
                ViewCount = 287,
                MetaTitle = "Machine Learning in Banking: Fraud Detection & Beyond | Soham Yoga",
                MetaDescription = "Learn how machine learning is transforming banking with real-time fraud detection, credit scoring, and customer analytics."
            },
            new BlogPost
            {
                Title = "Computer Vision for Oil & Gas Pipeline Inspection",
                Slug = "computer-vision-for-oil-gas-pipeline-inspection",
                Summary = "AI-powered computer vision is transforming pipeline inspection in the oil and gas industry. Drones equipped with vision models can detect corrosion, leaks, and structural defects faster and more safely than traditional methods.",
                Content = "<h3>Modernizing Pipeline Inspection</h3>" +
                    "<p>Pipeline inspection in the oil and gas industry has traditionally relied on manual visual inspections and scheduled maintenance, which are expensive, time-consuming, and potentially dangerous. Computer vision combined with drone technology is creating a paradigm shift, enabling automated inspection of thousands of kilometers of pipeline with unprecedented speed and accuracy.</p>" +
                    "<h3>How AI Vision Systems Work</h3>" +
                    "<p>Modern pipeline inspection systems use drones equipped with high-resolution cameras and thermal imaging sensors. Computer vision models trained on thousands of labeled images can detect corrosion, coating damage, vegetation encroachment, ground movement, and potential leak indicators. These models process images in real-time, flagging areas of concern for human review.</p>" +
                    "<ul><li>Automated corrosion detection with 95% accuracy</li><li>Thermal anomaly identification for early leak detection</li><li>3D terrain mapping for ground movement monitoring</li><li>Historical comparison for change detection over time</li></ul>" +
                    "<h3>Operational Impact</h3>" +
                    "<p>Companies deploying AI-powered inspection systems report 60% reduction in inspection costs, 80% faster survey completion, and earlier detection of integrity issues that prevent costly failures. As regulations tighten and ESG expectations grow, computer vision inspection is becoming a critical capability for responsible pipeline operators.</p>",
                CategoryId = aiCategory.Id,
                AuthorName = "Michael Torres",
                Tags = "computer-vision,oil-gas,inspection",
                IsPublished = true,
                PublishedAt = new DateTime(2026, 1, 5, 8, 0, 0, DateTimeKind.Utc),
                ViewCount = 198,
                MetaTitle = "Computer Vision for Oil & Gas Pipeline Inspection | Soham Yoga",
                MetaDescription = "Discover how AI-powered computer vision and drones are transforming pipeline inspection in the oil and gas industry."
            },
            new BlogPost
            {
                Title = "Deep Learning vs Machine Learning: A Business Guide",
                Slug = "deep-learning-vs-machine-learning-a-business-guide",
                Summary = "Understanding the difference between deep learning and traditional machine learning is crucial for making the right technology investments. This guide breaks down when to use each approach for maximum business impact.",
                Content = "<h3>Understanding the Difference</h3>" +
                    "<p>Machine learning and deep learning are related but distinct approaches to artificial intelligence. Machine learning uses algorithms that learn patterns from structured data with human-engineered features, while deep learning uses neural networks with multiple layers that automatically discover representations from raw data. Choosing the right approach depends on your data, problem complexity, and resource constraints.</p>" +
                    "<h3>When to Use Traditional ML</h3>" +
                    "<p>Traditional machine learning excels when you have structured, tabular data, relatively small datasets, and need interpretable models. Algorithms like gradient boosting, random forests, and logistic regression are powerful, efficient, and well-understood. For problems like credit scoring, demand forecasting, and customer segmentation, traditional ML often outperforms deep learning while being faster to develop and easier to maintain.</p>" +
                    "<ul><li>Structured data with well-defined features: Traditional ML</li><li>Small to medium datasets (thousands to millions of rows): Traditional ML</li><li>Unstructured data (images, text, audio): Deep Learning</li><li>Very large datasets with complex patterns: Deep Learning</li></ul>" +
                    "<h3>Making the Right Choice</h3>" +
                    "<p>The best approach for your organization depends on your specific use case, data availability, and technical capabilities. Many successful AI strategies combine both traditional ML and deep learning, using the right tool for each problem. We recommend starting with simpler models and only moving to deep learning when the data and problem complexity warrant it.</p>",
                CategoryId = mlCategory.Id,
                AuthorName = "Rajesh Kumar",
                Tags = "deep-learning,machine-learning,guide",
                IsPublished = true,
                PublishedAt = new DateTime(2026, 1, 12, 11, 0, 0, DateTimeKind.Utc),
                ViewCount = 456,
                MetaTitle = "Deep Learning vs Machine Learning: A Business Guide | Soham Yoga",
                MetaDescription = "A practical guide for business leaders on when to use deep learning vs traditional machine learning for maximum ROI."
            },
            new BlogPost
            {
                Title = "AI Strategy: Building Your Organization's AI Roadmap",
                Slug = "ai-strategy-building-your-organizations-ai-roadmap",
                Summary = "A well-defined AI strategy is the foundation for successful AI adoption. Learn the key steps to assess AI readiness, identify high-value use cases, and build a practical roadmap that delivers measurable results.",
                Content = "<h3>Why AI Strategy Matters</h3>" +
                    "<p>Organizations that approach AI with a clear strategy are three times more likely to achieve positive ROI compared to those that adopt AI in an ad-hoc manner. An AI strategy aligns technology investments with business objectives, ensures resources are focused on high-impact use cases, and establishes the governance framework needed for responsible AI deployment.</p>" +
                    "<h3>The Five Pillars of AI Readiness</h3>" +
                    "<p>Before investing in AI solutions, organizations must assess their readiness across five key dimensions: data maturity (is your data accessible, clean, and governed?), technical infrastructure (do you have the compute and tooling?), talent and skills (do you have or can you hire the right people?), organizational culture (is leadership committed and the workforce prepared?), and governance (do you have ethical guidelines and compliance frameworks?).</p>" +
                    "<ul><li>Data Maturity: Inventory, quality assessment, and governance framework</li><li>Technical Infrastructure: Cloud, compute, MLOps tooling evaluation</li><li>Talent: Skills gap analysis and upskilling roadmap</li><li>Culture: Change management and executive sponsorship plan</li><li>Governance: Ethics guidelines, bias testing, compliance framework</li></ul>" +
                    "<h3>Building Your Roadmap</h3>" +
                    "<p>A practical AI roadmap prioritizes use cases based on business impact and feasibility, defines success metrics before starting projects, establishes a center of excellence to build institutional knowledge, and includes feedback loops for continuous improvement. Start with quick wins that demonstrate value, then scale successful patterns across the organization.</p>",
                CategoryId = dtCategory.Id,
                AuthorName = "Priya Sharma",
                Tags = "ai-strategy,roadmap,enterprise",
                IsPublished = true,
                PublishedAt = new DateTime(2026, 1, 20, 9, 30, 0, DateTimeKind.Utc),
                ViewCount = 389,
                MetaTitle = "AI Strategy: Building Your Organization's AI Roadmap | Soham Yoga",
                MetaDescription = "Learn how to build a practical AI strategy and roadmap that delivers measurable business results."
            },
            new BlogPost
            {
                Title = "IoT and AI: The Power of Edge Computing",
                Slug = "iot-and-ai-the-power-of-edge-computing",
                Summary = "Edge computing brings AI processing closer to IoT devices, enabling real-time decisions without cloud latency. Explore how edge AI is transforming manufacturing, energy, and smart city applications.",
                Content = "<h3>Why Edge Computing Matters for AI</h3>" +
                    "<p>As IoT deployments scale to millions of connected devices, sending all data to the cloud for AI processing becomes impractical. Edge computing solves this by running AI models directly on or near the devices that generate data, enabling real-time inference with sub-millisecond latency, reduced bandwidth costs, and operation even when cloud connectivity is unavailable.</p>" +
                    "<h3>Edge AI Use Cases</h3>" +
                    "<p>Edge AI is delivering transformative results across industries. In manufacturing, vision models running on edge devices detect defects on production lines at speeds no human inspector can match. In energy, edge AI monitors grid equipment and predicts failures before they cause outages. In smart cities, edge computing processes traffic camera feeds locally to optimize signal timing without sending video to the cloud.</p>" +
                    "<ul><li>Manufacturing: Real-time quality inspection at 1,000+ parts per minute</li><li>Energy: Predictive maintenance on remote equipment without connectivity</li><li>Smart Cities: Local traffic optimization preserving citizen privacy</li><li>Healthcare: On-device patient monitoring with instant alerting</li></ul>" +
                    "<h3>Implementing Edge AI</h3>" +
                    "<p>Successful edge AI deployment requires careful model optimization to fit hardware constraints. Techniques like model quantization, pruning, and knowledge distillation can shrink models by 10-100x while maintaining accuracy. Hardware selection (NVIDIA Jetson, Intel NUC, custom FPGA) must match your latency, power, and cost requirements. A robust OTA update system ensures models stay current in the field.</p>",
                CategoryId = techCategory.Id,
                AuthorName = "Rajesh Kumar",
                Tags = "iot,edge-computing,ai",
                IsPublished = true,
                PublishedAt = new DateTime(2026, 1, 28, 10, 0, 0, DateTimeKind.Utc),
                ViewCount = 234,
                MetaTitle = "IoT and AI: The Power of Edge Computing | Soham Yoga",
                MetaDescription = "Explore how edge computing brings AI to IoT devices for real-time decisions in manufacturing, energy, and smart cities."
            },
            new BlogPost
            {
                Title = "Digital Transformation: Lessons from the Public Sector",
                Slug = "digital-transformation-lessons-from-the-public-sector",
                Summary = "Government agencies are undergoing digital transformation to improve citizen services and operational efficiency. Learn key lessons from successful public sector modernization projects across Canada.",
                Content = "<h3>The Public Sector Digital Imperative</h3>" +
                    "<p>Citizens now expect the same seamless digital experiences from government services that they get from private sector companies. Canadian government agencies at all levels are investing in digital transformation to improve service delivery, reduce processing times, and increase transparency. However, public sector transformation comes with unique challenges including legacy systems, procurement constraints, and accessibility requirements.</p>" +
                    "<h3>Lessons from Successful Projects</h3>" +
                    "<p>Our experience working with public sector clients across Canada has revealed several key success factors. First, start with citizen-facing services that have the highest volume and longest wait times for maximum impact. Second, take an incremental approach that delivers value every quarter rather than big-bang replacements. Third, invest heavily in change management because technology is only 30% of the transformation equation.</p>" +
                    "<ul><li>Start with high-volume, high-wait citizen services for maximum impact</li><li>Incremental delivery over big-bang replacements reduces risk</li><li>Change management is 70% of the success equation</li><li>Accessibility (WCAG 2.1 AA) must be built in from day one, not bolted on later</li></ul>" +
                    "<h3>Measuring Success</h3>" +
                    "<p>Successful public sector digital transformation should be measured by citizen outcomes, not technology metrics. Track citizen satisfaction scores, processing time reductions, digital adoption rates, and cost per transaction. Build dashboards that make these metrics visible to leadership and the public, reinforcing the value of digital investments and building support for continued modernization.</p>",
                CategoryId = dtCategory.Id,
                AuthorName = "Sarah Chen",
                Tags = "digital-transformation,public-sector",
                IsPublished = true,
                PublishedAt = new DateTime(2026, 2, 3, 8, 30, 0, DateTimeKind.Utc),
                ViewCount = 178,
                MetaTitle = "Digital Transformation: Lessons from the Public Sector | Soham Yoga",
                MetaDescription = "Key lessons from successful digital transformation projects in Canadian government agencies."
            },
            new BlogPost
            {
                Title = "AI Testing: Ensuring Your Models Are Production-Ready",
                Slug = "ai-testing-ensuring-your-models-are-production-ready",
                Summary = "Deploying untested AI models is a recipe for disaster. Learn the comprehensive testing strategies needed to validate ML models for accuracy, fairness, robustness, and performance before they reach production.",
                Content = "<h3>The Testing Gap in AI</h3>" +
                    "<p>While software testing has mature methodologies and tools, AI model testing is still an emerging discipline. Many organizations rush models to production with only basic accuracy checks, leading to failures that erode trust and cause real harm. A comprehensive AI testing strategy must cover functional correctness, fairness, robustness, performance, and security.</p>" +
                    "<h3>Essential AI Testing Categories</h3>" +
                    "<p>Effective AI testing goes far beyond checking accuracy on a holdout dataset. You need to test for data drift (does the model still work as real-world data changes?), fairness (does the model treat protected groups equitably?), adversarial robustness (can the model be fooled by intentionally crafted inputs?), and performance under load (does inference latency meet SLA requirements at peak traffic?).</p>" +
                    "<ul><li>Accuracy Testing: Cross-validation, holdout sets, stratified evaluation by segment</li><li>Fairness Testing: Disparate impact analysis across protected attributes</li><li>Robustness Testing: Adversarial inputs, noisy data, missing features</li><li>Performance Testing: Latency, throughput, memory usage under load</li><li>Regression Testing: Automated checks that new versions do not degrade</li></ul>" +
                    "<h3>Building an AI Testing Framework</h3>" +
                    "<p>Invest in automated testing infrastructure that runs on every model update. Create test datasets that represent edge cases, rare events, and diverse populations. Establish minimum quality gates that models must pass before promotion to production. Implement continuous monitoring in production to detect degradation early. The upfront investment in AI testing pays enormous dividends in model reliability and organizational trust.</p>",
                CategoryId = aiCategory.Id,
                AuthorName = "Michael Torres",
                Tags = "ai-testing,mlops,quality",
                IsPublished = true,
                PublishedAt = new DateTime(2026, 2, 10, 9, 0, 0, DateTimeKind.Utc),
                ViewCount = 267,
                MetaTitle = "AI Testing: Ensuring Your Models Are Production-Ready | Soham Yoga",
                MetaDescription = "Comprehensive guide to AI model testing covering accuracy, fairness, robustness, and performance validation."
            },
            new BlogPost
            {
                Title = "Natural Language Processing for Document Automation",
                Slug = "natural-language-processing-for-document-automation",
                Summary = "NLP technologies are automating document-intensive processes across industries. From contract analysis to compliance review, learn how organizations are using NLP to process documents faster and more accurately than ever before.",
                Content = "<h3>The Document Processing Challenge</h3>" +
                    "<p>Organizations across every industry are drowning in documents. Contracts, invoices, reports, emails, and regulatory filings consume thousands of person-hours annually. Natural language processing (NLP) technologies now enable automated extraction, classification, summarization, and analysis of documents at scale, freeing knowledge workers to focus on high-value tasks.</p>" +
                    "<h3>NLP Techniques for Document Automation</h3>" +
                    "<p>Modern document automation combines multiple NLP techniques to handle the full lifecycle of document processing. OCR and layout analysis extract text and structure from scanned documents. Named entity recognition (NER) identifies key entities like names, dates, amounts, and clauses. Text classification routes documents to the right workflow. Summarization generates concise overviews of lengthy documents for faster review.</p>" +
                    "<ul><li>OCR + Layout Analysis: Extract text with position-aware understanding</li><li>Named Entity Recognition: Identify key data points automatically</li><li>Text Classification: Route documents to correct workflows</li><li>Summarization: Generate concise overviews of lengthy documents</li><li>Semantic Search: Find relevant documents and clauses instantly</li></ul>" +
                    "<h3>Real-World Impact</h3>" +
                    "<p>Our clients have achieved remarkable results with NLP-powered document automation. A law firm reduced contract review time by 70% using AI-assisted clause extraction. A bank automated 85% of loan document processing, cutting approval times from days to hours. An insurance company deployed NLP for claims processing, improving accuracy while handling 3x more claims with the same team. The technology is mature, proven, and delivering ROI today.</p>",
                CategoryId = aiCategory.Id,
                AuthorName = "Priya Sharma",
                Tags = "nlp,document-automation,ai",
                IsPublished = true,
                PublishedAt = new DateTime(2026, 2, 17, 10, 30, 0, DateTimeKind.Utc),
                ViewCount = 203,
                MetaTitle = "Natural Language Processing for Document Automation | Soham Yoga",
                MetaDescription = "How NLP technologies are automating document processing across industries with real-world examples and ROI data."
            },
            new BlogPost
            {
                Title = "The Future of AI in Transportation & Logistics",
                Slug = "the-future-of-ai-in-transportation-and-logistics",
                Summary = "AI is revolutionizing transportation and logistics with autonomous vehicles, predictive maintenance, and intelligent route optimization. Explore the trends shaping the future of how goods and people move.",
                Content = "<h3>AI is Reshaping Transportation</h3>" +
                    "<p>The transportation and logistics industry is undergoing a fundamental transformation driven by artificial intelligence. From autonomous trucks on highways to AI-optimized last-mile delivery, every aspect of how goods and people move is being reimagined. Companies that embrace these technologies are gaining significant competitive advantages in cost, speed, and reliability.</p>" +
                    "<h3>Key AI Applications in Transportation</h3>" +
                    "<p>AI is delivering value across the transportation value chain. Route optimization algorithms reduce fuel costs by 15-25% by considering real-time traffic, weather, delivery windows, and vehicle capacity constraints. Predictive maintenance models analyze sensor data from vehicles to predict failures weeks in advance, reducing unplanned downtime by up to 50%. Computer vision enables automated damage inspection, warehouse picking, and safety monitoring.</p>" +
                    "<ul><li>Route Optimization: 15-25% fuel cost reduction with AI-powered routing</li><li>Predictive Maintenance: 50% reduction in unplanned vehicle downtime</li><li>Demand Forecasting: Improved capacity planning and resource allocation</li><li>Computer Vision: Automated damage inspection and safety monitoring</li><li>Autonomous Vehicles: Platooning, last-mile delivery robots, warehouse AGVs</li></ul>" +
                    "<h3>Preparing for the AI-Driven Future</h3>" +
                    "<p>Transportation companies should start their AI journey with high-ROI use cases like route optimization and predictive maintenance that deliver quick wins with proven technology. Build data infrastructure by instrumenting vehicles and warehouses with IoT sensors. Invest in data engineering capabilities to clean and integrate data from multiple sources. Partner with experienced AI consultants who understand both the technology and the unique operational challenges of transportation and logistics.</p>",
                CategoryId = techCategory.Id,
                AuthorName = "Rajesh Kumar",
                Tags = "transportation,logistics,ai",
                IsPublished = true,
                PublishedAt = new DateTime(2026, 2, 24, 9, 0, 0, DateTimeKind.Utc),
                ViewCount = 156,
                MetaTitle = "The Future of AI in Transportation & Logistics | Soham Yoga",
                MetaDescription = "Explore how AI is transforming transportation and logistics with autonomous vehicles, predictive maintenance, and intelligent optimization."
            }
        };

        context.BlogPosts.AddRange(blogPosts);
        await context.SaveChangesAsync();
    }

    private static async Task SeedAdditionalBlogCategoriesAsync(ApplicationDbContext context)
    {
        var categoriesToSeed = new List<BlogCategory>
        {
            new BlogCategory { Name = "Data Migration", Slug = "data-migration" },
            new BlogCategory { Name = "SharePoint Services", Slug = "sharepoint-services" },
            new BlogCategory { Name = "Project Management", Slug = "project-management" },
            new BlogCategory { Name = "NLP", Slug = "nlp" },
            new BlogCategory { Name = "Data Testing", Slug = "data-testing" },
            new BlogCategory { Name = "Computer Vision", Slug = "computer-vision" }
        };

        foreach (var category in categoriesToSeed)
        {
            if (!await context.BlogCategories.AnyAsync(c => c.Slug == category.Slug))
            {
                context.BlogCategories.Add(category);
            }
        }

        await context.SaveChangesAsync();
    }

    private static async Task SeedAdditionalBlogPostsAsync(ApplicationDbContext context)
    {
        var categories = await context.BlogCategories.ToListAsync();

        var postsToSeed = new List<BlogPost>
        {
            // Post 1: Data Migration Strategies for Enterprise Systems
            new BlogPost
            {
                Title = "Data Migration Strategies for Enterprise Systems",
                Slug = "data-migration-strategies-for-enterprise-systems",
                Summary = "Explore proven ETL patterns, data validation frameworks, and rollback strategies that ensure zero-downtime data migration for enterprise systems.",
                Content = "<h2>The Challenge of Enterprise Data Migration</h2>" +
                    "<p>Enterprise data migration is one of the most complex and risk-laden initiatives an organization can undertake. Whether consolidating legacy databases, moving to cloud platforms, or integrating acquisitions, the stakes are extraordinarily high. A failed migration can result in data loss, extended downtime, regulatory violations, and significant financial impact. At Soham Yoga, we have guided dozens of organizations through successful large-scale migrations by applying battle-tested methodologies and rigorous validation frameworks.</p>" +
                    "<h2>ETL Patterns That Scale</h2>" +
                    "<p>The foundation of any successful data migration is a well-designed Extract, Transform, Load (ETL) pipeline. For enterprise-scale migrations, we recommend incremental ETL patterns that process data in manageable batches rather than monolithic full-load approaches. Change Data Capture (CDC) enables near-real-time synchronization between source and target systems during the transition period, minimizing the cutover window and reducing risk.</p>" +
                    "<h3>Key ETL Design Principles</h3>" +
                    "<ul>" +
                    "<li>Idempotent operations that can be safely re-run without duplicating data</li>" +
                    "<li>Checkpoint and restart capabilities for recovering from mid-pipeline failures</li>" +
                    "<li>Parallel processing with configurable thread pools to maximize throughput</li>" +
                    "<li>Comprehensive audit logging that tracks every record through the pipeline</li>" +
                    "<li>Data lineage tracking from source to destination for compliance requirements</li>" +
                    "</ul>" +
                    "<h2>Data Validation and Rollback Strategies</h2>" +
                    "<p>Validation is not an afterthought; it is woven into every stage of the migration. Pre-migration profiling establishes baseline data quality metrics. In-flight validation catches transformation errors before they propagate. Post-migration reconciliation compares record counts, checksums, and business-rule assertions between source and target systems. We build automated validation suites that run continuously during migration windows, providing real-time confidence dashboards for stakeholders.</p>" +
                    "<h3>Zero-Downtime Migration Approaches</h3>" +
                    "<p>For mission-critical systems that cannot tolerate downtime, we employ blue-green migration strategies with dual-write capabilities. The source system continues to serve production traffic while data is synchronized to the target. Application-level feature flags control the cutover, enabling instant rollback if issues are detected. This approach has allowed our clients to migrate terabytes of data across platforms with zero user-facing disruption and complete data integrity.</p>",
                CategoryId = categories.First(c => c.Slug == "data-migration").Id,
                AuthorName = "Soham Yoga Team",
                FeaturedImageUrl = "/images/blog/data-migration-strategies-for-enterprise-systems.jpg",
                Tags = "data-migration,ETL,enterprise,data-validation,zero-downtime",
                IsPublished = true,
                PublishedAt = DateTime.UtcNow,
                ViewCount = 0,
                MetaTitle = "Data Migration Strategies for Enterprise Systems | Soham Yoga",
                MetaDescription = "Proven ETL patterns, data validation frameworks, and rollback strategies for zero-downtime enterprise data migration projects."
            },

            // Post 2: SharePoint Services: Collaboration in the Modern Workplace
            new BlogPost
            {
                Title = "SharePoint Services: Collaboration in the Modern Workplace",
                Slug = "sharepoint-services-collaboration-in-the-modern-workplace",
                Summary = "Discover how SharePoint Online and Microsoft Teams integration is transforming workplace collaboration with custom workflows, governance frameworks, and modern intranet experiences.",
                Content = "<h2>SharePoint Online: The Hub of Modern Collaboration</h2>" +
                    "<p>SharePoint Online has evolved far beyond its origins as a document management system. Today it serves as the central nervous system of the modern digital workplace, integrating seamlessly with Microsoft Teams, Power Platform, and the broader Microsoft 365 ecosystem. Organizations that leverage SharePoint effectively see dramatic improvements in knowledge sharing, process efficiency, and employee engagement. At Soham Yoga, our SharePoint practice has delivered transformative collaboration solutions for organizations across Calgary and Western Canada.</p>" +
                    "<h2>Microsoft Teams Integration and Custom Workflows</h2>" +
                    "<p>The integration between SharePoint and Microsoft Teams creates a powerful collaboration platform where documents, conversations, and workflows converge. Teams channels are backed by SharePoint document libraries, enabling structured content management within the context of team collaboration. We build custom Teams apps and SharePoint web parts that surface business data, automate approvals, and streamline day-to-day operations directly within the tools employees already use.</p>" +
                    "<h3>Power Platform Automation</h3>" +
                    "<ul>" +
                    "<li>Power Automate flows for document approval, onboarding, and procurement processes</li>" +
                    "<li>Power Apps for custom forms and mobile-friendly data entry interfaces</li>" +
                    "<li>Power BI dashboards embedded in SharePoint pages for real-time business intelligence</li>" +
                    "<li>Custom connectors integrating SharePoint with line-of-business applications</li>" +
                    "<li>Automated metadata tagging and content classification using AI Builder</li>" +
                    "</ul>" +
                    "<h2>Governance and Information Architecture</h2>" +
                    "<p>Without proper governance, SharePoint environments quickly become sprawling, disorganized repositories that frustrate users rather than empowering them. Our governance framework establishes clear policies for site creation, content lifecycle management, permissions, and compliance. We design information architectures that reflect how your organization actually works, with intuitive navigation, managed metadata, and search configurations that help employees find what they need in seconds rather than minutes.</p>" +
                    "<h3>Migration and Modernization</h3>" +
                    "<p>For organizations still running SharePoint on-premises, we provide comprehensive migration services to SharePoint Online. Our migration methodology includes content auditing to identify what should be migrated, archived, or retired; automated migration tooling that preserves metadata and version history; user acceptance testing; and post-migration training. We have successfully migrated organizations with millions of documents while maintaining business continuity throughout the transition.</p>",
                CategoryId = categories.First(c => c.Slug == "sharepoint-services").Id,
                AuthorName = "Soham Yoga Team",
                FeaturedImageUrl = "/images/blog/sharepoint-services-collaboration-in-the-modern-workplace.jpg",
                Tags = "sharepoint,microsoft-teams,collaboration,governance,power-platform",
                IsPublished = true,
                PublishedAt = DateTime.UtcNow,
                ViewCount = 0,
                MetaTitle = "SharePoint Services: Collaboration in the Modern Workplace | Soham Yoga",
                MetaDescription = "How SharePoint Online and Microsoft Teams integration transforms workplace collaboration with custom workflows and governance frameworks."
            },

            // Post 3: Project Management Best Practices for IT Teams
            new BlogPost
            {
                Title = "Project Management Best Practices for IT Teams",
                Slug = "project-management-best-practices-for-it-teams",
                Summary = "Learn how Agile, Scrum, and hybrid project management methodologies drive successful IT project delivery with effective stakeholder management and risk mitigation.",
                Content = "<h2>Choosing the Right Methodology</h2>" +
                    "<p>The success of IT projects hinges not just on technical excellence but on the project management methodology that guides delivery. There is no one-size-fits-all approach. Agile methodologies excel for software development where requirements evolve, while more structured approaches suit infrastructure deployments and compliance-driven initiatives. At Soham Yoga, we help organizations select and tailor the right methodology for each project, drawing on our experience delivering hundreds of IT projects across diverse industries in Alberta and beyond.</p>" +
                    "<h2>Agile and Scrum in Practice</h2>" +
                    "<p>Agile project management, particularly the Scrum framework, has become the dominant approach for software delivery. Two-week sprints with defined ceremonies including sprint planning, daily standups, sprint reviews, and retrospectives create a rhythm that keeps teams focused and stakeholders informed. However, the real power of Agile lies not in the ceremonies themselves but in the principles they embody: iterative delivery, continuous feedback, adaptive planning, and a relentless focus on delivering working software that meets user needs.</p>" +
                    "<h3>Hybrid Approaches for Complex Programs</h3>" +
                    "<ul>" +
                    "<li>Agile delivery within a Waterfall governance framework for regulated industries</li>" +
                    "<li>SAFe (Scaled Agile Framework) for coordinating multiple Agile teams on large programs</li>" +
                    "<li>Kanban for operations teams managing continuous flow of work items</li>" +
                    "<li>PRINCE2 Agile combining structured governance with iterative delivery</li>" +
                    "<li>Custom hybrid models tailored to organizational maturity and project characteristics</li>" +
                    "</ul>" +
                    "<h2>Stakeholder Management and Communication</h2>" +
                    "<p>The most common cause of IT project failure is not technical complexity but poor stakeholder management. Effective project managers build comprehensive stakeholder maps that identify influence, interest, and communication preferences for every key participant. Regular status reporting, risk escalation protocols, and executive steering committees ensure that decision-makers have the information they need to remove blockers and keep projects on track. We establish communication cadences early and adjust them as project dynamics evolve.</p>" +
                    "<h3>Risk Management and Mitigation</h3>" +
                    "<p>Proactive risk management is a hallmark of mature project delivery. We maintain living risk registers that are reviewed weekly, with each risk assigned an owner, probability, impact score, and mitigation plan. For IT projects specifically, common risks include scope creep, integration complexity, resource availability, vendor dependencies, and technology maturity. By identifying and addressing these risks early, our project managers consistently deliver projects within scope, budget, and timeline commitments.</p>",
                CategoryId = categories.First(c => c.Slug == "project-management").Id,
                AuthorName = "Soham Yoga Team",
                FeaturedImageUrl = "/images/blog/project-management-best-practices-for-it-teams.jpg",
                Tags = "project-management,agile,scrum,stakeholder-management,risk-mitigation",
                IsPublished = true,
                PublishedAt = DateTime.UtcNow,
                ViewCount = 0,
                MetaTitle = "Project Management Best Practices for IT Teams | Soham Yoga",
                MetaDescription = "Agile, Scrum, and hybrid project management methodologies for successful IT project delivery with effective stakeholder management."
            },

            // Post 4: Computer Vision Applications in Industrial Automation
            new BlogPost
            {
                Title = "Computer Vision Applications in Industrial Automation",
                Slug = "computer-vision-applications-in-industrial-automation",
                Summary = "Learn how computer vision is revolutionizing industrial automation through quality inspection, object detection, safety monitoring, and edge deployment strategies.",
                Content = "<h2>The Rise of Vision-Guided Automation</h2>" +
                    "<p>Computer vision has emerged as one of the most transformative technologies in industrial automation. By enabling machines to see and interpret their environment, computer vision systems are replacing manual visual inspection, enhancing worker safety, and enabling entirely new categories of automated processes. At Soham Yoga, our computer vision practice works with manufacturers, energy companies, and logistics operators across Western Canada to deploy production-grade vision systems that deliver measurable operational improvements.</p>" +
                    "<h2>Quality Inspection and Defect Detection</h2>" +
                    "<p>Automated quality inspection is the most widely adopted application of computer vision in manufacturing. Deep learning models trained on images of acceptable and defective products can inspect thousands of items per minute with accuracy exceeding 99 percent. Unlike human inspectors who fatigue over time, vision systems maintain consistent performance around the clock. Our implementations use high-speed cameras, controlled lighting, and optimized inference pipelines to achieve real-time inspection at production line speeds.</p>" +
                    "<h3>Core Industrial Applications</h3>" +
                    "<ul>" +
                    "<li>Surface defect detection on metal, glass, and plastic components using convolutional neural networks</li>" +
                    "<li>Dimensional measurement and tolerance verification with sub-millimeter accuracy</li>" +
                    "<li>Object detection and counting for inventory management and packaging verification</li>" +
                    "<li>Optical character recognition for label verification and traceability compliance</li>" +
                    "<li>Worker safety monitoring including PPE detection and restricted zone enforcement</li>" +
                    "</ul>" +
                    "<h2>Safety Monitoring and Compliance</h2>" +
                    "<p>Computer vision is increasingly deployed for workplace safety applications. Systems can detect whether workers are wearing required personal protective equipment, identify unauthorized personnel in restricted areas, and monitor for unsafe behaviors or conditions in real time. These systems do not replace safety programs but augment them with continuous, automated monitoring that catches risks human supervisors might miss. Alert systems can notify safety officers instantly when violations are detected.</p>" +
                    "<h3>Edge Deployment for Real-Time Performance</h3>" +
                    "<p>Industrial vision systems demand low latency and high reliability, making edge deployment the preferred architecture. We deploy models on NVIDIA Jetson, Intel OpenVINO, and custom FPGA hardware located directly on the factory floor. Edge deployment eliminates dependency on network connectivity, ensures sub-10-millisecond inference times, and keeps sensitive production data within the facility. Our MLOps pipelines enable over-the-air model updates so that vision systems continuously improve without production interruption.</p>",
                CategoryId = categories.First(c => c.Slug == "computer-vision").Id,
                AuthorName = "Soham Yoga Team",
                FeaturedImageUrl = "/images/blog/computer-vision-applications-in-industrial-automation.jpg",
                Tags = "computer-vision,industrial-automation,quality-inspection,edge-computing,safety",
                IsPublished = true,
                PublishedAt = DateTime.UtcNow,
                ViewCount = 0,
                MetaTitle = "Computer Vision Applications in Industrial Automation | Soham Yoga",
                MetaDescription = "How computer vision is revolutionizing industrial automation through quality inspection, object detection, safety monitoring, and edge deployment."
            },

            // Post 5: NLP-Powered Customer Service Transformation
            new BlogPost
            {
                Title = "NLP-Powered Customer Service Transformation",
                Slug = "nlp-powered-customer-service-transformation",
                Summary = "Discover how Natural Language Processing is transforming customer service through intelligent chatbots, sentiment analysis, intent classification, and multilingual support capabilities.",
                Content = "<h2>The New Era of Customer Service</h2>" +
                    "<p>Natural Language Processing has fundamentally changed what is possible in customer service. Gone are the days of rigid decision-tree chatbots that frustrate customers with their inability to understand natural language. Modern NLP-powered systems can understand context, detect sentiment, classify intent with high accuracy, and maintain coherent multi-turn conversations. At Soham Yoga, we build intelligent customer service platforms that reduce response times, improve satisfaction scores, and enable organizations to scale support operations without proportional increases in headcount.</p>" +
                    "<h2>Intelligent Chatbots and Virtual Assistants</h2>" +
                    "<p>Today's NLP-powered chatbots leverage large language models fine-tuned on domain-specific data to provide accurate, contextual responses. Our chatbot implementations use Retrieval Augmented Generation (RAG) to ground responses in your organization's knowledge base, ensuring factual accuracy while maintaining natural conversational flow. These systems handle routine inquiries autonomously while seamlessly escalating complex issues to human agents with full conversation context, eliminating the need for customers to repeat themselves.</p>" +
                    "<h3>Key NLP Capabilities for Customer Service</h3>" +
                    "<ul>" +
                    "<li>Intent classification that routes customer queries to the appropriate resolution path with over 95 percent accuracy</li>" +
                    "<li>Sentiment analysis that detects frustrated or at-risk customers for priority handling and proactive intervention</li>" +
                    "<li>Entity extraction that automatically captures order numbers, account details, and issue specifics from unstructured messages</li>" +
                    "<li>Automated ticket summarization that gives agents instant context when escalations occur</li>" +
                    "<li>Multilingual support enabling seamless service in English, French, and other languages without separate systems</li>" +
                    "</ul>" +
                    "<h2>Sentiment Analysis and Voice of the Customer</h2>" +
                    "<p>Beyond direct customer interactions, NLP enables organizations to analyze customer sentiment at scale across all communication channels. We build sentiment analysis pipelines that process support tickets, social media mentions, survey responses, and call transcripts to identify emerging issues, track satisfaction trends, and measure the impact of service improvements. These insights feed into executive dashboards that make customer experience a data-driven discipline rather than an anecdotal one.</p>" +
                    "<h3>Multilingual and Omnichannel Support</h3>" +
                    "<p>Canadian organizations face the unique requirement of providing services in both English and French, and many serve diverse communities with additional language needs. Our NLP solutions incorporate state-of-the-art multilingual models that provide consistent service quality across languages. We integrate across channels including web chat, email, social media, SMS, and voice to deliver a unified customer experience regardless of how customers choose to communicate.</p>",
                CategoryId = categories.First(c => c.Slug == "nlp").Id,
                AuthorName = "Soham Yoga Team",
                FeaturedImageUrl = "/images/blog/nlp-powered-customer-service-transformation.jpg",
                Tags = "nlp,chatbots,sentiment-analysis,customer-service,multilingual",
                IsPublished = true,
                PublishedAt = DateTime.UtcNow,
                ViewCount = 0,
                MetaTitle = "NLP-Powered Customer Service Transformation | Soham Yoga",
                MetaDescription = "How Natural Language Processing transforms customer service through intelligent chatbots, sentiment analysis, intent classification, and multilingual support."
            },

            // Post 6: Data Testing: Ensuring Quality in ML Pipelines
            new BlogPost
            {
                Title = "Data Testing: Ensuring Quality in ML Pipelines",
                Slug = "data-testing-ensuring-quality-in-ml-pipelines",
                Summary = "Learn how data testing frameworks like Great Expectations, data contracts, schema validation, and drift detection ensure data quality throughout machine learning pipelines.",
                Content = "<h2>Why Data Quality Is the Foundation of ML Success</h2>" +
                    "<p>The adage garbage in, garbage out has never been more relevant than in machine learning. Models are only as good as the data they are trained and scored on, yet data quality testing remains one of the most neglected aspects of ML engineering. Organizations invest heavily in model architecture and hyperparameter tuning while treating data validation as an afterthought. At Soham Yoga, we embed rigorous data testing into every stage of the ML pipeline, from ingestion through feature engineering to model inference, ensuring that data quality issues are caught and resolved before they corrupt model outputs.</p>" +
                    "<h2>Great Expectations and Modern Data Testing Frameworks</h2>" +
                    "<p>Great Expectations has emerged as the leading open-source framework for data validation and documentation. It enables teams to define expectations about their data in a declarative, version-controlled format that serves as both validation logic and living documentation. We integrate Great Expectations into our ML pipelines to validate data at every stage: raw data ingestion, post-transformation checks, feature store validation, and model input verification. When expectations fail, pipelines halt automatically and alert the responsible team, preventing bad data from propagating downstream.</p>" +
                    "<h3>Essential Data Testing Strategies</h3>" +
                    "<ul>" +
                    "<li>Schema validation ensuring column types, names, and constraints match the expected contract at every pipeline boundary</li>" +
                    "<li>Statistical profiling that flags anomalous distributions, unexpected null rates, and outlier patterns in incoming data</li>" +
                    "<li>Referential integrity checks that verify foreign key relationships and cross-table consistency</li>" +
                    "<li>Freshness monitoring that alerts when data sources stop updating or fall behind expected schedules</li>" +
                    "<li>Volume checks that detect unexpected spikes or drops in record counts indicating upstream issues</li>" +
                    "</ul>" +
                    "<h2>Data Contracts Between Teams</h2>" +
                    "<p>Data contracts formalize the agreement between data producers and consumers about the schema, semantics, quality, and freshness of shared data. In ML systems where multiple teams contribute data to shared feature stores and training pipelines, data contracts prevent the breaking changes and silent data corruption that plague organizations without clear ownership boundaries. We help organizations define and enforce data contracts using a combination of schema registries, automated validation, and organizational governance processes.</p>" +
                    "<h3>Data Drift Detection and Monitoring</h3>" +
                    "<p>Data drift, the gradual change in the statistical properties of input data over time, is the silent killer of ML models. A model trained on historical data will degrade in production as real-world data distributions shift due to seasonality, market changes, or evolving user behavior. We implement continuous drift detection using statistical tests such as the Kolmogorov-Smirnov test, Population Stability Index, and Jensen-Shannon divergence. When significant drift is detected, automated alerts trigger model retraining or human review, ensuring models remain accurate and reliable over their entire production lifecycle.</p>",
                CategoryId = categories.First(c => c.Slug == "data-testing").Id,
                AuthorName = "Soham Yoga Team",
                FeaturedImageUrl = "/images/blog/data-testing-ensuring-quality-in-ml-pipelines.jpg",
                Tags = "data-testing,great-expectations,data-quality,drift-detection,ml-pipelines",
                IsPublished = true,
                PublishedAt = DateTime.UtcNow,
                ViewCount = 0,
                MetaTitle = "Data Testing: Ensuring Quality in ML Pipelines | Soham Yoga",
                MetaDescription = "Data testing frameworks including Great Expectations, data contracts, schema validation, and drift detection for ML pipeline quality assurance."
            },

            // Post 7: AI Testing Frameworks and Methodologies
            new BlogPost
            {
                Title = "AI Testing Frameworks and Methodologies",
                Slug = "ai-testing-frameworks-and-methodologies",
                Summary = "A comprehensive guide to AI testing including model testing, A/B testing, adversarial testing, and compliance validation methodologies for production ML systems.",
                Content = "<h2>The Imperative of Rigorous AI Testing</h2>" +
                    "<p>As AI systems take on increasingly consequential decisions in healthcare, finance, hiring, and public safety, the need for rigorous testing has never been more critical. Traditional software testing methodologies are necessary but insufficient for AI systems, which exhibit non-deterministic behavior, learn from data, and can fail in subtle ways that are invisible to conventional test suites. At Soham Yoga, our AI Testing and QA practice has developed comprehensive testing frameworks that give organizations confidence their models are accurate, fair, robust, and compliant before they are deployed to production.</p>" +
                    "<h2>Model Testing: Beyond Accuracy Metrics</h2>" +
                    "<p>While accuracy, precision, recall, and F1 scores are foundational, production-ready model testing goes much deeper. We test models across data slices to identify subpopulations where performance degrades. We evaluate calibration to ensure predicted probabilities reflect true likelihoods. We measure stability by testing with perturbed inputs to understand how sensitive predictions are to small changes. We run temporal validation to confirm models perform well on data from different time periods, not just the test split from the training dataset.</p>" +
                    "<h3>Comprehensive AI Testing Categories</h3>" +
                    "<ul>" +
                    "<li>Unit testing for individual model components including feature transformations, preprocessing steps, and post-processing logic</li>" +
                    "<li>Integration testing to verify the end-to-end pipeline from raw input to final prediction functions correctly</li>" +
                    "<li>A/B testing frameworks that compare model versions in production with statistical rigor and proper sample sizing</li>" +
                    "<li>Adversarial testing using crafted inputs designed to expose model vulnerabilities and edge case failures</li>" +
                    "<li>Regression testing that automatically validates new model versions do not degrade on critical benchmarks</li>" +
                    "</ul>" +
                    "<h2>A/B Testing for Model Deployment</h2>" +
                    "<p>A/B testing is the gold standard for validating that a new model version actually improves business outcomes in production. Our A/B testing framework handles traffic splitting, metric collection, statistical significance calculation, and automated rollback. We ensure proper experiment design with adequate sample sizes, guard against multiple comparison errors, and monitor for interaction effects. For high-stakes models, we implement multi-armed bandit approaches that dynamically allocate more traffic to better-performing variants while maintaining statistical validity.</p>" +
                    "<h3>Adversarial Testing and Compliance Validation</h3>" +
                    "<p>Adversarial testing probes models with intentionally challenging inputs to expose vulnerabilities. For NLP models, this includes testing with adversarial text perturbations, injection attacks, and out-of-distribution inputs. For computer vision models, we test with adversarial patches, domain shifts, and edge cases. Compliance validation ensures models meet regulatory requirements including fairness across protected attributes, explainability obligations, and audit trail requirements. We produce comprehensive test reports that satisfy internal governance committees and external regulatory reviewers, documenting every aspect of model behavior before production deployment.</p>",
                CategoryId = categories.First(c => c.Slug == "data-testing").Id,
                AuthorName = "Soham Yoga Team",
                FeaturedImageUrl = "/images/blog/ai-testing-frameworks-and-methodologies.jpg",
                Tags = "ai-testing,A/B-testing,adversarial-testing,compliance,model-validation",
                IsPublished = true,
                PublishedAt = DateTime.UtcNow,
                ViewCount = 0,
                MetaTitle = "AI Testing Frameworks and Methodologies | Soham Yoga",
                MetaDescription = "Comprehensive guide to AI testing including model testing, A/B testing, adversarial testing, and compliance validation for production ML systems."
            }
        };

        foreach (var post in postsToSeed)
        {
            if (!await context.BlogPosts.AnyAsync(p => p.Slug == post.Slug))
            {
                context.BlogPosts.Add(post);
            }
        }

        await context.SaveChangesAsync();
    }

    private static async Task SeedJobPostingsAsync(ApplicationDbContext context)
    {
        if (await context.JobPostings.AnyAsync()) return;

        var jobs = new List<JobPosting>
        {
            new JobPosting
            {
                Title = "Senior Data Engineer",
                Slug = "senior-data-engineer",
                Department = "Data Engineering",
                Location = "Calgary, AB (Hybrid)",
                EmploymentType = "Full-Time",
                SalaryRange = "$110,000 – $140,000 CAD",
                Summary = "Lead the design and implementation of scalable data pipelines and cloud data infrastructure for enterprise clients.",
                Description = @"<p>We are looking for a <strong>Senior Data Engineer</strong> to join our growing Data Engineering team. You will work with enterprise clients to build robust, scalable data infrastructure that powers analytics and AI initiatives.</p>
<h3>What You'll Do</h3>
<ul>
  <li>Design and implement end-to-end data pipelines using Apache Spark, dbt, and Airflow</li>
  <li>Architect cloud data warehouses on Azure (Synapse, Data Factory, ADLS Gen2)</li>
  <li>Collaborate with data scientists to productionize ML models</li>
  <li>Mentor junior engineers and conduct code reviews</li>
  <li>Establish data engineering best practices and standards across the team</li>
</ul>",
                Requirements = @"<ul>
  <li>5+ years of data engineering experience</li>
  <li>Proficiency in Python, SQL, and Spark</li>
  <li>Hands-on experience with Azure or AWS data services</li>
  <li>Strong understanding of data modeling (star schema, data vault)</li>
  <li>Experience with dbt, Airflow, or similar orchestration tools</li>
  <li>Bachelor's or Master's degree in Computer Science, Engineering, or related field</li>
</ul>",
                NiceToHave = @"<ul>
  <li>Azure Data Engineer certification (DP-203)</li>
  <li>Experience with Databricks or Snowflake</li>
  <li>Knowledge of streaming architectures (Kafka, Event Hubs)</li>
  <li>Experience with MLOps pipelines</li>
</ul>",
                IsActive = true,
                SortOrder = 1
            },
            new JobPosting
            {
                Title = "Data Engineer – ETL & Analytics",
                Slug = "data-engineer-etl-analytics",
                Department = "Data Engineering",
                Location = "Remote (Canada)",
                EmploymentType = "Full-Time",
                SalaryRange = "$85,000 – $110,000 CAD",
                Summary = "Build and maintain ETL pipelines and analytical data models to support business intelligence and reporting across our client organizations.",
                Description = @"<p>Join Soham Yoga as a <strong>Data Engineer</strong> specializing in ETL development and analytics. You will build data pipelines that transform raw operational data into clean, analysis-ready datasets powering dashboards and reports.</p>
<h3>What You'll Do</h3>
<ul>
  <li>Develop and maintain ETL/ELT pipelines using Azure Data Factory and dbt</li>
  <li>Build and optimize data models in Azure Synapse Analytics and SQL Server</li>
  <li>Collaborate with BI developers to support Power BI reporting needs</li>
  <li>Monitor pipeline health and implement alerting for data quality issues</li>
  <li>Document data lineage, transformations, and business rules</li>
</ul>",
                Requirements = @"<ul>
  <li>3+ years of experience building ETL/ELT pipelines</li>
  <li>Strong SQL skills (T-SQL, window functions, query optimization)</li>
  <li>Hands-on experience with Azure Data Factory or SSIS</li>
  <li>Familiarity with dbt or similar data transformation tools</li>
  <li>Experience with data warehousing concepts (Kimball methodology)</li>
</ul>",
                NiceToHave = @"<ul>
  <li>Power BI development experience</li>
  <li>Python scripting for data processing</li>
  <li>Azure certifications (DP-900, DP-203)</li>
</ul>",
                IsActive = true,
                SortOrder = 2
            },
            new JobPosting
            {
                Title = "Junior Data Engineer",
                Slug = "junior-data-engineer",
                Department = "Data Engineering",
                Location = "Calgary, AB (On-site)",
                EmploymentType = "Full-Time",
                SalaryRange = "$65,000 – $80,000 CAD",
                Summary = "A great opportunity for a recent graduate or early-career professional to grow in data engineering by working on real-world cloud data projects.",
                Description = @"<p>Soham Yoga is looking for a <strong>Junior Data Engineer</strong> eager to learn and grow in the cloud data space. You will work alongside senior engineers and gain hands-on experience with industry-leading tools and platforms.</p>
<h3>What You'll Do</h3>
<ul>
  <li>Assist in the development of data pipelines and ETL processes</li>
  <li>Write and optimize SQL queries for data transformation tasks</li>
  <li>Support the maintenance and monitoring of existing data workflows</li>
  <li>Participate in code reviews and team knowledge-sharing sessions</li>
  <li>Help with data quality validation and testing</li>
</ul>",
                Requirements = @"<ul>
  <li>Bachelor's degree in Computer Science, Statistics, Engineering, or related field</li>
  <li>Working knowledge of SQL and at least one programming language (Python preferred)</li>
  <li>Familiarity with cloud platforms (Azure, AWS, or GCP) through coursework or personal projects</li>
  <li>Strong analytical and problem-solving skills</li>
  <li>Eagerness to learn and collaborate in a fast-paced environment</li>
</ul>",
                NiceToHave = @"<ul>
  <li>Internship or co-op experience in a data role</li>
  <li>Exposure to Spark, dbt, or Airflow</li>
  <li>Azure Fundamentals (AZ-900) or Data Fundamentals (DP-900) certification</li>
</ul>",
                IsActive = true,
                SortOrder = 3
            },
            new JobPosting
            {
                Title = "Data Science & ML Engineer",
                Slug = "data-science-ml-engineer",
                Department = "Data Engineering",
                Location = "Remote (Canada)",
                EmploymentType = "Full-Time",
                SalaryRange = "$100,000 – $130,000 CAD",
                Summary = "Design and deploy machine learning models and data science solutions that generate measurable business value for our enterprise clients.",
                Description = @"<p>We are seeking a talented <strong>Data Science & ML Engineer</strong> to bridge the gap between data science and production engineering. You will develop ML models and ensure they are deployed, monitored, and maintained reliably at scale.</p>
<h3>What You'll Do</h3>
<ul>
  <li>Develop and train machine learning models for classification, regression, and forecasting use cases</li>
  <li>Build MLOps pipelines using Azure ML or MLflow for model versioning and deployment</li>
  <li>Collaborate with data engineers to curate high-quality training datasets</li>
  <li>Monitor model performance in production and retrain as needed</li>
  <li>Present findings and model insights to non-technical stakeholders</li>
</ul>",
                Requirements = @"<ul>
  <li>3+ years of experience in data science or ML engineering</li>
  <li>Proficiency in Python (scikit-learn, XGBoost, PyTorch, or TensorFlow)</li>
  <li>Experience deploying ML models to production environments</li>
  <li>Strong statistical background and understanding of model evaluation metrics</li>
  <li>Experience with SQL and data wrangling at scale</li>
</ul>",
                NiceToHave = @"<ul>
  <li>Experience with Azure ML, Databricks, or SageMaker</li>
  <li>Knowledge of LLM fine-tuning or RAG architectures</li>
  <li>Familiarity with feature stores (Feast, Tecton)</li>
  <li>Published research or open-source contributions</li>
</ul>",
                IsActive = true,
                SortOrder = 4
            }
        };

        foreach (var job in jobs)
        {
            if (!await context.JobPostings.AnyAsync(j => j.Slug == job.Slug))
            {
                context.JobPostings.Add(job);
            }
        }

        await context.SaveChangesAsync();
    }

    private static async Task SeedYogaProductsAsync(ApplicationDbContext context)
    {
        if (await context.YogaProducts.AnyAsync()) return;

        var products = new List<YogaProduct>
        {
            new YogaProduct
            {
                Name = "Premium Cork Yoga Mat",
                ShortDescription = "Eco-friendly cork surface with natural rubber base for superior grip and stability.",
                FullDescription = "<p>Experience the perfect blend of sustainability and performance with our Premium Cork Yoga Mat. The natural cork surface provides exceptional grip that improves with moisture, making it ideal for hot yoga and intense practice sessions.</p><p>The natural rubber base offers cushioning and prevents slipping on any floor surface. Cork is naturally antimicrobial, hypoallergenic, and easy to clean. Dimensions: 72\" x 24\" x 5mm.</p>",
                Price = 79.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "premium-cork-yoga-mat",
                Category = "Yoga Mats",
                Brand = "SohamYoga",
                Sku = "YM-CORK-001",
                StockQuantity = 50,
                IsActive = true,
                IsFeatured = true,
                SortOrder = 1,
                Rating = 4.8,
                ReviewCount = 124,
                Tags = "cork,eco-friendly,hot-yoga,non-slip"
            },
            new YogaProduct
            {
                Name = "Eco-Friendly TPE Yoga Mat",
                ShortDescription = "Lightweight, non-toxic TPE mat with dual-layer cushioning for joint protection.",
                FullDescription = "<p>Our Eco-Friendly TPE Yoga Mat is crafted from thermoplastic elastomer, a recyclable and non-toxic material free of PVC, latex, and heavy metals. The dual-layer design features a textured top for grip and a waffle-pattern bottom for floor traction.</p><p>At just 2.5 lbs, it's perfect for yogis on the go. The closed-cell construction resists moisture and bacteria. Dimensions: 72\" x 24\" x 6mm.</p>",
                Price = 49.99m,
                DiscountPrice = 39.99m,
                ImageUrl = "",
                Slug = "eco-friendly-tpe-yoga-mat",
                Category = "Yoga Mats",
                Brand = "SohamYoga",
                Sku = "YM-TPE-002",
                StockQuantity = 75,
                IsActive = true,
                IsFeatured = true,
                SortOrder = 2,
                Rating = 4.5,
                ReviewCount = 89,
                Tags = "tpe,eco-friendly,lightweight,travel"
            },
            new YogaProduct
            {
                Name = "Natural Rubber Yoga Mat",
                ShortDescription = "Professional-grade natural rubber mat with alignment lines for precise practice.",
                FullDescription = "<p>Designed for serious practitioners, our Natural Rubber Yoga Mat features laser-etched alignment lines to help perfect your poses. The open-cell natural rubber provides unmatched cushioning and grip even during the most demanding sessions.</p><p>Sustainably harvested rubber with a polyurethane top layer for moisture absorption. Dimensions: 72\" x 26\" x 5mm. Includes carrying strap.</p>",
                Price = 89.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "natural-rubber-yoga-mat",
                Category = "Yoga Mats",
                Brand = "SohamYoga",
                Sku = "YM-RUB-003",
                StockQuantity = 35,
                IsActive = true,
                IsFeatured = true,
                SortOrder = 3,
                Rating = 4.9,
                ReviewCount = 156,
                Tags = "natural-rubber,alignment,professional,sustainable"
            },
            new YogaProduct
            {
                Name = "Bamboo Yoga Block Set (2-Pack)",
                ShortDescription = "Solid bamboo yoga blocks for stable support and deeper stretches.",
                FullDescription = "<p>Elevate your practice with our Bamboo Yoga Block Set. Each block is crafted from sustainably sourced bamboo, providing a firm, stable surface that won't compress under pressure. The smooth, rounded edges are comfortable to grip and gentle on your hands.</p><p>Bamboo is naturally moisture-resistant and antibacterial. Dimensions: 9\" x 6\" x 4\" each. Set includes 2 blocks.</p>",
                Price = 29.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "bamboo-yoga-block-set",
                Category = "Yoga Blocks & Props",
                Brand = "SohamYoga",
                Sku = "YP-BLK-001",
                StockQuantity = 100,
                IsActive = true,
                IsFeatured = false,
                SortOrder = 4,
                Rating = 4.6,
                ReviewCount = 72,
                Tags = "bamboo,blocks,props,support"
            },
            new YogaProduct
            {
                Name = "Yoga Strap with Metal D-Ring",
                ShortDescription = "Durable cotton yoga strap with adjustable metal D-ring buckle for deep stretching.",
                FullDescription = "<p>Our Yoga Strap is an essential prop for improving flexibility and achieving proper alignment. Made from dense, woven cotton that won't stretch or slip, with a sturdy metal D-ring buckle for secure, adjustable hold.</p><p>Perfect for extending reach in seated forward bends, shoulder stretches, and bound poses. Length: 8 feet. Machine washable.</p>",
                Price = 14.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "yoga-strap-metal-d-ring",
                Category = "Yoga Blocks & Props",
                Brand = "SohamYoga",
                Sku = "YP-STP-002",
                StockQuantity = 150,
                IsActive = true,
                IsFeatured = false,
                SortOrder = 5,
                Rating = 4.7,
                ReviewCount = 98,
                Tags = "strap,props,flexibility,stretching"
            },
            new YogaProduct
            {
                Name = "Meditation Cushion Zafu",
                ShortDescription = "Traditional round meditation cushion filled with organic buckwheat hulls.",
                FullDescription = "<p>Our Zafu Meditation Cushion is designed to support proper spinal alignment during seated meditation. Filled with organic buckwheat hulls that conform to your body and provide firm yet comfortable support.</p><p>The removable cover is made from organic cotton twill and is machine washable. The pleated design allows the cushion to maintain its shape. Diameter: 14\", Height: 6\". Available in multiple colors.</p>",
                Price = 44.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "meditation-cushion-zafu",
                Category = "Meditation & Accessories",
                Brand = "SohamYoga",
                Sku = "MA-CUS-001",
                StockQuantity = 60,
                IsActive = true,
                IsFeatured = true,
                SortOrder = 6,
                Rating = 4.8,
                ReviewCount = 67,
                Tags = "meditation,cushion,zafu,organic"
            },
            new YogaProduct
            {
                Name = "Organic Cotton Yoga Pants",
                ShortDescription = "Breathable organic cotton yoga pants with a wide waistband for all-day comfort.",
                FullDescription = "<p>Move freely in our Organic Cotton Yoga Pants, crafted from GOTS-certified organic cotton blended with a touch of spandex for stretch and recovery. The wide, fold-over waistband stays in place without digging in.</p><p>Features a bootcut leg, flat seams to prevent chafing, and a hidden waistband pocket. Pre-shrunk and machine washable. Available in sizes XS-XL.</p>",
                Price = 59.99m,
                DiscountPrice = 49.99m,
                ImageUrl = "",
                Slug = "organic-cotton-yoga-pants",
                Category = "Yoga Clothing",
                Brand = "SohamYoga",
                Sku = "YC-PNT-001",
                StockQuantity = 80,
                IsActive = true,
                IsFeatured = false,
                SortOrder = 7,
                Rating = 4.4,
                ReviewCount = 53,
                Tags = "clothing,pants,organic-cotton,comfortable"
            },
            new YogaProduct
            {
                Name = "Bamboo Yoga Tank Top",
                ShortDescription = "Ultra-soft bamboo fabric tank top with moisture-wicking properties.",
                FullDescription = "<p>Stay cool and comfortable with our Bamboo Yoga Tank Top. Made from bamboo viscose fabric that is naturally moisture-wicking, breathable, and thermoregulating. The relaxed fit and racerback design allow full range of motion.</p><p>Bamboo fabric is hypoallergenic and naturally odor-resistant, keeping you fresh through your entire practice. Features a built-in shelf bra for light support. Available in sizes XS-XL.</p>",
                Price = 34.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "bamboo-yoga-tank-top",
                Category = "Yoga Clothing",
                Brand = "SohamYoga",
                Sku = "YC-TNK-002",
                StockQuantity = 90,
                IsActive = true,
                IsFeatured = false,
                SortOrder = 8,
                Rating = 4.6,
                ReviewCount = 41,
                Tags = "clothing,tank-top,bamboo,moisture-wicking"
            },
            new YogaProduct
            {
                Name = "Yoga Wheel",
                ShortDescription = "Durable yoga wheel for backbends, stretching, and balance training.",
                FullDescription = "<p>Our Yoga Wheel is a versatile prop designed to deepen backbends, release tension in the spine, and improve flexibility. The strong ABS inner frame supports up to 500 lbs, while the thick TPE foam padding provides comfortable cushioning.</p><p>The non-slip surface ensures safe use during backbends, chest openers, and balance exercises. Diameter: 13\", Width: 5\". Includes a pose guide.</p>",
                Price = 39.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "yoga-wheel",
                Category = "Yoga Blocks & Props",
                Brand = "SohamYoga",
                Sku = "YP-WHL-003",
                StockQuantity = 45,
                IsActive = true,
                IsFeatured = true,
                SortOrder = 9,
                Rating = 4.5,
                ReviewCount = 38,
                Tags = "wheel,props,backbend,flexibility"
            },
            new YogaProduct
            {
                Name = "Essential Oil Diffuser Set",
                ShortDescription = "Ceramic essential oil diffuser with a curated set of 6 yoga-inspired essential oils.",
                FullDescription = "<p>Create the perfect atmosphere for your practice with our Essential Oil Diffuser Set. The handcrafted ceramic diffuser uses ultrasonic technology to create a fine, cool mist that disperses essential oils throughout your space.</p><p>Includes 6 pure essential oils (10ml each): Lavender, Eucalyptus, Peppermint, Frankincense, Sandalwood, and Ylang Ylang. Features auto shut-off, LED mood lighting, and whisper-quiet operation. Covers up to 300 sq ft.</p>",
                Price = 54.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "essential-oil-diffuser-set",
                Category = "Meditation & Accessories",
                Brand = "SohamYoga",
                Sku = "MA-DIF-002",
                StockQuantity = 40,
                IsActive = true,
                IsFeatured = false,
                SortOrder = 10,
                Rating = 4.7,
                ReviewCount = 85,
                Tags = "essential-oils,diffuser,aromatherapy,meditation"
            },
            new YogaProduct
            {
                Name = "Yoga Towel Non-Slip",
                ShortDescription = "Microfiber yoga towel with silicone grip dots for hot yoga sessions.",
                FullDescription = "<p>Our Non-Slip Yoga Towel is essential for hot yoga and sweaty sessions. The premium microfiber surface absorbs moisture quickly while hundreds of silicone grip dots on the underside keep the towel firmly anchored to your mat.</p><p>Super absorbent, quick-drying, and machine washable. Dimensions: 72\" x 24\" to fit standard yoga mats. Comes with a mesh carry bag. Available in multiple colors.</p>",
                Price = 24.99m,
                DiscountPrice = 19.99m,
                ImageUrl = "",
                Slug = "yoga-towel-non-slip",
                Category = "Yoga Mats",
                Brand = "SohamYoga",
                Sku = "YM-TWL-004",
                StockQuantity = 120,
                IsActive = true,
                IsFeatured = false,
                SortOrder = 11,
                Rating = 4.3,
                ReviewCount = 62,
                Tags = "towel,hot-yoga,non-slip,microfiber"
            },
            new YogaProduct
            {
                Name = "Singing Bowl Meditation Set",
                ShortDescription = "Hand-hammered Tibetan singing bowl with mallet and cushion for sound healing.",
                FullDescription = "<p>Deepen your meditation practice with our authentic Tibetan Singing Bowl Set. Each bowl is hand-hammered by skilled artisans from a traditional seven-metal alloy, producing rich, resonant tones that promote relaxation and mindfulness.</p><p>The set includes a 5-inch singing bowl, a wooden mallet wrapped in suede, and a silk cushion. Perfect for meditation, sound therapy, chakra balancing, and yoga class transitions. Includes a guide to playing techniques.</p>",
                Price = 69.99m,
                DiscountPrice = null,
                ImageUrl = "",
                Slug = "singing-bowl-meditation-set",
                Category = "Meditation & Accessories",
                Brand = "SohamYoga",
                Sku = "MA-SNG-003",
                StockQuantity = 30,
                IsActive = true,
                IsFeatured = true,
                SortOrder = 12,
                Rating = 4.9,
                ReviewCount = 47,
                Tags = "singing-bowl,meditation,sound-healing,tibetan"
            }
        };

        foreach (var product in products)
        {
            if (!await context.YogaProducts.AnyAsync(p => p.Slug == product.Slug))
            {
                context.YogaProducts.Add(product);
            }
        }

        await context.SaveChangesAsync();
    }
}
