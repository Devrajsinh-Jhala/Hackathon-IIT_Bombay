// app/api/research/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configure Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Define interface types
interface ResearchQuery {
    query: string;
    filters?: {
        startDate?: string;
        endDate?: string;
        categories?: string[];
        maxResults?: number;
    };
}

interface ResearchResult {
    title: string;
    content: string;
    url?: string;
    source: string;
    publishedDate?: string;
    relevance: number;
}

interface ResearchResponse {
    success: boolean;
    count: number;
    results: ResearchResult[];
    summary?: string;
}

// GET endpoint for research queries
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('query');

        if (!query) {
            return NextResponse.json({
                success: false,
                error: 'Query parameter is required'
            }, { status: 400 });
        }

        // Parse optional parameters
        const maxResults = parseInt(searchParams.get('maxResults') || '5', 10);
        const categories = searchParams.get('categories')?.split(',') || [];

        // Perform research
        const results = await performResearch(query, { maxResults, categories });

        return NextResponse.json({
            success: true,
            count: results.length,
            results: results
        });
    } catch (error) {
        console.error("Research GET error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { status: 500 });
    }
}

// POST endpoint for more complex research queries
export async function POST(request: NextRequest) {
    try {
        // Safely parse the request body with fallback
        const body = await request.json().catch(() => ({}));
        const queryData = body as ResearchQuery;

        if (!queryData?.query) {
            return NextResponse.json({
                success: false,
                error: 'Query is required in the request body'
            }, { status: 400 });
        }

        // Extract query and filters
        const { query, filters } = queryData;

        // Perform research with filters
        const results = await performResearch(query, filters);

        // Generate research summary if requested
        let summary = undefined;
        if (body.includeSummary) {
            summary = await generateResearchSummary(query, results);
        }

        return NextResponse.json({
            success: true,
            count: results.length,
            results: results,
            summary: summary
        });
    } catch (error) {
        console.error("Research POST error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { status: 500 });
    }
}

// Core research function using Gemini
async function performResearch(query: string, options: any = {}): Promise<ResearchResult[]> {
    try {
        console.log(`Performing research for query: "${query}"`);

        // Configure Gemini deep search parameters
        const maxResults = options.maxResults || 5;

        // Structure the research prompt for Gemini
        const researchPrompt = `
    Research the following query in depth: "${query}"
    
    Please provide detailed findings including:
    1. The most relevant information about this topic
    2. Key facts and data points
    3. Different perspectives if applicable
    4. Recent developments on this subject
    
    ${options.categories?.length ? `Focus on these categories: ${options.categories.join(', ')}` : ''}
    
    For each research finding, provide:
    - A descriptive title
    - The main content/information
    - The source of the information
    - Relevance score (0.0-1.0)
    
    Format your response as JSON:
    {
      "results": [
        {
          "title": "string",
          "content": "string",
          "url": "string",
          "source": "string",
          "publishedDate": "YYYY-MM-DD",
          "relevance": number
        },
        ...
      ]
    }
    `;

        // Call Gemini with retry logic
        const results = await callGeminiWithRetry(researchPrompt, 3);

        // Cache results in Supabase for future use if needed
        try {
            await supabase.from('research_cache').insert({
                query: query,
                results: results,
                timestamp: new Date().toISOString()
            });
        } catch (cacheError) {
            // Non-critical error, just log it
            console.warn("Failed to cache research results:", cacheError);
        }

        return results;
    } catch (error) {
        console.error("Research error:", error);
        throw error;
    }
}

// Helper function to call Gemini with retry logic
async function callGeminiWithRetry(prompt: string, maxAttempts: number): Promise<ResearchResult[]> {
    let attempts = 0;
    let lastError;

    while (attempts < maxAttempts) {
        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("Failed to extract JSON from Gemini response");
            }

            const parsedData = JSON.parse(jsonMatch[0]);
            return parsedData?.results || [];

        } catch (error) {
            attempts++;
            lastError = error;

            if (attempts < maxAttempts) {
                // Wait with exponential backoff
                const delay = Math.pow(2, attempts) * 1000;
                console.log(`Gemini API attempt ${attempts} failed, retrying in ${delay / 1000}s`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error(`All ${maxAttempts} Gemini API attempts failed`);
    throw lastError || new Error("Failed to get response from Gemini API");
}

// Generate summary of research findings
async function generateResearchSummary(query: string, results: ResearchResult[]): Promise<string> {
    if (!results || results.length === 0) {
        return "No research results to summarize.";
    }

    const summarizePrompt = `
  Summarize the following research findings for the query: "${query}"
  
  Research data:
  ${JSON.stringify(results.slice(0, 5))}
  
  Provide a concise but comprehensive summary of these findings.
  `;

    try {
        const result = await model.generateContent(summarizePrompt);
        return result.response.text();
    } catch (error) {
        console.error("Summary generation error:", error);
        return "Failed to generate summary.";
    }
}