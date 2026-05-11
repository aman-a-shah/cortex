# Cortex 🧠

**The Unified Intelligence Layer for the Agentic Enterprise.**

Cortex is a real-time, shared global context engine designed to solve the "Context Silo" problem in corporate AI workflows. Built for **soon hackathon #1**, Cortex ensures that every agentic interaction—from engineering to finance—is powered by a single, evolving source of truth.

## 📸 Screenshots

<div align="center">
  <img src="references/Screenshot 2026-05-10 at 4.25.51 AM.png" width="800" alt="Cortex Workflow Initial" />
  <br/>
  <img src="references/Screenshot 2026-05-10 at 4.27.19 AM.png" width="800" alt="Cortex Context Bank" />
  <img src="references/Screenshot 2026-05-10 at 4.27.43 AM.png" width="800" alt="Cortex Context Bank" />
  <img src="references/Screenshot 2026-05-10 at 4.28.20 AM.png" width="800" alt="Cortex Context Bank" />
</div>

## � The Vision

In the modern enterprise, context is managed poorly. Individuals manually feed agents files, rules, and snippets session-by-session. This leads to:
- **Inconsistency:** Different team members receive different answers for the same policy.
- **Wasted Time:** Context is re-uploaded and re-explained every single time a new chat starts.
- **Lost Knowledge:** Critical decisions made in one session vanish the moment the window is closed.

**Cortex solves this.** It turns individual interactions into institutional memory.

---

## ✨ Key Features

- **Shared Global Memory:** A real-time graph of company context that accelerates development across all departments.
- **Departmental Awareness:** Tailored context for Engineering, Management, Finance, Marketing, and more.
- **Autonomous Context Extraction:** Using `claude-haiku-4.5`, Cortex automatically identifies "substantial" info (decisions, budgets, policies) from chat logs and saves them to the bank.
- **Peer Experience Injection:** Naturally surfaces similar situations encountered by colleagues (e.g., *"Interestingly, [Name] from [Dept] ran into something similar..."*).
- **"GitHub for Context":** Managers can review "sub-nodes" (session context) and merge them into "department-nodes" (mainline truth).
- **Multimodal Pipeline:** Full support for image analysis and server-triggered Cloudinary transformations (blur, background removal, etc.) before the LLM even sees them.

---

## 🛠 The Cortex Pipeline

1.  **Identity:** User signs in. The `proxy.ts` middleware validates the session and injects `x-cortex-department` and `x-cortex-name` headers into every request.
2.  **Hydration:** As development starts, Cortex fetches relevant context from the **Context Bank** (Supabase) and existing threads.
3.  **Real-time Synthesis:** The `backboard.ts` engine uses keyword-overlap similarity to find relevant peer experiences and merges them into the system prompt.
4.  **Autonomous Storage:** If a session yields new important data, it is identified by Haiku and stored as a **Sub-node**.
5.  **Governance:** Managers review Sub-nodes, merging them into the **Department-node** or deleting irrelevant noise.

---

## 📊 The Knowledge Graph

Cortex organizes information hierarchically:

*   **Sub-node:** Transient context from a specific session or individual development task.
*   **Department-node:** The established "Main" branch for a specific department (e.g., Engineering standards).
*   **Context-Map:** The global company graph connecting all department nodes into a unified corporate brain.

---

## 🏗 Technical Implementation

### Next.js 16 + Proxy
Cortex leverages the latest **Next.js 16** features. We utilize a `proxy.ts` pattern to handle secure auth and department-based routing, ensuring the LLM always knows the specific departmental constraints of the user.

### Intelligence Engine (Backboard & Anthropic)
- **Primary LLM:** `claude-sonnet-4-6` for high-reasoning chat and multimodal analysis.
- **Extraction:** `claude-haiku-4-5-20251001` for low-latency JSON extraction of context from messages.
- **Memory Management:** Integrated with **Backboard.io** to provide a persistent, "Readonly" or "Auto-writing" memory stream that lives outside the chat window.

### Storage & Cache
- **Database:** Supabase for structured context entry storage and agent metadata.
- **Caching:** Backboard's thread-based memory provides a high-speed cache for institutional knowledge.
- **Secret Management:** Built-in `warmSecretCache` in `instrumentation.ts` for enterprise-grade security handling.

---

## 🛠 Setup & Development

### Requirements
- Node.js 20.9+
- Anthropic API Key
- Backboard API Key
- Supabase Account

### Installation
```bash
npm install
```

### Environment Variables
Create a `.env.local` file:
```env
ANTHROPIC_API_KEY=your_key
BACKBOARD_API_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
CORTEX_MCP_TOKEN=your_internal_token
```

### Run
```bash
npm run dev
```

---

## 🛣 Roadmap
- [ ] **Claude CLI & Agentic IDE Integration:** Feed Cortex context directly into your terminal or VS Code.
- [ ] **Slack Real-time Sync:** Bidirectional context flow between Slack channels and the Context Bank.
- [ ] **Automated Conflict Detection:** Alerting managers when a new sub-node contradicts existing department-node policies.

---
*Built with ❤️ for soon hackathon #1*