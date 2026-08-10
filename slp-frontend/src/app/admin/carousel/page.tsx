"use client";
import { useState } from "react";

const TABS = ["overview", "carousels", "slides", "settings", "analytics", "flowchart", "integrations"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview", carousels: "Carousels", slides: "Slides",
  settings: "Settings", analytics: "Analytics", flowchart: "Flowchart", integrations: "Integrations",
};

const LOCATIONS = ["hero","testimonials","gallery","teachers","services","promotions","classes","partners","videos","products"] as const;
const STATUSES = ["draft","active","paused","archived"] as const;
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700", archived: "bg-red-100 text-red-600",
};
const SLIDE_TYPES = ["image","video_mp4","youtube","vimeo"] as const;
const TYPE_COLORS: Record<string, string> = {
  image: "bg-blue-100 text-blue-700", video_mp4: "bg-purple-100 text-purple-700",
  youtube: "bg-red-100 text-red-700", vimeo: "bg-cyan-100 text-cyan-700",
};

const MOCK_CAROUSELS = [
  { id:"cr-1", name:"Homepage Hero", location:"hero", status:"active", slides:4, views:12800, clicks:384, ctr:3.0 },
  { id:"cr-2", name:"Teacher Profiles", location:"teachers", status:"active", slides:6, views:4200, clicks:210, ctr:5.0 },
  { id:"cr-3", name:"Testimonials", location:"testimonials", status:"active", slides:9, views:8300, clicks:166, ctr:2.0 },
  { id:"cr-4", name:"Gallery — Yoga Classes", location:"gallery", status:"active", slides:12, views:3100, clicks:93, ctr:3.0 },
  { id:"cr-5", name:"Class Videos", location:"videos", status:"paused", slides:5, views:1800, clicks:72, ctr:4.0 },
  { id:"cr-6", name:"Promotions — Diwali", location:"promotions", status:"draft", slides:3, views:0, clicks:0, ctr:0 },
];

const MOCK_SLIDES = [
  { id:"sl-1", carousel:"Homepage Hero", type:"image", status:"active", order:1, alt:"Morning Yoga at Dawn", scheduled:false, overlay:true, cta:"Book Now" },
  { id:"sl-2", carousel:"Homepage Hero", type:"video_mp4", status:"active", order:2, alt:"Intro reel", scheduled:false, overlay:true, cta:"Learn More" },
  { id:"sl-3", carousel:"Homepage Hero", type:"image", status:"active", order:3, alt:"Pranayama Session", scheduled:true, overlay:true, cta:"Join Us" },
  { id:"sl-4", carousel:"Homepage Hero", type:"image", status:"inactive", order:4, alt:"Evening Meditation", scheduled:false, overlay:false, cta:"" },
  { id:"sl-5", carousel:"Teacher Profiles", type:"image", status:"active", order:1, alt:"Ananya Sharma", scheduled:false, overlay:true, cta:"View Profile" },
  { id:"sl-6", carousel:"Class Videos", type:"video_mp4", status:"active", order:1, alt:"Hatha Yoga Basics", scheduled:false, overlay:true, cta:"Play" },
];

