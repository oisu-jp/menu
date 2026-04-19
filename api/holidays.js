export default async function handler(req, res) {
  const start = typeof req.query.start === "string" ? req.query.start : "";
  const end = typeof req.query.end === "string" ? req.query.end : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return res.status(400).json({ error: "invalid start or end" });
  }

  try {
    const googleResult = await fetchFromGoogleCalendar(start, end);
    if (googleResult) {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=43200");
      return res.status(200).json({ source: "Google Calendar API", holidays: googleResult });
    }
  } catch (error) {
    console.error("google holiday fetch failed", error);
  }

  try {
    const fallbackResult = await fetchFromHolidaysApi(start, end);
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=43200");
    return res.status(200).json({ source: "祝日API", holidays: fallbackResult });
  } catch (error) {
    console.error("holiday api fetch failed", error);
    return res.status(500).json({ error: "failed to fetch holidays" });
  }
}

async function fetchFromGoogleCalendar(start, end) {
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!apiKey) return null;

  const calendarId = encodeURIComponent("ja.japanese.official#holiday@group.v.calendar.google.com");
  const timeMin = new Date(`${start}T00:00:00+09:00`).toISOString();
  const timeMax = new Date(`${end}T23:59:59+09:00`).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Calendar API ${response.status}`);

  const payload = await response.json();
  const result = {};
  for (const item of payload.items || []) {
    const date = item.start?.date;
    if (!date) continue;
    result[date] = item.summary || "祝日";
  }
  return result;
}

async function fetchFromHolidaysApi(start, end) {
  const holidayMap = {};
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));

  for (let year = startYear; year <= endYear; year += 1) {
    const response = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`);
    if (!response.ok) throw new Error(`holidays api ${response.status}`);
    const payload = await response.json();

    for (const [date, name] of Object.entries(payload)) {
      if (date >= start && date <= end) holidayMap[date] = name;
    }
  }

  return holidayMap;
}
