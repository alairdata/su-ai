// Tavily Search API integration for web search capability

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export async function webSearch(query: string): Promise<SearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.error("TAVILY_API_KEY not configured");
    return { results: [], query };
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      console.error("Tavily search failed:", response.status);
      return { results: [], query };
    }

    const data = await response.json();

    const results: SearchResult[] = (data.results || []).map((r: {
      title?: string;
      url?: string;
      content?: string;
    }) => ({
      title: r.title || "",
      url: r.url || "",
      content: r.content || "",
    }));

    return { results, query };
  } catch (error) {
    console.error("Web search error:", error);
    return { results: [], query };
  }
}

// Format search results for Claude
export function formatSearchResults(searchResponse: SearchResponse): string {
  if (searchResponse.results.length === 0) {
    return `No search results found for: "${searchResponse.query}"`;
  }

  let formatted = `Web search results for: "${searchResponse.query}"\n\n`;

  searchResponse.results.forEach((result, index) => {
    formatted += `[${index + 1}] ${result.title}\n`;
    formatted += `URL: ${result.url}\n`;
    formatted += `${result.content}\n\n`;
  });

  return formatted;
}
