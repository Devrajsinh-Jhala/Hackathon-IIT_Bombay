// // app/api/compliance/check/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';

// export async function POST(request: NextRequest) {

//     try {
//         const { shipment } = await request.json();

//         if (!shipment) {
//             return NextResponse.json({ error: 'Shipment data is required' }, { status: 400 });
//         }

//         // Get compliance rules from database
//         const { data: rules } = await supabase
//             .from('compliance_rules')
//             .select('*')
//             .eq('is_active', true);

//         // Get restricted countries
//         const { data: restrictedCountries } = await supabase
//             .from('restricted_countries')
//             .select('*');

//         const issues = [];

//         // Check for restricted country
//         const countryRestriction = restrictedCountries?.find(
//             country => country.country_code === shipment.destination_country
//         );

//         if (countryRestriction) {
//             issues.push({
//                 rule_name: 'Restricted Country',
//                 description: `${countryRestriction.country_name} has restriction level: ${countryRestriction.restriction_level}`
//             });
//         }

//         // Check value rules
//         const valueRule = rules?.find(rule => rule.rule_type === 'VALUE');
//         if (valueRule && shipment.declared_value > valueRule.rule_conditions.threshold) {
//             issues.push({
//                 rule_name: 'High Value Shipment',
//                 description: `Value exceeds $${valueRule.rule_conditions.threshold}. Additional documentation required: ${valueRule.rule_conditions.documentation_required.join(', ')}`
//             });
//         }

//         // Check weight rules
//         const weightRule = rules?.find(rule => rule.rule_type === 'WEIGHT');
//         if (weightRule && shipment.weight > weightRule.rule_conditions.max_weight) {
//             issues.push({
//                 rule_name: 'Excess Weight',
//                 description: `Weight exceeds ${weightRule.rule_conditions.max_weight}${weightRule.rule_conditions.unit}. Consider splitting shipment or using specialized shipping service.`
//             });
//         }

//         // Save to database
//         // const { data, error } = await supabase
//         //     .from('shipments')
//         //     .insert({
//         //         item_name: shipment.item_name,
//         //         item_id: shipment.item_id,
//         //         declared_value: shipment.declared_value,
//         //         weight: shipment.weight,
//         //         destination_country: shipment.destination_country,
//         //         commodity_code: shipment.commodity_code,
//         //         sender_details: shipment.sender_name ? {
//         //             name: shipment.sender_name,
//         //             address: shipment.sender_address
//         //         } : null,
//         //         recipient_details: shipment.recipient_name ? {
//         //             name: shipment.recipient_name,
//         //             address: shipment.recipient_address
//         //         } : null,
//         //         compliance_status: issues.length > 0 ? 'FLAGGED' : 'COMPLIANT',
//         //         compliance_issues: issues.length > 0 ? issues : []
//         //     })
//         //     .select()
//         //     .single();

//         // if (error) {
//         //     console.error('Error saving shipment:', error);
//         //     return NextResponse.json({ error: 'Failed to save shipment' }, { status: 500 });
//         // }

//         // Return the compliance result
//         return NextResponse.json({
//             status: issues.length > 0 ? 'FLAGGED' : 'COMPLIANT',
//             shipment,
//             details: issues.length > 0
//                 ? 'Compliance issues detected with this shipment.'
//                 : 'This shipment complies with all regulations.',
//             issues,
//             lastUpdated: new Date().toISOString()
//         });
//     } catch (error) {
//         console.error('API error:', error);
//         return NextResponse.json({ error: 'Failed to check compliance' }, { status: 500 });
//     }
// }


//* new
// app/api/compliance/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Define types to fix the any errors
interface Country {
    country_code: string;
    country_name: string;
    restriction_level: string;
    restriction_reason?: string;
}

interface RuleCondition {
    threshold?: number;
    documentation_required?: string[];
    max_weight?: number;
    unit?: string;
    from_countries?: string[];
    to_countries?: string[];
    tariff_rate?: string;
    effective_date?: string;
}

interface ComplianceRule {
    rule_type: string;
    product_name?: string;
    rule_conditions: RuleCondition;
    description?: string;
    source_link?: string;
    last_verified?: string;
}

interface Shipment {
    item_name: string;
    item_id?: string;
    commodity_code?: string;
    declared_value: number;
    weight: number;
    destination_country: string;
    origin_country?: string;
}

