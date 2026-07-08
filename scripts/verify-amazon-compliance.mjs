import { parseArgs } from "util";

const args = process.argv.slice(2);
const baseUrl = args[0] || "http://localhost:3000";

async function verify() {
  console.log(`Verifying Amazon Compliance against ${baseUrl}...\n`);
  
  let passed = true;
  
  // 1. Unauthenticated fetch of /
  console.log("1. Checking homepage...");
  try {
    const res = await fetch(baseUrl);
    const html = await res.text();
    // The disclosure is not on the homepage per the user's latest request (only on Amazon pages).
    // Let's just check for general loading.
    if (!res.ok) throw new Error(`Homepage failed with status ${res.status}`);
    console.log("✅ Homepage loaded.");
  } catch (err) {
    console.error("❌ Homepage check failed:", err);
    passed = false;
  }

  // 2. Unauthenticated fetch of /merchants?merchantId=<amazon_id>
  // Primary Amazon ID is typically 1 (from our env)
  console.log("\n2. Checking Amazon merchants page...");
  try {
    const res = await fetch(`${baseUrl}/merchants?merchantId=1`);
    const html = await res.text();
    
    if (!html.includes("Amazon Associate I earn from qualifying purchases")) {
      console.error("❌ Amazon merchants page missing disclosure text.");
      passed = false;
    } else {
      console.log("✅ Amazon Associate disclosure found.");
    }
  } catch (err) {
    console.error("❌ Merchants page check failed:", err);
    passed = false;
  }

  // 3. Unauthenticated fetch of /api/redirect?merchantId=1
  console.log("\n3. Checking Amazon redirect route...");
  try {
    const res = await fetch(`${baseUrl}/api/redirect?merchantId=1`, { redirect: 'manual' });
    if (res.status !== 302 && res.status !== 307) {
      console.error(`❌ Redirect returned wrong status: ${res.status}`);
      passed = false;
    } else {
      const loc = res.headers.get("location");
      if (!loc || !loc.includes("amazon.") || !loc.includes("tag=")) {
        console.error("❌ Redirect location does not contain valid Amazon tag format:", loc);
        passed = false;
      } else {
        console.log("✅ Redirect valid:", loc);
      }
    }
  } catch (err) {
    console.error("❌ Redirect check failed:", err);
    passed = false;
  }

  if (passed) {
    console.log("\n✅ ALL COMPLIANCE CHECKS PASSED.");
    process.exit(0);
  } else {
    console.log("\n❌ COMPLIANCE CHECKS FAILED.");
    process.exit(1);
  }
}

verify().catch(console.error);
