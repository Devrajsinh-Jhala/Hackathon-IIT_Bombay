// app/api/compliance/predict/route.ts

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

// export const dynamic = 'force-dynamic';

// Initialize Google Generative AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { shipment } = await request.json();

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    // Get existing compliance rules from Supabase
    const { data: rules } = await supabase
      .from("compliance_rules")
      .select("*")
      .eq("is_active", true);

    // Format rules for the AI model
    const ruleDescriptions = rules?.map(rule =>
      `${rule.rule_name}: ${rule.description} (Applies to: ${rule.applicable_countries || 'All countries'})`
    ).join("\n") || "No specific rules found.";

    // Initialize the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Create a prompt with shipment information
    const prompt = `
      You are a compliance expert specializing in international shipping regulations.
      
      PRODUCT INFORMATION:
      - Product Name: ${shipment.item_name}
      - Commodity Code (if available): ${shipment.commodity_code || 'Not provided'}
      - Declared Value: $${shipment.declared_value}
      - Weight: ${shipment.weight} kg
      - Destination Country: ${shipment.destination_country}
      
      EXISTING RULES IN THE SYSTEM:
      ${ruleDescriptions}
      
      Please provide specific compliance recommendations for shipping this product to ${shipment.destination_country}.
      Focus on:
      1. Documentation requirements specific to this product and destination
      2. Packaging requirements
      3. Labeling requirements
      4. Import duties and taxes expectations
      5. Any special permits or certifications needed
      
      If there are no special requirements beyond standard shipping procedures, state "NO SPECIAL REQUIREMENTS" and provide brief general guidance.
      
      Format your response in HTML paragraphs that can be included directly in a report. Keep it concise (max 250 words) and professional.
    `;

    // Generate a response
    const result = await model.generateContent(prompt);
    const response = result.response;
    const aiPrediction = response.text();

    return NextResponse.json({
      prediction: aiPrediction || "No specific compliance recommendations available at this time.",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error generating compliance prediction:", error);
    return NextResponse.json(
      { error: "Failed to generate compliance prediction" },
      { status: 500 }
    );
  }
}