function KpiCard({ label, value, sub, color = "blue" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: "border-l-4 border-blue-500 bg-blue-50",
    green: "border-l-4 border-green-500 bg-green-50",
    amber: "border-l-4 border-amber-500 bg-amber-50",
    purple: "border-l-4 border-purple-500 bg-purple-50",
    teal: "border-l-4 border-teal-500 bg-teal-50",
    pink: "border-l-4 border-pink-500 bg-pink-50",
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

function OverviewTab() {
  const totalViews = MOCK_CAROUSELS.reduce((s, c) => s + c.views, 0);
  const totalClicks = MOCK_CAROUSELS.reduce((s, c) => s + c.clicks, 0);
  const avgCtr = totalViews > 0 ? Math.round((totalClicks / totalViews) * 100 * 100) / 100 : 0;
  const activeCount = MOCK_CAROUSELS.filter(c => c.status === "active").length;
  const totalSlides = MOCK_CAROUSELS.reduce((s, c) => s + c.slides, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Carousels" value={MOCK_CAROUSELS.length} sub="All locations" color="blue" />
        <KpiCard label="Active" value={activeCount} sub="Live now" color="green" />
        <KpiCard label="Total Slides" value={totalSlides} sub="Across all carousels" color="purple" />
        <KpiCard label="Total Views" value={totalViews.toLocaleString()} sub="This month" color="teal" />
        <KpiCard label="Total Clicks" value={totalClicks.toLocaleString()} sub="Slide interactions" color="amber" />
        <KpiCard label="Avg CTR" value={`${avgCtr}%`} sub="Click-through rate" color="pink" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Carousels by Status</h3>
          {STATUSES.map(s => {
            const count = MOCK_CAROUSELS.filter(c => c.status === s).length;
            return (
              <div key={s} className="flex items-center gap-3 mb-2">
                <Badge label={s} colorClass={STATUS_COLORS[s]} />
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(count / MOCK_CAROUSELS.length) * 100}%` }} />
                </div>
                <span className="text-sm font-medium w-4">{count}</span>
              </div>
            );
          })}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Top Carousels by CTR</h3>
          <div className="space-y-2">
            {[...MOCK_CAROUSELS].sort((a, b) => b.ctr - a.ctr).slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1 mr-3">{c.name}</span>
                <span className="font-bold text-amber-600">{c.ctr}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Carousels — Quick Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {MOCK_CAROUSELS.map(c => (
            <div key={c.id} className={`border rounded-lg p-3 ${c.status === "active" ? "border-green-200 bg-green-50" : c.status === "paused" ? "border-yellow-200 bg-yellow-50" : "border-gray-200"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 capitalize">{c.location}</span>
                <Badge label={c.status} colorClass={STATUS_COLORS[c.status]} />
              </div>
              <p className="font-medium text-sm text-gray-800 truncate">{c.name}</p>
              <p className="text-xs text-gray-400 mt-1">{c.slides} slides · {c.views.toLocaleString()} views</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CarouselsTab() {
  const [locFilter, setLocFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = MOCK_CAROUSELS.filter(c =>
    (locFilter === "all" || c.location === locFilter) &&
    (statusFilter === "all" || c.status === statusFilter)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="all">All Locations</option>
          {LOCATIONS.map(l => <option key={l}>{l}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="ml-auto bg-amber-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-400">+ New Carousel</button>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Location</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Slides</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Views</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Clicks</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">CTR</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3"><Badge label={c.location} colorClass="bg-gray-100 text-gray-600" /></td>
                <td className="px-4 py-3"><Badge label={c.status} colorClass={STATUS_COLORS[c.status]} /></td>
                <td className="px-4 py-3 text-right">{c.slides}</td>
                <td className="px-4 py-3 text-right">{c.views.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{c.clicks}</td>
                <td className="px-4 py-3 text-right font-medium text-amber-600">{c.ctr}%</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Slides</button>
                    <button className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Edit</button>
                    {c.status === "active" && <button className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Pause</button>}
                    {c.status === "draft" && <button className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Publish</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SlidesTab() {
  const SLIDE_STATUS_COLORS: Record<string, string> = {
    active: "bg-green-100 text-green-700", inactive: "bg-gray-100 text-gray-600",
    draft: "bg-blue-100 text-blue-700", scheduled: "bg-purple-100 text-purple-700",
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select className="border rounded px-3 py-2 text-sm">
          <option>All Carousels</option>
          {MOCK_CAROUSELS.map(c => <option key={c.id}>{c.name}</option>)}
        </select>
        <button className="bg-amber-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-400">+ Add Slide</button>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Alt / Label</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Carousel</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Overlay</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Scheduled</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">CTA</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_SLIDES.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{s.order}</td>
                <td className="px-4 py-3 font-medium max-w-xs truncate">{s.alt}</td>
                <td className="px-4 py-3"><Badge label={s.type} colorClass={TYPE_COLORS[s.type] || ""} /></td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.carousel}</td>
                <td className="px-4 py-3"><Badge label={s.status} colorClass={SLIDE_STATUS_COLORS[s.status] || ""} /></td>
                <td className="px-4 py-3 text-center">{s.overlay ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-center">{s.scheduled ? <span className="text-purple-500">📅</span> : "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.cta || "—"}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Edit</button>
                    <button className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState({
    autoplay: true, autoplayDelay: 6000, pauseOnHover: true,
    loop: true, speed: 600, effect: "slide",
    showArrows: true, showDots: true,
    touchEnabled: true, keyboardEnabled: true, lazyLoad: true,
    slidesPerView: 1, spaceBetween: 0,
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Default Carousel Settings</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-600 border-b pb-2">Autoplay</h4>
            {[
              { key: "autoplay", label: "Enable Autoplay" },
              { key: "pauseOnHover", label: "Pause on Hover" },
              { key: "loop", label: "Loop Slides" },
            ].map(f => (
              <label key={f.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{f.label}</span>
                <button
                  onClick={() => setSettings(s => ({ ...s, [f.key]: !s[f.key as keyof typeof s] }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${Boolean(settings[f.key as keyof typeof settings]) ? "bg-amber-500" : "bg-gray-200"}`}
                  role="switch"
                  aria-checked={Boolean(settings[f.key as keyof typeof settings])}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${Boolean(settings[f.key as keyof typeof settings]) ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </label>
            ))}
            <div>
              <label className="text-sm text-gray-700 block mb-1">Autoplay Delay (ms)</label>
              <input type="number" value={settings.autoplayDelay} onChange={e => setSettings(s => ({ ...s, autoplayDelay: +e.target.value }))} min={500} step={500} className="border rounded px-3 py-2 text-sm w-full" />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-600 border-b pb-2">Appearance</h4>
            {[
              { key: "showArrows", label: "Show Arrow Navigation" },
              { key: "showDots", label: "Show Dot Navigation" },
              { key: "touchEnabled", label: "Touch / Swipe Enabled" },
              { key: "keyboardEnabled", label: "Keyboard Navigation" },
              { key: "lazyLoad", label: "Lazy Load Media" },
            ].map(f => (
              <label key={f.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{f.label}</span>
                <button
                  onClick={() => setSettings(s => ({ ...s, [f.key]: !Boolean(s[f.key as keyof typeof s]) }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${Boolean(settings[f.key as keyof typeof settings]) ? "bg-amber-500" : "bg-gray-200"}`}
                  role="switch"
                  aria-checked={Boolean(settings[f.key as keyof typeof settings])}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${Boolean(settings[f.key as keyof typeof settings]) ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-700 block mb-1">Transition Effect</label>
            <select value={settings.effect} onChange={e => setSettings(s => ({ ...s, effect: e.target.value }))} className="border rounded px-3 py-2 text-sm w-full">
              {["slide","fade","coverflow","cube","flip"].map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-700 block mb-1">Slides Per View</label>
            <input type="number" value={settings.slidesPerView} min={1} max={6} onChange={e => setSettings(s => ({ ...s, slidesPerView: +e.target.value }))} className="border rounded px-3 py-2 text-sm w-full" />
          </div>
          <div>
            <label className="text-sm text-gray-700 block mb-1">Transition Speed (ms)</label>
            <input type="number" value={settings.speed} min={0} step={100} onChange={e => setSettings(s => ({ ...s, speed: +e.target.value }))} className="border rounded px-3 py-2 text-sm w-full" />
          </div>
        </div>

        <div className="mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Video safety policy:</strong> All video slides are muted by default with visible play/pause controls. Autoplay with sound is always disabled. Poster images required for all video slides.
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Views vs Clicks by Carousel</h3>
          <div className="space-y-3">
            {MOCK_CAROUSELS.map(c => (
              <div key={c.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium truncate max-w-36">{c.name}</span>
                  <span className="text-amber-600 font-bold">{c.ctr}% CTR</span>
                </div>
                <div className="flex gap-1">
                  <div className="bg-blue-500 h-2 rounded-l" style={{ width: `${(c.views / 12800) * 60}%` }} title={`${c.views} views`} />
                  <div className="bg-amber-400 h-2 rounded-r" style={{ width: `${(c.clicks / 384) * 20}%` }} title={`${c.clicks} clicks`} />
                </div>
              </div>
            ))}
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500 rounded inline-block" /> Views</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-amber-400 rounded inline-block" /> Clicks</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Slide Type Distribution</h3>
          <div className="space-y-2">
            {SLIDE_TYPES.map(t => {
              const count = MOCK_SLIDES.filter(s => s.type === t).length;
              return (
                <div key={t} className="flex items-center gap-3">
                  <Badge label={t} colorClass={TYPE_COLORS[t] || ""} />
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(count / MOCK_SLIDES.length) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-4">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
            <strong>Video policy reminder:</strong> {MOCK_SLIDES.filter(s => s.type === "video_mp4").length} video slides — all muted, with visible controls and poster images.
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">PostHog Event Tracking</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          {[
            { event: "carousel_viewed", count: "12,800", desc: "Carousel entered viewport" },
            { event: "slide_clicked", count: "384", desc: "CTA or slide clicked" },
            { event: "slide_changed", count: "5,200", desc: "Next/prev or autoplay advance" },
            { event: "video_played", count: "203", desc: "Video play button clicked" },
            { event: "lightbox_opened", count: "147", desc: "Gallery lightbox opened" },
            { event: "carousel_paused", count: "890", desc: "Hovered — autoplay paused" },
          ].map(e => (
            <div key={e.event} className="border rounded-lg p-3">
              <code className="text-xs text-blue-600 font-mono">{e.event}</code>
              <div className="text-xl font-bold mt-1">{e.count}</div>
              <div className="text-xs text-gray-400 mt-0.5">{e.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlowchartTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Carousel Lifecycle State Machine</h3>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          {[
            { state: "draft", color: "bg-gray-200 text-gray-700", border: "border-gray-300" },
            { arrow: "publish()" },
            { state: "active", color: "bg-green-200 text-green-800", border: "border-green-300" },
            { arrow: "pause()" },
            { state: "paused", color: "bg-yellow-200 text-yellow-800", border: "border-yellow-300" },
            { arrow: "resume()" },
            { state: "active", color: "bg-green-200 text-green-800", border: "border-green-300" },
            { arrow: "archive()" },
            { state: "archived", color: "bg-red-200 text-red-700", border: "border-red-200" },
          ].map((n, i) => (
            "state" in n ? (
              <div key={i} className={`px-4 py-2 rounded-lg font-medium border shadow-sm ${n.color} ${n.border}`}>{n.state}</div>
            ) : (
              <div key={i} className="flex items-center gap-1 text-gray-400 text-xs">
                <span>{n.arrow}</span><span>→</span>
              </div>
            )
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Slide Type Decision Tree</h3>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          {[
            { type: "image", label: "Static Image", uses: "Hero, gallery, promotions, teachers", requirements: "Alt text required, lazy load, poster optional", icon: "🖼️" },
            { type: "video_mp4", label: "MP4 Video", uses: "Hero video, class videos, intro reels", requirements: "Muted=true, poster required, controls shown", icon: "🎬" },
            { type: "youtube", label: "YouTube Embed", uses: "Published class recordings, vlogs", requirements: "Muted embed, no autoplay sound, privacy mode", icon: "▶️" },
            { type: "vimeo", label: "Vimeo Embed", uses: "Professional showcase videos", requirements: "Muted embed, title + alt description required", icon: "🎥" },
          ].map(t => (
            <div key={t.type} className="border rounded-lg p-4">
              <div className="text-2xl mb-2">{t.icon}</div>
              <div className="font-semibold text-gray-900">{t.label}</div>
              <Badge label={t.type} colorClass={TYPE_COLORS[t.type] || ""} />
              <p className="text-xs text-gray-500 mt-2"><strong>Use for:</strong> {t.uses}</p>
              <p className="text-xs text-amber-700 mt-1 bg-amber-50 rounded p-1">{t.requirements}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">10 Portal Locations × Component Map</h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {[
            { loc: "hero", component: "SwiperHero", desc: "Full-height hero with image + video slides and animated content overlays" },
            { loc: "testimonials", component: "TestimonialCarousel", desc: "3-up card carousel with star ratings, quote, avatar" },
            { loc: "gallery", component: "GalleryCarousel", desc: "Masonry-style grid with lightbox — images + videos" },
            { loc: "teachers", component: "TeacherCarousel", desc: "Teacher profile cards with inline video intro preview" },
            { loc: "services", component: "ServiceCarousel (CSS marquee)", desc: "Infinite horizontal scroll — no Swiper, pure CSS" },
            { loc: "promotions", component: "SwiperHero (promo mode)", desc: "Compact banner slides with countdown overlay" },
            { loc: "classes", component: "ClassVideoCarousel", desc: "Class preview video cards with play/pause, progress bar" },
            { loc: "partners", component: "Marquee (CSS)", desc: "Partner logo continuous scroll" },
            { loc: "videos", component: "ClassVideoCarousel", desc: "Full yoga video library browser" },
            { loc: "products", component: "TeacherCarousel (product mode)", desc: "Product card carousel for yoga mat/props shop" },
          ].map(m => (
            <div key={m.loc} className="flex items-start gap-3 border rounded-lg p-3">
              <Badge label={m.loc} colorClass="bg-gray-100 text-gray-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-xs text-blue-700 font-mono">{m.component}</p>
                <p className="text-xs text-gray-500">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const DB_TABLES = [
    { name: "carousel", desc: "Master carousel record — location, status, settings" },
    { name: "carousel_slide", desc: "Individual slides: image/video/youtube/vimeo" },
    { name: "carousel_slide_overlay", desc: "Heading, subheading, CTA text, position" },
    { name: "carousel_analytics", desc: "Views, clicks, CTR per carousel" },
    { name: "carousel_slide_analytics", desc: "Per-slide views, clicks, play events" },
    { name: "carousel_schedule", desc: "Slide activeFrom/activeTo scheduling" },
    { name: "carousel_audit", desc: "Full audit trail for all mutations" },
    { name: "carousel_notification", desc: "Novu alerts for publish/archive events" },
  ];

  const MCP_TOOLS = [
    { name: "list_carousels", tier: "auto" },
    { name: "get_carousel", tier: "auto" },
    { name: "create_carousel", tier: "staff" },
    { name: "update_carousel", tier: "staff" },
    { name: "add_slide", tier: "staff" },
    { name: "update_slide", tier: "staff" },
    { name: "reorder_slides", tier: "staff" },
    { name: "get_analytics", tier: "staff" },
    { name: "schedule_slide", tier: "staff" },
    { name: "publish_carousel", tier: "staff_approval" },
    { name: "archive_carousel", tier: "staff_approval" },
    { name: "delete_carousel", tier: "admin_destructive" },
  ];

  const TIER_COLORS: Record<string, string> = {
    auto: "bg-green-100 text-green-700",
    staff: "bg-blue-100 text-blue-700",
    staff_approval: "bg-orange-100 text-orange-700",
    admin_destructive: "bg-red-100 text-red-700",
  };

  const COMPONENTS = [
    { name: "SwiperHero", file: "components/carousel/SwiperHero.tsx", desc: "Hero with image + video, overlays, arrows, dots, keyboard" },
    { name: "GalleryCarousel", file: "components/carousel/GalleryCarousel.tsx", desc: "Grid gallery with lightbox, categories, lazy load" },
    { name: "TeacherCarousel", file: "components/carousel/TeacherCarousel.tsx", desc: "Teacher cards with inline muted video intro preview" },
    { name: "TestimonialCarousel", file: "components/carousel/TestimonialCarousel.tsx", desc: "3-up testimonial cards with stars, avatar, yoga style tag" },
    { name: "ClassVideoCarousel", file: "components/carousel/ClassVideoCarousel.tsx", desc: "Video cards with play/pause, muted label, progress bar" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Database Tables (8)</h3>
          <div className="space-y-1.5">
            {DB_TABLES.map(t => (
              <div key={t.name} className="flex items-start gap-2">
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-blue-700 whitespace-nowrap">{t.name}</code>
                <span className="text-xs text-gray-500">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">MCP Tools (12)</h3>
          <div className="space-y-1.5">
            {MCP_TOOLS.map(t => (
              <div key={t.name} className="flex items-center justify-between">
                <code className="text-xs font-mono text-gray-700">{t.name}</code>
                <Badge label={t.tier} colorClass={TIER_COLORS[t.tier] || ""} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">React Components (5)</h3>
        <div className="space-y-2">
          {COMPONENTS.map(c => (
            <div key={c.name} className="flex items-start gap-3 border rounded-lg p-3">
              <div>
                <p className="font-semibold text-sm text-blue-700">{c.name}</p>
                <code className="text-xs text-gray-400 font-mono">{c.file}</code>
                <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">External Dependencies</h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {[
            { name: "swiper ^14", role: "npm package — installed; used for future Swiper API migration" },
            { name: "PostHog", role: "carousel_viewed, slide_clicked, video_played events" },
            { name: "MinIO / S3", role: "Media storage for slide images and MP4 videos" },
            { name: "Novu", role: "Publish/archive notifications to content team" },
            { name: "next/image", role: "Lazy loading with priority flag on first slide" },
            { name: "GrowthBook", role: "A/B test carousel effects and autoplay delay" },
          ].map(s => (
            <div key={s.name} className="flex gap-2 items-start border rounded p-2">
              <span className="font-medium text-blue-700 w-28 flex-shrink-0">{s.name}</span>
              <span className="text-gray-500 text-xs">{s.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CarouselAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const TAB_CONTENT: Record<Tab, React.ReactElement> = {
    overview: <OverviewTab />, carousels: <CarouselsTab />, slides: <SlidesTab />,
    settings: <SettingsTab />, analytics: <AnalyticsTab />, flowchart: <FlowchartTab />, integrations: <IntegrationsTab />,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carousel / Slider Management</h1>
            <p className="text-sm text-gray-500 mt-1">Hero · Gallery · Teachers · Testimonials · Class Videos · Promotions</p>
          </div>
          <div className="flex gap-2">
            <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-medium">Wave 12</span>
            <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">Swiper v14</span>
          </div>
        </div>

        <div className="flex gap-1 border-b overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div>{TAB_CONTENT[activeTab]}</div>
      </div>
    </div>
  );
}
