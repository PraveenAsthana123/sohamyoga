using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SohamYoga.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddBlogCategoryDescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "BlogCategories",
                type: "TEXT",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "BlogCategories");
        }
    }
}
