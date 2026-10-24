import {
  boolean,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const profiles = mysqlTable("profiles", {
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
  createdAt: datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export const userRoles = mysqlTable(
  "user_roles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["admin", "student"]).notNull().default("student"),
  },
  (table) => [uniqueIndex("user_roles_user_role_unique").on(table.userId, table.role)],
);

export const sessions = mysqlTable(
  "sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index("password_reset_expiry_idx").on(table.expiresAt)],
);

export const loginAttempts = mysqlTable("login_attempts", {
  email: varchar("email", { length: 255 }).primaryKey(),
  attempts: int("attempts").notNull().default(0),
  windowStartedAt: datetime("window_started_at", { mode: "date", fsp: 3 }).notNull(),
});

export const services = mysqlTable(
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
    sort: int("sort").notNull().default(0),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index("services_active_sort_idx").on(table.active, table.sort)],
);

export const requests = mysqlTable(
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
    numQuestions: int("num_questions"),
    numPages: int("num_pages"),
    academicLevel: varchar("academic_level", { length: 60 }),
    deadline: datetime("deadline", { mode: "date", fsp: 3 }),
    preferredDate: datetime("preferred_date", { mode: "date", fsp: 3 }),
    status: mysqlEnum("status", [
      "submitted",
      "under_review",
      "quoted",
      "awaiting_payment",
      "in_progress",
      "completed",
      "declined",
      "cancelled",
    ])
      .notNull()
      .default("submitted"),
    paymentStatus: mysqlEnum("payment_status", ["unpaid", "pending", "paid", "refunded"])
      .notNull()
      .default("unpaid"),
    price: decimal("price", { precision: 10, scale: 2, mode: "number" }),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    adminNotes: text("admin_notes"),
    grade: varchar("grade", { length: 20 }),
    adminFeedback: text("admin_feedback"),
    gradedAt: datetime("graded_at", { mode: "date", fsp: 3 }),
    gradedBy: varchar("graded_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("requests_ref_unique").on(table.ref),
    index("requests_student_created_idx").on(table.studentId, table.createdAt),
    index("requests_status_idx").on(table.status),
  ],
);

export const requestUpdates = mysqlTable(
  "request_updates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requestId: varchar("request_id", { length: 36 })
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", [
      "submitted",
      "under_review",
      "quoted",
      "awaiting_payment",
      "in_progress",
      "completed",
      "declined",
      "cancelled",
    ]),
    note: text("note"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index("request_updates_request_created_idx").on(table.requestId, table.createdAt)],
);

export const requestFiles = mysqlTable(
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
    size: int("size").notNull(),
    kind: mysqlEnum("kind", ["submission", "delivery"]).notNull().default("submission"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("request_files_storage_key_unique").on(table.storageKey),
    index("request_files_request_created_idx").on(table.requestId, table.createdAt),
  ],
);

export const libraryResources = mysqlTable(
  "library_resources",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    category: mysqlEnum("category", ["novel", "business_plan", "article"]).notNull(),
    storageKey: varchar("storage_key", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    size: int("size").notNull(),
    uploadedBy: varchar("uploaded_by", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("library_resources_storage_key_unique").on(table.storageKey),
    index("library_resources_category_created_idx").on(table.category, table.createdAt),
  ],
);

export const siteSettings = mysqlTable("site_settings", {
  id: int("id").primaryKey().default(1),
  showPrices: boolean("show_prices").notNull().default(true),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export const notifications = mysqlTable(
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
    readAt: datetime("read_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_user_read_created_idx").on(table.userId, table.readAt, table.createdAt),
  ],
);
