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
        await SeedDemoAccountsAsync(userManager);
        await SeedSiteSettingsAsync(context);
        await SeedYogaProductsAsync(context);

        // Services, testimonials, case studies, industries, team, videos, blog
        // posts, and job postings are intentionally NOT seeded: the previous
        // seed data here described an unrelated IT-consulting business
        // ("SLP Systems"). Populate these via the admin CMS with real
        // SohamYoga content instead of carrying over fabricated placeholders.
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        string[] roles = { "Admin", "Editor", "HR", "Sales", "Customer", "Teacher" };

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

    // Fixed-credential demo accounts for the end-to-end showcase (Demo
    // Showcase Hub): a real Admin-role login and a real Customer-role login,
    // both authenticated through the same Identity pipeline as production
    // accounts — not a separate mock auth path. Idempotent: skipped if the
    // account already exists, so re-deploys never reset a demo password an
    // operator may have since rotated.
    private static async Task SeedDemoAccountsAsync(UserManager<IdentityUser> userManager)
    {
        await SeedRoleUserAsync(userManager, "admin_demo@sohamyoga.ca", "AdminDemo@123456", "Admin", null);
        await SeedRoleUserAsync(userManager, "customer_demo@sohamyoga.ca", "CustomerDemo@123456", "Customer", "Demo Customer");
    }

    private static async Task SeedRoleUserAsync(
        UserManager<IdentityUser> userManager, string email, string password, string role, string? displayName)
    {
        if (await userManager.FindByEmailAsync(email) != null) return;

        var user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = true };
        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded) return;

        await userManager.AddToRoleAsync(user, role);
        if (displayName != null)
        {
            await userManager.AddClaimAsync(user, new System.Security.Claims.Claim("DisplayName", displayName));
        }
    }

    private static async Task SeedSiteSettingsAsync(ApplicationDbContext context)
    {
        if (await context.SiteSettings.AnyAsync()) return;

        context.SiteSettings.Add(new SiteSettings
        {
            CompanyName = "Soham Yoga",
            Tagline = "",
            Description = "",
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
