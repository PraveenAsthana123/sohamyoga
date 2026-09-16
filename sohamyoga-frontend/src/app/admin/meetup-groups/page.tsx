'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, string> = {
  meetup: '🟠', facebook: '🔵', linkedin: '💼', discord: '🟣',
  whatsapp: '🟢', eventbrite: '🔴', zoom: '💙', google_meet: '🟩',
};

const CATEGORY_COLORS: Record<string, string> = {
  tech: 'bg-blue-100 text-blue-800',
  business: 'bg-green-100 text-green-800',
  health_wellness: 'bg-emerald-100 text-emerald-800',
  arts_culture: 'bg-purple-100 text-purple-800',
  education: 'bg-yellow-100 text-yellow-800',
  social: 'bg-orange-100 text-orange-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  tech: 'Tech & Startup', business: 'Business & Networking',
  health_wellness: 'Health & Wellness', arts_culture: 'Arts & Culture',
  education: 'Education', social: 'Social & Hobbies',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);
const FREQUENCIES = ['weekly','bi_weekly','monthly','quarterly','ad_hoc'];
const EVENT_TYPES = ['in_person','virtual','hybrid'];
const EVENT_CATEGORIES = ['workshop','networking','social','presentation','hackathon','panel','ama','meetup'];
const PLATFORMS_VIRTUAL = ['google_meet','zoom','ms_teams','discord','youtube_live'];
const RSVP_SOURCES = ['meetup','facebook','linkedin','eventbrite','discord','whatsapp','referral','direct'];
const MEMBER_ROLES = ['member','organizer','co_organizer','volunteer','speaker'];
const CONTENT_TYPES = [
  { value: 'event_description', label: 'Event Description (Meetup.com style)' },
  { value: 'social_post', label: 'Social Post' },
  { value: 'reminder_email', label: '48h Reminder Email' },
  { value: 'welcome_message', label: 'Welcome Message (New Member)' },
  { value: 'recap_post', label: 'Post-Event Recap' },
];
const SOCIAL_PLATFORMS = ['facebook','linkedin','discord','whatsapp'];

// ─── Types ────────────────────────────────────────────────────────────────────

type Group = {
  id: number; name: string; slug: string; category: string; subcategory: string | null;
  description: string | null; city: string; province: string; meeting_frequency: string;
  typical_venue: string | null; max_members: number; current_members: number;
  organizer_name: string | null; organizer_email: string | null;
  meetup_url: string | null; facebook_group_url: string | null;
  linkedin_group_url: string | null; discord_invite_url: string | null;
  whatsapp_group_url: string | null; eventbrite_organizer_url: string | null;
  is_free: boolean; membership_fee: string | null; status: string;
  tags: string[]; created_at: string;
  event_count: string; member_count_live: string;
};

type MeetupEvent = {
  id: number; group_id: number; title: string; description: string | null;
  event_type: string; category: string | null; venue_name: string | null;
  venue_address: string | null; city: string;
  google_meet_url: string | null; zoom_url: string | null; platform: string | null;
  start_time: string; end_time: string | null; timezone: string;
  max_attendees: number | null; rsvp_deadline: string | null;
  waitlist_enabled: boolean; is_free: boolean; price: string | null;
  eventbrite_url: string | null; posted_to: string[]; status: string;
  actual_attendees: number | null; recording_url: string | null; notes: string | null;
  created_at: string;
  group_name?: string; group_category?: string; rsvp_count?: string;
};

type RSVP = {
  id: number; event_id: number; group_id: number; name: string;
  email: string | null; phone: string | null; source: string; status: string;
  dietary_requirements: string | null; notes: string | null; rsvp_at: string;
};

type Member = {
  id: number; group_id: number; name: string; email: string | null;
  phone: string | null; joined_date: string; source: string | null;
  events_attended: number; last_attended: string | null; role: string;
  status: string; interests: string[]; notes: string | null; created_at: string;
};

type Stats = {
  total_groups: string; total_members: string; events_this_month: string;
  upcoming_events: string; total_rsvps_this_month: string; platform_reach: number;
  by_category: { category: string; count: string; members: string }[];
};

type Analytics = {
  growth_by_month: { month: string; new_members: string; events_held: string; total_rsvps: string }[];
  top_groups_by_attendance: { group_name: string; avg_attendance: string; total_events: string; total_attended: string }[];
  rsvp_to_show_rate: number;
  platform_breakdown: { platform: string; rsvps_from_platform: string }[];
  category_engagement: { category: string; groups_count: string; members: string; events: string; avg_rsvps: string }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dt: string) {
  return new Date(dt).toLocaleString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupPlatforms(g: Group): { key: string; icon: string; url: string }[] {
  const map: [string, string | null][] = [
    ['meetup', g.meetup_url], ['facebook', g.facebook_group_url],
    ['linkedin', g.linkedin_group_url], ['discord', g.discord_invite_url],
    ['whatsapp', g.whatsapp_group_url], ['eventbrite', g.eventbrite_organizer_url],
  ];
  return map.filter(([, url]) => url).map(([key, url]) => ({ key, icon: PLATFORM_ICONS[key], url: url! }));
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700', published: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700', completed: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700', paused: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-gray-200 text-gray-500',
  };
  return <Badge label={status} color={colors[status] ?? 'bg-gray-100 text-gray-600'} />;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    in_person: 'bg-amber-100 text-amber-700',
    virtual: 'bg-sky-100 text-sky-700',
    hybrid: 'bg-indigo-100 text-indigo-700',
  };
  return <Badge label={type.replace('_', ' ')} color={colors[type] ?? 'bg-gray-100 text-gray-600'} />;
}

function CssBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MeetupGroupsPage() {
  const [tab, setTab] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<MeetupEvent[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFreq, setFilterFreq] = useState('');
  const [filterFree, setFilterFree] = useState('');
  const [filterGroupStatus, setFilterGroupStatus] = useState('active');
  const [filterEventGroup, setFilterEventGroup] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterEventStatus, setFilterEventStatus] = useState('');
  const [filterEventCat, setFilterEventCat] = useState('');
  const [filterUpcoming, setFilterUpcoming] = useState(true);

  // Modals
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showAddRsvp, setShowAddRsvp] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MeetupEvent | null>(null);
  const [rsvpEventId, setRsvpEventId] = useState<number | null>(null);
  const [memberGroupId, setMemberGroupId] = useState<number | null>(null);

  // Event detail
  const [eventDetail, setEventDetail] = useState<{ event: MeetupEvent; rsvps: RSVP[]; by_source: { platform: string; count: string }[]; by_status: { status: string; count: string }[] } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersGroupId, setMembersGroupId] = useState<number | ''>('');
  const [filterMemberRole, setFilterMemberRole] = useState('');
  const [filterMemberStatus, setFilterMemberStatus] = useState('active');

  // AI Content Studio
  const [aiGroup, setAiGroup] = useState('');
  const [aiEvent, setAiEvent] = useState('');
  const [aiContentType, setAiContentType] = useState('event_description');
  const [aiPlatform, setAiPlatform] = useState('facebook');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiContent, setAiContent] = useState('');
  const [aiCopied, setAiCopied] = useState(false);

  // Reminder
  const [reminderContent, setReminderContent] = useState('');
  const [reminderEventId, setReminderEventId] = useState<number | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/meetup-groups');
      const data = await res.json() as { groups: Group[]; stats: Stats };
      setGroups(data.groups || []);
      setStats(data.stats || null);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEventGroup) params.set('group_id', filterEventGroup);
    if (filterEventType) params.set('event_type', filterEventType);
    if (filterEventStatus) params.set('status', filterEventStatus);
    if (filterEventCat) params.set('category', filterEventCat);
    if (filterUpcoming) params.set('upcoming', 'true');
    const res = await fetch(`/api/admin/meetup-groups/events?${params}`);
    const data = await res.json() as { events: MeetupEvent[] };
    setEvents(data.events || []);
  }, [filterEventGroup, filterEventType, filterEventStatus, filterEventCat, filterUpcoming]);

  const loadAnalytics = useCallback(async () => {
    const res = await fetch('/api/admin/meetup-groups/analytics');
    const data = await res.json() as Analytics;
    setAnalytics(data);
  }, []);

  const loadMembers = useCallback(async () => {
    if (!membersGroupId) return;
    const params = new URLSearchParams();
    if (filterMemberRole) params.set('role', filterMemberRole);
    if (filterMemberStatus) params.set('status', filterMemberStatus);
    const res = await fetch(`/api/admin/meetup-groups/${membersGroupId}/members?${params}`);
    const data = await res.json() as { members: Member[] };
    setMembers(data.members || []);
  }, [membersGroupId, filterMemberRole, filterMemberStatus]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 2) loadEvents(); }, [tab, loadEvents]);
  useEffect(() => { if (tab === 6) loadAnalytics(); }, [tab, loadAnalytics]);
  useEffect(() => { if (tab === 4) loadMembers(); }, [tab, loadMembers, membersGroupId]);

  // ── Upcoming events for dashboard ────────────────────────────────────────

  const [upcomingEvents, setUpcomingEvents] = useState<MeetupEvent[]>([]);
  useEffect(() => {
    fetch('/api/admin/meetup-groups/events?upcoming=true')
      .then(r => r.json())
      .then((d: { events: MeetupEvent[] }) => setUpcomingEvents((d.events || []).slice(0, 10)));
  }, []);

  // ── Filtered groups ───────────────────────────────────────────────────────

  const filteredGroups = groups.filter(g => {
    if (filterCategory && g.category !== filterCategory) return false;
    if (filterFreq && g.meeting_frequency !== filterFreq) return false;
    if (filterFree === 'free' && !g.is_free) return false;
    if (filterFree === 'paid' && g.is_free) return false;
    if (filterGroupStatus && g.status !== filterGroupStatus) return false;
    return true;
  });

  // ── Event detail loader ──────────────────────────────────────────────────

  const openEventDetail = async (ev: MeetupEvent) => {
    setSelectedEvent(ev);
    const res = await fetch(`/api/admin/meetup-groups/events/${ev.id}`);
    const data = await res.json() as typeof eventDetail;
    setEventDetail(data);
  };

  // ── Create Group ──────────────────────────────────────────────────────────

  const [gf, setGf] = useState({
    name: '', category: 'tech', subcategory: '', description: '', city: 'Calgary',
    meeting_frequency: 'monthly', typical_venue: '', max_members: 100,
    organizer_name: '', organizer_email: '',
    meetup_url: '', facebook_group_url: '', linkedin_group_url: '',
    discord_invite_url: '', whatsapp_group_url: '', eventbrite_organizer_url: '',
    is_free: true, membership_fee: '', tags: '',
  });
  const [gfSaving, setGfSaving] = useState(false);
  const [gfError, setGfError] = useState('');

  const createGroup = async () => {
    if (!gf.name.trim()) { setGfError('Name required.'); return; }
    setGfSaving(true); setGfError('');
    try {
      const res = await fetch('/api/admin/meetup-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...gf,
          max_members: Number(gf.max_members),
          membership_fee: gf.membership_fee ? parseFloat(gf.membership_fee) : null,
          tags: gf.tags.split(',').map(t => t.trim()).filter(Boolean),
          meetup_url: gf.meetup_url || null,
          facebook_group_url: gf.facebook_group_url || null,
          linkedin_group_url: gf.linkedin_group_url || null,
          discord_invite_url: gf.discord_invite_url || null,
          whatsapp_group_url: gf.whatsapp_group_url || null,
          eventbrite_organizer_url: gf.eventbrite_organizer_url || null,
        }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; setGfError(d.error); return; }
      setShowCreateGroup(false);
      setGf({ name:'',category:'tech',subcategory:'',description:'',city:'Calgary',meeting_frequency:'monthly',typical_venue:'',max_members:100,organizer_name:'',organizer_email:'',meetup_url:'',facebook_group_url:'',linkedin_group_url:'',discord_invite_url:'',whatsapp_group_url:'',eventbrite_organizer_url:'',is_free:true,membership_fee:'',tags:'' });
      loadDashboard();
    } finally { setGfSaving(false); }
  };

  // ── Create Event ──────────────────────────────────────────────────────────

  const [ef, setEf] = useState({
    group_id: '', title: '', description: '', event_type: 'in_person',
    category: 'meetup', venue_name: '', venue_address: '',
    platform: 'google_meet', start_time: '', end_time: '',
    max_attendees: '', rsvp_deadline: '', waitlist_enabled: false,
    is_free: true, price: '', eventbrite_url: '',
    posted_to: [] as string[], status: 'published',
    generatedMeetUrl: '',
  });
  const [efSaving, setEfSaving] = useState(false);
  const [efError, setEfError] = useState('');

  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * 26)]).join('');
  const genMeetUrl = () => `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;

  useEffect(() => {
    if ((ef.event_type === 'virtual' || ef.event_type === 'hybrid') && ef.platform === 'google_meet') {
      if (!ef.generatedMeetUrl) setEf(p => ({ ...p, generatedMeetUrl: genMeetUrl() }));
    } else {
      setEf(p => ({ ...p, generatedMeetUrl: '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ef.event_type, ef.platform]);

  const createEvent = async () => {
    if (!ef.group_id || !ef.title || !ef.start_time) { setEfError('Group, title, and start time required.'); return; }
    setEfSaving(true); setEfError('');
    try {
      const res = await fetch('/api/admin/meetup-groups/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: parseInt(ef.group_id, 10),
          title: ef.title, description: ef.description || null,
          event_type: ef.event_type, category: ef.category,
          venue_name: ef.venue_name || null, venue_address: ef.venue_address || null,
          platform: ef.platform,
          start_time: ef.start_time, end_time: ef.end_time || null,
          max_attendees: ef.max_attendees ? parseInt(ef.max_attendees, 10) : null,
          rsvp_deadline: ef.rsvp_deadline || null,
          waitlist_enabled: ef.waitlist_enabled,
          is_free: ef.is_free,
          price: ef.price ? parseFloat(ef.price) : null,
          eventbrite_url: ef.eventbrite_url || null,
          posted_to: ef.posted_to, status: ef.status,
        }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; setEfError(d.error); return; }
      setShowCreateEvent(false);
      loadEvents();
    } finally { setEfSaving(false); }
  };

  // ── Add RSVP ──────────────────────────────────────────────────────────────

  const [rf, setRf] = useState({ name: '', email: '', phone: '', source: 'direct', dietary_requirements: '', notes: '' });
  const [rfSaving, setRfSaving] = useState(false);

  const addRsvp = async () => {
    if (!rsvpEventId || !rf.name.trim()) return;
    setRfSaving(true);
    await fetch(`/api/admin/meetup-groups/events/${rsvpEventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rsvp', ...rf }),
    });
    setRfSaving(false);
    setShowAddRsvp(false);
    setRf({ name:'',email:'',phone:'',source:'direct',dietary_requirements:'',notes:'' });
    if (selectedEvent) openEventDetail(selectedEvent);
  };

  // ── Add Member ────────────────────────────────────────────────────────────

  const [mf, setMf] = useState({ name: '', email: '', phone: '', source: '', role: 'member', interests: '', notes: '' });
  const [mfSaving, setMfSaving] = useState(false);

  const addMember = async () => {
    if (!memberGroupId || !mf.name.trim()) return;
    setMfSaving(true);
    await fetch(`/api/admin/meetup-groups/${memberGroupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mf,
        interests: mf.interests.split(',').map(s => s.trim()).filter(Boolean),
      }),
    });
    setMfSaving(false);
    setShowAddMember(false);
    setMf({ name:'',email:'',phone:'',source:'',role:'member',interests:'',notes:'' });
    loadMembers();
  };

  // ── Reminder ──────────────────────────────────────────────────────────────

  const sendReminder = async (eventId: number) => {
    setReminderEventId(eventId);
    setReminderContent('Generating reminder…');
    const res = await fetch(`/api/admin/meetup-groups/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remind' }),
    });
    const data = await res.json() as { content: string };
    setReminderContent(data.content || '');
  };

  // ── AI Generate ───────────────────────────────────────────────────────────

  const generateContent = async () => {
    setAiGenerating(true); setAiContent('');
    const selectedGroupObj = groups.find(g => g.id === parseInt(aiGroup, 10));
    const selectedEventObj = events.find(e => e.id === parseInt(aiEvent, 10));
    const res = await fetch('/api/admin/meetup-groups/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_type: aiContentType,
        group_name: selectedGroupObj?.name || '',
        event_title: selectedEventObj?.title || '',
        event_description: selectedEventObj?.description || '',
        category: selectedGroupObj?.category || '',
        platform: aiContentType === 'social_post' ? aiPlatform : undefined,
      }),
    });
    const data = await res.json() as { content: string };
    setAiContent(data.content || '');
    setAiGenerating(false);
  };

  const copyAi = async () => {
    await navigator.clipboard.writeText(aiContent);
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 2000);
  };

  // ── Mark complete ─────────────────────────────────────────────────────────

  const markComplete = async (eventId: number, actual: number) => {
    await fetch(`/api/admin/meetup-groups/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', actual_attendees: actual }),
    });
    loadEvents();
  };

  const cancelEvent = async (eventId: number) => {
    await fetch(`/api/admin/meetup-groups/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    loadEvents();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const TABS = [
    'Community Dashboard', 'Groups', 'Events', 'RSVPs & Attendance',
    'Members', 'AI Content Studio', 'Analytics',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meetup Groups Hub</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Multi-group community management · Calgary · Meetup + Google Meet + Eventbrite + Social
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + New Group
            </button>
            <button
              onClick={() => setShowCreateEvent(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
            >
              + New Event
            </button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={i}
              onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === i
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}
        {loading && tab === 0 && (
          <div className="text-center text-gray-400 py-12">Loading community data…</div>
        )}

        {/* ── TAB 0: Community Dashboard ──────────────────────────────────── */}
        {tab === 0 && stats && (
          <div className="space-y-6">
            {/* Hero Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Groups', value: stats.total_groups, color: 'text-blue-600' },
                { label: 'Total Members', value: stats.total_members, color: 'text-green-600' },
                { label: 'Events This Month', value: stats.events_this_month, color: 'text-purple-600' },
                { label: 'Upcoming Events', value: stats.upcoming_events, color: 'text-orange-600' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Platform Reach + RSVPs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Platform Reach</h3>
                <div className="text-4xl font-bold text-indigo-600">{stats.platform_reach}</div>
                <p className="text-sm text-gray-500 mt-1">Active platform channel connections across all groups</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.entries(PLATFORM_ICONS).map(([k, icon]) => (
                    <span key={k} className="text-lg" title={k}>{icon}</span>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-3">RSVPs This Month</h3>
                <div className="text-4xl font-bold text-pink-600">{stats.total_rsvps_this_month}</div>
                <p className="text-sm text-gray-500 mt-1">Community engagement momentum</p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Communities by Category</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORIES.map(cat => {
                  const found = stats.by_category.find(c => c.category === cat);
                  return (
                    <div key={cat} className={`rounded-lg p-4 ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-700'}`}>
                      <div className="font-semibold text-sm">{CATEGORY_LABELS[cat]}</div>
                      <div className="text-2xl font-bold mt-1">{found?.count ?? 0}</div>
                      <div className="text-xs mt-0.5 opacity-75">{found?.members ?? 0} members</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Events */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Upcoming Events — Next 14 Days</h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-gray-400 text-sm">No upcoming events scheduled.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {upcomingEvents.map(ev => (
                    <div key={ev.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{ev.title}</div>
                        <div className="text-xs text-gray-500">{ev.group_name} · {fmt(ev.start_time)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <TypeBadge type={ev.event_type} />
                        <span className="text-xs text-gray-500">{ev.rsvp_count ?? 0} RSVPs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 1: Groups ───────────────────────────────────────────────── */}
        {tab === 1 && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              <select value={filterFreq} onChange={e => setFilterFreq(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All Frequencies</option>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
              </select>
              <select value={filterFree} onChange={e => setFilterFree(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Free & Paid</option>
                <option value="free">Free Only</option>
                <option value="paid">Paid Only</option>
              </select>
              <select value={filterGroupStatus} onChange={e => setFilterGroupStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
              <span className="text-sm text-gray-500 self-center">{filteredGroups.length} groups</span>
            </div>

            {/* Group Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map(g => {
                const platforms = groupPlatforms(g);
                return (
                  <div
                    key={g.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedGroup(g)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 leading-tight">{g.name}</h3>
                      <StatusBadge status={g.status} />
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge label={CATEGORY_LABELS[g.category] || g.category} color={CATEGORY_COLORS[g.category] || 'bg-gray-100 text-gray-700'} />
                      {g.subcategory && <span className="text-xs text-gray-500 self-center">{g.subcategory}</span>}
                    </div>
                    {g.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{g.description}</p>}
                    <div className="flex justify-between text-sm text-gray-600 mb-3">
                      <span>👥 {g.member_count_live} members</span>
                      <span>📅 {g.event_count} events</span>
                      <span>🔄 {g.meeting_frequency.replace('_',' ')}</span>
                    </div>
                    {platforms.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mb-3">
                        {platforms.map(p => (
                          <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title={p.key} className="text-lg hover:opacity-80">
                            {p.icon}
                          </a>
                        ))}
                      </div>
                    )}
                    {g.organizer_name && (
                      <div className="text-xs text-gray-400">Organizer: {g.organizer_name}</div>
                    )}
                  </div>
                );
              })}
              {filteredGroups.length === 0 && (
                <div className="col-span-3 text-center text-gray-400 py-12">No groups match the current filters.</div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: Events ───────────────────────────────────────────────── */}
        {tab === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
              <select value={filterEventGroup} onChange={e => { setFilterEventGroup(e.target.value); }} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All Groups</option>
                {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              </select>
              <select value={filterEventType} onChange={e => setFilterEventType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All Types</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </select>
              <select value={filterEventStatus} onChange={e => setFilterEventStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All Statuses</option>
                {['draft','published','cancelled','completed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterEventCat} onChange={e => setFilterEventCat(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All Categories</option>
                {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={filterUpcoming} onChange={e => setFilterUpcoming(e.target.checked)} className="rounded" />
                Upcoming only
              </label>
              <button onClick={loadEvents} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
                Filter
              </button>
            </div>

            <div className="space-y-3">
              {events.map(ev => (
                <div key={ev.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-gray-900">{ev.title}</h3>
                        <TypeBadge type={ev.event_type} />
                        <StatusBadge status={ev.status} />
                        {ev.category && <Badge label={ev.category} color="bg-gray-100 text-gray-600" />}
                      </div>
                      <div className="text-sm text-gray-500 mb-1">
                        {ev.group_name} · {fmt(ev.start_time)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {ev.event_type === 'in_person' || ev.event_type === 'hybrid'
                          ? ev.venue_name ? `📍 ${ev.venue_name}` : ''
                          : ''}
                        {ev.google_meet_url && (
                          <span className="ml-2">{PLATFORM_ICONS.google_meet}
                            <a href={ev.google_meet_url} target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 underline text-xs ml-1">{ev.google_meet_url}</a>
                          </span>
                        )}
                        {ev.zoom_url && <span className="ml-2">{PLATFORM_ICONS.zoom} Zoom configured</span>}
                      </div>
                      {ev.posted_to.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {ev.posted_to.map(p => <span key={p} className="text-base" title={p}>{PLATFORM_ICONS[p] || p}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-sm font-medium text-gray-700">
                        {ev.rsvp_count ?? 0}{ev.max_attendees ? `/${ev.max_attendees}` : ''} RSVPs
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <button onClick={() => openEventDetail(ev)}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                          View RSVPs
                        </button>
                        <button onClick={() => sendReminder(ev.id)}
                          className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100">
                          Send Reminder
                        </button>
                        {ev.status === 'published' && (
                          <button onClick={() => {
                            const actual = parseInt(prompt('Actual attendees count:') || '0', 10);
                            if (!isNaN(actual)) markComplete(ev.id, actual);
                          }}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">
                            Mark Complete
                          </button>
                        )}
                        {ev.status !== 'cancelled' && ev.status !== 'completed' && (
                          <button onClick={() => cancelEvent(ev.id)}
                            className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Reminder output */}
                  {reminderEventId === ev.id && reminderContent && (
                    <div className="mt-3 bg-purple-50 rounded-lg p-3 text-sm text-gray-700 relative">
                      <pre className="whitespace-pre-wrap font-sans">{reminderContent}</pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(reminderContent)}
                        className="absolute top-2 right-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {events.length === 0 && (
                <div className="text-center text-gray-400 py-12">No events found. Try adjusting filters or create a new event.</div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: RSVPs & Attendance ────────────────────────────────────── */}
        {tab === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
              <select
                value={selectedEvent?.id ?? ''}
                onChange={async e => {
                  const ev = events.find(ev => String(ev.id) === e.target.value);
                  if (ev) await openEventDetail(ev);
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48"
              >
                <option value="">Select an event…</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title} — {fmt(ev.start_time)}</option>
                ))}
              </select>
              {selectedEvent && (
                <button
                  onClick={() => { setRsvpEventId(selectedEvent.id); setShowAddRsvp(true); }}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700"
                >
                  + Add RSVP
                </button>
              )}
            </div>

            {eventDetail && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['going','waitlist','attended','no_show'] as const).map(s => {
                    const row = eventDetail.by_status.find(b => b.status === s);
                    const colors: Record<string, string> = {
                      going: 'text-green-600', waitlist: 'text-yellow-600',
                      attended: 'text-blue-600', no_show: 'text-red-500',
                    };
                    return (
                      <div key={s} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className={`text-2xl font-bold ${colors[s]}`}>{row?.count ?? 0}</div>
                        <div className="text-xs text-gray-500 capitalize mt-1">{s.replace('_',' ')}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Show rate */}
                {(() => {
                  const going = Number(eventDetail.by_status.find(b => b.status === 'going')?.count ?? 0)
                    + Number(eventDetail.by_status.find(b => b.status === 'attended')?.count ?? 0);
                  const attended = Number(eventDetail.by_status.find(b => b.status === 'attended')?.count ?? 0);
                  const rate = going > 0 ? Math.round((attended / going) * 100) : 0;
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Show Rate</span>
                        <span className="font-semibold">{rate}%</span>
                      </div>
                      <CssBar value={attended} max={going} color="bg-blue-500" />
                    </div>
                  );
                })()}

                {/* Bulk action */}
                {selectedEvent?.status === 'completed' && (
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        for (const r of eventDetail.rsvps.filter(r => r.status === 'going')) {
                          await fetch(`/api/admin/meetup-groups/events/${r.event_id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'rsvp_update', rsvpId: r.id, status: 'attended' }),
                          });
                        }
                        if (selectedEvent) await openEventDetail(selectedEvent);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      Mark All Going as Attended
                    </button>
                  </div>
                )}

                {/* RSVP Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">RSVPs ({eventDetail.rsvps.length})</h3>
                    <div className="flex gap-2">
                      {eventDetail.by_source.map(s => (
                        <span key={s.platform} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {PLATFORM_ICONS[s.platform] || s.platform} {s.count}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Email</th>
                          <th className="px-4 py-2 text-left">Source</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Dietary</th>
                          <th className="px-4 py-2 text-left">RSVP'd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {eventDetail.rsvps.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                            <td className="px-4 py-2 text-gray-500">{r.email || '—'}</td>
                            <td className="px-4 py-2">
                              <span className="text-base" title={r.source}>{PLATFORM_ICONS[r.source] || r.source}</span>
                            </td>
                            <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                            <td className="px-4 py-2 text-gray-500 text-xs">{r.dietary_requirements || '—'}</td>
                            <td className="px-4 py-2 text-gray-400 text-xs">{fmtDate(r.rsvp_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {eventDetail.rsvps.length === 0 && (
                      <div className="text-center text-gray-400 py-8 text-sm">No RSVPs yet for this event.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB 4: Members ──────────────────────────────────────────────── */}
        {tab === 4 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
              <select
                value={membersGroupId}
                onChange={e => { setMembersGroupId(e.target.value as number | ''); }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">Select a group…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select value={filterMemberRole} onChange={e => setFilterMemberRole(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All Roles</option>
                {MEMBER_ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
              </select>
              <select value={filterMemberStatus} onChange={e => setFilterMemberStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="left">Left</option>
                <option value="">All</option>
              </select>
              <button onClick={loadMembers} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">Load</button>
              {membersGroupId && (
                <button
                  onClick={() => { setMemberGroupId(membersGroupId as number); setShowAddMember(true); }}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700"
                >
                  + Add Member
                </button>
              )}
            </div>

            {members.length > 0 && (
              <>
                {/* Spotlight */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">Top Members by Attendance</h3>
                  <div className="flex gap-3 flex-wrap">
                    {members.slice(0, 5).map((m, i) => (
                      <div key={m.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <span className="text-lg">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{m.name}</div>
                          <div className="text-xs text-gray-500">{m.events_attended} events</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inactive alert */}
                {(() => {
                  const cutoff = new Date();
                  cutoff.setDate(cutoff.getDate() - 90);
                  const inactive = members.filter(m =>
                    m.status === 'active' && m.last_attended && new Date(m.last_attended) < cutoff
                  );
                  return inactive.length > 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <h4 className="font-semibold text-yellow-800 mb-1">⚠️ Inactive Members ({inactive.length})</h4>
                      <p className="text-sm text-yellow-700">
                        {inactive.map(m => m.name).join(', ')} — last attended more than 90 days ago.
                      </p>
                    </div>
                  ) : null;
                })()}

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Email</th>
                          <th className="px-4 py-2 text-left">Role</th>
                          <th className="px-4 py-2 text-left">Joined</th>
                          <th className="px-4 py-2 text-left">Events</th>
                          <th className="px-4 py-2 text-left">Last Attended</th>
                          <th className="px-4 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {members.map(m => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{m.name}</td>
                            <td className="px-4 py-2 text-gray-500">{m.email || '—'}</td>
                            <td className="px-4 py-2">
                              <Badge
                                label={m.role.replace('_',' ')}
                                color={m.role === 'organizer' ? 'bg-purple-100 text-purple-700'
                                  : m.role === 'speaker' ? 'bg-blue-100 text-blue-700'
                                  : m.role === 'volunteer' ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'}
                              />
                            </td>
                            <td className="px-4 py-2 text-gray-500 text-xs">{m.joined_date ? fmtDate(m.joined_date) : '—'}</td>
                            <td className="px-4 py-2 text-center font-semibold text-gray-700">{m.events_attended}</td>
                            <td className="px-4 py-2 text-gray-500 text-xs">{m.last_attended ? fmtDate(m.last_attended) : '—'}</td>
                            <td className="px-4 py-2"><StatusBadge status={m.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            {membersGroupId && members.length === 0 && (
              <div className="text-center text-gray-400 py-12">No members found. Add the first member to this group.</div>
            )}
            {!membersGroupId && (
              <div className="text-center text-gray-400 py-12">Select a group to view its members.</div>
            )}
          </div>
        )}

        {/* ── TAB 5: AI Content Studio ────────────────────────────────────── */}
        {tab === 5 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Content Generator</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Group</label>
                    <select value={aiGroup} onChange={e => setAiGroup(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option value="">Select group…</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Event (optional)</label>
                    <select value={aiEvent} onChange={e => setAiEvent(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option value="">No specific event</option>
                      {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Content Type</label>
                    <select value={aiContentType} onChange={e => setAiContentType(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      {CONTENT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                    </select>
                  </div>

                  {aiContentType === 'social_post' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
                      <div className="flex gap-2 flex-wrap">
                        {SOCIAL_PLATFORMS.map(p => (
                          <button key={p}
                            onClick={() => setAiPlatform(p)}
                            className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1.5 ${
                              aiPlatform === p
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                            }`}>
                            <span>{PLATFORM_ICONS[p]}</span> {p.charAt(0).toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={generateContent}
                    disabled={aiGenerating}
                    className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-purple-700 disabled:opacity-50"
                  >
                    {aiGenerating ? '🤖 Generating with Ollama…' : '✨ Generate Content'}
                  </button>

                  {/* Quick prompts */}
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Quick refinements (manual prompts):</div>
                    <div className="flex flex-wrap gap-2">
                      {['Make it more exciting', 'Add Calgary local flavour', 'Shorten to 280 chars'].map(p => (
                        <button key={p}
                          onClick={() => setAiContent(prev => prev + `\n\n[Refine: ${p}]`)}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Generated Content</h3>
                  {aiContent && (
                    <div className="flex gap-2">
                      <button
                        onClick={copyAi}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
                      >
                        {aiCopied ? '✅ Copied!' : '📋 Copy'}
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = `/admin/social/compose?content=${encodeURIComponent(aiContent)}`;
                        }}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                      >
                        → Schedule to Social
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  value={aiContent}
                  onChange={e => setAiContent(e.target.value)}
                  rows={16}
                  placeholder="Generated content will appear here. Select a group and content type, then click Generate."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
                {aiContent && (
                  <div className="text-xs text-gray-400 mt-1 text-right">
                    {aiContent.length} chars · {aiContent.split(/\s+/).filter(Boolean).length} words
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: Analytics ────────────────────────────────────────────── */}
        {tab === 6 && analytics && (
          <div className="space-y-6">
            {/* Attendance Trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Community Growth — Last 6 Months</h3>
              <div className="flex items-end gap-3 h-32">
                {analytics.growth_by_month.map(m => {
                  const maxMembers = Math.max(...analytics.growth_by_month.map(x => Number(x.new_members)), 1);
                  const maxEvents = Math.max(...analytics.growth_by_month.map(x => Number(x.events_held)), 1);
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-0.5 items-end justify-center h-24">
                        <div
                          className="bg-blue-400 rounded-t w-4"
                          style={{ height: `${(Number(m.new_members) / maxMembers) * 100}%` }}
                          title={`New members: ${m.new_members}`}
                        />
                        <div
                          className="bg-green-400 rounded-t w-4"
                          style={{ height: `${(Number(m.events_held) / maxEvents) * 100}%` }}
                          title={`Events: ${m.events_held}`}
                        />
                      </div>
                      <div className="text-xs text-gray-500 text-center leading-tight">{m.month}</div>
                      <div className="text-xs text-gray-400">{m.total_rsvps} RSVPs</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded inline-block" /> New Members</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded inline-block" /> Events Held</span>
              </div>
            </div>

            {/* RSVP to Show Rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">RSVP → Show Rate</h3>
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.8" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3b82f6" strokeWidth="3.8"
                        strokeDasharray={`${analytics.rsvp_to_show_rate} ${100 - analytics.rsvp_to_show_rate}`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-800">{analytics.rsvp_to_show_rate}%</span>
                    </div>
                  </div>
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">
                  Attendees vs RSVPs marked &apos;going&apos;
                </p>
              </div>

              {/* Platform Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">RSVPs by Platform</h3>
                <div className="space-y-2">
                  {analytics.platform_breakdown.map(p => {
                    const maxRsvps = Math.max(...analytics.platform_breakdown.map(x => Number(x.rsvps_from_platform)), 1);
                    return (
                      <div key={p.platform} className="flex items-center gap-2">
                        <span className="text-base w-5" title={p.platform}>{PLATFORM_ICONS[p.platform] || '⚪'}</span>
                        <span className="text-xs text-gray-600 w-20">{p.platform}</span>
                        <div className="flex-1">
                          <CssBar value={Number(p.rsvps_from_platform)} max={maxRsvps} color="bg-indigo-400" />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-6 text-right">{p.rsvps_from_platform}</span>
                      </div>
                    );
                  })}
                  {analytics.platform_breakdown.length === 0 && (
                    <p className="text-gray-400 text-sm">No RSVP data yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top Groups */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Top Groups by Attendance</h3>
              <div className="space-y-2">
                {analytics.top_groups_by_attendance.map((g, i) => {
                  const maxAvg = Math.max(...analytics.top_groups_by_attendance.map(x => Number(x.avg_attendance)), 1);
                  return (
                    <div key={g.group_name} className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 w-5 text-right">{i + 1}.</span>
                      <span className="text-sm text-gray-800 w-40 truncate">{g.group_name}</span>
                      <div className="flex-1">
                        <CssBar value={Number(g.avg_attendance)} max={maxAvg} color="bg-green-400" />
                      </div>
                      <span className="text-xs text-gray-600 w-24 text-right">
                        avg {Number(g.avg_attendance).toFixed(1)} · {g.total_events} events
                      </span>
                    </div>
                  );
                })}
                {analytics.top_groups_by_attendance.length === 0 && (
                  <p className="text-gray-400 text-sm">No completed events yet.</p>
                )}
              </div>
            </div>

            {/* Category Heat */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Category Engagement Heat</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {analytics.category_engagement.map(c => (
                  <div key={c.category} className={`rounded-lg p-4 ${CATEGORY_COLORS[c.category] || 'bg-gray-100 text-gray-700'}`}>
                    <div className="font-semibold text-sm mb-2">{CATEGORY_LABELS[c.category] || c.category}</div>
                    <div className="grid grid-cols-2 gap-x-2 text-xs opacity-90">
                      <div>{c.groups_count} groups</div>
                      <div>{c.members} members</div>
                      <div>{c.events} events</div>
                      <div>{Number(c.avg_rsvps).toFixed(1)} avg RSVPs</div>
                    </div>
                  </div>
                ))}
                {analytics.category_engagement.length === 0 && (
                  <div className="col-span-3 text-gray-400 text-sm">No category data yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Community Group</h2>
              <button onClick={() => setShowCreateGroup(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {gfError && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{gfError}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Group Name *</label>
                  <input value={gf.name} onChange={e => setGf(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Calgary AI/ML Meetup" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
                  <select value={gf.category} onChange={e => setGf(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subcategory</label>
                  <input value={gf.subcategory} onChange={e => setGf(p => ({ ...p, subcategory: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Machine Learning" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea value={gf.description} onChange={e => setGf(p => ({ ...p, description: e.target.value }))}
                    rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input value={gf.city} onChange={e => setGf(p => ({ ...p, city: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Meeting Frequency</label>
                  <select value={gf.meeting_frequency} onChange={e => setGf(p => ({ ...p, meeting_frequency: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Typical Venue</label>
                  <input value={gf.typical_venue} onChange={e => setGf(p => ({ ...p, typical_venue: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Coworking space / Library / Online" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Max Members</label>
                  <input type="number" value={gf.max_members} onChange={e => setGf(p => ({ ...p, max_members: parseInt(e.target.value, 10) || 100 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                <div className="md:col-span-2 border-t border-gray-100 pt-4">
                  <div className="font-medium text-sm text-gray-700 mb-3">Membership</div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox" checked={gf.is_free} onChange={e => setGf(p => ({ ...p, is_free: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-gray-700">Free group</span>
                  </label>
                  {!gf.is_free && (
                    <input type="number" step="0.01" value={gf.membership_fee}
                      onChange={e => setGf(p => ({ ...p, membership_fee: e.target.value }))}
                      placeholder="Membership fee (CAD)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Organizer Name</label>
                  <input value={gf.organizer_name} onChange={e => setGf(p => ({ ...p, organizer_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Organizer Email</label>
                  <input type="email" value={gf.organizer_email} onChange={e => setGf(p => ({ ...p, organizer_email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                <div className="md:col-span-2 border-t border-gray-100 pt-4">
                  <div className="font-medium text-sm text-gray-700 mb-3">Platform URLs (all optional)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      ['meetup_url', '🟠 Meetup.com URL', 'https://meetup.com/your-group'],
                      ['facebook_group_url', '🔵 Facebook Group URL', 'https://facebook.com/groups/...'],
                      ['linkedin_group_url', '💼 LinkedIn Group URL', 'https://linkedin.com/groups/...'],
                      ['discord_invite_url', '🟣 Discord Invite URL', 'https://discord.gg/...'],
                      ['whatsapp_group_url', '🟢 WhatsApp Group URL', 'https://chat.whatsapp.com/...'],
                      ['eventbrite_organizer_url', '🔴 Eventbrite Organizer URL', 'https://eventbrite.ca/...'],
                    ].map(([key, label, ph]) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        <input
                          value={gf[key as keyof typeof gf] as string}
                          onChange={e => setGf(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs"
                          placeholder={ph}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
                  <input value={gf.tags} onChange={e => setGf(p => ({ ...p, tags: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ai, machine learning, calgary" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowCreateGroup(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={createGroup} disabled={gfSaving}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {gfSaving ? 'Creating…' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Event</h2>
              <button onClick={() => setShowCreateEvent(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {efError && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{efError}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Group *</label>
                  <select value={ef.group_id} onChange={e => setEf(p => ({ ...p, group_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select group…</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={ef.category} onChange={e => setEf(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Event Title *</label>
                  <input value={ef.title} onChange={e => setEf(p => ({ ...p, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="January AI/ML Meetup" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea value={ef.description} onChange={e => setEf(p => ({ ...p, description: e.target.value }))}
                    rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
                  <div className="flex gap-2">
                    {EVENT_TYPES.map(t => (
                      <button key={t}
                        onClick={() => setEf(p => ({ ...p, event_type: t }))}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${
                          ef.event_type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'
                        }`}>
                        {t.replace('_',' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {(ef.event_type === 'virtual' || ef.event_type === 'hybrid') && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Virtual Platform</label>
                    <select value={ef.platform} onChange={e => setEf(p => ({ ...p, platform: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      {PLATFORMS_VIRTUAL.map(p => <option key={p} value={p}>{p.replace('_',' ')}</option>)}
                    </select>
                    {ef.generatedMeetUrl && (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-2">
                        🟩 Auto-generated Google Meet: <span className="font-mono">{ef.generatedMeetUrl}</span>
                      </div>
                    )}
                    {ef.platform === 'zoom' && (
                      <div className="mt-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-xs text-sky-700">
                        💙 Zoom placeholder will be set. Update with real meeting ID after creating in Zoom.
                      </div>
                    )}
                  </div>
                )}

                {(ef.event_type === 'in_person' || ef.event_type === 'hybrid') && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Venue Name</label>
                      <input value={ef.venue_name} onChange={e => setEf(p => ({ ...p, venue_name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Startup Calgary Hub" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Venue Address</label>
                      <input value={ef.venue_address} onChange={e => setEf(p => ({ ...p, venue_address: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="123 Main St SW, Calgary" />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Time *</label>
                  <input type="datetime-local" value={ef.start_time} onChange={e => setEf(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                  <input type="datetime-local" value={ef.end_time} onChange={e => setEf(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Max Attendees</label>
                  <input type="number" value={ef.max_attendees} onChange={e => setEf(p => ({ ...p, max_attendees: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">RSVP Deadline</label>
                  <input type="datetime-local" value={ef.rsvp_deadline} onChange={e => setEf(p => ({ ...p, rsvp_deadline: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="waitlist" checked={ef.waitlist_enabled} onChange={e => setEf(p => ({ ...p, waitlist_enabled: e.target.checked }))} className="rounded" />
                  <label htmlFor="waitlist" className="text-sm text-gray-700 cursor-pointer">Enable waitlist</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="evfree" checked={ef.is_free} onChange={e => setEf(p => ({ ...p, is_free: e.target.checked }))} className="rounded" />
                  <label htmlFor="evfree" className="text-sm text-gray-700 cursor-pointer">Free event</label>
                </div>
                {!ef.is_free && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Price (CAD)</label>
                    <input type="number" step="0.01" value={ef.price} onChange={e => setEf(p => ({ ...p, price: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Eventbrite URL</label>
                  <input value={ef.eventbrite_url} onChange={e => setEf(p => ({ ...p, eventbrite_url: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://eventbrite.ca/e/..." />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Cross-post to platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PLATFORM_ICONS).map(([p, icon]) => (
                      <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input type="checkbox"
                          checked={ef.posted_to.includes(p)}
                          onChange={e => setEf(prev => ({
                            ...prev,
                            posted_to: e.target.checked
                              ? [...prev.posted_to, p]
                              : prev.posted_to.filter(x => x !== p),
                          }))}
                          className="rounded"
                        />
                        <span>{icon}</span> {p}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Publish status</label>
                  <div className="flex gap-2">
                    {['draft','published'].map(s => (
                      <button key={s}
                        onClick={() => setEf(p => ({ ...p, status: s }))}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${
                          ef.status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowCreateEvent(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={createEvent} disabled={efSaving}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {efSaving ? 'Creating…' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add RSVP Modal */}
      {showAddRsvp && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add RSVP</h2>
              <button onClick={() => setShowAddRsvp(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-3">
              {[
                ['Name *', 'name', 'text', 'Jane Smith'],
                ['Email', 'email', 'email', 'jane@example.com'],
                ['Phone', 'phone', 'tel', '+1 (403) 555-0100'],
                ['Dietary Requirements', 'dietary_requirements', 'text', 'Vegetarian, nut allergy'],
              ].map(([label, key, type, ph]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={rf[key as keyof typeof rf]} onChange={e => setRf(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={ph} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
                <select value={rf.source} onChange={e => setRf(p => ({ ...p, source: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {RSVP_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowAddRsvp(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={addRsvp} disabled={rfSaving}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {rfSaving ? 'Adding…' : 'Add RSVP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add Member</h2>
              <button onClick={() => setShowAddMember(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-3">
              {[
                ['Name *', 'name', 'text', 'Jane Smith'],
                ['Email', 'email', 'email', 'jane@example.com'],
                ['Phone', 'phone', 'tel', '+1 (403) 555-0100'],
                ['Source / How they joined', 'source', 'text', 'meetup, referral, etc.'],
                ['Interests (comma-separated)', 'interests', 'text', 'AI, yoga, networking'],
                ['Notes', 'notes', 'text', ''],
              ].map(([label, key, type, ph]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={mf[key as keyof typeof mf]} onChange={e => setMf(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={ph} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select value={mf.role} onChange={e => setMf(p => ({ ...p, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {MEMBER_ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowAddMember(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={addMember} disabled={mfSaving}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {mfSaving ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Detail Modal */}
      {selectedGroup && !showCreateEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedGroup.name}</h2>
                <div className="flex gap-2 mt-1">
                  <Badge label={CATEGORY_LABELS[selectedGroup.category]} color={CATEGORY_COLORS[selectedGroup.category] || 'bg-gray-100 text-gray-700'} />
                  <StatusBadge status={selectedGroup.status} />
                </div>
              </div>
              <button onClick={() => setSelectedGroup(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {selectedGroup.description && (
                <p className="text-sm text-gray-600">{selectedGroup.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">City:</span> {selectedGroup.city}, {selectedGroup.province}</div>
                <div><span className="text-gray-500">Frequency:</span> {selectedGroup.meeting_frequency.replace('_',' ')}</div>
                <div><span className="text-gray-500">Members:</span> {selectedGroup.member_count_live}</div>
                <div><span className="text-gray-500">Events:</span> {selectedGroup.event_count}</div>
                {selectedGroup.organizer_name && (
                  <div><span className="text-gray-500">Organizer:</span> {selectedGroup.organizer_name}</div>
                )}
                {selectedGroup.typical_venue && (
                  <div><span className="text-gray-500">Venue:</span> {selectedGroup.typical_venue}</div>
                )}
              </div>

              {/* Platform Links */}
              {groupPlatforms(selectedGroup).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Platform Presence</div>
                  <div className="flex flex-wrap gap-2">
                    {groupPlatforms(selectedGroup).map(p => (
                      <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200">
                        <span className="text-base">{p.icon}</span> {p.key}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedGroup.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedGroup.tags.map(t => (
                    <span key={t} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{t}</span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowCreateEvent(true); setEf(p => ({ ...p, group_id: String(selectedGroup.id) })); setSelectedGroup(null); }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  + Create Event
                </button>
                <button
                  onClick={() => { setMembersGroupId(selectedGroup.id); setSelectedGroup(null); setTab(4); }}
                  className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100"
                >
                  View Members
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
