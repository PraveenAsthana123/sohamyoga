import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const {
      event_type, guest_count, dietary_restrictions, food_allergies,
      cuisine_preferences, budget_per_person, menu_theme, courses,
    } = body;

    const prompt = `Create a personalized menu for a ${event_type || 'dinner party'} for ${guest_count || 4} guests. Dietary restrictions: ${Array.isArray(dietary_restrictions) && dietary_restrictions.length ? dietary_restrictions.join(', ') : 'none'}. Food allergies: ${Array.isArray(food_allergies) && food_allergies.length ? food_allergies.join(', ') : 'none'}. Cuisine preference: ${Array.isArray(cuisine_preferences) && cuisine_preferences.length ? cuisine_preferences.join(', ') : 'contemporary'}. Budget: ~$${budget_per_person || 80} per person. Menu theme: ${menu_theme || 'seasonal'}. Include: ${courses || 3}-course menu with dish names and brief descriptions, wine pairing suggestions, estimated prep/service timeline, and grocery list categories. Calgary, Alberta local ingredients preferred.`;

    let menu = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const data = await aiRes.json() as { response?: string };
        menu = data.response || '';
      }
    } catch {
      menu = `PERSONALIZED MENU — ${(event_type || 'dinner party').toUpperCase()}\nGuests: ${guest_count || 4} | Budget: ~$${budget_per_person || 80}/person | Theme: ${menu_theme || 'Seasonal'}\n\nAPPETIZER\n• Whipped ricotta crostini with roasted tomatoes and basil oil\n• Alberta charcuterie board with local cheeses and seasonal preserves\n\nSOUP / SALAD\n• Roasted beet and goat cheese salad with candied walnuts and citrus vinaigrette\n\nMAIN COURSE\n• Herb-crusted Alberta beef tenderloin with truffle jus\n• Pan-seared Pacific salmon with lemon caper butter (dietary alternative)\n\nSIDE DISHES\n• Roasted fingerling potatoes with rosemary and garlic\n• Grilled seasonal vegetables with herb oil\n\nDESSERT\n• Dark chocolate lava cake with vanilla bean ice cream\n• Seasonal fruit pavlova (gluten-free option)\n\nWINE PAIRINGS\n• White: Okanagan Chardonnay\n• Red: BC Cabernet Sauvignon\n• Non-alcoholic: Sparkling elderflower lemonade\n\nSERVICE TIMELINE\n• 2h before: Mise en place, prep all components\n• 1h before: Begin main course cooking\n• 15 min before guests arrive: Appetizers plated\n• Service: Courses at 20-min intervals\n\nGROCERY LIST CATEGORIES\nProteins | Produce | Dairy | Dry Goods | Herbs & Spices | Wine & Beverages\n\n[AI service unavailable — menu generated from template]`;
    }
    return Response.json({ menu });
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
