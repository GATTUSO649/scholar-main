import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import {
  emailVerificationTokens,
  loginAttempts,
  libraryPurchases,
  libraryResources,
  notifications,
  passwordResetTokens,
  profiles,
  requestFiles,
  requestUpdates,
  requests,
  services,
  sessions,
  siteSettings,
  userRoles,
  users,
} from "../../drizzle/schema";
import { getCookie, setCookie, deleteCookie, getRequestUrl } from "@tanstack/react-start/server";
import { getDatabase } from "./database.server";
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
  genericEmailRequestResponse,
  getEmailConfig,
  isEmailVerificationRequired,
  sendTransactionalEmail,
} from "./email.server";
import { initiateMpesaStkPush, queryMpesaStkPush } from "./mpesa.server";

function derivePassword(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}
const SESSION_COOKIE = "scholar_desk_session";
const SESSION_DAYS = 14;
const RESET_MINUTES = 30;
const EMAIL_VERIFICATION_MINUTES = 30;
const EMAIL_REQUEST_WINDOW_MINUTES = 15;
const MAX_EMAIL_REQUESTS = 3;
const LOGIN_WINDOW_MINUTES = 15;
const MAX_LOGIN_ATTEMPTS = 8;

export type SessionUser = { id: string; email: string };
export type ProfileDto = {
  id: string;
  full_name: string;
  reg_number: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  institution: string | null;
  course: string | null;
  year_of_study: string | null;
  created_at: string;
  updated_at: string;
};
type Role = "admin" | "student";
type RequestState =
  | "submitted"
  | "under_review"
  | "quoted"
  | "awaiting_payment"
  | "in_progress"
  | "completed"
  | "declined"
  | "cancelled";
type PaymentState = "unpaid" | "pending" | "paid" | "refunded";
export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function passwordMatches(password: string, encodedHash: string) {
  const [saltHex, hashHex] = encodedHash.split(":");
  if (!saltHex || !hashHex) return false;
  const actual = await derivePassword(password, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(hashHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function encodePassword(password: string, salt: Buffer, hash: Buffer) {
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function canUseStudentPortal(roles: readonly Role[]) {
  return roles.includes("student") && !roles.includes("admin");
}

export function canUseAdminPortal(roles: readonly Role[]) {
  return roles.includes("admin");
}

function mapProfile(row: typeof profiles.$inferSelect): ProfileDto {
  return {
    id: row.id,
    full_name: row.fullName,
    reg_number: row.regNumber,
    email: row.email,
    phone: row.phone,
    country: row.country,
    institution: row.institution,
    course: row.course,
    year_of_study: row.yearOfStudy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function setSessionCookie(token: string) {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, { path: "/", httpOnly: true, sameSite: "lax" });
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDatabase()
    .insert(sessions)
    .values({ tokenHash: tokenHash(token), userId, expiresAt });
  setSessionCookie(token);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const [row] = await getDatabase()
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to perform this action.");
  return user;
}

async function requireAdmin() {
  const user = await requireUser();
  const [role] = await getDatabase()
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, "admin")))
    .limit(1);
  if (!role) throw new Error("Administrator access is required.");
  return user;
}

async function requireLibraryStudent() {
  const user = await requireUser();
  const roles = await getDatabase()
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));
  if (!canUseStudentPortal(roles.map(({ role }) => role))) {
    throw new Error("Student library access is required.");
  }
  return user;
}

async function isEmailRequestRateLimited(action: "reset" | "verification", email: string) {
  const key = `${action}:${tokenHash(email)}`;
  const now = new Date();
  const windowInterval = sql.raw(`${EMAIL_REQUEST_WINDOW_MINUTES} MINUTE`);
  const db = getDatabase();
  await db
    .insert(loginAttempts)
    .values({ email: key, attempts: 1, windowStartedAt: now })
    .onDuplicateKeyUpdate({
      set: {
        attempts: sql`IF(${loginAttempts.windowStartedAt} < DATE_SUB(NOW(3), INTERVAL ${windowInterval}), 1, ${loginAttempts.attempts} + 1)`,
        windowStartedAt: sql`IF(${loginAttempts.windowStartedAt} < DATE_SUB(NOW(3), INTERVAL ${windowInterval}), NOW(3), ${loginAttempts.windowStartedAt})`,
      },
    });
  const [attempt] = await db
    .select({ attempts: loginAttempts.attempts })
    .from(loginAttempts)
    .where(eq(loginAttempts.email, key))
    .limit(1);
  return (attempt?.attempts ?? 0) > MAX_EMAIL_REQUESTS;
}

async function createVerificationTokenForUser(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_MINUTES * 60 * 1000);
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await tx.insert(emailVerificationTokens).values({
      tokenHash: tokenHash(token),
      userId,
      expiresAt,
    });
  });
  return token;
}

async function sendVerificationEmail(userId: string, email: string, fullName?: string | null) {
  const config = getEmailConfig();
  if (!config.enabled || !config.appUrl) return false;
  const token = await createVerificationTokenForUser(userId);
  const mail = buildVerificationEmail({
    appUrl: config.appUrl,
    code: token,
    name: fullName ?? undefined,
  });
  const result = await sendTransactionalEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (!result.ok) {
    console.warn("Verification email could not be sent.", {
      toDomain: email.split("@")[1] ?? "unknown",
      reason: result.reason ?? "unknown",
    });
  }
  return result.ok;
}

