const liveUrl = process.env.ORBIT_LEDGER_LIVE_WEB_URL || 'https://orbit-ledger-f41c2.web.app/login/';
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

const response = await fetch(liveUrl, {
  redirect: 'follow',
  headers: {
    'User-Agent': 'OrbitLedgerLaunchSmoke/1.0',
  },
});

if (!response.ok) {
  throw new Error(`Live web smoke failed: ${liveUrl} returned HTTP ${response.status}.`);
}

const html = await response.text();
const failures = [];

if (!html.includes(`<title>${requiredTitle}</title>`)) {
  failures.push(`Live page does not include <title>${requiredTitle}</title>.`);
}

if (!html.includes('application-name') || !html.includes(requiredTitle)) {
  failures.push('Live page is missing Orbit Ledger application metadata.');
}

for (const pattern of forbiddenHtmlPatterns) {
  if (pattern.test(html)) {
    failures.push(`Live HTML contains forbidden pattern ${pattern}.`);
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
console.log(`Checked ${liveUrl} without printing API keys or secrets.`);
console.log('Manual App Check traffic proof is still required in Firebase Console after signed-in Firestore and Storage activity.');
