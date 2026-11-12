import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  boolean,
  decimal,
  jsonb,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "student"]);
export const requestStatusEnum = pgEnum("request_status", [
  "submitted",
  "under_review",
  "quoted",
  "awaiting_payment",
  "in_progress",
  "completed",
  "declined",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "pending",
  "paid",
  "refunded",
]);
export const requestUpdateStatusEnum = pgEnum("request_update_status", [
  "submitted",
  "under_review",
  "quoted",
  "awaiting_payment",
  "in_progress",
  "completed",
  "declined",
  "cancelled",
]);
export const requestFileKindEnum = pgEnum("request_file_kind", ["submission", "delivery"]);
export const libraryCategoryEnum = pgEnum("library_category", [
  "novel",
  "business_plan",
  "article",
  "lesson_plan",
  "working_scheme",
]);
export const libraryPurchaseStatusEnum = pgEnum("library_purchase_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
]);
export const serviceRequestPaymentStatusEnum = pgEnum("service_request_payment_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
]);

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
).enableRLS();

export const profiles = pgTable("profiles", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 100 }).notNull().default(""),
  regNumber: varchar("reg_number", { length: 50 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 40 }),
  country: varchar("country", { length: 60 }),
  institution: varchar("institution", { length: 120 }),
  course: varchar("course", { length: 120 }),
  yearOfStudy: varchar("year_of_study", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}).enableRLS();

export const userRoles = pgTable(
  "user_roles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull().default("student"),
  },
  (table) => [uniqueIndex("user_roles_user_role_unique").on(table.userId, table.role)],
).enableRLS();

export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: varchar("actor_email", { length: 255 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: varchar("target_id", { length: 36 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_audit_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("admin_audit_target_created_idx").on(table.targetType, table.targetId, table.createdAt),
  ],
).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expiry_idx").on(table.expiresAt),
  ],
).enableRLS();

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("password_reset_expiry_idx").on(table.expiresAt)],
).enableRLS();

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("email_verification_expiry_idx").on(table.expiresAt)],
).enableRLS();

export const loginAttempts = pgTable("login_attempts", {
  email: varchar("email", { length: 255 }).primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "date" }).notNull(),
}).enableRLS();

export const services = pgTable(
  "services",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    basePrice: decimal("base_price", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    unit: varchar("unit", { length: 40 }).notNull().default("per page"),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("services_active_sort_idx").on(table.active, table.sort)],
).enableRLS();

