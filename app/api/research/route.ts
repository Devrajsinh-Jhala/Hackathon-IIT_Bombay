// app/api/research/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configure Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Define interface types
interface TradeAlert {
    alertId: string;
    summary: string;
    product: string;
    restrictionType: string;
    fromCountries: string[];
    toCountries: string[];
    tariffRate: string | null;
    effectiveDate: string;
    datePublished: string;
    source: string;
    title: string;
    link: string;
    confidence: number;
}

interface AlertResponse {
    success: boolean;
    processed: number;
    newAlerts: TradeAlert[];
    forwarded: boolean;
    forwardingDetails: {
        success: boolean;
        reason: string;
    };
    dataSource: string;
    timestamp: string;
}

export async function POST(request: NextRequest) {
    try {
        const alertData: AlertResponse = await request.json();
        console.log(`Received ${alertData.newAlerts.length} alerts from ${alertData.dataSource}`);

        // Filter for relevant alerts only - INCLUDE simulated for testing
        const relevantAlerts = alertData.newAlerts.filter(alert =>
            // Focus on ban/restriction type alerts 
            alert.restrictionType === "ban/restriction" &&
            // Only process fairly confident alerts
            alert.confidence >= 85
        );

        console.log(`${relevantAlerts.length} relevant alerts found for processing`);

        if (relevantAlerts.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No relevant alerts to process",
                processed: 0
            });
        }

        // Process each relevant alert
        const processPromises = relevantAlerts.map(alert => processAlert(alert));
        const results = await Promise.allSettled(processPromises);

        // Count successful processes
        const successful = results.filter(r =>
            r.status === "fulfilled" && r.value.success
        ).length;

        return NextResponse.json({
            success: true,
            message: `Successfully processed ${successful} of ${relevantAlerts.length} alerts`,
            processed: successful
        });

    } catch (error) {
        console.error("Error processing research alerts:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to process alerts",
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

async function processAlert(alert: TradeAlert) {
    try {
        console.log(`Processing alert: ${alert.alertId} - ${alert.title}`);

        // Check if we've already processed this alert
        const { data: existingAlert } = await supabase
            .from('processed_alerts')
            .select('*')
            .eq('alert_id', alert.alertId)
            .single();

        if (existingAlert) {
            console.log(`Alert ${alert.alertId} was already processed`);
            return { success: false, reason: "ALREADY_PROCESSED" };
        }

        // Use Gemini for deep search and validation
        const verificationResult = await verifyWithGemini(alert);
        console.log(`Gemini verification result: ${verificationResult.shouldRestrict ? "RESTRICT" : "IGNORE"}`);

        // If verification suggests we should restrict this item
        if (verificationResult.shouldRestrict) {
            await addToRestrictedItems(alert, verificationResult);
            console.log(`Added ${alert.product} to restricted items table`);
        }

        // Record this alert as processed
        await supabase.from('processed_alerts').insert([{
            alert_id: alert.alertId,
            processed_at: new Date().toISOString(),
            result: verificationResult
        }]);

        return {
            success: true,
            restricted: verificationResult.shouldRestrict
        };
    } catch (error) {
        console.error(`Error processing alert ${alert.alertId}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

async function verifyWithGemini(alert: TradeAlert) {
    const prompt = `
    Research the following trade restriction and determine if it should be added to our restricted items database:
    
    ALERT DETAILS:
    Product/Item: ${alert.product}
    Restriction Type: ${alert.restrictionType}
    From Countries: ${alert.fromCountries.join(', ')}
    To Countries: ${alert.toCountries.join(', ')}
    Source: ${alert.source}
    Title: "${alert.title}"
    Summary: "${alert.summary}"
    
    Please verify:
    1. Is this a genuine trade restriction based on reliable sources?
    2. What is the exact scope of products affected?
    3. Is this a total ban (PROHIBITED) or a conditional restriction (RESTRICTED)?
    4. What specific requirements exist for complying with this restriction?
    5. What category would these items fall under (e.g., TECHNOLOGY, WEAPONS, etc.)?
    
    RESPOND WITH JSON ONLY:
    {
      "isGenuine": boolean,
      "scope": "string describing exact products affected",
      "severity": "PROHIBITED" or "RESTRICTED",
      "requirements": "string explaining compliance requirements",
      "category": "string category name",
      "shouldRestrict": boolean,
      "reasoning": "explanation for your decision"
    }
  `;

    try {
        // Call Gemini API with retry logic
        let attempts = 0;
        const maxAttempts = 3;
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

                return JSON.parse(jsonMatch[0]);
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
        throw lastError;
    } catch (error) {
        console.error("Error with Gemini verification:", error);
        // Return a default object when Gemini fails
        return {
            isGenuine: false,
            scope: alert.product,
            severity: "RESTRICTED",
            requirements: "Verification failed, manual review required",
            category: "UNVERIFIED",
            shouldRestrict: false,
            reasoning: `Could not verify due to API error: ${error}`
        };
    }
}

async function addToRestrictedItems(alert: TradeAlert, verification: any) {
    // Create the restricted item entry
    const restrictedItem = {
        item_name: verification.scope || alert.product,
        description: `${verification.severity === "PROHIBITED" ? "Ban" : "Restriction"} on ${alert.product} from ${alert.fromCountries.join(', ')} to ${alert.toCountries.join(', ')}. ${verification.reasoning || ""}`,
        category: verification.category || "GENERAL",
        severity: verification.severity || "RESTRICTED",
        requirements: verification.requirements || null,
        source_link: alert.link,
        effective_date: alert.effectiveDate,
        created_at: new Date().toISOString()
    };

    // Insert into database
    const { error } = await supabase
        .from('restricted_items')
        .insert([restrictedItem]);

    if (error) {
        console.error("Failed to insert restricted item:", error);
        throw error;
    }
}