export async function requestEmailVerification(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  if (!email || (await isEmailRequestRateLimited("verification", email))) {
    return genericEmailRequestResponse();
  }
  const [account] = await getDatabase()
    .select({
      id: users.id,
      email: users.email,
      fullName: profiles.fullName,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.id, users.id))
    .where(eq(users.email, email))
    .limit(1);
  if (!account || account.emailVerifiedAt) return genericEmailRequestResponse();
  await sendVerificationEmail(account.id, account.email, account.fullName);
  return genericEmailRequestResponse();
}

export async function verifyEmailToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) throw new AuthError("The verification link is invalid or expired.");
  const db = getDatabase();
  const [record] = await db
    .select({
      userId: emailVerificationTokens.userId,
      expiresAt: emailVerificationTokens.expiresAt,
      email: users.email,
      fullName: profiles.fullName,
    })
    .from(emailVerificationTokens)
    .innerJoin(users, eq(users.id, emailVerificationTokens.userId))
    .leftJoin(profiles, eq(profiles.id, users.id))
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash(trimmed)),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!record) throw new AuthError("The verification link is invalid or expired.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, record.userId));
    await tx
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, record.userId));
  });
  return { success: true, email: record.email, fullName: record.fullName ?? undefined };
}

export async function registerAccount(input: {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  country: string;
}) {
  const email = input.email.trim().toLowerCase();
  const id = randomUUID();
  const salt = randomBytes(16);
  const passwordHash = `${salt.toString("hex")}:${(await derivePassword(input.password, salt)).toString("hex")}`;
  try {
    const db = getDatabase();
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id, email, passwordHash, emailVerifiedAt: null });
      await tx.insert(profiles).values({
        id,
        email,
        fullName: input.full_name.trim(),
        phone: input.phone.trim(),
        country: input.country.trim(),
        course: null,
        yearOfStudy: null,
      });
      await tx.insert(userRoles).values({ id: randomUUID(), userId: id, role: "student" });
    });
    if (isEmailVerificationRequired()) {
      await sendVerificationEmail(id, email, input.full_name.trim());
    }
  } catch (error) {
    if (isDuplicateKey(error))
      throw new AuthError(
        "Could not create your account. If you already have an account, sign in or reset your password.",
      );
    console.error(
      "Account registration failed.",
      getDatabaseErrorCode(error) ?? "unknown database error",
    );
    throw new AuthError(
      "Could not create your account. If you already have an account, sign in or reset your password.",
    );
  }
  return { id, email };
}

export function isAdminSignupConfigured(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= 32;
}

export function getAdminSignupState() {
  if (!isAdminSignupConfigured(process.env["ADMIN_SIGNUP_SECRET"])) {
    return { available: false, reason: "not_configured" as const };
  }
  return { available: true, reason: null };
}

export async function registerAdmin(input: {
  email: string;
  password: string;
  full_name: string;
  signup_secret: string;
}) {
  const configuredSecret = process.env["ADMIN_SIGNUP_SECRET"];
  if (!isAdminSignupConfigured(configuredSecret)) {
    throw new AuthError("Administrator signup is not configured.");
  }

  const expected = createHash("sha256").update(configuredSecret).digest();
  const actual = createHash("sha256").update(input.signup_secret).digest();
  if (!timingSafeEqual(actual, expected)) {
    throw new AuthError("The admin signup key is incorrect.");
  }

  const email = input.email.trim().toLowerCase();
  const id = randomUUID();
  const salt = randomBytes(16);
  const passwordHash = `${salt.toString("hex")}:${(await derivePassword(input.password, salt)).toString("hex")}`;
  const sessionToken = randomBytes(32).toString("base64url");
  try {
    const db = getDatabase();
    await db.transaction(async (tx) => {
      await tx
        .insert(siteSettings)
        .values({ id: 1, showPrices: true })
        .onDuplicateKeyUpdate({ set: { showPrices: sql`show_prices` } });

      await tx.insert(users).values({ id, email, passwordHash });
      await tx.insert(profiles).values({
        id,
        email,
        fullName: input.full_name.trim(),
      });
      await tx.insert(userRoles).values({ id: randomUUID(), userId: id, role: "admin" });
      await tx.insert(sessions).values({
        tokenHash: tokenHash(sessionToken),
        userId: id,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
      });
    });
    setSessionCookie(sessionToken);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (isDuplicateKey(error))
      throw new AuthError(
        "Could not create the administrator account. If this email is already registered, sign in.",
      );
    console.error(
      "Administrator registration failed.",
      getDatabaseErrorCode(error) ?? "unknown database error",
    );
    throw new AuthError(
      "Could not create the administrator account. If this email is already registered, sign in.",
    );
  }
  return { id, email };
}

class AuthError extends Error {}

export function getDatabaseErrorCode(error: unknown): string | undefined {
  let current = error;
  const visited = new Set<object>();

  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    const wrapped = current as { code?: unknown; cause?: unknown };
    if (typeof wrapped.code === "string") return wrapped.code;
    current = wrapped.cause;
  }

  return undefined;
}

function isDuplicateKey(error: unknown): boolean {
  return getDatabaseErrorCode(error) === "ER_DUP_ENTRY";
}