export async function POST(request: NextRequest) {
    try {
        const { shipment } = await request.json() as { shipment: Shipment };

        if (!shipment) {
            return NextResponse.json({ error: 'Shipment data is required' }, { status: 400 });
        }

        // Get compliance rules from database with default empty array to prevent null
        const { data: rules = [] } = await supabase
            .from('compliance_rules')
            .select('*')
            .eq('is_active', true);

        // Get restricted countries with default empty array
        const { data: restrictedCountries = [] } = await supabase
            .from('restricted_countries')
            .select('*');

        const issues = [];

        // Check for restricted country
        const countryRestriction = restrictedCountries?.find(
            (country: Country) => country.country_code === shipment.destination_country
        );

        if (countryRestriction) {
            issues.push({
                rule_name: 'Restricted Country',
                description: `${countryRestriction.country_name} has restriction level: ${countryRestriction.restriction_level}`,
                reason: countryRestriction.restriction_reason || 'Country is restricted'
            });
        }

        // Check value rules
        const valueRule = rules?.find((rule: ComplianceRule) => rule.rule_type === 'VALUE');
        if (valueRule && valueRule.rule_conditions?.threshold &&
            shipment.declared_value > valueRule.rule_conditions.threshold) {

            const documentation = valueRule.rule_conditions.documentation_required || ['Commercial Invoice'];

            issues.push({
                rule_name: 'High Value Shipment',
                description: `Value exceeds $${valueRule.rule_conditions.threshold}. Additional documentation required: ${documentation.join(', ')}`
            });
        }

        // Check weight rules
        const weightRule = rules?.find((rule: ComplianceRule) => rule.rule_type === 'WEIGHT');
        if (weightRule && weightRule.rule_conditions?.max_weight &&
            shipment.weight > weightRule.rule_conditions.max_weight) {

            const unit = weightRule.rule_conditions.unit || 'kg';

            issues.push({
                rule_name: 'Excess Weight',
                description: `Weight exceeds ${weightRule.rule_conditions.max_weight}${unit}. Consider splitting shipment or using specialized shipping service.`
            });
        }

        // Check product-specific rules
        const itemName = shipment.item_name?.toLowerCase() || '';

        // Find rules that match this product
        const productRules = rules?.filter((rule: ComplianceRule) => {
            if (!rule.product_name) return false;

            const productName = rule.product_name.toLowerCase();
            // Check if the shipment item contains this product or vice versa
            return (
                itemName.includes(productName) ||
                productName.includes(itemName)
            );
        });

        // Apply any matching product rules
        for (const rule of productRules!) {
            // Check if the rule applies to this shipment
            let ruleApplies = true;

            // Check destination country restrictions
            if (rule.rule_conditions?.to_countries && rule.rule_conditions.to_countries.length > 0) {
                const destinationMatches = rule.rule_conditions.to_countries.some((country: string) => {
                    if (!country) return false;
                    return country.toLowerCase() === shipment.destination_country.toLowerCase();
                });

                if (!destinationMatches) {
                    ruleApplies = false;
                }
            }

            // Check origin country restrictions
            if (ruleApplies && rule.rule_conditions?.from_countries &&
                rule.rule_conditions.from_countries.length > 0 && shipment.origin_country) {

                const originMatches = rule.rule_conditions.from_countries.some((country: string) => {
                    if (!country) return false;
                    return country.toLowerCase() === shipment.origin_country!.toLowerCase();
                });

                if (!originMatches) {
                    ruleApplies = false;
                }
            }

            // If rule applies, add to issues
            if (ruleApplies) {
                // Create detailed description with available information
                let ruleDetails = rule.description || `Trade restriction applies to ${rule.product_name}`;

                if (rule.rule_conditions?.tariff_rate) {
                    ruleDetails += ` Tariff rate: ${rule.rule_conditions.tariff_rate}`;
                }

                if (rule.rule_conditions?.effective_date) {
                    ruleDetails += ` Effective: ${rule.rule_conditions.effective_date}`;
                }

                issues.push({
                    rule_name: `${rule.rule_type} on ${rule.product_name}`,
                    description: ruleDetails,
                    source_link: rule.source_link || null,
                    last_verified: rule.last_verified || null
                });
            }
        }

        // Return the compliance result
        return NextResponse.json({
            status: issues.length > 0 ? 'FLAGGED' : 'COMPLIANT',
            shipment,
            details: issues.length > 0
                ? 'Compliance issues detected with this shipment.'
                : 'This shipment complies with all regulations.',
            issues,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('API error:', error);
        return NextResponse.json({ error: 'Failed to check compliance' }, { status: 500 });
    }
}