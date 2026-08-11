"use client";
// Teacher profile — real data from teacher_profile + teacher_certification.
// Previously a fully static mock (fixed "Sunita Patel" regardless of the
// route param) with fabricated ratings/revenue/attendance and five
// external-system integrations (Frappe HR, Cal.com, Moodle, Paperless-ngx,
// ERPNext) none of which are deployed. Scoped to what's real: profile
// fields and certification records (the certification table is real and
// FK-enforced as of migration 075, even though no certifications have been
// added yet in this environment — shown as an honest empty state).

import { useEffect, useState } from "react";

interface Teacher {
  id: string; first_name: string; last_name: string; email: string; phone: string | null;
  bio: string | null; timezone: string; status: string; contract_type: string;
  specializations: string[]; hire_date: string;
}
interface Certification {
  id: string; type: string; issuing_organization: string; certification_number: string | null;
  issued_at: string; expires_at: string | null; status: string;
}

export default function TeacherDetailPage({ params }: { params: { id: string } }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/teachers/${params.id}`, { cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setTeacher(d.teacher); setCertifications(d.certifications); })
      .catch(e => setError(e.message));
  }, [params.id]);

  if (error) return <div className="p-6 max-w-5xl mx-auto"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!teacher) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shrink-0">
          {teacher.first_name[0]}{teacher.last_name[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{teacher.first_name} {teacher.last_name}</h1>
          <p className="text-gray-500">{teacher.email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{teacher.status}</span>
            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{teacher.contract_type}</span>
            {teacher.specializations.map(s => (
              <span key={s} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">{s}</span>
            ))}
          </div>
        </div>
      </div>

      {teacher.bio && (
        <div className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold text-gray-800 mb-2">Biography</h2>
          <p className="text-gray-600 text-sm">{teacher.bio}</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Contact & Details</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd>{teacher.phone ?? "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Timezone</dt><dd>{teacher.timezone}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Hire Date</dt><dd>{new Date(teacher.hire_date).toLocaleDateString()}</dd></div>
        </dl>
      </div>

      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Certifications</h2>
        {certifications.length === 0 ? (
          <p className="text-sm text-gray-400">No certifications on file yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-left">
              <th className="pb-2">Type</th><th className="pb-2">Issuing Body</th>
              <th className="pb-2">Issued</th><th className="pb-2">Expires</th><th className="pb-2">Status</th>
            </tr></thead>
            <tbody>{certifications.map(c => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{c.type}</td>
                <td className="py-2 text-gray-500">{c.issuing_organization}</td>
                <td className="py-2 text-gray-500">{new Date(c.issued_at).toLocaleDateString()}</td>
                <td className="py-2 text-gray-500">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                <td className="py-2">{c.status}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