async function authenticateAccount(input: { email: string; password: string }, adminOnly: boolean) {
  try {
    const db = getDatabase();
    const email = input.email.trim().toLowerCase();
    const now = new Date();
    const loginWindowInterval = sql.raw(`${LOGIN_WINDOW_MINUTES} MINUTE`);
    await db
      .insert(loginAttempts)
      .values({ email, attempts: 1, windowStartedAt: now })
      .onDuplicateKeyUpdate({
        set: {
          attempts: sql`IF(${loginAttempts.windowStartedAt} < DATE_SUB(NOW(3), INTERVAL ${loginWindowInterval}), 1, ${loginAttempts.attempts} + 1)`,
          windowStartedAt: sql`IF(${loginAttempts.windowStartedAt} < DATE_SUB(NOW(3), INTERVAL ${loginWindowInterval}), NOW(3), ${loginAttempts.windowStartedAt})`,
        },
      });
    const [attempt] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.email, email))
      .limit(1);
    if (attempt && attempt.attempts > MAX_LOGIN_ATTEMPTS) {
      throw new AuthError("Too many sign-in attempts. Please wait 15 minutes and try again.");
    }
    const [account] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const valid = account ? await passwordMatches(input.password, account.passwordHash) : false;
    if (!account || !valid) throw new AuthError("Email or password is incorrect.");
    if (isEmailVerificationRequired() && !account.emailVerifiedAt) {
      throw new AuthError("Email verification is required before you can sign in.");
    }
    const roles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, account.id));
    const accountRoles = roles.map((role) => role.role);
    if (adminOnly ? !canUseAdminPortal(accountRoles) : !canUseStudentPortal(accountRoles)) {
      throw new AuthError("Email or password is incorrect.");
    }
    await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
    await createSession(account.id);
    return { id: account.id, email: account.email };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    console.error("Sign-in failed.", {
      code: getDatabaseErrorCode(error) ?? "unknown error",
    });
    throw new AuthError("Sign-in is temporarily unavailable. Please try again.");
  }
}

export function loginStudentAccount(input: { email: string; password: string }) {
  return authenticateAccount(input, false);
}

export function loginAdminAccount(input: { email: string; password: string }) {
  return authenticateAccount(input, true);
}

export async function logoutAccount() {
  const token = getCookie(SESSION_COOKIE);
  if (token)
    await getDatabase()
      .delete(sessions)
      .where(eq(sessions.tokenHash, tokenHash(token)));
  clearSessionCookie();
}

export async function requestPasswordReset(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const config = getEmailConfig();
  if (!config.enabled || !config.appUrl) {
    console.error("Password reset email is unavailable.", {
      reason: config.reason ?? "missing_app_url",
    });
    return genericEmailRequestResponse();
  }

  if (await isEmailRequestRateLimited("reset", email)) {
    return genericEmailRequestResponse();
  }

  const [account] = await getDatabase()
    .select({ id: users.id, email: users.email, fullName: profiles.fullName })
    .from(users)
    .leftJoin(profiles, eq(profiles.id, users.id))
    .where(eq(users.email, email))
    .limit(1);
  if (!account) return genericEmailRequestResponse();

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
  await getDatabase().transaction(async (tx) => {
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, account.id));
    await tx
      .insert(passwordResetTokens)
      .values({ tokenHash: tokenHash(token), userId: account.id, expiresAt });
  });
  const mail = buildPasswordResetEmail({
    appUrl: config.appUrl,
    token,
    name: account.fullName ?? undefined,
  });
  const result = await sendTransactionalEmail({
    to: account.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (!result.ok) {
    console.warn("Password reset email could not be sent.", {
      toDomain: account.email.split("@")[1] ?? "unknown",
      reason: result.reason ?? "unknown",
      messageId: result.messageId ?? null,
    });
  }
  return genericEmailRequestResponse();
}

export async function resetPassword(token: string, password: string) {
  const db = getDatabase();
  const hashedToken = tokenHash(token);
  const [reset] = await db
    .select({
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      email: users.email,
      fullName: profiles.fullName,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .leftJoin(profiles, eq(profiles.id, users.id))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashedToken),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!reset) throw new Error("This password reset link is invalid or has expired.");
  const salt = randomBytes(16);
  const passwordHash = `${salt.toString("hex")}:${(await derivePassword(password, salt)).toString("hex")}`;
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, reset.userId));
    await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
  });
  const config = getEmailConfig();
  if (config.enabled) {
    const mail = buildPasswordChangedEmail({
      appUrl: config.appUrl,
      name: reset.fullName ?? undefined,
    });
    await sendTransactionalEmail({
      to: reset.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  }
  clearSessionCookie();
  return { success: true };
}

export async function changeAccountPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const user = await requireUser();
  const sessionToken = getCookie(SESSION_COOKIE);
  if (!sessionToken) throw new AuthError("Your session has expired. Sign in again.");

  const db = getDatabase();
  const [account] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!account || !(await passwordMatches(input.currentPassword, account.passwordHash))) {
    throw new AuthError("Current password is incorrect.");
  }

  const salt = randomBytes(16);
  const passwordHash = encodePassword(
    input.newPassword,
    salt,
    await derivePassword(input.newPassword, salt),
  );
  const currentSessionHash = tokenHash(sessionToken);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await tx
      .delete(sessions)
      .where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, currentSessionHash)));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  });

  return { success: true };
}

export async function getProfile(userId?: string) {
  const current = await requireUser();
  if (userId && userId !== current.id) await requireAdmin();
  const id = userId ?? current.id;
  const [profile] = await getDatabase().select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return profile ? mapProfile(profile) : null;
}

export async function isCurrentUserAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  const [role] = await getDatabase()
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, "admin")))
    .limit(1);
  return !!role;
}

export async function saveProfile(input: {
  full_name: string;
  phone: string;
  country: string;
  institution: string;
  year_of_study: string;
}) {
  const user = await requireUser();
  const values = {
    fullName: input.full_name.trim(),
    phone: input.phone.trim() || null,
    country: input.country.trim() || null,
    institution: input.institution.trim() || null,
    yearOfStudy: input.year_of_study.trim() || null,
    updatedAt: new Date(),
  };
  await getDatabase().update(profiles).set(values).where(eq(profiles.id, user.id));
  return getProfile();
}

export async function getPublicData() {
  const db = getDatabase();
  const [setting] = await db
    .select({ showPrices: siteSettings.showPrices })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.active, true))
    .orderBy(services.sort);
  return {
    showPrices: setting?.showPrices ?? true,
    services: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      base_price: row.basePrice,
      currency: row.currency,
      unit: row.unit,
      active: row.active,
      sort: row.sort,
      created_at: row.createdAt.toISOString(),
    })),
  };
}

function mapLibraryResource(row: typeof libraryResources.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    name: row.name,
    size: row.size,
    price: row.price,
    currency: row.currency,
    created_at: row.createdAt.toISOString(),
  };
}

export async function getLibraryResources() {
  const rows = await getDatabase()
    .select()
    .from(libraryResources)
    .orderBy(desc(libraryResources.createdAt));
  return rows.map(mapLibraryResource);
}

export async function getAdminLibraryResources() {
  await requireAdmin();
  return getLibraryResources();
}

export async function getStudentLibraryResources() {
  const student = await requireLibraryStudent();
  const db = getDatabase();
  const [resources, purchases] = await Promise.all([
    db.select().from(libraryResources).orderBy(desc(libraryResources.createdAt)),
    db
      .select({ resourceId: libraryPurchases.resourceId, status: libraryPurchases.status })
      .from(libraryPurchases)
      .where(eq(libraryPurchases.studentId, student.id))
      .orderBy(desc(libraryPurchases.createdAt)),
  ]);
  const purchaseState = new Map<string, "paid" | "pending" | "failed">();
  for (const purchase of purchases) {
    if (purchase.status === "paid") {
      purchaseState.set(purchase.resourceId, "paid");
    } else if (!purchaseState.has(purchase.resourceId)) {
      purchaseState.set(purchase.resourceId, purchase.status);
    }
  }
  return resources.map((resource) => {
    const purchaseStatus: "free" | "available" | "pending" | "paid" | "failed" =
      resource.price <= 0 ? "free" : (purchaseState.get(resource.id) ?? "available");
    return { ...mapLibraryResource(resource), purchase_status: purchaseStatus };
  });
}

export async function requireLibraryAdmin() {
  await requireAdmin();
}

export async function createLibraryResource(input: {
  title: string;
  description: string;
  category: "novel" | "business_plan" | "article";
  price: number;
  storageKey: string;
  name: string;
  size: number;
}) {
  const user = await requireAdmin();
  await getDatabase().insert(libraryResources).values({
    id: randomUUID(),
    title: input.title,
    description: input.description,
    category: input.category,
    price: input.price,
    currency: "KES",
    storageKey: input.storageKey,
    name: input.name,
    size: input.size,
    uploadedBy: user.id,
  });
  return { success: true };
}

export async function updateLibraryResource(
  id: string,
  input: {
    title: string;
    description: string;
    category: "novel" | "business_plan" | "article";
    price: number;
  },
) {
  await requireAdmin();
  const db = getDatabase();
  const [resource] = await db
    .select({ id: libraryResources.id })
    .from(libraryResources)
    .where(eq(libraryResources.id, id))
    .limit(1);
  if (!resource) return null;
  await db
    .update(libraryResources)
    .set({
      title: input.title,
      description: input.description,
      category: input.category,
      price: input.price,
      currency: "KES",
    })
    .where(eq(libraryResources.id, id));
  return { success: true };
}

export async function getLibraryResourceForDownload(id: string) {
  const db = getDatabase();
  const [resource] = await getDatabase()
    .select({
      id: libraryResources.id,
      storageKey: libraryResources.storageKey,
      name: libraryResources.name,
      price: libraryResources.price,
    })
    .from(libraryResources)
    .where(eq(libraryResources.id, id))
    .limit(1);
  if (!resource) return null;
  if (resource.price > 0) {
    const user = await requireUser();
    const roles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));
    if (
      !canUseStudentPortal(roles.map(({ role }) => role)) &&
      !canUseAdminPortal(roles.map(({ role }) => role))
    ) {
      throw new Error("Purchase this resource before downloading it.");
    }
    if (canUseStudentPortal(roles.map(({ role }) => role))) {
      const [purchase] = await db
        .select({ id: libraryPurchases.id })
        .from(libraryPurchases)
        .where(
          and(
            eq(libraryPurchases.resourceId, resource.id),
            eq(libraryPurchases.studentId, user.id),
            eq(libraryPurchases.status, "paid"),
          ),
        )
        .limit(1);
      if (!purchase) throw new Error("Purchase this resource before downloading it.");
    }
  }
  return resource;
}

