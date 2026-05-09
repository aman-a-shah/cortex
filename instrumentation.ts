export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmSecretCache } = await import("./lib/cystack");
    console.log("[cystack] warming secret cache…");
    await warmSecretCache();
    console.log("[cystack] secret cache ready");
  }
}
