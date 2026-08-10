"use client";
import { useState } from "react";

const CHALLENGES = [
  { id: 1, title: "7-Day Morning Flow", description: "Complete a morning flow every day for 7 days.", progress: 5, total: 7, reward: "🏅 Sunrise Warrior", joined: true },
  { id: 2, title: "30 Days of Yoga", description: "Practice at least 20 minutes every day for a month.", progress: 12, total: 30, reward: "🏆 Dedicated Yogi", joined: true },
  { id: 3, title: "Pose Mastery: Warrior I", description: "Score 85+ on Warrior I three times in a row.", progress: 1, total: 3, reward: "⭐ Warrior Star", joined: false },
  { id: 4, title: "Explore All Styles", description: "Attend one class in each of Hatha, Vinyasa, Yin, and Ashtanga.", progress: 3, total: 4, reward: "🌈 Style Explorer", joined: true },
];

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState(CHALLENGES);

  function join(id: number) {
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, joined: true } : c));
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Challenges</h1>
          <p className="text-gray-400 mt-1">Push your practice further</p>
        </div>

        <div className="space-y-4">
          {challenges.map(c => {
            const pct = Math.round((c.progress / c.total) * 100);
            return (
              <div key={c.id} className="bg-gray-900 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{c.title}</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{c.description}</p>
                  </div>
                  <span className="text-2xl">{c.reward.split(" ")[0]}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{c.progress} / {c.total} completed</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${pct === 100 ? "bg-yellow-400" : "bg-green-500"}`}
                         style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-sm text-purple-400 font-medium">Reward: {c.reward}</div>
                  {!c.joined ? (
                    <button onClick={() => join(c.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium transition-colors">
                      Join Challenge
                    </button>
                  ) : pct === 100 ? (
                    <span className="px-3 py-1 bg-yellow-900 text-yellow-300 rounded-full text-sm">Completed!</span>
                  ) : (
                    <span className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-sm">In Progress</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
