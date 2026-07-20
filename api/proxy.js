export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, payload } = req.body;

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const SLACK_TOKEN = process.env.SLACK_TOKEN;
  const PROJECT_DB_ID = process.env.PROJECT_DB_ID;
  const TASK_DB_ID = process.env.TASK_DB_ID;

  try {
    if (action === "getClients") {
      const r = await fetch(`https://api.notion.com/v1/databases/${PROJECT_DB_ID}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({ page_size: 100 }),
      });
      const data = await r.json();
      const clients = (data.results || [])
        .map((p) => {
          const props = p.properties;
          const canvasId = props["Slack Canvas ID"]?.rich_text?.[0]?.plain_text;
          const name = props["Client Name"]?.title?.[0]?.plain_text;
          return canvasId && name ? { id: p.id, name, canvasId } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
      return res.json({ clients });
    }

    if (action === "getTasks") {
      const { clientId } = payload;
      const r = await fetch(`https://api.notion.com/v1/databases/${TASK_DB_ID}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({ page_size: 100 }),
      });
      const data = await r.json();
      const clientIdClean = clientId.replace(/-/g, "");
      const tasks = (data.results || [])
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
            status: props["Status"]?.status?.name || "No Status",
            responsible: props["Responsible Person"]?.people?.[0]?.name || "Unassigned",
            dueDate: props["Due date"]?.date?.start || "No date",
          };
        });
      return res.json({ tasks });
    }

    if (action === "updateCanvas") {
      const { canvasId, taskMarkdown } = payload;

      const lookupRes = await fetch("https://slack.com/api/canvases.sections.lookup", {
        method: "POST",
        headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ canvas_id: canvasId, criteria: { contains_text: "Client Tasks" } }),
      });
      const lookupData = await lookupRes.json();

      if (!lookupData.ok || !lookupData.sections?.length) {
        return res.json({ success: false, error: "Client Tasks section not found in canvas" });
      }

      const sectionId = lookupData.sections[0].id;

      const editRes = await fetch("https://slack.com/api/canvases.edit", {
        method: "POST",
        headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_id: canvasId,
          changes: [{ operation: "replace", section_id: sectionId, document_content: { type: "markdown", markdown: taskMarkdown } }],
        }),
      });
      const editData = await editRes.json();
      return res.json({ success: editData.ok, error: editData.error });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