export async function startLibraryPurchase(input: { resourceId: string; phoneNumber: string }) {
  const student = await requireLibraryStudent();
  const db = getDatabase();
  const [resource] = await db
    .select({
      id: libraryResources.id,
      title: libraryResources.title,
      price: libraryResources.price,
      currency: libraryResources.currency,
    })
    .from(libraryResources)
    .where(eq(libraryResources.id, input.resourceId))
    .limit(1);
  if (!resource) throw new Error("Resource not found.");
  if (resource.price <= 0) throw new Error("This resource is free to download.");
  if (
    resource.currency !== "KES" ||
    !Number.isInteger(resource.price) ||
    resource.price > 150_000
  ) {
    throw new Error("This resource price is not configured for M-Pesa.");
  }
  if (!/^254[17]\d{8}$/.test(input.phoneNumber)) {
    throw new Error("Enter a Safaricom phone number in 2547XXXXXXXX format.");
  }

  const purchase = await db.transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, student.id))
      .limit(1)
      .for("update");

    const [paid] = await tx
      .select({ id: libraryPurchases.id })
      .from(libraryPurchases)
      .where(
        and(
          eq(libraryPurchases.resourceId, resource.id),
          eq(libraryPurchases.studentId, student.id),
          eq(libraryPurchases.status, "paid"),
        ),
      )
      .limit(1);
    if (paid) return { purchaseId: paid.id, status: "paid" as const };

    const [pending] = await tx
      .select({ id: libraryPurchases.id })
      .from(libraryPurchases)
      .where(
        and(
          eq(libraryPurchases.resourceId, resource.id),
          eq(libraryPurchases.studentId, student.id),
          eq(libraryPurchases.status, "pending"),
        ),
      )
      .orderBy(desc(libraryPurchases.createdAt))
      .limit(1);
    if (pending) return { purchaseId: pending.id, status: "pending" as const };

    const purchaseId = randomUUID();
    await tx.insert(libraryPurchases).values({
      id: purchaseId,
      resourceId: resource.id,
      studentId: student.id,
      amount: resource.price,
      currency: resource.currency,
      status: "pending",
      phoneNumber: input.phoneNumber,
    });
    return { purchaseId, status: "new" as const };
  });

  if (purchase.status !== "new") return purchase;
  const { purchaseId } = purchase;
  try {
    const checkout = await initiateMpesaStkPush({
      phoneNumber: input.phoneNumber,
      amount: resource.price,
      accountReference: `L${purchaseId.replaceAll("-", "").slice(0, 11)}`,
      transactionDesc: "LIBRARY",
    });
    if (!checkout.CheckoutRequestID || !checkout.MerchantRequestID) {
      throw new Error("M-Pesa did not return a checkout reference.");
    }
    await db
      .update(libraryPurchases)
      .set({
        checkoutRequestId: checkout.CheckoutRequestID,
        merchantRequestId: checkout.MerchantRequestID,
      })
      .where(eq(libraryPurchases.id, purchaseId));
    return {
      purchaseId,
      status: "pending" as const,
      message: checkout.CustomerMessage || `Check ${input.phoneNumber} to complete payment.`,
    };
  } catch (error) {
    await db
      .update(libraryPurchases)
      .set({ status: "failed" })
      .where(eq(libraryPurchases.id, purchaseId));
    throw error;
  }
}

async function syncLibraryPurchaseFromProvider(purchaseId: string) {
  const db = getDatabase();
  const [purchase] = await db
    .select({
      id: libraryPurchases.id,
      studentId: libraryPurchases.studentId,
      amount: libraryPurchases.amount,
      status: libraryPurchases.status,
      checkoutRequestId: libraryPurchases.checkoutRequestId,
      title: libraryResources.title,
    })
    .from(libraryPurchases)
    .innerJoin(libraryResources, eq(libraryPurchases.resourceId, libraryResources.id))
    .where(eq(libraryPurchases.id, purchaseId))
    .limit(1);
  if (!purchase) return { status: "not_found" as const };
  if (purchase.status !== "pending" || !purchase.checkoutRequestId) {
    return { status: purchase.status };
  }

  const verification = await queryMpesaStkPush(purchase.checkoutRequestId);
  if (String(verification.ResponseCode) !== "0" || verification.ResultCode == null) {
    return { status: "pending" as const };
  }
  const paid = String(verification.ResultCode) === "0";

  const status = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: libraryPurchases.status })
      .from(libraryPurchases)
      .where(eq(libraryPurchases.id, purchase.id))
      .limit(1)
      .for("update");
    if (!current) return "not_found" as const;
    if (current.status !== "pending") return current.status;
    await tx
      .update(libraryPurchases)
      .set({ status: paid ? "paid" : "failed", ...(paid ? { paidAt: new Date() } : {}) })
      .where(eq(libraryPurchases.id, purchase.id));
    if (paid) {
      await tx.insert(notifications).values({
        id: randomUUID(),
        userId: purchase.studentId,
        requestId: null,
        type: "library_purchase",
        title: "Library purchase complete",
        message: `Your payment for ${purchase.title} was confirmed. The resource is ready to download.`,
        href: "/portal/library",
      });
    }
    return paid ? ("paid" as const) : ("failed" as const);
  });
  return { status };
}

