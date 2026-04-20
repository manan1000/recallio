import { fetchTranscript } from 'youtube-transcript-plus';

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
];

const randomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];


export const processYoutube = async (url: string): Promise<string> => {
    const segments = await fetchTranscript(url, { userAgent: randomAgent() });
    if (!segments || segments.length === 0) {
        throw new Error("No transcript available for this video");
    }

    const transcript = segments
        .map((segment) => segment.text)
        .join(" ")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();

    return transcript;
}