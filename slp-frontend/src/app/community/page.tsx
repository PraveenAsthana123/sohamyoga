"use client";
import { useState } from "react";

const POSTS = [
  { id: 1, author: "Aisha P.", avatar: "A", time: "2h ago", content: "Finally held Warrior III for 30 seconds today! 🙌 Two months ago I couldn't even balance. Keep going everyone!", likes: 24, comments: 5 },
  { id: 2, author: "Marcus C.", avatar: "M", time: "4h ago", content: "Morning flow with Priya was absolutely amazing. Her cueing for the hip openers was spot on. Highly recommend!", likes: 18, comments: 3 },
  { id: 3, author: "Sofia R.", avatar: "S", time: "Yesterday", content: "Question for the community — any tips for improving balance in Tree Pose? I always wobble when I close my eyes 😅", likes: 9, comments: 12 },
  { id: 4, author: "James O.", avatar: "J", time: "Yesterday", content: "Advanced inversions class is no joke 😅 But I got my headstand today for the first time in my life. Worth every fall!", likes: 41, comments: 8 },
];

const CHALLENGES = [
  { title: "7-Day Morning Flow", participants: 142, daysLeft: 2 },
  { title: "30 Days of Yoga", participants: 89, daysLeft: 18 },
  { title: "Pose Mastery: Warrior I", participants: 57, daysLeft: 5 },
];

export default function CommunityPage() {
  const [liked, setLiked] = useState<Set<number>>(new Set());

  function toggleLike(id: number) {
    setLiked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Community</h1>
          <p className="text-gray-400 mt-1">Share your journey with fellow yogis</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* New post */}
            <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
              <textarea placeholder="Share a milestone, ask a question, or encourage someone…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none text-sm"
                rows={3} />
              <div className="flex justify-end">
                <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  Post
                </button>
              </div>
            </div>

            {POSTS.map(post => (
              <div key={post.id} className="bg-gray-900 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center font-bold text-sm">
                    {post.avatar}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{post.author}</div>
                    <div className="text-xs text-gray-500">{post.time}</div>
                  </div>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{post.content}</p>
                <div className="flex gap-4 text-sm text-gray-500">
                  <button onClick={() => toggleLike(post.id)}
                    className={`flex items-center gap-1 hover:text-green-400 transition-colors ${liked.has(post.id) ? "text-green-400" : ""}`}>
                    {liked.has(post.id) ? "❤️" : "🤍"} {post.likes + (liked.has(post.id) ? 1 : 0)}
                  </button>
                  <span className="flex items-center gap-1 cursor-pointer hover:text-gray-300">💬 {post.comments}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
              <h2 className="font-semibold text-gray-300">Active Challenges</h2>
              {CHALLENGES.map(c => (
                <div key={c.title} className="border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                  <div className="font-medium text-sm">{c.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    👥 {c.participants} participants · {c.daysLeft} days left
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 rounded-2xl p-5 space-y-2 text-sm">
              <h2 className="font-semibold text-gray-300">Community Guidelines</h2>
              <ul className="text-gray-400 space-y-1 list-disc list-inside">
                <li>Be kind and supportive</li>
                <li>Share authentic experiences</li>
                <li>No self-promotion or spam</li>
                <li>Respect all levels and journeys</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
