const liveBaseUrl = process.env.ORBIT_LEDGER_LIVE_WEB_URL || 'https://orbit-ledger-f41c2.web.app/';
const requiredTitle = 'Orbit Ledger';
const forbiddenHtmlPatterns = [
  /dangerouslyAllowBrowser/i,
  /FIREBASE_APPCHECK_DEBUG_TOKEN/i,
  /RAZORPAY_KEY_SECRET/i,
  /RAZORPAY_WEBHOOK_SECRET/i,
  /RESEND_API_KEY/i,
  /OPENAI_API_KEY/i,
  /ANTHROPIC_API_KEY/i,
];

const failures = [];
const urlsToCheck = [new URL('/', liveBaseUrl).toString(), new URL('/login/', liveBaseUrl).toString()];

for (const liveUrl of urlsToCheck) {
  const response = await fetch(liveUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'OrbitLedgerLaunchSmoke/1.0',
    },
  });

  if (!response.ok) {
    failures.push(`${liveUrl} returned HTTP ${response.status}.`);
    continue;
  }

  const html = await response.text();

  if (!html.includes(`<title>${requiredTitle}</title>`)) {
    failures.push(`${liveUrl} does not include <title>${requiredTitle}</title>.`);
  }

  if (!html.includes('application-name') || !html.includes(requiredTitle)) {
    failures.push(`${liveUrl} is missing Orbit Ledger application metadata.`);
  }

  if (/__next_error__|NEXT_REDIRECT/i.test(html)) {
    failures.push(`${liveUrl} contains a static Next redirect/error payload.`);
  }

  for (const pattern of forbiddenHtmlPatterns) {
    if (pattern.test(html)) {
      failures.push(`${liveUrl} contains forbidden pattern ${pattern}.`);
    }
  }
}

if (failures.length) {
  console.error('Orbit Ledger live web smoke failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Orbit Ledger live web smoke passed.');
console.log(`Checked ${urlsToCheck.join(' and ')} without printing API keys or secrets.`);
if (process.env.ORBIT_LEDGER_SIGNED_IN_APPCHECK_TRAFFIC_VERIFIED === 'yes') {
  console.log('Signed-in Firestore and Storage App Check traffic proof has been acknowledged for the web launch path.');
} else {
  console.log('Manual App Check traffic proof is required before enabling Firestore and Storage enforcement.');
}
