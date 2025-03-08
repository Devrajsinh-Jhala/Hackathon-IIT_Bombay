// app/api/help-chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export async function POST(request: NextRequest) {
    try {
        const { message } = await request.json();

        // Create a prompt that includes context and instructions
        const prompt = `I need help with a compliance question related to trade compliance systems.
    
    As a compliance assistant, please help me with: ${message}
    
    When answering, focus on:
    - How to check shipments for compliance issues
    - How to interpret compliance flags and warnings
    - Understanding restricted items and countries
    - Navigating compliance dashboards`;

        // Simple generate content call without using chat history
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        return NextResponse.json({
            response,
            success: true
        });
    } catch (error) {
        console.error('Help chat error:', error);
        return NextResponse.json(
            {
                error: 'Failed to process request',
                details: error instanceof Error ? error.message : 'Unknown error',
                success: false
            },
            { status: 500 }
        );
    }
}