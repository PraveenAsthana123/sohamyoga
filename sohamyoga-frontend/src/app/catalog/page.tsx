"use client";
import { useState } from "react";
import Link from "next/link";
import { useAnalyticsContext } from "@/components/analytics/AnalyticsProvider";

interface ClassCard {
  id: string;
  title: string;
  teacher: string;
  style: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "All Levels";
  durationMinutes: number;
  spotsLeft: number;
  totalSpots: number;
  priceCAD: number;
  nextSession: string;
  isOnline: boolean;
  tags: string[];
  shortDescription: string;
  faqs: { q: string; a: string }[];
}

const CATALOG: ClassCard[] = [
  {
    id: "1", title: "Morning Hatha Flow", teacher: "Priya Sharma", style: "Hatha", level: "Beginner",
    durationMinutes: 60, spotsLeft: 8, totalSpots: 15, priceCAD: 15,
    nextSession: "Tomorrow 7:00 AM", isOnline: false, tags: ["morning", "gentle", "breathing"],
    shortDescription: "Gentle sun salutations and foundational poses to start your day with intention and calm energy.",
    faqs: [
      { q: "Do I need prior experience?", a: "No — this class is perfect for absolute beginners." },
      { q: "What should I bring?", a: "Yoga mat, water bottle, and an open mind." },
    ],
  },
  {
    id: "2", title: "Power Vinyasa", teacher: "Raj Patel", style: "Vinyasa", level: "Intermediate",
    durationMinutes: 75, spotsLeft: 3, totalSpots: 12, priceCAD: 18,
    nextSession: "Today 10:00 AM", isOnline: true, tags: ["strength", "flow", "cardio"],
    shortDescription: "Dynamic, breath-linked movement sequences that build cardiovascular fitness and functional strength.",
    faqs: [
      { q: "How fit do I need to be?", a: "Basic yoga foundation (6+ months) recommended. Modifications offered for all moves." },
      { q: "Is this class online or in-studio?", a: "Both options available — this session is online via Zoom." },
    ],
  },
  {
    id: "3", title: "Yin & Restore", teacher: "Anita Mehta", style: "Yin", level: "All Levels",
    durationMinutes: 90, spotsLeft: 12, totalSpots: 15, priceCAD: 15,
    nextSession: "Today 6:00 PM", isOnline: false, tags: ["relaxation", "flexibility", "stress relief"],
    shortDescription: "Deep, passive stretches held for 3–5 minutes each. Targets fascia and connective tissue. Perfect for recovery and stress relief.",
    faqs: [
      { q: "Is this suitable for injury recovery?", a: "Many find it helpful — but consult your doctor first and inform the teacher." },
      { q: "Do I need props?", a: "Blocks and bolsters are provided at the studio." },
    ],
  },
  {
    id: "4", title: "Advanced Inversions", teacher: "Priya Sharma", style: "Ashtanga", level: "Advanced",
    durationMinutes: 60, spotsLeft: 5, totalSpots: 8, priceCAD: 22,
    nextSession: "Thu 8:00 AM", isOnline: false, tags: ["inversions", "headstand", "handstand", "advanced"],
    shortDescription: "Systematic progression through headstand, forearm balance, and handstand. Safety-first approach with spotting and wall work.",
    faqs: [
      { q: "What level is required?", a: "2+ years of consistent practice. Comfort with crow pose and shoulder stand recommended." },
      { q: "Is it safe to practice inversions?", a: "Yes, with proper instruction. Avoid if you have neck/shoulder injuries or high blood pressure." },
    ],
  },
  {
    id: "5", title: "Prenatal Yoga", teacher: "Anita Mehta", style: "Restorative", level: "All Levels",
    durationMinutes: 60, spotsLeft: 10, totalSpots: 10, priceCAD: 18,
    nextSession: "Sat 11:00 AM", isOnline: true, tags: ["prenatal", "pregnancy", "gentle"],
    shortDescription: "Safe, nurturing practice designed for all trimesters. Focuses on pelvic floor, breath, and labour preparation.",
    faqs: [
      { q: "Which trimester is this for?", a: "All trimesters welcome — poses are adapted for each stage with modifications." },
      { q: "Do I need a doctor's clearance?", a: "We recommend it, especially if you have any pregnancy complications." },
    ],
  },
  {
    id: "6", title: "Kundalini Awakening", teacher: "Raj Patel", style: "Kundalini", level: "Intermediate",
    durationMinutes: 90, spotsLeft: 7, totalSpots: 12, priceCAD: 20,
    nextSession: "Wed 7:30 PM", isOnline: true, tags: ["kundalini", "meditation", "breathing", "chanting"],
    shortDescription: "Traditional kriya practice combining dynamic poses, breathwork, mantra, and meditation to awaken energy and clarity.",
    faqs: [
      { q: "Do I need to chant?", a: "Chanting is optional but encouraged. The vibration has powerful calming effects." },
      { q: "What do people wear to Kundalini?", a: "White or light-coloured natural fabrics are traditional, but any comfortable clothing is fine." },
    ],
  },
];

