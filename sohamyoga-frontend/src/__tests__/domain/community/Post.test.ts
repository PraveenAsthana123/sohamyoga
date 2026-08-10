import { Post } from "@/domain/community/Post";

const base = {
  id: "post_1",
  authorId: "user_1",
  category: "milestone" as const,
  body: "Finally held Warrior III for 30 seconds!",
  likes: [] as string[],
  comments: [] as never[],
  isPinned: false,
  isHidden: false,
  createdAt: new Date("2026-08-04"),
  updatedAt: new Date("2026-08-04"),
};

describe("Post", () => {
  it("creates a valid post", () => {
    const p = new Post(base);
    expect(p.body).toBe("Finally held Warrior III for 30 seconds!");
    expect(p.likeCount).toBe(0);
  });

  it("throws when body is blank", () => {
    expect(() => new Post({ ...base, body: "   " })).toThrow("Post body is required");
  });

  it("adds a like", () => {
    const p = new Post(base).like("user_2");
    expect(p.likeCount).toBe(1);
    expect(p.isLikedBy("user_2")).toBe(true);
  });

  it("throws when liking twice", () => {
    const p = new Post(base).like("user_2");
    expect(() => p.like("user_2")).toThrow("Already liked");
  });

  it("removes a like", () => {
    const p = new Post(base).like("user_2").unlike("user_2");
    expect(p.likeCount).toBe(0);
  });

  it("adds a comment", () => {
    const comment = { id: "c_1", authorId: "user_2", body: "So inspiring!", createdAt: new Date(), isDeleted: false };
    const p = new Post(base).addComment(comment);
    expect(p.comments).toHaveLength(1);
    expect(p.comments[0].body).toBe("So inspiring!");
  });

  it("soft-deletes a comment by author", () => {
    const comment = { id: "c_1", authorId: "user_2", body: "So inspiring!", createdAt: new Date(), isDeleted: false };
    const p = new Post(base).addComment(comment).deleteComment("c_1", "user_2", false);
    expect(p.comments).toHaveLength(0); // filtered out
  });

  it("admin can delete any comment", () => {
    const comment = { id: "c_1", authorId: "user_2", body: "Spam!", createdAt: new Date(), isDeleted: false };
    const p = new Post(base).addComment(comment).deleteComment("c_1", "admin_1", true);
    expect(p.comments).toHaveLength(0);
  });

  it("throws when unauthorized user deletes comment", () => {
    const comment = { id: "c_1", authorId: "user_2", body: "Hi!", createdAt: new Date(), isDeleted: false };
    const p = new Post(base).addComment(comment);
    expect(() => p.deleteComment("c_1", "user_3", false)).toThrow("Not authorised to delete this comment");
  });

  it("pins and unpins", () => {
    const p = new Post(base).pin();
    expect(p.isPinned).toBe(true);
    expect(p.unpin().isPinned).toBe(false);
  });

  it("hides post", () => {
    expect(new Post(base).hide().isHidden).toBe(true);
  });
});