export async function refreshStudentLibraryPurchaseStatus(purchaseId: string) {
  const student = await requireLibraryStudent();
  const [purchase] = await getDatabase()
    .select({ id: libraryPurchases.id })
    .from(libraryPurchases)
    .where(and(eq(libraryPurchases.id, purchaseId), eq(libraryPurchases.studentId, student.id)))
    .limit(1);
  if (!purchase) return { status: "not_found" as const };
  return syncLibraryPurchaseFromProvider(purchase.id);
}

export async function handleLibraryPurchaseCallback(input: {
  checkoutRequestId: string;
  resultCode: number;
  amount?: number;
  receiptNumber?: string;
}) {
  const db = getDatabase();
  const [purchase] = await db
    .select({
      id: libraryPurchases.id,
      studentId: libraryPurchases.studentId,
      resourceId: libraryPurchases.resourceId,
      amount: libraryPurchases.amount,
      status: libraryPurchases.status,
      title: libraryResources.title,
    })
    .from(libraryPurchases)
    .innerJoin(libraryResources, eq(libraryPurchases.resourceId, libraryResources.id))
    .where(eq(libraryPurchases.checkoutRequestId, input.checkoutRequestId))
    .limit(1);
  if (!purchase) return { status: "unknown" as const };
  if (purchase.status === "paid") return { status: "paid" as const };
  if (input.resultCode === 0 && input.amount != null && input.amount !== purchase.amount) {
    return { status: "pending" as const };
  }
  const result = await syncLibraryPurchaseFromProvider(purchase.id);
  if (result.status === "paid" && input.receiptNumber?.trim()) {
    await db
      .update(libraryPurchases)
      .set({ receiptNumber: input.receiptNumber.trim().slice(0, 32) })
      .where(
        and(
          eq(libraryPurchases.id, purchase.id),
          eq(libraryPurchases.status, "paid"),
          isNull(libraryPurchases.receiptNumber),
        ),
      );
  }
  return result;
}

export async function deleteLibraryResource(id: string) {
  await requireAdmin();
  const [resource] = await getDatabase()
    .select({ storageKey: libraryResources.storageKey })
    .from(libraryResources)
    .where(eq(libraryResources.id, id))
    .limit(1);
  if (!resource) return null;
  await getDatabase().delete(libraryResources).where(eq(libraryResources.id, id));
  return resource;
}

function mapRequest(
  row: typeof requests.$inferSelect,
  serviceName: string | null,
  includePrivate = false,
) {
  return {
    id: row.id,
    ref: row.ref,
    student_id: row.studentId,
    service_id: row.serviceId,
    title: row.title,
    course_unit: row.courseUnit,
    lecturer: row.lecturer,
    description: row.description,
    num_questions: row.numQuestions,
    num_pages: row.numPages,
    academic_level: row.academicLevel,
    deadline: row.deadline?.toISOString() ?? null,
    preferred_date: row.preferredDate?.toISOString() ?? null,
    status: row.status,
    payment_status: row.paymentStatus,
    price: row.price,
    currency: row.currency,
    admin_notes: includePrivate ? row.adminNotes : null,
    grade: row.grade,
    admin_feedback: row.adminFeedback,
    graded_at: row.gradedAt?.toISOString() ?? null,
    graded_by: includePrivate ? row.gradedBy : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    services: serviceName ? { name: serviceName } : null,
  };
}

export async function getMyRequests() {
  const user = await requireUser();
  const rows = await getDatabase()
    .select({ request: requests, serviceName: services.name })
    .from(requests)
    .leftJoin(services, eq(requests.serviceId, services.id))
    .where(eq(requests.studentId, user.id))
    .orderBy(desc(requests.createdAt));
  return rows.map(({ request, serviceName }) => mapRequest(request, serviceName));
}

export async function getMyUpdateCount() {
  const user = await requireUser();
  const [row] = await getDatabase()
    .select({ count: sql<number>`count(*)` })
    .from(requestUpdates)
    .innerJoin(requests, eq(requestUpdates.requestId, requests.id))
    .where(eq(requests.studentId, user.id));
  return Number(row?.count ?? 0);
}

export async function getMyNotifications() {
  const user = await requireUser();
  const db = getDatabase();
  const [rows, [unreadRow]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(20),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
  ]);
  return {
    items: rows.map((row): NotificationDto => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      href: row.href,
      read_at: row.readAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    })),
    unreadCount: Number(unreadRow?.count ?? 0),
  };
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await getDatabase()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, user.id),
        isNull(notifications.readAt),
      ),
    );
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await getDatabase()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
}

