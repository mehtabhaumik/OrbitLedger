#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const projectId = "orbit-ledger-f41c2";
const projectNumber = "26507257397";
const webAppId = "1:26507257397:web:0fd74ca52a0e2ac969737c";
const androidAppId = "1:26507257397:android:0c4f604d6c59414069737c";
const requiredTrafficProof = process.env.ORBIT_LEDGER_SIGNED_IN_APPCHECK_TRAFFIC_VERIFIED === "yes";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function commandSucceeds(command, args) {
  try {
    run(command, args);
    return true;
  } catch {
    return false;
  }
}

function getAccessToken() {
  return run("gcloud", ["auth", "print-access-token", `--project=${projectId}`]).trim();
}

async function fetchAppCheck(path, accessToken) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`https://firebaseappcheck.googleapis.com/v1/${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-goog-user-project": projectId,
        },
      });
      const payload = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        payload,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  return {
    ok: false,
    status: 0,
    payload: {
      error: "App Check readiness query failed after retry.",
      reason: lastError,
    },
  };
}

function summarizeService(service) {
  return {
    ok: service.ok,
    status: service.status,
    updateTime: service.payload?.updateTime ?? null,
    enforcementMode: service.payload?.enforcementMode ?? null,
  };
}

function collectSourceFiles(root) {
  if (!existsSync(root)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (/\.(ts|tsx|js|jsx|mjs)$/.test(path)) {
      files.push(path);
    }
  }

  return files;
}

function mobileClientInitializesAppCheck() {
  const mobileSources = collectSourceFiles("apps/mobile/src");
  return mobileSources.some((file) => {
    const source = readFileSync(file, "utf8");
    return (
      /firebase\/app-check|@react-native-firebase\/app-check|initializeAppCheck|appCheck\(/i.test(source) &&
      /PlayIntegrity|DeviceCheck|AppAttest|AppCheck|initializeAppCheck|appCheck/i.test(source)
    );
  });
}

const productionEnvReady = commandSucceeds("node", ["scripts/verify-web-production-env.mjs"]);
const accessToken = getAccessToken();
const [webV3Provider, webEnterpriseProvider, androidPlayIntegrityProvider, firestoreService, storageService] = await Promise.all([
  fetchAppCheck(`projects/${projectNumber}/apps/${webAppId}/recaptchaV3Config`, accessToken),
  fetchAppCheck(`projects/${projectNumber}/apps/${webAppId}/recaptchaEnterpriseConfig`, accessToken),
  fetchAppCheck(`projects/${projectNumber}/apps/${androidAppId}/playIntegrityConfig`, accessToken),
  fetchAppCheck(`projects/${projectNumber}/services/firestore.googleapis.com`, accessToken),
  fetchAppCheck(`projects/${projectNumber}/services/firebasestorage.googleapis.com`, accessToken),
]);

const webProviderReady =
  (webV3Provider.ok && Boolean(webV3Provider.payload?.name)) ||
  (webEnterpriseProvider.ok && Boolean(webEnterpriseProvider.payload?.name));
const webProviderType =
  webEnterpriseProvider.ok && Boolean(webEnterpriseProvider.payload?.name)
    ? "recaptcha_enterprise"
    : webV3Provider.ok && Boolean(webV3Provider.payload?.name)
      ? "recaptcha_v3"
      : null;
const firestore = summarizeService(firestoreService);
const storage = summarizeService(storageService);
const androidProviderReady = androidPlayIntegrityProvider.ok && Boolean(androidPlayIntegrityProvider.payload?.name);
const mobileClientAppCheckReady = mobileClientInitializesAppCheck();
const allActiveClientsReadyForEnforcement = mobileClientAppCheckReady;
const enforcementReady =
  productionEnvReady &&
  webProviderReady &&
  requiredTrafficProof &&
  allActiveClientsReadyForEnforcement;

const report = {
  generatedAt: new Date().toISOString(),
  projectId,
  webProviderReady,
  webProviderType,
  androidProviderReady,
  mobileClientAppCheckReady,
  allActiveClientsReadyForEnforcement,
  productionEnvReady,
  signedInAppCheckTrafficVerified: requiredTrafficProof,
  firestore,
  storage,
  canBuildProductionAppCheckHosting: productionEnvReady && webProviderReady,
  canEnableFirestoreStorageEnforcement: enforcementReady,
  notes: [
    "This command prints readiness booleans only and never prints Firebase API keys or reCAPTCHA site keys.",
    "Set ORBIT_LEDGER_SIGNED_IN_APPCHECK_TRAFFIC_VERIFIED=yes only after Firebase Console shows signed-in Firestore and Storage App Check traffic.",
    "Firestore and Storage App Check enforcement is project-wide. Do not enforce while an active mobile client is missing App Check initialization.",
  ],
};

console.log(JSON.stringify(report, null, 2));

if (!report.canBuildProductionAppCheckHosting || !report.canEnableFirestoreStorageEnforcement) {
  process.exitCode = 1;
}