export const requests = pgTable(
  "requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ref: varchar("ref", { length: 20 }).notNull(),
    studentId: varchar("student_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: varchar("service_id", { length: 36 }).references(() => services.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    courseUnit: varchar("course_unit", { length: 120 }),
    lecturer: varchar("lecturer", { length: 120 }),
    description: text("description").notNull(),
    numQuestions: integer("num_questions"),
    numPages: integer("num_pages"),
    academicLevel: varchar("academic_level", { length: 60 }),
    deadline: timestamp("deadline", { withTimezone: true, mode: "date" }),
    preferredDate: timestamp("preferred_date", { withTimezone: true, mode: "date" }),
    status: requestStatusEnum("status").notNull().default("submitted"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
    price: decimal("price", { precision: 10, scale: 2, mode: "number" }),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    adminNotes: text("admin_notes"),
    grade: varchar("grade", { length: 20 }),
    adminFeedback: text("admin_feedback"),
    gradedAt: timestamp("graded_at", { withTimezone: true, mode: "date" }),
    gradedBy: varchar("graded_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("requests_ref_unique").on(table.ref),
    index("requests_student_created_idx").on(table.studentId, table.createdAt),
    index("requests_status_idx").on(table.status),
  ],
).enableRLS();

export const requestUpdates = pgTable(
  "request_updates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requestId: varchar("request_id", { length: 36 })
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    status: requestUpdateStatusEnum("status"),
    note: text("note"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("request_updates_request_created_idx").on(table.requestId, table.createdAt)],
).enableRLS();

export const requestFiles = pgTable(
  "request_files",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requestId: varchar("request_id", { length: 36 })
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    uploadedBy: varchar("uploaded_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    size: integer("size").notNull(),
    kind: requestFileKindEnum("kind").notNull().default("submission"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("request_files_storage_key_unique").on(table.storageKey),
    index("request_files_request_created_idx").on(table.requestId, table.createdAt),
  ],
).enableRLS();

export const libraryResources = pgTable(
  "library_resources",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    category: libraryCategoryEnum("category").notNull(),
    storageKey: varchar("storage_key", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull().default("application/octet-stream"),
    size: integer("size").notNull(),
    price: decimal("price", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    uploadedBy: varchar("uploaded_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("library_resources_storage_key_unique").on(table.storageKey),
    index("library_resources_category_created_idx").on(table.category, table.createdAt),
  ],
).enableRLS();

export const libraryPurchases = pgTable(
  "library_purchases",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    resourceId: varchar("resource_id", { length: 36 })
      .notNull()
      .references(() => libraryResources.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    status: libraryPurchaseStatusEnum("status").notNull().default("pending"),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("mpesa"),
    accountReference: varchar("account_reference", { length: 12 }),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    merchantRequestId: varchar("merchant_request_id", { length: 100 }),
    checkoutRequestId: varchar("checkout_request_id", { length: 100 }),
    receiptNumber: varchar("receipt_number", { length: 32 }),
    merchantShortcode: varchar("merchant_shortcode", { length: 7 }),
    transactionTimestamp: timestamp("transaction_timestamp", { withTimezone: true, mode: "date" }),
    callbackResponse: jsonb("callback_response").$type<Record<string, unknown>>(),
    failureReason: varchar("failure_reason", { length: 255 }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("library_purchases_checkout_unique").on(table.checkoutRequestId),
    uniqueIndex("library_purchases_merchant_unique").on(table.merchantRequestId),
    uniqueIndex("library_purchases_receipt_unique").on(table.receiptNumber),
    index("library_purchases_student_status_idx").on(table.studentId, table.status),
    index("library_purchases_resource_created_idx").on(table.resourceId, table.createdAt),
    index("library_purchases_status_created_idx").on(table.status, table.createdAt),
  ],
).enableRLS();

export const serviceRequestPayments = pgTable(
  "service_request_payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requestId: varchar("request_id", { length: 36 })
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    status: serviceRequestPaymentStatusEnum("status").notNull().default("pending"),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    accountReference: varchar("account_reference", { length: 12 }).notNull(),
    merchantRequestId: varchar("merchant_request_id", { length: 100 }),
    checkoutRequestId: varchar("checkout_request_id", { length: 100 }),
    receiptNumber: varchar("receipt_number", { length: 32 }),
    merchantShortcode: varchar("merchant_shortcode", { length: 7 }),
    transactionTimestamp: timestamp("transaction_timestamp", { withTimezone: true, mode: "date" }),
    callbackResponse: jsonb("callback_response").$type<Record<string, unknown>>(),
    failureReason: varchar("failure_reason", { length: 255 }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("service_request_payments_checkout_unique").on(table.checkoutRequestId),
    uniqueIndex("service_request_payments_merchant_unique").on(table.merchantRequestId),
    uniqueIndex("service_request_payments_receipt_unique").on(table.receiptNumber),
    index("service_request_payments_request_created_idx").on(table.requestId, table.createdAt),
    index("service_request_payments_student_status_idx").on(table.studentId, table.status),
    index("service_request_payments_status_created_idx").on(table.status, table.createdAt),
  ],
).enableRLS();

export const faqEntries = pgTable(
  "faq_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    question: varchar("question", { length: 300 }).notNull(),
    answer: text("answer").notNull(),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("faq_entries_active_sort_idx").on(table.active, table.sort)],
).enableRLS();

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    content: text("content").notNull(),
    published: boolean("published").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_documents_published_title_idx").on(table.published, table.title)],
).enableRLS();

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  businessName: varchar("business_name", { length: 120 }).notNull().default("ScholarDesk"),
  mpesaTillNumber: varchar("mpesa_till_number", { length: 7 }),
  showPrices: boolean("show_prices").notNull().default(true),
  contactEmail: varchar("contact_email", { length: 255 })
    .notNull()
    .default("support@scholardesk.app"),
  contactPhone: varchar("contact_phone", { length: 40 }).notNull().default("+254 700 000 000"),
  contactWhatsapp: varchar("contact_whatsapp", { length: 40 }).notNull().default(""),
  supportHours: varchar("support_hours", { length: 120 })
    .notNull()
    .default("Mon-Sat, 8:00-20:00 EAT"),
  footerMessage: varchar("footer_message", { length: 255 })
    .notNull()
    .default("Thoughtful academic support, from first draft to final submission."),
  faqTitle: varchar("faq_title", { length: 160 }).notNull().default("Frequently asked questions"),
  faqIntro: varchar("faq_intro", { length: 500 })
    .notNull()
    .default("Answers to common questions about ScholarDesk services, payments and privacy."),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}).enableRLS();

export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestId: varchar("request_id", { length: 36 }).references(() => requests.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    href: varchar("href", { length: 255 }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_user_read_created_idx").on(table.userId, table.readAt, table.createdAt),
  ],
).enableRLS();