export async function getRequestBundle(id: string) {
  const user = await requireUser();
  const db = getDatabase();
  const [joined] = await db
    .select({ request: requests, serviceName: services.name })
    .from(requests)
    .leftJoin(services, eq(requests.serviceId, services.id))
    .where(eq(requests.id, id))
    .limit(1);
  const isAdmin = await isCurrentUserAdmin();
  if (!joined || (joined.request.studentId !== user.id && !isAdmin)) {
    return { req: null, files: [], updates: [] };
  }
  const [files, updates] = await Promise.all([
    db
      .select()
      .from(requestFiles)
      .where(eq(requestFiles.requestId, id))
      .orderBy(requestFiles.createdAt),
    db
      .select()
      .from(requestUpdates)
      .where(eq(requestUpdates.requestId, id))
      .orderBy(desc(requestUpdates.createdAt)),
  ]);
  return {
    req: mapRequest(joined.request, joined.serviceName, isAdmin),
    files: files.map((file) => ({
      id: file.id,
      request_id: file.requestId,
      uploaded_by: file.uploadedBy,
      path: file.storageKey,
      name: file.name,
      kind: file.kind,
      created_at: file.createdAt.toISOString(),
    })),
    updates: updates.map((update) => ({
      id: update.id,
      request_id: update.requestId,
      status: update.status,
      note: update.note,
      created_by: update.createdBy,
      created_at: update.createdAt.toISOString(),
    })),
  };
}

