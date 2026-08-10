export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "checkbox"
  | "rating_scale"
  | "matrix_grid"
  | "short_text"
  | "long_text"
  | "file_upload"
  | "digital_signature"
  | "date"
  | "number"
  | "email"
  | "phone"
  | "nps";

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  isOther?: boolean;
}

export interface MatrixRow {
  id: string;
  label: string;
}

export interface ConditionalLogic {
  dependsOnQuestionId: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value: string;
  action: "show" | "skip";
}

export interface QuestionProps {
  id: string;
  surveyId: string;
  type: QuestionType;
  text: string;
  description?: string;
  isRequired: boolean;
  order: number;
  options?: QuestionOption[];
  matrixRows?: MatrixRow[];
  ratingMin?: number;
  ratingMax?: number;
  ratingMinLabel?: string;
  ratingMaxLabel?: string;
  conditionalLogic?: ConditionalLogic;
  placeholder?: string;
  maxLength?: number;
  maxFileSizeMb?: number;
  allowedFileTypes?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CHOICE_TYPES: QuestionType[] = ["single_choice", "multiple_choice", "checkbox"];
const RATING_TYPES: QuestionType[] = ["rating_scale", "nps"];
const TEXT_TYPES:   QuestionType[] = ["short_text", "long_text", "email", "phone"];

export class Question {
  private readonly props: Readonly<QuestionProps>;

  constructor(props: QuestionProps) {
    if (!props.id?.trim())       throw new Error("id is required");
    if (!props.surveyId?.trim()) throw new Error("surveyId is required");
    if (!props.text?.trim())     throw new Error("text is required");
    if (props.order < 0)         throw new Error("order must be >= 0");

    if (CHOICE_TYPES.includes(props.type)) {
      if (!props.options || props.options.length < 2) {
        throw new Error(`${props.type} requires at least 2 options`);
      }
    }

    if (props.type === "matrix_grid") {
      if (!props.options || props.options.length < 2) {
        throw new Error("matrix_grid requires at least 2 column options");
      }
      if (!props.matrixRows || props.matrixRows.length < 1) {
        throw new Error("matrix_grid requires at least 1 row");
      }
    }

    if (RATING_TYPES.includes(props.type)) {
      if (props.ratingMin === undefined || props.ratingMax === undefined) {
        throw new Error(`${props.type} requires ratingMin and ratingMax`);
      }
      if (props.ratingMin >= props.ratingMax) {
        throw new Error("ratingMin must be less than ratingMax");
      }
    }

    if (props.type === "nps") {
      if (props.ratingMin !== 0 || props.ratingMax !== 10) {
        throw new Error("NPS questions must have ratingMin=0 and ratingMax=10");
      }
    }

    if (props.maxLength !== undefined && props.maxLength < 1) {
      throw new Error("maxLength must be >= 1");
    }

    if (props.maxFileSizeMb !== undefined && props.maxFileSizeMb <= 0) {
      throw new Error("maxFileSizeMb must be > 0");
    }

    this.props = {
      ...props,
      options:     props.options     ? [...props.options]     : undefined,
      matrixRows:  props.matrixRows  ? [...props.matrixRows]  : undefined,
      allowedFileTypes: props.allowedFileTypes ? [...props.allowedFileTypes] : undefined,
    };
  }

  get id()                { return this.props.id; }
  get surveyId()          { return this.props.surveyId; }
  get type()              { return this.props.type; }
  get text()              { return this.props.text; }
  get description()       { return this.props.description; }
  get isRequired()        { return this.props.isRequired; }
  get order()             { return this.props.order; }
  get options()           { return this.props.options ? [...this.props.options] : undefined; }
  get matrixRows()        { return this.props.matrixRows ? [...this.props.matrixRows] : undefined; }
  get ratingMin()         { return this.props.ratingMin; }
  get ratingMax()         { return this.props.ratingMax; }
  get ratingMinLabel()    { return this.props.ratingMinLabel; }
  get ratingMaxLabel()    { return this.props.ratingMaxLabel; }
  get conditionalLogic()  { return this.props.conditionalLogic; }
  get placeholder()       { return this.props.placeholder; }
  get maxLength()         { return this.props.maxLength; }
  get maxFileSizeMb()     { return this.props.maxFileSizeMb; }
  get allowedFileTypes()  { return this.props.allowedFileTypes ? [...this.props.allowedFileTypes] : undefined; }
  get createdAt()         { return this.props.createdAt; }
  get updatedAt()         { return this.props.updatedAt; }

  isChoiceQuestion(): boolean {
    return CHOICE_TYPES.includes(this.props.type) || this.props.type === "matrix_grid";
  }

  isRatingQuestion(): boolean {
    return RATING_TYPES.includes(this.props.type);
  }

  isTextQuestion(): boolean {
    return TEXT_TYPES.includes(this.props.type);
  }

  hasConditionalLogic(): boolean {
    return this.props.conditionalLogic !== undefined;
  }

  makeRequired(): Question {
    return new Question({
      ...this.props,
      options:     this.props.options     ? [...this.props.options]     : undefined,
      matrixRows:  this.props.matrixRows  ? [...this.props.matrixRows]  : undefined,
      allowedFileTypes: this.props.allowedFileTypes ? [...this.props.allowedFileTypes] : undefined,
      isRequired: true,
      updatedAt: new Date(),
    });
  }

  makeOptional(): Question {
    return new Question({
      ...this.props,
      options:     this.props.options     ? [...this.props.options]     : undefined,
      matrixRows:  this.props.matrixRows  ? [...this.props.matrixRows]  : undefined,
      allowedFileTypes: this.props.allowedFileTypes ? [...this.props.allowedFileTypes] : undefined,
      isRequired: false,
      updatedAt: new Date(),
    });
  }

  reorder(newOrder: number): Question {
    if (newOrder < 0) throw new Error("order must be >= 0");
    return new Question({
      ...this.props,
      options:     this.props.options     ? [...this.props.options]     : undefined,
      matrixRows:  this.props.matrixRows  ? [...this.props.matrixRows]  : undefined,
      allowedFileTypes: this.props.allowedFileTypes ? [...this.props.allowedFileTypes] : undefined,
      order: newOrder,
      updatedAt: new Date(),
    });
  }

  addConditionalLogic(logic: ConditionalLogic): Question {
    if (!logic.dependsOnQuestionId?.trim()) throw new Error("dependsOnQuestionId is required");
    if (!logic.value?.trim()) throw new Error("conditional logic value is required");
    return new Question({
      ...this.props,
      options:     this.props.options     ? [...this.props.options]     : undefined,
      matrixRows:  this.props.matrixRows  ? [...this.props.matrixRows]  : undefined,
      allowedFileTypes: this.props.allowedFileTypes ? [...this.props.allowedFileTypes] : undefined,
      conditionalLogic: { ...logic },
      updatedAt: new Date(),
    });
  }

  removeConditionalLogic(): Question {
    const { conditionalLogic: _cl, ...rest } = this.props;
    return new Question({
      ...rest,
      options:     rest.options     ? [...rest.options]     : undefined,
      matrixRows:  rest.matrixRows  ? [...rest.matrixRows]  : undefined,
      allowedFileTypes: rest.allowedFileTypes ? [...rest.allowedFileTypes] : undefined,
      updatedAt: new Date(),
    });
  }
}
