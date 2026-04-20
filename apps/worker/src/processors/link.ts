import * as cheerio from "cheerio";

const jinaToken = process.env.JINA_API_KEY;
const MIN_CONTENT_LENGTH = 200;


export const processLink = async (url: string): Promise<string> => {
    // try Jina first
    try {
        const options = {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${jinaToken}`,
                "Content-Type": "application/json",
                "X-Retain-Images": "none",
                "X-Timeout": "15",
            },
            body: JSON.stringify({ url }),
            signal: AbortSignal.timeout(15000) // 15 seconds
        };
        const res = await fetch(process.env.JINA_URL!, options);

        if (res.ok) {
            const text = await res.text();
            if (text.length > MIN_CONTENT_LENGTH) {
                return text;
            }
        }
    } catch {
        console.warn(`Jina failed for ${url}, falling back to cheerio`);
    }

    // cheerio fallback
    const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBase/1.0)",
        },
    });

    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // remove noise
    $("script, style, nav, footer, header, aside, iframe, noscript").remove();

    // try article/main first, fall back to body
    const candidates = [
        $("article").text(),
        $("main").text(),
        $("[role='main']").text(),
        $(".content").text(),
        $(".post-content").text(),
        $(".article-body").text(),
        $("body").text(),
    ]
        .map((t) => t.replace(/\s+/g, " ").trim())
        .filter((t) => t.length > MIN_CONTENT_LENGTH);

    if (candidates.length === 0) {
        throw new Error("Could not extract meaningful content from URL");
    }

    // pick longest — most likely to be the full content
    return candidates.reduce((a, b) => (a.length >= b.length ? a : b));
};