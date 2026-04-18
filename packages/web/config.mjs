const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://opensploit.ai" : `https://${stage}.opensploit.ai`,
  console: stage === "production" ? "https://opensploit.ai/auth" : `https://${stage}.opensploit.ai/auth`,
  email: "contact@opensploit.ai",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/silicon-works/opensploit",
  discord: "", // placeholder — no Discord yet
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
