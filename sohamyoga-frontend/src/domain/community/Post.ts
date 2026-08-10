export type PostCategory = "milestone" | "question" | "inspiration" | "tip" | "class_review";

export interface CommentProps {
  id: string;
  authorId: string;
  body: string;
  createdAt: Date;
  isDeleted: boolean;
}

export interface PostProps {
  id: string;
  authorId: string;
  category: PostCategory;
  body: string;
  imageUrl?: string;
  likes: string[];           // user IDs
  comments: CommentProps[];
  isPinned: boolean;
  isHidden: boolean;         // moderation
  createdAt: Date;
  updatedAt: Date;
}

export class Post {
  constructor(private props: PostProps) {
    if (!props.body.trim()) throw new Error("Post body is required");
  }

  get id()         { return this.props.id; }
  get authorId()   { return this.props.authorId; }
  get category()   { return this.props.category; }
  get body()       { return this.props.body; }
  get imageUrl()   { return this.props.imageUrl; }
  get likeCount()  { return this.props.likes.length; }
  get comments()   { return this.props.comments.filter(c => !c.isDeleted); }
  get isPinned()   { return this.props.isPinned; }
  get isHidden()   { return this.props.isHidden; }
  get createdAt()  { return this.props.createdAt; }

  isLikedBy(userId: string): boolean { return this.props.likes.includes(userId); }

  like(userId: string): Post {
    if (this.isLikedBy(userId)) throw new Error("Already liked");
    return new Post({ ...this.props, likes: [...this.props.likes, userId] });
  }

  unlike(userId: string): Post {
    return new Post({ ...this.props, likes: this.props.likes.filter(id => id !== userId) });
  }

  addComment(comment: CommentProps): Post {
    return new Post({ ...this.props, comments: [...this.props.comments, comment], updatedAt: new Date() });
  }

  deleteComment(commentId: string, requestorId: string, isAdmin: boolean): Post {
    const updated = this.props.comments.map(c => {
      if (c.id !== commentId) return c;
      if (c.authorId !== requestorId && !isAdmin) throw new Error("Not authorised to delete this comment");
      return { ...c, isDeleted: true };
    });
    return new Post({ ...this.props, comments: updated });
  }

  hide(): Post   { return new Post({ ...this.props, isHidden: true }); }
  pin(): Post    { return new Post({ ...this.props, isPinned: true }); }
  unpin(): Post  { return new Post({ ...this.props, isPinned: false }); }

  toJSON(): PostProps { return { ...this.props, likes: [...this.props.likes], comments: this.props.comments.map(c => ({ ...c })) }; }
}
