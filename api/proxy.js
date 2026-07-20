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
