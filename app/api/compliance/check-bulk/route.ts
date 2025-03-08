// async function delay(ms: number) {
//     return new Promise(resolve => setTimeout(resolve, ms));
//   }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

// Prevent caching to ensure fresh data on each request
export const dynamic = "force-dynamic";

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

        // Fetch all active compliance rules from Supabase
        const { data: rules, error: rulesError } = await supabase
            .from("compliance_rules")
            .select("*")
            .eq("is_active", true);

        if (rulesError) {
            console.error("Error fetching compliance rules:", rulesError);
            return NextResponse.json(
                { error: "Failed to fetch compliance rules from the database." },
                { status: 500 }
            );
        }

        // Fetch restricted countries
        const { data: restrictedCountries, error: countriesError } = await supabase
            .from("restricted_countries")
            .select("*");

        if (countriesError) {
            console.error("Error fetching restricted countries:", countriesError);
            return NextResponse.json(
                { error: "Failed to fetch restricted countries from the database." },
                { status: 500 }
            );
        }

        // Fetch restricted items from the new table
        const { data: restrictedItems, error: itemsError } = await supabase
            .from("restricted_items")
            .select("*");

        if (itemsError) {
            console.error("Error fetching restricted items:", itemsError);
            return NextResponse.json(
                { error: "Failed to fetch restricted items from the database." },
                { status: 500 }
            );
        }

        // Extract country codes and prepare for comparison
        const restrictedCountryCodes = restrictedCountries.map(entry => entry.country_code || entry.code || entry.country_name);

        console.log("Rules retrieved:", rules.length);
        console.log("Restricted countries retrieved:", restrictedCountryCodes.length);
        console.log("Restricted items retrieved:", restrictedItems.length);

        // Process shipments (up to 100 at a time for better performance)
        const results = [];
        const batchSize = 100;

        for (let i = 0; i < shipments.length; i += batchSize) {
            const batchShipments = shipments.slice(i, i + batchSize);
            const batchPromises = batchShipments.map(async (shipment) => {
                // Check shipment against all rules
                const issues = [];

                // FIRST PRIORITY CHECK: Check if item is in restricted items list
                const itemNameLower = shipment.item_name.toLowerCase();
                const restrictedItem = restrictedItems.find(item =>
                    itemNameLower.includes(item.item_name.toLowerCase())
                );

                if (restrictedItem) {
                    // Create a high-priority flag for restricted items
                    const severity = restrictedItem.severity || "RESTRICTED";
                    const requirements = restrictedItem.requirements
                        ? `. ${restrictedItem.requirements}`
                        : "";

                    issues.push({
                        rule_name: `${severity} ITEM`,
                        description: `This item (${shipment.item_name}) matches a ${severity.toLowerCase()} item: ${restrictedItem.item_name}. ${restrictedItem.description || ""}${requirements}`,
                        priority: 'HIGH'
                    });

                    // If the item is PROHIBITED, we can skip other checks
                    if (severity === 'PROHIBITED') {
                        return {
                            status: "REJECTED",
                            shipment,
                            details: `Shipment contains prohibited item: ${restrictedItem.item_name}. Export is not allowed.`,
                            issues,
                            lastUpdated: new Date().toISOString()
                        };
                    }
                }

                // Check value threshold rule
                const valueRule = rules.find(rule => rule.rule_type === 'VALUE');
                if (valueRule && valueRule.rule_conditions?.threshold &&
                    Number(shipment.declared_value) > Number(valueRule.rule_conditions.threshold)) {

                    const documentation = valueRule.rule_conditions.documentation_required || ['Commercial Invoice'];

                    issues.push({
                        rule_name: 'High Value Shipment',
                        description: `Value exceeds $${valueRule.rule_conditions.threshold}. Additional documentation required: ${documentation.join(', ')}`,
                        priority: 'MEDIUM'
                    });
                }

                // Check weight threshold rule
                const weightRule = rules.find(rule => rule.rule_type === 'WEIGHT');
                if (weightRule && weightRule.rule_conditions?.threshold &&
                    Number(shipment.weight) > Number(weightRule.rule_conditions.threshold)) {

                    const documentation = weightRule.rule_conditions.documentation_required || ['Weight Certificate'];

                    issues.push({
                        rule_name: 'Heavy Shipment',
                        description: `Weight exceeds ${weightRule.rule_conditions.threshold} kg. Additional documentation required: ${documentation.join(', ')}`,
                        priority: 'MEDIUM'
                    });
                }

                // Check restricted items from rule_conditions (for backward compatibility)
                const restrictedItemsRule = rules.find(rule => rule.rule_type === 'RESTRICTED_ITEMS');
                if (restrictedItemsRule && restrictedItemsRule.rule_conditions?.items) {
                    const ruleRestrictedItems = restrictedItemsRule.rule_conditions.items;

                    for (const item of ruleRestrictedItems) {
                        if (itemNameLower.includes(item.toLowerCase())) {
                            issues.push({
                                rule_name: 'Restricted Item',
                                description: `Shipment contains a restricted item: ${item}. Additional permits may be required.`,
                                priority: 'MEDIUM'
                            });
                            break;
                        }
                    }
                }

                // Check if destination is in restricted countries list
                const destinationCountry = shipment.destination_country.trim();

                if (restrictedCountryCodes.some(code => code.trim().toUpperCase() === destinationCountry.toUpperCase())) {
                    issues.push({
                        rule_name: 'Restricted Destination',
                        description: `Shipping to ${shipment.destination_country} is restricted. Additional documentation or permits required.`,
                        priority: 'HIGH'
                    });
                }

                // Determine compliance status
                let status = "COMPLIANT";
                let details = "Shipment is compliant with all rules.";

                if (issues.length > 0) {
                    // Check if there are any HIGH priority issues
                    const hasHighPriorityIssues = issues.some(issue => issue.priority === 'HIGH');
                    status = hasHighPriorityIssues ? "FLAGGED" : "FLAGGED";
                    details = `Shipment is flagged for ${issues.length} issue(s).`;
                }

                // Return result for this shipment
                return {
                    status,
                    shipment,
                    details,
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