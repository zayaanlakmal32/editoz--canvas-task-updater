export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, payload } = req.body;

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const SLACK_TOKEN = process.env.SLACK_TOKEN;
  const PROJECT_DB_ID = process.env.PROJECT_DB_ID;
  const TASK_DB_ID = process.env.TASK_DB_ID;

  try {
    if (action === "debug") {
      const r = await fetch(`https://api.notion.com/v1/databases/${PROJECT_DB_ID}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({ page_size: 3 }),
      });
      const data = await r.json();
      const first = data.results?.[0];
      return res.json({
        httpStatus: r.status,
        notionError: data.object === "error" ? { code: data.code, message: data.message } : null,
        tokenPrefix: NOTION_TOKEN ? NOTION_TOKEN.slice(0, 10) : "MISSING",
        dbId: PROJECT_DB_ID,
        total: data.results?.length,
        hasMore: data.has_more,
        firstPageId: first?.id,
        firstProps: first ? Object.keys(first.properties) : [],
        clientNameRaw: first?.properties?.["Client Name"],
        canvasIdRaw: first?.properties?.["Slack Canvas ID"],
      });
    }

    if (action === "getClients") {
      let allResults = [];
      let hasMore = true;
      let startCursor = undefined;
      while (hasMore) {
        const body = { page_size: 100 };
        if (startCursor) body.start_cursor = startCursor;
        const r = await fetch(`https://api.notion.com/v1/databases/${PROJECT_DB_ID}/query`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify(body),
        });
        const data = await r.json();
        allResults = allResults.concat(data.results || []);
        hasMore = data.has_more;
        startCursor = data.next_cursor;
      }
      const clients = allResults
        .map((p) => {
          const props = p.properties;
          const canvasId = props["Slack Canvas ID"]?.rich_text?.[0]?.plain_text;
          const name = props["Client Name"]?.title?.[0]?.plain_text;
          return canvasId && name ? { id: p.id, name, canvasId } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
      return res.json({ clients, total: allResults.length });
    }

    if (action === "getTasks") {
      const { clientId } = payload;
      let allResults = [];
      let hasMore = true;
      let startCursor = undefined;
      while (hasMore) {
        const body = { page_size: 100 };
        if (startCursor) body.start_cursor = startCursor;
        const r = await fetch(`https://api.notion.com/v1/databases/${TASK_DB_ID}/query`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify(body),
        });
        const data = await r.json();
        allResults = allResults.concat(data.results || []);
        hasMore = data.has_more;
        startCursor = data.next_cursor;
      }
      const clientIdClean = clientId.replace(/-/g, "");
      const tasks = allResults
        .filter((p) => {
          const relations = p.properties["Project Tracker Client"]?.relation || [];
          const status = p.properties["Status"]?.status?.name;
          const isClient = relations.some((r) => r.id === clientId || r.id === clientIdClean);
          return isClient && status !== "Done";
        })
        .map((p) => {
          const props = p.properties;
          return {
            actionItem: props["Action Item"]?.title?.[0]?.plain_text || "Untitled",
            status:
