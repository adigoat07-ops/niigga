import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const BASE_URL = "http://localhost:3000";
const prisma = new PrismaClient();

async function run() {
  console.log("=== STARTING PHASE 1 END-TO-END VERIFICATION ===");
  const timestamp = Date.now();
  const testEmail = `phase1_test_${timestamp}@example.com`;
  const testPassword = "Password123!";
  const testName = "Phase1 Audit Tester";

  // Step 1: Sign up
  console.log("\n[Step 1] Signing up new user:", testEmail);
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword, name: testName }),
  });

  const signupStatus = signupRes.status;
  const signupData = await signupRes.json();
  const rawSetCookie = signupRes.headers.get("set-cookie") || "";
  console.log("Signup status:", signupStatus, "Response:", signupData);

  if (signupStatus !== 201 || !signupData.user?.id) {
    throw new Error(`Signup failed: ${JSON.stringify(signupData)}`);
  }

  const userId = signupData.user.id;

  // Step 2: Log in
  console.log("\n[Step 2] Logging in with user:", testEmail);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });

  const loginStatus = loginRes.status;
  const loginData = await loginRes.json();
  const loginSetCookie = loginRes.headers.get("set-cookie") || rawSetCookie;
  console.log("Login status:", loginStatus, "Response:", loginData);

  if (loginStatus !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }

  // Extract session token
  const cookieMatch = loginSetCookie.match(/lab_saathi_session=([^;]+)/);
  if (!cookieMatch) {
    throw new Error("Could not extract lab_saathi_session cookie from response");
  }
  const sessionCookieHeader = `lab_saathi_session=${cookieMatch[1]}`;
  console.log("Acquired session cookie:", sessionCookieHeader.substring(0, 40) + "...");

  // Step 3: Verify /api/auth/me
  console.log("\n[Step 3] Fetching /api/auth/me with session cookie");
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookieHeader },
  });
  const meStatus = meRes.status;
  const meData = await meRes.json();
  console.log("/api/auth/me status:", meStatus, "Data:", meData);
  if (meStatus !== 200 || meData.user?.email !== testEmail) {
    throw new Error("/api/auth/me verification failed");
  }

  // Step 4: Upload PDF lab report
  console.log("\n[Step 4] Uploading PDF lab report via /api/upload");
  const samplePdfContent = "%PDF-1.4\n1 0 obj\n<< /Title (Complete Blood Count) /Author (Diagnostic Labs) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
  const pdfBuffer = Buffer.from(samplePdfContent, "utf8");
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });

  const formData = new FormData();
  formData.append("file", blob, `blood_test_${timestamp}.pdf`);
  formData.append("reportTitle", `Annual Health Panel ${timestamp}`);

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Cookie: sessionCookieHeader },
    body: formData,
  });

  const uploadStatus = uploadRes.status;
  const uploadData = await uploadRes.json();
  console.log("Upload status:", uploadStatus, "Response:", uploadData);

  if (uploadStatus !== 200 || !uploadData.reportId) {
    throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
  }

  const reportId = uploadData.reportId;

  // Step 5: Verify file exists on local filesystem
  console.log("\n[Step 5] Checking stored file on disk");
  const storedRelativePath = uploadData.storedPath;
  const fullStoredPath = path.resolve("apps/web", storedRelativePath);
  console.log("Checking path:", fullStoredPath);
  if (!fs.existsSync(fullStoredPath)) {
    throw new Error(`Uploaded file not found on disk at: ${fullStoredPath}`);
  }
  const fileStats = fs.statSync(fullStoredPath);
  console.log("File exists on disk! Size:", fileStats.size, "bytes");

  // Step 6: Verify PostgreSQL record association via Prisma directly
  console.log("\n[Step 6] Directly verifying PostgreSQL database state via Prisma");
  const dbReport = await prisma.labReport.findUnique({
    where: { id: reportId },
    include: { uploadedFile: true, user: { select: { id: true, email: true } } },
  });

  console.log("DB LabReport found:", {
    id: dbReport?.id,
    title: dbReport?.title,
    status: dbReport?.status,
    userId: dbReport?.userId,
    userEmail: dbReport?.user?.email,
    uploadedFile: {
      fileName: dbReport?.uploadedFile?.fileName,
      originalName: dbReport?.uploadedFile?.originalName,
      sizeBytes: dbReport?.uploadedFile?.sizeBytes,
      storagePath: dbReport?.uploadedFile?.storagePath,
      userId: dbReport?.uploadedFile?.userId,
    },
  });

  if (!dbReport || dbReport.userId !== userId) {
    throw new Error("Report not properly associated with user in database");
  }
  if (!dbReport.uploadedFile || dbReport.uploadedFile.userId !== userId) {
    throw new Error("UploadedFile record not properly associated with user in database");
  }

  // Step 7: Verify /api/reports list endpoint
  console.log("\n[Step 7] Checking /api/reports for user report history");
  const reportsRes = await fetch(`${BASE_URL}/api/reports`, {
    headers: { Cookie: sessionCookieHeader },
  });
  const reportsStatus = reportsRes.status;
  const reportsData = await reportsRes.json();
  console.log("/api/reports status:", reportsStatus, "Count:", reportsData.reports?.length);

  const matched = reportsData.reports?.find((r) => r.id === reportId);
  if (!matched) {
    throw new Error("Uploaded report missing from /api/reports response");
  }
  console.log("Matched report in user history:", matched.title);

  // Step 8: Verify /api/reports/[id] single report endpoint
  console.log(`\n[Step 8] Checking /api/reports/${reportId}`);
  const singleReportRes = await fetch(`${BASE_URL}/api/reports/${reportId}`, {
    headers: { Cookie: sessionCookieHeader },
  });
  const singleReportData = await singleReportRes.json();
  console.log("Single report status:", singleReportRes.status, "Title:", singleReportData.report?.title);
  if (singleReportRes.status !== 200 || singleReportData.report?.id !== reportId) {
    throw new Error("Failed to fetch individual report by ID");
  }

  // Step 9: Verify unauthenticated request rejection (401)
  console.log("\n[Step 9] Verifying security isolation (unauthenticated request)");
  const unauthRes = await fetch(`${BASE_URL}/api/reports`);
  console.log("Unauthenticated /api/reports status:", unauthRes.status);
  if (unauthRes.status !== 401) {
    throw new Error("Expected 401 for unauthenticated request, received " + unauthRes.status);
  }

  console.log("\n=== ALL PHASE 1 END-TO-END TESTS PASSED WITH 100% SUCCESS! ===");
}

run()
  .catch((err) => {
    console.error("\n? E2E VERIFICATION FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