const STYLES = ["All", "Hatha", "Vinyasa", "Yin", "Ashtanga", "Restorative", "Kundalini"];
const LEVELS = ["All", "Beginner", "Intermediate", "Advanced", "All Levels"];

const LEVEL_COLOR: Record<string, string> = {
  "Beginner": "bg-green-100 text-green-700",
  "Intermediate": "bg-yellow-100 text-yellow-700",
  "Advanced": "bg-red-100 text-red-700",
  "All Levels": "bg-blue-100 text-blue-700",
};

export default function CatalogPage() {
  const { track } = useAnalyticsContext();
  const [styleFilter, setStyleFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const filtered = CATALOG.filter(c => {
    const matchStyle = styleFilter === "All" || c.style === styleFilter;
    const matchLevel = levelFilter === "All" || c.level === levelFilter;
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.teacher.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchStyle && matchLevel && matchSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Class Catalog</h1>
          <p className="text-gray-500 mt-1">{filtered.length} classes available</p>
        </div>

        {/* Search */}
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search classes, teachers, or styles…"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white shadow-sm"
        />

        {/* Style filter */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Style</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map(s => (
              <button key={s} onClick={() => setStyleFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  styleFilter === s ? "bg-green-800 text-white" : "bg-white border border-gray-300 text-gray-800 hover:bg-green-50"
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {/* Level filter */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Level</p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevelFilter(l)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  levelFilter === l ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-purple-50"
                }`}>{l}</button>
            ))}
          </div>
        </div>

        {/* ONE ROW PER CLASS — full-width card with detail + FAQ */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No classes match your filters.</div>
          )}

          {filtered.map(cls => {
            const fillPct = ((cls.totalSpots - cls.spotsLeft) / cls.totalSpots) * 100;
            const isFaqOpen = expandedFaq === cls.id;

            return (
              <div key={cls.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                {/* Main row */}
                <div className="p-5">
                  {/* Top: badges + title */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLOR[cls.level]}`}>{cls.level}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{cls.style}</span>
                    {cls.isOnline && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Online</span>}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900">{cls.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">👩‍🏫 {cls.teacher} · ⏱ {cls.durationMinutes} min · 📅 {cls.nextSession}</p>
                  <p className="text-gray-600 text-sm mt-2 leading-relaxed">{cls.shortDescription}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {cls.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">{t}</span>
                    ))}
                  </div>

                  {/* Spots bar + CTA */}
                  <div className="flex items-center justify-between mt-4 gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs text-gray-700">
                        <span>{cls.spotsLeft > 0 ? `${cls.spotsLeft} spots left` : "Full"}</span>
                        <span>{cls.totalSpots} max</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${fillPct >= 90 ? "bg-red-400" : "bg-green-500"}`}
                             style={{ width: `${fillPct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-gray-900">${cls.priceCAD} <span className="text-xs text-gray-700 font-normal">CAD</span></div>
                      <Link href={`/booking/${cls.id}`}
                        onClick={() => track({ name: 'catalog_book_now_click', eventType: 'click', properties: { classId: cls.id, title: cls.title, style: cls.style, level: cls.level, priceCAD: cls.priceCAD } })}
                        className={`mt-1 inline-block px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                          cls.spotsLeft > 0
                            ? "bg-green-800 hover:bg-green-900 text-white"
                            : "bg-gray-200 text-gray-400 pointer-events-none"
                        }`}>
                        {cls.spotsLeft > 0 ? "Book Now" : "Full"}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* FAQ accordion */}
                {cls.faqs.length > 0 && (
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => setExpandedFaq(isFaqOpen ? null : cls.id)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                      <span>FAQs about this class ({cls.faqs.length})</span>
                      <span className="text-lg leading-none">{isFaqOpen ? "−" : "+"}</span>
                    </button>
                    {isFaqOpen && (
                      <div className="px-5 pb-4 space-y-3 bg-gray-50">
                        {cls.faqs.map((faq, i) => (
                          <div key={i}>
                            <p className="text-sm font-semibold text-gray-800">Q: {faq.q}</p>
                            <p className="text-sm text-gray-600 mt-0.5">A: {faq.a}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
