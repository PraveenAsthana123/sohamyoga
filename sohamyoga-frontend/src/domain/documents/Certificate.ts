// Certificate & document management — indexed by Paperless-ngx
// Covers: student completion certs, teacher credentials, insurance, health waivers

export type DocumentType =
  | "completion_certificate"   // student finishes a course
  | "participation_certificate"// attended workshop/retreat
  | "teacher_certification"    // RYT-200, RYT-500, etc.
  | "insurance_document"       // liability insurance
  | "health_waiver"            // signed health/liability form
  | "medical_clearance"        // doctor's note
  | "id_proof"                 // passport/license for teacher onboarding
  | "contract"                 // employment/contractor agreement
  | "payslip"                  // salary slip from Frappe HR
  | "tax_document"             // T4, 1099, etc.
  | "training_completion"      // Moodle course completion
  | "other";

export type DocumentStatus = "draft" | "issued" | "signed" | "expired" | "revoked" | "archived";

export interface CertificateProps {
  id: string;
  type: DocumentType;
  title: string;
  recipientId: string;          // studentId or teacherId
  recipientName: string;
  recipientType: "student" | "teacher" | "staff";

  // Issuance
  issuedBy: string;             // admin userId
  issuedAt: Date;
  expiresAt?: Date;
  status: DocumentStatus;

  // Paperless-ngx integration
  paperlessDocumentId?: number; // Paperless-ngx document ID
  paperlessTagIds: number[];    // Paperless-ngx tags
  storagePath?: string;         // local file path before upload
  fileHash?: string;            // SHA-256 for integrity verification

  // Metadata
  courseId?: string;
  courseName?: string;
  hoursCompleted?: number;
  grade?: string;
  certificationBody?: string;   // "Yoga Alliance", "IYTA"
  serialNumber?: string;        // unique cert number printed on document

  signedAt?: Date;
  revokedAt?: Date;
  revokeReason?: string;

  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Certificate {
  constructor(private props: CertificateProps) {
    if (!props.title.trim()) throw new Error("Certificate title required");
    if (!props.recipientName.trim()) throw new Error("Recipient name required");
    if (props.expiresAt && props.expiresAt <= props.issuedAt)
      throw new Error("Expiry must be after issue date");
  }

  get id()                   { return this.props.id; }
  get type()                 { return this.props.type; }
  get title()                { return this.props.title; }
  get recipientId()          { return this.props.recipientId; }
  get recipientName()        { return this.props.recipientName; }
  get recipientType()        { return this.props.recipientType; }
  get status()               { return this.props.status; }
  get issuedAt()             { return this.props.issuedAt; }
  get expiresAt()            { return this.props.expiresAt; }
  get paperlessDocumentId()  { return this.props.paperlessDocumentId; }
  get serialNumber()         { return this.props.serialNumber; }
  get courseId()             { return this.props.courseId; }
  get courseName()           { return this.props.courseName; }
  get hoursCompleted()       { return this.props.hoursCompleted; }

  isExpired(): boolean {
    return this.props.status !== "revoked" &&
      this.props.expiresAt !== undefined &&
      this.props.expiresAt < new Date();
  }

  isValid(): boolean {
    return this.props.status === "issued" || this.props.status === "signed";
  }

  daysUntilExpiry(): number | null {
    if (!this.props.expiresAt) return null;
    return Math.floor((this.props.expiresAt.getTime() - Date.now()) / 86400000);
  }

  expiresWithinDays(days: number): boolean {
    const d = this.daysUntilExpiry();
    return d !== null && d >= 0 && d <= days;
  }

  issue(): Certificate {
    if (this.props.status !== "draft") throw new Error("Only draft certificates can be issued");
    return new Certificate({ ...this.props, status: "issued", updatedAt: new Date() });
  }

  sign(signedAt: Date): Certificate {
    if (this.props.status !== "issued") throw new Error("Only issued certificates can be signed");
    return new Certificate({ ...this.props, status: "signed", signedAt, updatedAt: new Date() });
  }

  revoke(reason: string): Certificate {
    if (!reason.trim()) throw new Error("Revocation reason required");
    if (this.props.status === "revoked") throw new Error("Already revoked");
    return new Certificate({ ...this.props, status: "revoked", revokeReason: reason, revokedAt: new Date(), updatedAt: new Date() });
  }

  archive(): Certificate {
    return new Certificate({ ...this.props, status: "archived", updatedAt: new Date() });
  }

  linkPaperless(documentId: number, tagIds: number[]): Certificate {
    return new Certificate({ ...this.props, paperlessDocumentId: documentId, paperlessTagIds: tagIds, updatedAt: new Date() });
  }

  toJSON(): CertificateProps {
    return { ...this.props, paperlessTagIds: [...this.props.paperlessTagIds] };
  }
}

// Certificate serial number format: SY-CERT-YYYY-NNNN
export function generateCertSerial(year: number, sequence: number): string {
  return `SY-CERT-${year}-${String(sequence).padStart(4, "0")}`;
}
