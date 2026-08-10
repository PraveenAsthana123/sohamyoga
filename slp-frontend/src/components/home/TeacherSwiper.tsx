'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';

const TEACHERS = [
  {
    id: 1,
    name: 'Priya Sharma',
    title: 'Hatha & Vinyasa',
    cert: 'RYT 500',
    years: 12,
    students: 420,
    rating: 4.9,
    specialties: ['Hatha', 'Vinyasa', 'Pranayama'],
    bio: 'Priya trained in Mysore under BNS Iyengar and has guided students from anxiety to advanced practice.',
    avatar: '🧘‍♀️',
    available: true,
  },
  {
    id: 2,
    name: 'Arjun Patel',
    title: 'Ashtanga & Power',
    cert: 'RYT 500 + YACEP',
    years: 8,
    students: 310,
    rating: 4.8,
    specialties: ['Ashtanga', 'Power', 'Arm Balances'],
    bio: 'Former competitive gymnast turned yoga teacher — Arjun makes advanced poses accessible and safe.',
    avatar: '🧘‍♂️',
    available: true,
  },
  {
    id: 3,
    name: 'Meera Nair',
    title: 'Yin & Restorative',
    cert: 'RYT 200 + Trauma-Informed',
    years: 6,
    students: 280,
    rating: 4.9,
    specialties: ['Yin', 'Restorative', 'Meditation'],
    bio: 'Meera holds space for healing and recovery. Her trauma-informed approach welcomes every body.',
    avatar: '🌿',
    available: false,
  },
  {
    id: 4,
    name: 'Kavya Reddy',
    title: 'Kundalini & Prenatal',
    cert: 'RYT 500 + RPYT',
    years: 10,
    students: 390,
    rating: 4.8,
    specialties: ['Kundalini', 'Prenatal', 'Mantra'],
    bio: 'Kavya weaves mantra, kriya, and conscious breath to open channels beyond the physical body.',
    avatar: '✨',
    available: true,
  },
  {
    id: 5,
    name: 'Rohan Gupta',
    title: 'Hatha & Sports Yoga',
    cert: 'RYT 200 + CSCS',
    years: 5,
    students: 190,
    rating: 4.7,
    specialties: ['Hatha', 'Sports', 'Injury Rehab'],
    bio: 'A strength coach and yoga teacher, Rohan bridges the gap between athletic training and mindful movement.',
    avatar: '💪',
    available: true,
  },
];

export default function TeacherSwiper() {
  return (
    <section className="py-24 bg-yoga-section overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <span
              className="yoga-tag bg-green-600/15 text-green-700 border border-green-600/20 mb-4"
              data-aos="fade-down"
            >
              Meet the Team
            </span>
            <h2
              className="text-4xl md:text-5xl font-black text-green-950"
              data-aos="fade-up"
              data-aos-delay="50"
            >
              Our Teachers
            </h2>
          </div>
          <Link
            href="/teachers"
            className="btn-primary text-sm"
            data-aos="fade-left"
          >
            View All Teachers →
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6" data-aos="fade-up" data-aos-delay="100">
        <Swiper
          modules={[Autoplay, Pagination, Navigation]}
          breakpoints={{
            0:    { slidesPerView: 1.15, spaceBetween: 16 },
            640:  { slidesPerView: 2.2,  spaceBetween: 20 },
            1024: { slidesPerView: 3.2,  spaceBetween: 24 },
            1280: { slidesPerView: 4,    spaceBetween: 24 },
          }}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop
          className="pb-14"
        >
          {TEACHERS.map((t) => (
            <SwiperSlide key={t.id}>
              <div className="bg-white rounded-2xl shadow-lg hover-lift overflow-hidden flex flex-col h-full">
                {/* Avatar header */}
                <div className="bg-gradient-to-br from-green-800 to-emerald-950 p-8 text-center">
                  <div className="text-6xl mb-3">{t.avatar}</div>
                  <h3 className="text-xl font-bold text-white">{t.name}</h3>
                  <p className="text-green-300 text-sm font-medium">{t.title}</p>
                  <span className={`yoga-tag mt-2 ${t.available ? 'bg-green-400/20 text-green-300' : 'bg-gray-400/20 text-gray-300'}`}>
                    {t.available ? 'Booking Open' : 'Waitlist'}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 border-b border-gray-100">
                  {[
                    { label: 'Years',    value: t.years },
                    { label: 'Students', value: t.students },
                    { label: 'Rating',   value: t.rating },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center p-3">
                      <div className="text-lg font-bold text-green-800">{value}</div>
                      <div className="text-xs text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <p className="text-gray-600 text-sm leading-relaxed">{t.bio}</p>
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {t.specialties.map((s) => (
                      <span key={s} className="yoga-tag bg-green-50 text-green-700 border border-green-100">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-400 font-medium">{t.cert}</div>
                </div>

                {/* CTA */}
                <div className="p-4 pt-0">
                  <Link
                    href={`/teachers/${t.id}`}
                    className="block w-full text-center py-2.5 rounded-xl btn-primary text-sm"
                  >
                    {t.available ? 'Book a Class' : 'Join Waitlist'}
                  </Link>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
