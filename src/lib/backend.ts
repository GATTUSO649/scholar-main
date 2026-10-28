import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a symbol");
const statusSchema = z.enum([
  "submitted",
  "under_review",
  "quoted",
  "awaiting_payment",
  "in_progress",
  "completed",
  "declined",
  "cancelled",
]);
const paymentSchema = z.enum(["unpaid", "pending", "paid", "refunded"]);

function assertSameOrigin() {
  requireSameOrigin(getRequest());
}

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getCurrentUser } = await import("./backend.server");
  return getCurrentUser();
});

export const registerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: emailSchema,
      password: passwordSchema,
      full_name: z.string().trim().min(2).max(100),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 ]{9,16}$/),
      country: z.string().trim().min(2).max(60),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { registerAccount } = await import("./backend.server");
    return registerAccount(data);
  });

export const getAdminSignupStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminSignupState } = await import("./backend.server");
  return getAdminSignupState();
});

export const registerAdminFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: emailSchema,
      password: passwordSchema,
      full_name: z.string().trim().min(2).max(100),
      signup_secret: z.string().min(1).max(256),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { registerAdmin } = await import("./backend.server");
    return registerAdmin(data);
  });

export const loginFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: emailSchema, password: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { loginStudentAccount } = await import("./backend.server");
    return loginStudentAccount(data);
  });

export const adminLoginFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: emailSchema, password: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { loginAdminAccount } = await import("./backend.server");
    return loginAdminAccount(data);
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  assertSameOrigin();
  const { logoutAccount } = await import("./backend.server");
  await logoutAccount();
});

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { requestPasswordReset } = await import("./backend.server");
    return requestPasswordReset(data.email);
  });

export const requestEmailVerificationFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { requestEmailVerification } = await import("./backend.server");
    return requestEmailVerification(data.email);
  });

export const verifyEmailFn = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().min(32).max(256) }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { verifyEmailToken } = await import("./backend.server");
    return verifyEmailToken(data.code);
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(32).max(128), password: passwordSchema }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { resetPassword } = await import("./backend.server");
    return resetPassword(data.token, data.password);
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: passwordSchema,
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { changeAccountPassword } = await import("./backend.server");
    return changeAccountPassword(data);
  });

export const getProfileFn = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const { getProfile } = await import("./backend.server");
    return getProfile(data.userId);
  });

export const saveProfileFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      full_name: z.string().trim().min(1).max(100),
      phone: z.string().max(40),
      country: z.string().max(60),
      institution: z.string().max(120),
      year_of_study: z.enum(["1st year", "2nd year", "3rd year", "4th year", "Other"]),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { saveProfile } = await import("./backend.server");
    return saveProfile(data);
  });

export const getAdminStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { isCurrentUserAdmin } = await import("./backend.server");
  return isCurrentUserAdmin();
});

export const getPublicDataFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicData } = await import("./backend.server");
  return getPublicData();
});

export const getLibraryResourcesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getLibraryResources } = await import("./backend.server");
  return getLibraryResources();
});

export const getAdminLibraryResourcesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminLibraryResources } = await import("./backend.server");
  return getAdminLibraryResources();
});

export const getStudentLibraryResourcesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStudentLibraryResources } = await import("./backend.server");
  return getStudentLibraryResources();
});

export const getMyRequestsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getMyRequests } = await import("./backend.server");
  return getMyRequests();
});

export const getMyUpdateCountFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getMyUpdateCount } = await import("./backend.server");
  return getMyUpdateCount();
});

export const getMyNotificationsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getMyNotifications } = await import("./backend.server");
  return getMyNotifications();
});

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { markNotificationRead } = await import("./backend.server");
    return markNotificationRead(data.id);
  });

export const markAllNotificationsReadFn = createServerFn({ method: "POST" }).handler(async () => {
  assertSameOrigin();
  const { markAllNotificationsRead } = await import("./backend.server");
  return markAllNotificationsRead();
});

export const getRequestBundleFn = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { getRequestBundle } = await import("./backend.server");
    return getRequestBundle(data.id);
  });

export const createRequestFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().trim().min(3).max(200),
      service_id: z.string().uuid(),
      course_unit: z.string().max(120).nullable().optional(),
      lecturer: z.string().max(120).nullable().optional(),
      academic_level: z.string().max(60).nullable().optional(),
      description: z.string().trim().min(10).max(5000),
      num_questions: z.number().int().min(0).max(500).nullable().optional(),
      num_pages: z.number().int().min(0).max(1000).nullable().optional(),
      deadline: z.string().datetime(),
      preferred_date: z.string().datetime().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { createRequest } = await import("./backend.server");
    return createRequest(data);
  });

export const getAdminRequestsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminRequests } = await import("./backend.server");
  return getAdminRequests();
});

export const getAdminStudentsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminStudents } = await import("./backend.server");
  return getAdminStudents();
});

export const getAdminStudentFn = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { getUserById } = await import("./backend.server");
    return getUserById(data.userId);
  });

export const getAdminStudentCountFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminStudentCount } = await import("./backend.server");
  return getAdminStudentCount();
});

export const setPublicPricesFn = createServerFn({ method: "POST" })
  .validator(z.object({ showPrices: z.boolean() }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { setPublicPrices } = await import("./backend.server");
    return setPublicPrices(data.showPrices);
  });

export const getAdminServicesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminServices } = await import("./backend.server");
  return getAdminServices();
});

const adminServiceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(3000),
  base_price: z.number().finite().min(0).max(99_999_999.99),
  currency: z.enum(["KES", "USD", "GBP", "EUR"]),
  unit: z.string().trim().min(1).max(40),
  sort: z.number().int().min(0).max(9999),
  active: z.boolean(),
});

export const saveAdminServiceFn = createServerFn({ method: "POST" })
  .validator(adminServiceSchema)
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { saveAdminService } = await import("./backend.server");
    return saveAdminService(data);
  });

export const setAdminServiceActiveFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { setAdminServiceActive } = await import("./backend.server");
    return setAdminServiceActive(data);
  });

export const updateRequestFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: statusSchema,
      payment_status: paymentSchema,
      price: z.number().finite().min(0).max(99999999).nullable(),
      currency: z.enum(["USD", "KES", "GBP", "EUR"]),
      admin_notes: z.string().max(10000),
      grade: z.string().max(20).nullable(),
      admin_feedback: z.string().max(4000).nullable(),
      note: z.string().max(2000).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { updateRequest } = await import("./backend.server");
    await updateRequest(data);
  });

export function requireSameOrigin(request: Request) {
  if (!isSameOriginRequest(request)) {
    throw new Error("This request origin is not allowed.");
  }
}

export function isSameOriginRequest(request: Request) {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  const host = request.headers.get("host");
  if (!source || !host) return false;

  try {
    const sourceUrl = new URL(source);
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const requestProtocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);
    if (requestProtocol !== "http" && requestProtocol !== "https") return false;
    return sourceUrl.origin === new URL(`${requestProtocol}://${host}`).origin;
  } catch {
    return false;
  }
}