export async function createRequest(input: {
  title: string;
  service_id: string;
  course_unit?: string | null | undefined;
  lecturer?: string | null | undefined;
  academic_level?: string | null | undefined;
  description: string;
  num_questions?: number | null | undefined;
  num_pages?: number | null | undefined;
  deadline: string;
  preferred_date?: string | null | undefined;
}) {
  const user = await requireUser();
  const deadline = new Date(input.deadline);
  const preferredDate = input.preferred_date ? new Date(input.preferred_date) : null;
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    throw new Error("Deadline must be in the future.");
  }
  if (preferredDate && Number.isNaN(preferredDate.getTime())) {
    throw new Error("Preferred completion date is invalid.");
  }
  const db = getDatabase();
  const [service] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, input.service_id), eq(services.active, true)))
    .limit(1);
  if (!service) throw new Error("The selected support service is unavailable.");
  const id = randomUUID();
  const ref = `REQ-${randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(requests).values({
        id,
        ref,
        studentId: user.id,
        serviceId: input.service_id,
        title: input.title.trim(),
        courseUnit: input.course_unit?.trim() || null,
        lecturer: input.lecturer?.trim() || null,
        academicLevel: input.academic_level || null,
        description: input.description.trim(),
        numQuestions: input.num_questions ?? null,
        numPages: input.num_pages ?? null,
        deadline,
        preferredDate,
      });
      const adminUsers = await tx
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.role, "admin"));
      if (!adminUsers.length) {
        throw new Error("No administrator is configured to receive student requests.");
      }
      await tx.insert(notifications).values(
        adminUsers.map(({ userId }) => ({
          id: randomUUID(),
          userId,
          requestId: id,
          type: "new_request",
          title: "New student request",
          message: `A student submitted “${input.title.trim()}” (${ref}).`,
          href: `/manage/${id}`,
        })),
      );
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "No administrator is configured to receive student requests."
    ) {
      throw error;
    }
    console.error(
      "Student request creation failed.",
      getDatabaseErrorCode(error) ?? "unknown database error",
    );
    throw new Error("Could not submit your request. Please try again.");
  }
  return { id };
}

export async function getAdminRequests() {
  await requireAdmin();
  const rows = await getDatabase()
    .select({
      request: requests,
      serviceName: services.name,
      studentName: profiles.fullName,
    })
    .from(requests)
    .leftJoin(services, eq(requests.serviceId, services.id))
    .leftJoin(profiles, eq(requests.studentId, profiles.id))
    .orderBy(desc(requests.createdAt));
  return rows.map(({ request, serviceName, studentName }) => ({
    ...mapRequest(request, serviceName, true),
    profiles: studentName ? { full_name: studentName } : null,
  }));
}

export async function getAdminStudents() {
  await requireAdmin();
  const rows = await getDatabase().select().from(profiles).orderBy(desc(profiles.createdAt));
  return rows.map(mapProfile);
}

export async function setPublicPrices(showPrices: boolean) {
  await requireAdmin();
  await getDatabase()
    .insert(siteSettings)
    .values({ id: 1, showPrices, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { showPrices, updatedAt: new Date() } });
  return showPrices;
}

export async function updateRequest(input: {
  id: string;
  status: RequestState;
  payment_status: PaymentState;
  price: number | null;
  currency: string;
  admin_notes: string;
  grade: string | null;
  admin_feedback: string | null;
  note: string | null;
}) {
  const user = await requireAdmin();
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(requests).where(eq(requests.id, input.id)).limit(1);
    if (!current) throw new Error("Request not found.");
    if (input.currency !== "KES" && input.currency !== current.currency) {
      throw new Error(
        "New quotes must use KES. Existing request currencies can only be changed to KES.",
      );
    }
    const gradeChanged =
      input.grade !== current.grade || input.admin_feedback !== current.adminFeedback;
    await tx
      .update(requests)
      .set({
        status: input.status,
        paymentStatus: input.payment_status,
        price: input.price,
        currency: input.currency,
        adminNotes: input.admin_notes,
        grade: input.grade,
        adminFeedback: input.admin_feedback,
        ...(gradeChanged
          ? {
              gradedAt: input.grade || input.admin_feedback ? new Date() : null,
              gradedBy: input.grade || input.admin_feedback ? user.id : null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(requests.id, input.id));
    if (input.status !== current.status || input.note) {
      await tx.insert(requestUpdates).values({
        id: randomUUID(),
        requestId: input.id,
        status: input.status !== current.status ? input.status : null,
        note: input.note,
        createdBy: user.id,
      });
    }
    const studentVisibleChange =
      input.status !== current.status ||
      input.payment_status !== current.paymentStatus ||
      input.price !== current.price ||
      input.grade !== current.grade ||
      input.admin_feedback !== current.adminFeedback ||
      Boolean(input.note);
    if (studentVisibleChange) {
      const title =
        input.status !== current.status
          ? "Request status changed"
          : input.payment_status !== current.paymentStatus
            ? "Payment status updated"
            : input.price !== current.price
              ? "Your quote was updated"
              : input.grade !== current.grade || input.admin_feedback !== current.adminFeedback
                ? "New feedback is available"
                : "New request update";
      const statusLabel =
        input.status === "submitted" ? "received" : input.status.replaceAll("_", " ");
      const message =
        input.status !== current.status
          ? `Request ${current.ref} is now ${statusLabel}.`
          : input.payment_status !== current.paymentStatus
            ? `Payment status for request ${current.ref} is now ${input.payment_status}.`
            : input.price !== current.price
              ? `The quote for request ${current.ref} has changed.`
              : input.grade !== current.grade || input.admin_feedback !== current.adminFeedback
                ? `New feedback has been added to request ${current.ref}.`
                : `There is a new update for request ${current.ref}.`;
      await tx.insert(notifications).values({
        id: randomUUID(),
        userId: current.studentId,
        requestId: current.id,
        type: "request_update",
        title,
        message,
        href: `/request/${current.id}`,
      });
    }
  });
}

export async function getAdminStudentCount() {
  await requireAdmin();
  const [row] = await getDatabase()
    .select({ count: sql<number>`count(*)` })
    .from(profiles);
  return Number(row?.count ?? 0);
}

export async function getAuthorizedFile(storageKey: string) {
  const user = await requireUser();
  const [file] = await getDatabase()
    .select({
      id: requestFiles.id,
      requestId: requestFiles.requestId,
      storageKey: requestFiles.storageKey,
      name: requestFiles.name,
      mimeType: requestFiles.mimeType,
    })
    .from(requestFiles)
    .innerJoin(requests, eq(requestFiles.requestId, requests.id))
    .where(
      and(
        eq(requestFiles.storageKey, storageKey),
        sql`(${requests.studentId} = ${user.id} OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = ${user.id} AND role = 'admin'
    ))`,
      ),
    )
    .limit(1);
  return file ?? null;
}

export async function authorizedUploadTarget(requestId: string, kind: "submission" | "delivery") {
  const user = await requireUser();
  const [request] = await getDatabase()
    .select({ studentId: requests.studentId })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  if (!request) throw new Error("Request not found.");
  if (kind === "submission" && request.studentId !== user.id)
    throw new Error("You cannot upload to this request.");
  if (kind === "delivery" && !(await isCurrentUserAdmin()))
    throw new Error("Administrator access is required.");
  return { userId: user.id };
}

export async function addRequestFile(input: {
  requestId: string;
  uploadedBy: string;
  storageKey: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "submission" | "delivery";
}) {
  await getDatabase().insert(requestFiles).values({
    id: randomUUID(),
    requestId: input.requestId,
    uploadedBy: input.uploadedBy,
    storageKey: input.storageKey,
    name: input.name,
    mimeType: input.mimeType,
    size: input.size,
    kind: input.kind,
  });
}

export async function notifyAdminsOfStudentUpload(requestId: string) {
  const user = await requireUser();
  const db = getDatabase();
  const [request] = await db
    .select({ id: requests.id, ref: requests.ref })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.studentId, user.id)))
    .limit(1);
  if (!request) throw new Error("Request not found.");
  const admins = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, "admin"));
  if (!admins.length) {
    throw new Error("No administrator is configured to receive request file notifications.");
  }
  await db.insert(notifications).values(
    admins.map(({ userId }) => ({
      id: randomUUID(),
      userId,
      requestId,
      type: "request_files",
      title: "Student uploaded request files",
      message: `A student added files to request ${request.ref}.`,
      href: `/manage/${requestId}`,
    })),
  );
}

export async function completeRequestDelivery(requestId: string) {
  const user = await requireAdmin();
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const [request] = await tx
      .select({ id: requests.id, studentId: requests.studentId, ref: requests.ref })
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);
    if (!request) throw new Error("Request not found.");

    const note = "Completed work files are ready to download.";
    await tx
      .update(requests)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(requests.id, requestId));
    await tx.insert(requestUpdates).values({
      id: randomUUID(),
      requestId,
      status: "completed",
      note,
      createdBy: user.id,
    });
    await tx.insert(notifications).values({
      id: randomUUID(),
      userId: request.studentId,
      requestId,
      type: "delivery_ready",
      title: "Completed work is ready",
      message: `Completed work for request ${request.ref} is ready to download.`,
      href: `/request/${requestId}`,
    });
  });
}

export async function deleteRequestFile(storageKey: string) {
  await getDatabase().delete(requestFiles).where(eq(requestFiles.storageKey, storageKey));
}

export async function getUserById(userId: string) {
  const current = await requireAdmin();
  const [role] = await getDatabase()
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, current.id), eq(userRoles.role, "admin")))
    .limit(1);
  if (!role) throw new Error("Administrator access is required.");
  const [row] = await getDatabase().select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row ? mapProfile(row) : null;
}
