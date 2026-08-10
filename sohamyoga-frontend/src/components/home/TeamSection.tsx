import type { TeamMember } from '@/lib/api';

interface TeamSectionProps {
  teamMembers: TeamMember[];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const avatarGradients = [
  'from-primary-500 to-primary-700',
  'from-accent-500 to-accent-700',
  'from-blue-500 to-blue-700',
  'from-purple-500 to-purple-700',
  'from-rose-500 to-rose-700',
  'from-amber-500 to-amber-700',
];

export default function TeamSection({ teamMembers }: TeamSectionProps) {
  if (!teamMembers || teamMembers.length === 0) return null;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="section-title text-dark-900">
          Meet Our <span className="text-primary-600">Team</span>
        </h2>
        <p className="section-subtitle">
          Experienced professionals passionate about technology and dedicated to delivering exceptional results.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {teamMembers.map((member, index) => {
            const gradient = avatarGradients[index % avatarGradients.length];

            return (
              <div
                key={member.id}
                className="group text-center"
              >
                <div className="card border border-dark-100 group-hover:border-primary-200 group-hover:-translate-y-1 transition-all duration-300">
                  {/* Avatar */}
                  <div className="flex justify-center mb-5">
                    <div className="relative">
                      {member.imageUrl ? (
                        <img
                          src={member.imageUrl}
                          alt={member.name}
                          className="w-24 h-24 rounded-full object-cover ring-4 ring-dark-100 group-hover:ring-primary-200 transition-all duration-300"
                        />
                      ) : (
                        <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center ring-4 ring-dark-100 group-hover:ring-primary-200 transition-all duration-300`}>
                          <span className="text-white text-2xl font-bold">
                            {getInitials(member.name)}
                          </span>
                        </div>
                      )}
                      {/* Online indicator */}
                      <div className="absolute bottom-1 right-1 w-4 h-4 bg-accent-400 rounded-full border-2 border-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <h3 className="text-lg font-semibold text-dark-900 group-hover:text-primary-600 transition-colors">
                    {member.name}
                  </h3>
                  <p className="text-primary-600 text-sm font-medium mb-3">
                    {member.title}
                  </p>
                  <p className="text-dark-500 text-sm leading-relaxed line-clamp-3">
                    {member.bio}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
