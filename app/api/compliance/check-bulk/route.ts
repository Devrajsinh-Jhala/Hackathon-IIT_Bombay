import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Prevent caching to ensure fresh data on each request
// export const dynamic = "force-dynamic";

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// Initialize Gemini AI if API key is available
const genAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

export async function POST(request: Request) {
    try {
        const { shipments } = await request.json();

        // Validate input data
        if (!shipments || !Array.isArray(shipments) || shipments.length === 0) {
            return NextResponse.json(
                { error: "Invalid data format. Expected a non-empty array of shipments." },
                { status: 400 }
            );
        }

        // Log received data for debugging
        console.log("First shipment:", shipments[0]);

        // Fetch all active compliance rules from Supabase
        const { data: rules, error } = await supabase
            .from("compliance_rules")
            .select("*")
            .eq("is_active", true);

        if (error) {
            console.error("Error fetching compliance rules:", error);
            return NextResponse.json(
                { error: "Failed to fetch compliance rules from the database." },
                { status: 500 }
            );
        }

        // Debug: Log rules retrieved
        console.log("Rules retrieved:", rules.map(r => ({
            name: r.rule_name,
            max_value: r.max_value,
            is_active: r.is_active
        })));

        // Process shipments (up to 100 at a time for better performance)
        const results = [];
        const batchSize = 100;

        for (let i = 0; i < shipments.length; i += batchSize) {
            const batchShipments = shipments.slice(i, i + batchSize);

            // Process each shipment in the batch
            const batchPromises = batchShipments.map(async (shipment) => {
                // Check shipment against all rules
                const issues = [];

                for (const rule of rules) {
                    let isViolated = false;
                    let violationReason = "";

                    // Check value limits with explicit type conversion
                    if (rule.max_value !== null) {
                        const maxValue = Number(rule.max_value);
                        const declaredValue = Number(shipment.declared_value);

                        if (!isNaN(maxValue) && !isNaN(declaredValue) && declaredValue > maxValue) {
                            isViolated = true;
                            violationReason = `Value exceeds limit: $${declaredValue} > $${maxValue}`;
                        }
                    }

                    if (rule.min_value !== null) {
                        const minValue = Number(rule.min_value);
                        const declaredValue = Number(shipment.declared_value);

                        if (!isNaN(minValue) && !isNaN(declaredValue) && declaredValue < minValue) {
                            isViolated = true;
                            violationReason = `Value below minimum: $${declaredValue} < $${minValue}`;
                        }
                    }

                    // Check weight limits with explicit type conversion
                    if (rule.max_weight !== null) {
                        const maxWeight = Number(rule.max_weight);
                        const weight = Number(shipment.weight);

                        if (!isNaN(maxWeight) && !isNaN(weight) && weight > maxWeight) {
                            isViolated = true;
                            violationReason = `Weight exceeds limit: ${weight}kg > ${maxWeight}kg`;
                        }
                    }

                    if (rule.min_weight !== null) {
                        const minWeight = Number(rule.min_weight);
                        const weight = Number(shipment.weight);

                        if (!isNaN(minWeight) && !isNaN(weight) && weight < minWeight) {
                            isViolated = true;
                            violationReason = `Weight below minimum: ${weight}kg < ${minWeight}kg`;
                        }
                    }

                    // Check restricted countries (case insensitive)
                    if (rule.restricted_countries && Array.isArray(rule.restricted_countries)) {
                        const destination = String(shipment.destination_country).toUpperCase();
                        if (rule.restricted_countries.map((c: any) => String(c).toUpperCase()).includes(destination)) {
                            isViolated = true;
                            violationReason = `Shipping to restricted country: ${shipment.destination_country}`;
                        }
                    }

                    // Check restricted items (case insensitive)
                    if (rule.restricted_items && Array.isArray(rule.restricted_items)) {
                        const itemName = String(shipment.item_name).toLowerCase();
                        const matchedItems = rule.restricted_items.filter((item: any) =>
                            itemName.includes(String(item).toLowerCase())
                        );

                        if (matchedItems.length > 0) {
                            isViolated = true;
                            violationReason = `Item contains restricted keywords: ${matchedItems.join(', ')}`;
                        }
                    }

                    // If rule is violated, add to issues
                    if (isViolated) {
                        issues.push({
                            rule_name: rule.rule_name,
                            description: rule.description || "Compliance rule violation",
                            details: violationReason
                        });
                    }
                }

                // Determine compliance status
                const status = issues.length > 0 ? "FLAGGED" : "COMPLIANT";

                // Return result for this shipment
                return {
                    status,
                    shipment,
                    details: status === "COMPLIANT"
                        ? "Shipment is compliant with all rules."
                        : `Shipment is flagged for ${issues.length} issue(s).`,
                    issues,
                    lastUpdated: new Date().toISOString()
                };
            });

            // Wait for all shipments in this batch to be processed
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error("Error processing bulk compliance check:", error);
        return NextResponse.json(
            { error: "Failed to process compliance check." },
            { status: 500 }
        );
    }
}